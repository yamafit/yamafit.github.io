// 毎朝の「記事の写真」と「Instagram投稿」（.github/workflows/daily-image.yml から実行）
//
//   node tools/daily-image-post.mjs plan        今日やることを判定（GitHub Actions の出力 need_image / need_ig）
//   node tools/daily-image-post.mjs image       今日の記事の写真を作り、記事に入れてサイトを作り直す
//   node tools/daily-image-post.mjs prep        手作業用：参照シート・プロンプト・キャプションを out/daily に作る（.github/workflows/daily-prep.yml）
//   node tools/daily-image-post.mjs instagram   その写真と記事の内容・URLで Instagram に投稿し、data/ig-posts.json に記録
//   node tools/daily-image-post.mjs noon-prep   昼の投稿用に、今週の7選とは別の商品を1つ選び、参照シート・プロンプト・投稿文を out/noon に作る（data/noon-picks.json に記録）
//   node tools/daily-image-post.mjs noon-instagram  昼の写真（data/product-images.json に登録済み）で Instagram に投稿
//   node tools/daily-image-post.mjs reel        今日の朝（無ければ昼）の写真からリール動画を作って投稿（.github/workflows/reel-post.yml、19:00）
//
// 写真の作り方（プロンプト工房と同じ）:
//   1. 記事の商品の公式画像を使う。記事を書いたAIが公式ページで調べた ref_images（main＝商品全体、detail＝細部3枚まで）を優先し、
//      無ければ商品マスターの image.url、さらに無ければ公式ページの og:image
//   2. その画像と正式名称で「参照シート」を描く（tools/kobo-core.js。カテゴリー＝靴・ザック・ウェア）
//   3. 同じ文面のプロンプト＋参照シートを OpenAI の画像生成（ChatGPT と同じ画像モデル）に渡す
//   4. できた画像を img/articles/<slug>.jpg に保存し、記事の写真にする（「AIで作成したイメージ」と明記）
//
// 環境変数: OPENAI_API_KEY（必須）, OPENAI_IMAGE_MODEL（既定 gpt-image-2）, OPENAI_IMAGE_QUALITY（既定 high）,
//           INSTAGRAM_ACCESS_TOKEN（投稿に必須）, ARTICLE_SLUG（日付ではなく記事を指定するとき）,
//           REF_IMAGE_FILE（公式画像の代わりに使うローカル画像。テスト用）, DRY_RUN=1（APIを呼ばない）
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import "./kobo-core.js";
const KOBO = globalThis.KOBO;

const AUTO = "content/auto-articles.json";
const POSTS = "data/ig-posts.json";
const SIZE = { w: 1280, h: 1600, aspect: "4:5" }; // Instagram のフィードに収まる縦長（4:5）。記事でも同じ画像を使う
const today = process.env.TODAY || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const siteSrc = fs.readFileSync("js/site.js", "utf8");
const SITE_URL = (siteSrc.match(/url:\s*"([^"]+)"/) || [])[1] || "https://yamafit.github.io/";
const DRY = process.env.DRY_RUN === "1";
const readJSON = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const log = (...a) => console.log("・", ...a);
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); console.log(`${k}=${v}`); };

const articles = readJSON(AUTO, []);
const posts = readJSON(POSTS, {});
const article = process.env.ARTICLE_SLUG ? articles.find((a) => a.slug === process.env.ARTICLE_SLUG) : articles.filter((a) => a.date === today).sort((a, b) => (a.day ?? 0) - (b.day ?? 0))[0];
const masters = fs.readdirSync("data/master").filter((f) => f.endsWith(".json") && !f.includes(" ")).flatMap((f) => readJSON(`data/master/${f}`, { products: [] }).products || []);
const product = article && masters.find((p) => p.id === (article.products || [])[0]);
const slotToCat = (a, p) => ({ outer: "outer", pack: "pack", shoes: "shoes" }[a.slot] || ({ boots: "shoes", pack: "pack" }[p?.category] || "outer"));

// ---------- plan ----------
function plan() {
  if (!article) { log(`${today} の記事はまだありません`); out("need_image", "false"); out("need_ig", "false"); return; }
  log("記事:", article.slug, article.title);
  out("slug", article.slug);
  const hasKey = !!process.env.OPENAI_API_KEY, hasToken = !!process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!article.image && !hasKey) console.log("::warning::OPENAI_API_KEY が未登録のため、記事の写真を作れません（Settings → Secrets and variables → Actions）");
  if (!posts[article.slug] && !hasToken) console.log("::warning::INSTAGRAM_ACCESS_TOKEN が未登録のため、Instagram に投稿できません（Settings → Secrets and variables → Actions）");
  out("need_image", String(!article.image && hasKey));
  out("need_ig", String(!posts[article.slug] && hasToken && (!!article.image || hasKey)));
}

// ---------- 公式画像を調べる ----------
async function fetchBuf(url, referer) {
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", accept: "image/avif,image/webp,image/*,*/*;q=0.8", ...(referer ? { referer } : {}) } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "" };
}
async function findReferenceImage(a, p) {
  if (process.env.REF_IMAGE_FILE) return { buf: fs.readFileSync(process.env.REF_IMAGE_FILE), from: process.env.REF_IMAGE_FILE };
  const refs = a.ref_images || [];
  const page = (refs[0] && refs[0].page) || (p.image && p.image.src_page) || ((p.sources || [])[0] || {}).url || ((p.offers || []).find((o) => o.shop === "official") || {}).url;
  const tries = [];
  for (const r of refs.filter((r) => r.role === "main")) tries.push(r.url);
  if (p.image && p.image.url) tries.push(p.image.url);
  for (const url of tries) {
    try { const r = await fetchBuf(url, page); if (r.type.startsWith("image/") && r.buf.length > 5000) return { buf: r.buf, from: url }; } catch (e) { log("画像を取得できません:", e.message); }
  }
  if (page) { // 公式ページの og:image / twitter:image を探す
    try {
      const html = (await fetchBuf(page)).buf.toString("utf8");
      const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
      if (m) { const url = new URL(m[1].replace(/&amp;/g, "&"), page).href; const r = await fetchBuf(url, page); if (r.type.startsWith("image/")) return { buf: r.buf, from: url }; }
    } catch (e) { log("公式ページから画像を探せません:", e.message); }
  }
  throw new Error("商品の公式画像が見つかりませんでした（商品マスターの image.url と公式ページを確認してください）");
}
async function findDetailImages(a) { // 細部の確認用（記事を書いたAIが公式ページで選んだもの）
  const out = [];
  for (const r of (a.ref_images || []).filter((r) => r.role === "detail").slice(0, 3)) {
    try { const x = await fetchBuf(r.url, r.page); if (x.type.startsWith("image/") && x.buf.length > 3000) out.push({ buf: x.buf, type: x.type, note: r.note || "", from: r.url }); }
    catch (e) { log("細部の画像を取得できません:", e.message); }
  }
  return out;
}
const detailNote = (details) => details.length ? `\n\n追加の参照画像について\n\n2枚目以降の添付画像（${details.length}枚）は、同じ商品のメーカー公式の細部写真です（${details.map((d, i) => `${i + 2}枚目：${d.note || "細部"}`).join("、")}）。ディテール拡大図と指示線の位置を正しくするための確認用としてだけ使い、写真そのものや人物・背景を完成画像に貼り込まないでください。` : "";

// ---------- 参照シートとプロンプト ----------
// ---------- 事前に確認した内容（記事・公式の記載から。ChatGPT が事実と違うことを書かないように） ----------
const GENDER_TXT = { mens: "メンズモデル（レディースは別の品番。ユニセックスではない）", womens: "レディースモデル（メンズは別の品番。ユニセックスではない）", unisex: "ユニセックス（男女兼用）" };
const clip = (t, n) => { t = String(t || "").trim(); if (t.length <= n) return t; const c = t.slice(0, n); const i = Math.max(c.lastIndexOf("、"), c.lastIndexOf("。")); return (i > n * 0.5 ? c.slice(0, i) : c) + "など"; };
const clean = (t) => String(t || "").replace(/（公式記載）|と記載(されています)?|（[^）]*(より|によると|調べ)[^）]*）/g, "").replace(/公式ページ(によると|では|で)、?/g, "").trim();
const firstSentence = (t) => clip(clean(String(t || "").split(/(?<=。)/)[0].replace(/[A-Za-z]+(Lab|Hiker|REI)[^、。]*[、]?/g, "")), 70);
const specFeats = (rows, head = []) => rows.map((r) => {
  const k = r[0], v = r.length > 2 && head.length === r.length ? r.slice(1).map((x, i) => `${head[i + 1]} ${x}`).join("、") : r.slice(1).join("・");
  if (/容量/.test(k)) return { h: r.length > 2 ? "サイズで選べる容量" : `容量${v}`, b: v };
  if (/素材|生地/.test(k)) return { h: "本体素材", b: clip(v, 60) };
  if (/重量|重さ/.test(k)) return { h: "重量", b: v };
  if (/防水|透湿/.test(k)) return { h: "防水透湿", b: clip(v, 60) };
  return null;
}).filter(Boolean);
function ngWords(p, texts) {
  const t = texts.join(" ");
  const ng = [];
  if (/重い|重め|重量がある|重さが(気|目立)/.test(t)) ng.push("軽量", "軽い", "超軽量");
  if (p.gender && p.gender !== "unisex") ng.push("ユニセックス", "男女兼用");
  if (!p.waterproof && !/防水/.test(String(p.material || ""))) ng.push("防水");
  if (/レインカバー[^。]*(記載がな|付属な|別売|別に用意)/.test(t)) ng.push("レインカバー付き", "レインカバー内蔵");
  if (!/オールシーズン|通年|一年中/.test(t)) ng.push("オールシーズン");
  return [...new Set(ng)];
}
function factsFromArticle(a, p) {
  const SKIP = /スペック|仕様|デメリット|注意|向いて|まとめ|基本|価格|サイズ|導入|はじめに|概要|結論/;
  const feats = (a.sections || []).filter((x) => !SKIP.test(x.h)).map((x) => ({ h: x.h.replace(/^特徴とメリット$/, ""), b: firstSentence((x.p || [])[0]) })).filter((x) => x.h);
  const msec = (a.sections || []).find((x) => /メリット|特徴/.test(x.h) && !/デメリット/.test(x.h) && (x.ul || x.p)) || {};
  const merit = msec.ul || [];
  if (!msec.ul && msec.p) msec.p.forEach((t) => { const [h, ...rest] = String(t).split("。"); if (h && h.length <= 30 && feats.length < 6) feats.push({ h, b: clip(clean(rest.join("。")).split("。")[0], 60) }); });
  merit.forEach((m) => { if (feats.length < 6) feats.push({ h: String(m).split(/[、。：]/)[0].slice(0, 26), b: clip(clean(m), 60) }); });
  const spec = (a.sections || []).find((x) => x.table && /スペック|仕様/.test(x.h));
  if (spec) specFeats(spec.table.rows, spec.table.head).forEach((f) => { if (feats.length < 6 && !feats.some((x) => x.h === f.h)) feats.push(f); });
  const con = (a.sections || []).find((x) => /デメリット|注意/.test(x.h)) || {};
  const cautions = (con.ul || con.p || []).map((t) => String(t).split("：")[0].slice(0, 40));
  const fit = (a.sections || []).find((x) => /向いて/.test(x.h)) || {};
  const goodFor = (fit.good || ((fit.p || [])[1] && /向いていない/.test(fit.p[1]) ? (fit.ul || []).slice(0, Math.ceil((fit.ul || []).length / 2)) : fit.ul) || []).slice(0, 2).map((t) => String(t).slice(0, 40));
  const texts = (a.sections || []).flatMap((x) => [...(x.p || []), ...(x.ul || [])]);
  return { target: GENDER_TXT[p.gender] || "", catch: (a.title.split("：")[1] || a.title).slice(0, 30), features: feats.slice(0, 6), cautions: cautions.slice(0, 3), goodFor, ng: ngWords(p, texts) };
}
function factsFromProduct(p) {
  const e = p.evaluation || {};
  const pros = (e.pros || []).filter((x) => !/^不明|カテゴリ$|^[A-Z]+カテゴリ/.test(x));
  const feats = pros.slice(0, 6).map((x) => { const t = clean(x); const h = t.split(/[（(、。]/)[0].slice(0, 26); return { h, b: t === h ? "" : clip(t, 60) }; });
  const key = (t) => String(t).replace(/[\s,，、。約()（）]/g, "").slice(0, 10);
  const add = (h, b) => { if (b && feats.length < 6 && !feats.some((x) => x.b.includes(b) || x.h.includes(h) || (x.h + x.b).includes(key(b)) || key(x.h).includes(key(b)))) feats.push({ h, b }); };
  add("重量", p.weight_g ? `約${p.weight_g.toLocaleString()}g${p.weight_note && !/^約?[\d,.]+\s?g/.test(p.weight_note) ? "（" + p.weight_note.replace(/[（）()]/g, "") + "）" : ""}` : "");
  add("素材", clip(p.material, 60));
  add("防水・撥水", p.waterproof || "");
  add("容量", p.capacity_l ? p.capacity_l + "L" : "");
  add("保温", clip(p.warmth, 50));
  return { target: GENDER_TXT[p.gender] || "", catch: clip(clean(e.summary || ""), 30), features: feats,
    cautions: (e.cons || []).filter((x) => !/^不明/.test(x)).slice(0, 3), goodFor: (e.good_for || []).slice(0, 2), ng: ngWords(p, [...(e.cons || []), ...(e.pros || []), e.summary || ""]) };
}

function inputFor(a, p, cat) {
  const spec = (a.sections || []).find((s) => s.table && /スペック|仕様/.test(s.h));
  const head = spec ? spec.table.head || [] : [];
  const rows = spec ? spec.table.rows.map((r) => (r.length > 2 && head.length === r.length ? `${r[0]}：${r.slice(1).map((v, i) => `${head[i + 1]} ${v}`).join("、")}` : r.join("："))) : []; // サイズ別の列は「SM/MD 28L、MD/LG 30L」のように
  const num = rows.find((r) => /^(品番|型番)：/.test(r));
  const official = (p.image && p.image.src_page) || ((p.sources || [])[0] || {}).url || "";
  const d = { brand: p.brand, model: p.name + (num ? `（${num.split("：")[1]}）` : ""), modelJa: "", color: "", source: [official, ...rows].filter(Boolean).join("\n"), reader: "", usage: "", aspect: SIZE.aspect, attach: "sheet", fixed: true, full: false };
  for (const [id] of KOBO.CATS[cat].specs) d[id] = "";
  d.facts = factsFromArticle(a, p);
  return d;
}
async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright"].filter(Boolean)) { try { return await import(m); } catch {} }
  throw new Error("playwright が見つかりません（npm i playwright）");
}
async function renderSheet(d, cat, refBuf) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><meta charset=utf-8><body></body>");
    await page.addScriptTag({ content: fs.readFileSync("tools/kobo-core.js", "utf8") });
    const dataUrl = "data:image/png;base64," + refBuf.toString("base64");
    const png = await page.evaluate(async ({ d, cat, dataUrl }) => {
      const CF = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","Noto Sans JP","Noto Sans CJK JP",sans-serif';
      const img = new Image(); img.src = dataUrl; await img.decode();
      const cv = document.createElement("canvas"), mctx = document.createElement("canvas").getContext("2d");
      const plain = KOBO.plain(KOBO.buildPrompt(d, cat));
      KOBO.renderSheet(cv, mctx, d, cat, img, plain, CF);
      return cv.toDataURL("image/png").split(",")[1];
    }, { d, cat, dataUrl });
    return Buffer.from(png, "base64");
  } finally { await browser.close(); }
}

// ---------- 画像生成（OpenAI Images API：ChatGPT と同じ画像モデル） ----------
async function generateImage(prompt, sheetPng, details = []) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY が未設定です（GitHub の Settings → Secrets に登録してください）");
  const fd = new FormData();
  fd.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
  fd.append("prompt", prompt);
  fd.append("size", `${SIZE.w}x${SIZE.h}`);
  fd.append("quality", process.env.OPENAI_IMAGE_QUALITY || "high");
  fd.append("output_format", "jpeg");
  fd.append("n", "1");
  fd.append("image[]", new Blob([sheetPng], { type: "image/png" }), "reference-sheet.png");
  details.forEach((d, i) => fd.append("image[]", new Blob([d.buf], { type: /png|webp/.test(d.type) ? d.type.split(";")[0] : "image/jpeg" }), `detail-${i + 1}.${/png/.test(d.type) ? "png" : /webp/.test(d.type) ? "webp" : "jpg"}`));
  const r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: fd, signal: AbortSignal.timeout(600e3) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`画像生成に失敗しました（${r.status}）: ${(j.error && j.error.message) || JSON.stringify(j).slice(0, 300)}`);
  const b64 = j.data && j.data[0] && j.data[0].b64_json;
  if (!b64) throw new Error("画像生成の結果に画像がありません");
  return Buffer.from(b64, "base64");
}

// 手作業用：参照シート・プロンプト・キャプションだけを out/daily に作る（画像生成は人が ChatGPT で行う）
async function prep() {
  if (!article) return log("記事がないので何もしません");
  if (!product) throw new Error(`記事の商品がマスターにありません: ${(article.products || []).join(",")}`);
  const cat = slotToCat(article, product);
  const d = inputFor(article, product, cat);
  const ref = await findReferenceImage(article, product);
  log("参照した公式画像:", ref.from);
  const details = await findDetailImages(article);
  const prompt = KOBO.plain(KOBO.buildPrompt(d, cat));
  const sheet = await renderSheet(d, cat, ref.buf);
  fs.mkdirSync("out/daily", { recursive: true });
  fs.writeFileSync(`out/daily/sheet.png`, sheet);
  fs.writeFileSync(`out/daily/prompt.txt`, prompt);
  fs.writeFileSync(`out/daily/caption.txt`, buildCaption(article, product));
  details.forEach((x, i) => fs.writeFileSync(`out/daily/detail-${i + 1}.jpg`, x.buf));
  fs.writeFileSync(`out/daily/info.json`, JSON.stringify({ slug: article.slug, date: article.date, title: article.title, product: `${product.brand} ${product.name}`, category: KOBO.CATS[cat].title, ref: ref.from, details: details.map((x) => ({ url: x.from, note: x.note })), at: new Date().toISOString() }, null, 1));
  log(`準備しました: ${article.slug}（${KOBO.CATS[cat].title}・プロンプト${prompt.length}字・細部写真${details.length}枚）`);
}

async function image() {
  if (!article) return log("記事がないので何もしません");
  if (article.image && !process.env.FORCE) return log("この記事にはもう写真があります:", article.image);
  if (!product) throw new Error(`記事の商品がマスターにありません: ${(article.products || []).join(",")}`);
  const cat = slotToCat(article, product);
  const d = inputFor(article, product, cat);
  const ref = await findReferenceImage(article, product);
  log("参照した公式画像:", ref.from);
  const details = await findDetailImages(article);
  if (details.length) log("細部の参照画像:", details.map((x) => x.from).join(" , "));
  const prompt = KOBO.plain(KOBO.buildPrompt(d, cat)) + detailNote(details);
  const sheet = await renderSheet(d, cat, ref.buf);
  fs.mkdirSync("out/daily", { recursive: true });
  fs.writeFileSync(`out/daily/${article.slug}-sheet.png`, sheet);
  fs.writeFileSync(`out/daily/${article.slug}-prompt.txt`, prompt);
  log(`参照シートとプロンプト（${KOBO.CATS[cat].title}の文面・${prompt.length}字）を作りました`);
  let jpg;
  if (DRY) { log("DRY_RUN: 画像生成は呼ばず、参照シートを仮の写真にします"); jpg = await toJpeg(sheet); }
  else jpg = await generateImage(prompt, sheet, details);
  fs.mkdirSync("img/articles", { recursive: true });
  const rel = `img/articles/${article.slug}.jpg`;
  fs.writeFileSync(rel, jpg);
  Object.assign(article, { image: rel, image_w: SIZE.w, image_h: SIZE.h, image_alt: `${product.brand} ${product.name}の特徴をまとめたイメージ画像（AI生成）`, image_ref: ref.from, image_details: details.map((x) => x.from), image_at: new Date().toISOString() });
  fs.writeFileSync(AUTO, JSON.stringify(articles, null, 1) + "\n");
  execSync("node tools/build-articles.mjs && node tools/build-products.mjs && node tools/build-product-pages.mjs", { stdio: "inherit" }); // 写真は商品ページ・商品カードにも出す（data/product-images.json に残る）
  log("記事に写真を入れました:", rel);
}
async function toJpeg(png) { // DRY_RUN 用：PNG を JPEG に（ブラウザで変換）
  const { chromium } = await loadPlaywright();
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const p = await b.newPage(); await p.setContent("<body></body>");
    const s = await p.evaluate(async ({ u, w, h }) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); const k = Math.min(w / i.width, h / i.height); x.drawImage(i, (w - i.width * k) / 2, (h - i.height * k) / 2, i.width * k, i.height * k); return c.toDataURL("image/jpeg", 0.9).split(",")[1]; }, { u: "data:image/png;base64," + png.toString("base64"), w: SIZE.w, h: SIZE.h });
    return Buffer.from(s, "base64");
  } finally { await b.close(); }
}

// ---------- Instagram ----------
// ハッシュタグ：ブランド（日本語・英語）＋商品名＋よく検索される登山タグ10個
const BRAND_EN = { "ザ・ノース・フェイス": "thenorthface", "モンベル": "montbell", "アークテリクス": "arcteryx", "ミレー": "millet", "マーモット": "marmot",
  "ナンガ": "nanga", "ヘリーハンセン": "hellyhansen", "コールマン": "coleman", "コロンビア": "columbia", "マムート": "mammut", "カリマー": "karrimor",
  "ワイルドシングス": "wildthings", "エーグル": "aigle", "エルエルビーン": "llbean", "スノーピーク": "snowpeak", "KAVU": "kavu",
  "マウンテンハードウェア": "mountainhardwear", "パタゴニア": "patagonia", "ワークマン": "workman", "グレゴリー": "gregory", "キャラバン": "caravan",
  "シリオ": "sirio", "サロモン": "salomon", "メレル": "merrell", "オスプレー": "osprey", "ドイター": "deuter", "ミステリーランチ": "mysteryranch",
  "ラ・スポルティバ": "lasportiva", "スカルパ": "scarpa", "キーン": "keen", "ホグロフス": "haglofs", "ファイントラック": "finetrack", "チャムス": "chums" };
const POPULAR = ["#登山", "#山登り", "#登山好きな人と繋がりたい", "#山好きな人と繋がりたい", "#登山装備", "#登山ギア", "#アウトドア"];
const SLOT_POP = { outer: ["#登山ウェア", "#レインウェア", "#アウトドアウェア"], pack: ["#登山ザック", "#バックパック", "#ザック"], shoes: ["#登山靴", "#トレッキングシューズ", "#登山シューズ"] };
const CAT_SLOT = { rain: "outer", wear: "outer", pants: "outer", pack: "pack", boots: "shoes" };
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const tagify = (s) => "#" + String(s).replace(/[\s・'’.&＆/／()（）\-－_,，、:：!！?？]/g, "");

export function hashtags(a, p) {
  const brandJa = tagify(p.brand), en = BRAND_EN[p.brand] || (/^[A-Za-z0-9 ]+$/.test(p.brand) ? p.brand.toLowerCase() : "");
  const name = p.name.replace(/\s*(Men's|Women's|メンズ|レディース|ユニセックス|ウィメンズ)\s*/gi, " ").replace(/[（(][^）)]*[）)]/g, "").trim();
  const slot = a.slot || CAT_SLOT[p.category] || "outer";
  return [...new Set([brandJa, ...(en ? ["#" + en.replace(/\s+/g, "")] : []), tagify(name), ...POPULAR, ...(SLOT_POP[slot] || []), "#ヤマフィット"])].filter((t) => t.length > 1).slice(0, 15);
}

// 1行目：検索されやすい言葉（カテゴリー＋ブランド＋商品名）。PR表記も先頭に入れる
const BRANDS = readJSON("data/brands.json", []);
export function brandIG(p) {
  const b = (Array.isArray(BRANDS) ? BRANDS : BRANDS.brands || []).find((x) => x.name === p.brand || (x.aliases || []).includes(p.brand));
  return (b && b.instagram) || "";
}
export function catKeyword(p) {
  const n = p.name || "";
  if (p.category === "boots") return (p.waterproof ? "防水" : "") + (/トレラン|トレイルラン/.test(n) ? "トレイルランシューズ" : "登山靴");
  if (p.category === "pack") return "登山ザック" + (p.capacity_l && !/\d{2}/.test(n) ? ` ${p.capacity_l}L` : "");
  if (p.category === "rain") return "レインウェア";
  if (p.category === "pants") return "登山パンツ";
  if (p.category === "tent") return "テント";
  if (p.category === "poles") return "トレッキングポール";
  if (/ダウン/.test(n)) return "ダウンジャケット";
  if (/フリース/.test(n)) return "フリース";
  if (/ソフトシェル/.test(n)) return "ソフトシェル";
  return "登山ウェア";
}
export function keywordLine(p) {
  const g = { mens: "（メンズ）", womens: "（レディース）" }[p.gender] || "";
  const name = p.name.replace(/\s*(Men's|Women's|メンズ|レディース|ウィメンズ)\s*/gi, " ").trim();
  return `【PR】${catKeyword(p)}${g}｜${p.brand} ${name}`;
}

export function buildCaption(a, p) {
  // ポイント：「メリット・特徴」のリスト（デメリットは除く）。無ければ、特徴を書いた見出しを使う
  const SKIP_H = /スペック|仕様|デメリット|注意|向いて|まとめ|基本|価格|サイズ/;
  const merits = ((a.sections || []).find((s) => /メリット|特徴/.test(s.h) && !/デメリット/.test(s.h) && s.ul) || {}).ul
    || (a.sections || []).filter((s) => !SKIP_H.test(s.h)).map((s) => s.h);
  const articleUrl = `${SITE_URL}articles/${a.slug}.html`;
  return [
    keywordLine(p),
    a.title,
    "",
    a.desc,
    ...(merits.length ? ["", "【ポイント】", ...merits.slice(0, 3).map((m) => "・" + cut(m.replace(/\s+/g, " "), 70))] : []),
    "",
    "▼記事はプロフィールのリンクから",
    articleUrl,
    "",
    "※画像はAIで作成したイメージです。実際の商品とは細部が異なる場合があります。",
    "※価格・仕様は記事公開時点のメーカー公式の記載です。",
    "",
    hashtags(a, p).join(" "),
  ].join("\n").slice(0, 2200);
}

async function ig(pathAndQuery, params, method = "GET") {
  const base = `https://graph.instagram.com/${process.env.IG_API_VERSION || "v23.0"}`;
  const body = new URLSearchParams({ ...params, access_token: process.env.INSTAGRAM_ACCESS_TOKEN });
  const url = method === "GET" ? `${base}${pathAndQuery}${pathAndQuery.includes("?") ? "&" : "?"}${body}` : `${base}${pathAndQuery}`;
  const r = await fetch(url, method === "GET" ? {} : { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram API ${pathAndQuery.split("?")[0]}: ${(j.error && j.error.message) || r.status}`);
  return j;
}
async function waitLive(url) {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(url + `?t=${Date.now()}`, { method: "HEAD" }); if (r.ok && (r.headers.get("content-type") || "").startsWith("image/")) return; } catch {}
    await new Promise((s) => setTimeout(s, 15000));
  }
  throw new Error("サイトに写真が反映されません（GitHub Pages の公開を確認してください）: " + url);
}
async function instagram() {
  if (!article) return log("記事がないので投稿しません");
  if (posts[article.slug] && process.env.CAROUSEL_NO_PUBLISH !== "1") return log("この記事はもう投稿済みです:", posts[article.slug].permalink);
  if (!article.image) throw new Error("記事に写真がまだありません（先に image を実行）");
  if (!product) throw new Error("記事の商品がマスターにありません");
  const caption = buildCaption(article, product);
  const imageUrl = `${SITE_URL}${article.image}`;
  fs.mkdirSync("out/daily", { recursive: true });
  fs.writeFileSync(`out/daily/${article.slug}-caption.txt`, caption);
  log(`キャプション（${caption.length}字）を作りました`);
  if (DRY) { const f = makeVideo(article.image, videoFeatures(article, product), `morning-${today}`); return log("DRY_RUN: 投稿しません（動画 " + f + "）\n" + caption); }
  const r = await publishWithVideo(article.image, imageUrl, caption, product, article, `morning-${today}`);
  r.story = await publishStory(article.image, product, "朝のおすすめ", `${SITE_URL}articles/${article.slug}.html`);
  if (process.env.CAROUSEL_NO_PUBLISH === "1") return log("テスト：" + JSON.stringify(r));
  posts[article.slug] = { ...r, posted_at: new Date().toISOString(), image: article.image, app_id: article.app_id || "" };
  fs.writeFileSync(POSTS, JSON.stringify(posts, null, 1) + "\n");
  log("Instagram に投稿しました:", r.permalink || r.media_id);
}
async function publishIG(imageUrl, caption, p) {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN が未設定です（GitHub の Settings → Secrets に登録してください）");
  await waitLive(imageUrl);
  const me = await ig("/me?fields=user_id,username", {});
  const uid = me.user_id || me.id;
  const tag = p ? brandIG(p) : "";
  let c, tagged = "";
  if (tag) { // ブランド公式をタグ付け（画像の上の方）。受け付けられなければタグなしで投稿
    try { c = await ig(`/${uid}/media`, { image_url: imageUrl, caption, user_tags: JSON.stringify([{ username: tag, x: 0.5, y: 0.06 }]) }, "POST"); tagged = tag; }
    catch (e) { log("ブランドのタグ付けができませんでした（タグなしで投稿します）:", e.message); }
  }
  if (!c) c = await ig(`/${uid}/media`, { image_url: imageUrl, caption }, "POST");
  await waitContainer(c.id, 30, 5000);
  const pub = await ig(`/${uid}/media_publish`, { creation_id: c.id }, "POST");
  let permalink = "";
  try { permalink = (await ig(`/${pub.id}?fields=permalink`, {})).permalink || ""; } catch {}
  return { media_id: pub.id, permalink, account: me.username || "", tagged };
}
async function waitContainer(id, tries, ms) {
  for (let i = 0; i < tries; i++) {
    const s = await ig(`/${id}?fields=status_code,status`, {});
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram が受け付けませんでした: " + s.status_code + " " + (s.status || ""));
    await new Promise((r) => setTimeout(r, ms));
  }
  throw new Error("Instagram の処理が終わりませんでした（時間切れ）");
}

// ---------- 投稿の1枚目の動画（画面は固定・特徴をスライドで表示）→ 2枚目に解説画像（カルーセル） ----------
function videoFeatures(a, p) {
  const seen = new Set();
  const uniq = (list) => list.filter((x) => x.h && !seen.has(x.h) && seen.add(x.h)).slice(0, 5).map((x) => `${x.h}|${x.b === x.h ? "" : x.b}`);
  if (a) return uniq(factsFromArticle(a, p).features.map((x) => ({ h: clip(String(x.h).replace(/[「」]/g, ""), 20), b: clip(clean(x.b || ""), 75) })));
  // 商品だけのとき：評価のメリット（「〇〇で△△」は見出しと説明に分ける）＋重量・素材・防水
  const e = p.evaluation || {};
  const mat = String(p.material || "");
  const list = (e.pros || []).filter((x) => !/^不明/.test(x)).map((x) => clean(x)).filter((t) => !(mat && t.replace(/(素材|生地)$/, "").split(/と|、|・|，/).every((w) => w && mat.includes(w)))).map((t) => {
    const m = t.match(/^(.{3,16}?)(?:で|、)(.{4,})$/);
    return m ? { h: m[1], b: m[2].replace(/[。]$/, "") } : { h: t.length <= 20 ? t : t.slice(0, 18) + "…", b: t.length <= 20 ? "" : t };
  });
  if (p.waterproof) list.push({ h: "防水透湿", b: p.waterproof });
  if (p.weight_g) list.push({ h: "重量", b: `約${p.weight_g.toLocaleString()}g${p.weight_note && !/^約?[\d,.]+\s?g/.test(p.weight_note) ? "（" + p.weight_note.replace(/[（）()]/g, "") + "）" : ""}` });
  if (mat) list.push({ h: "素材", b: mat });
  if (p.capacity_l) list.push({ h: "容量", b: p.capacity_l + "L" });
  if (p.warmth) list.push({ h: "保温", b: clip(p.warmth, 75) });
  return uniq(list);
}
function makeVideo(img, feats, name) {
  fs.mkdirSync("out/reel", { recursive: true });
  const file = `out/reel/${name}.mp4`;
  const q = (x) => `'${String(x).replace(/'/g, "'\\''")}'`;
  execSync(`python3 tools/make-reel.py ${q(img)} ${q(file)} ${feats.map((f) => "--feat " + q(f)).join(" ")}`, { stdio: "inherit" });
  return file;
}
async function hostFile(file) { return hostVideo(file); }
async function hostVideo(file) { // 動画・画像を公開URLに置く（reel-media ブランチ。毎回上書きするのでリポジトリは大きくならない）
  const name = path.basename(file);
  const blob = execSync(`git hash-object -w ${file}`).toString().trim();
  const tree = execSync("git mktree", { input: `100644 blob ${blob}\t${name}\n` }).toString().trim();
  const commit = execSync(`git -c user.name=yamafit-bot -c user.email=bot@users.noreply.github.com commit-tree ${tree} -m "動画 ${name}"`).toString().trim();
  execSync(`git push -f -q origin ${commit}:refs/heads/reel-media`, { stdio: "inherit" });
  const url = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY || "yamafit/yamafit.github.io"}/reel-media/${encodeURIComponent(name)}`;
  for (let i = 0; i < 20; i++) { try { const r = await fetch(url, { method: "HEAD" }); if (r.ok) return url; } catch {} await new Promise((r) => setTimeout(r, 6000)); }
  return url;
}
async function publishCarousel(imageUrl, videoFile, caption, p) {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN が未設定です");
  await waitLive(imageUrl);
  const me = await ig("/me?fields=user_id,username", {});
  const uid = me.user_id || me.id;
  const videoUrl = await hostVideo(videoFile);
  const v = await ig(`/${uid}/media`, { media_type: "VIDEO", is_carousel_item: "true", video_url: videoUrl }, "POST");
  const tag = p ? brandIG(p) : "";
  let im, tagged = "";
  if (tag) { try { im = await ig(`/${uid}/media`, { image_url: imageUrl, is_carousel_item: "true", user_tags: JSON.stringify([{ username: tag, x: 0.5, y: 0.06 }]) }, "POST"); tagged = tag; } catch (e) { log("ブランドのタグ付けができませんでした:", e.message); } }
  if (!im) im = await ig(`/${uid}/media`, { image_url: imageUrl, is_carousel_item: "true" }, "POST");
  await waitContainer(v.id, 60, 10000);
  await waitContainer(im.id, 30, 5000);
  const c = await ig(`/${uid}/media`, { media_type: "CAROUSEL", children: `${v.id},${im.id}`, caption }, "POST");
  await waitContainer(c.id, 30, 5000);
  if (process.env.CAROUSEL_NO_PUBLISH === "1") return { media_id: "", permalink: "", account: me.username, tagged, test: c.id };
  const pub = await ig(`/${uid}/media_publish`, { creation_id: c.id }, "POST");
  let permalink = "";
  try { permalink = (await ig(`/${pub.id}?fields=permalink`, {})).permalink || ""; } catch {}
  return { media_id: pub.id, permalink, account: me.username || "", tagged, carousel: true };
}
// ストーリーズ（解説画像＋「プロフィールのリンクから」と URL の文字。API では押せるリンクを付けられない）
async function publishStory(img, p, label, pageUrl) {
  // 自動のストーリーズは止めている（API では押せるリンクを付けられないため、リンク付きは作成者が手動で載せる）。使うときは AUTO_STORY=1
  if (process.env.AUTO_STORY !== "1" && process.argv[2] !== "story") return { skipped: true };
  try {
    fs.mkdirSync("out/story", { recursive: true });
    const file = `out/story/${label === "昼のおすすめ" ? "noon" : "morning"}-${today}.jpg`;
    const q = (x) => `'${String(x).replace(/'/g, "'\\''")}'`;
    const g = { mens: "（メンズ）", womens: "（レディース）" }[p.gender] || "";
    execSync(`python3 tools/make-story.py ${q(img)} ${q(file)} --label ${q(label)} --title ${q(catKeyword(p) + g + "｜" + p.brand)} --url ${q(pageUrl.replace(/^https?:\/\//, ""))}`, { stdio: "inherit" });
    const me = await ig("/me?fields=user_id,username", {});
    const uid = me.user_id || me.id;
    const url = await hostFile(file);
    const c = await ig(`/${uid}/media`, { media_type: "STORIES", image_url: url }, "POST");
    await waitContainer(c.id, 30, 5000);
    if (process.env.CAROUSEL_NO_PUBLISH === "1") return { test: c.id };
    const pub = await ig(`/${uid}/media_publish`, { creation_id: c.id }, "POST");
    log("ストーリーズに投稿しました:", pub.id);
    return { media_id: pub.id, posted_at: new Date().toISOString() };
  } catch (e) {
    log("ストーリーズに投稿できませんでした:", e.message);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning::ストーリーズに投稿できませんでした: ${String(e.message).replace(/\n/g, " ")}`);
    return { error: e.message };
  }
}
// 動画つき（カルーセル）で投稿。動画づくりや動画の処理で失敗したら、画像1枚で投稿する
async function publishWithVideo(img, imageUrl, caption, p, a, name) {
  let file = "";
  try { file = makeVideo(img, videoFeatures(a, p), name); } catch (e) { log("動画を作れませんでした（画像1枚で投稿します）:", e.message); }
  if (file) {
    try { return await publishCarousel(imageUrl, file, caption, p); }
    catch (e) { log("動画つきの投稿ができませんでした（画像1枚で投稿します）:", e.message); if (process.env.GITHUB_ACTIONS) console.log(`::warning::動画つき投稿に失敗→画像1枚で投稿: ${e.message}`); }
  }
  return await publishIG(imageUrl, caption, p);
}

// ---------- リール（毎日19:00。その日の朝の商品の解説画像を動かした縦動画） ----------
async function publishReel(file, caption, p) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN が未設定です");
  const me = await ig("/me?fields=user_id,username", {});
  const uid = me.user_id || me.id;
  const videoUrl = await hostVideo(file);
  const tag = p ? brandIG(p) : "";
  const base = { media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true" };
  let c, tagged = "";
  if (tag) { try { c = await ig(`/${uid}/media`, { ...base, user_tags: JSON.stringify([{ username: tag }]) }, "POST"); tagged = tag; } catch (e) { log("ブランドのタグ付けができませんでした:", e.message); } }
  if (!c) c = await ig(`/${uid}/media`, base, "POST");
  log("動画をアップロードしました。Instagram の処理を待ちます");
  await waitContainer(c.id, 60, 10000);
  if (process.env.REEL_NO_PUBLISH === "1") return { media_id: "", permalink: "", account: me.username, tagged, test: c.id };
  const pub = await ig(`/${uid}/media_publish`, { creation_id: c.id }, "POST");
  let permalink = "";
  try { permalink = (await ig(`/${pub.id}?fields=permalink`, {})).permalink || ""; } catch {}
  return { media_id: pub.id, permalink, account: me.username || "", tagged };
}
async function reel() {
  const key = `reel:${today}`;
  if (posts[key] && !process.env.REEL_NO_PUBLISH) return log("今日のリールはもう投稿済みです:", posts[key].permalink);
  // 朝の記事の写真を優先。無ければ昼の商品の写真
  let img = article && article.image, p = product, caption, feats = [];
  if (img && p && fs.existsSync(img)) {
    caption = buildCaption(article, p);
    feats = factsFromArticle(article, p).features.map((f) => f.h);
  } else {
    const pick = readJSON(NOON, {})[today];
    const reg = readJSON(REG, {});
    p = pick && masters.find((x) => x.id === pick.id);
    img = pick && ((reg[pick.id] && reg[pick.id].image) || pick.image);
    if (!p || !img || !fs.existsSync(img)) return log("今日はリールにする写真がありません（朝・昼の写真が入っていません）");
    caption = productCaption(p);
    feats = factsFromProduct(p).features.map((f) => f.h);
  }
  feats = [...new Set(feats.map((h) => clip(String(h).replace(/[「」]/g, ""), 18)).filter(Boolean))].slice(0, 4);
  const title = `${catKeyword(p)}｜${p.brand}`;
  fs.mkdirSync("out/reel", { recursive: true });
  const file = `out/reel/${today}.mp4`;
  const q = (x) => `'${String(x).replace(/'/g, "'\\''")}'`;
  execSync(`python3 tools/make-reel.py ${q(img)} ${q(file)} --title ${q(title)} ${feats.map((f) => "--feat " + q(f)).join(" ")}`, { stdio: "inherit" });
  if (DRY) return log("DRY_RUN: 投稿しません\n" + caption);
  const r = await publishReel(file, caption, p);
  if (process.env.REEL_NO_PUBLISH === "1") { const m = "テスト：アップロードと処理まで成功（投稿はしていません） " + JSON.stringify(r); if (process.env.GITHUB_ACTIONS) console.log("::notice::" + m); return log(m); }
  posts[key] = { ...r, posted_at: new Date().toISOString(), image: img, id: p.id };
  fs.writeFileSync(POSTS, JSON.stringify(posts, null, 1) + "\n");
  log("リールを投稿しました:", r.permalink || r.media_id);
  if (process.env.GITHUB_ACTIONS) console.log(`::notice::リール投稿 ${r.permalink} タグ:${r.tagged || "なし"}`);
}

// ---------- 昼の投稿（今週の7選とは別の商品を1つ。写真はその商品の写真としてサイトに残す） ----------
const NOON = "data/noon-picks.json"; // { "YYYY-MM-DD": { id, cat, image?, posted? } }
const REG = "data/product-images.json";
const NOON_CAT = { outer: ["pack", "boots"], pack: ["boots", "rain"], shoes: ["rain", "wear"] }; // 朝の記事のカテゴリーと重ならないように
const kobo = (c) => ({ boots: "shoes", pack: "pack" }[c] || "outer");
function noonPickFor(date, skip = new Set()) {
  const picks = readJSON(NOON, {});
  if (picks[date] && !skip.has(picks[date].id)) return { picks, pick: picks[date] };
  delete picks[date];
  const reg = readJSON(REG, {});
  const rec = readJSON("data/recommendations.json", { categories: {} });
  const used = new Set([...Object.values(picks).map((x) => x.id), ...Object.keys(reg)]);
  const weekIds = new Set(articles.filter((a) => a.week && a.week === (article && article.week)).flatMap((a) => a.products || []));
  const morningSlot = article ? article.slot : "outer";
  const order = [...(NOON_CAT[morningSlot] || ["pack", "boots"]), "rain", "wear", "pack", "boots", "pants"];
  const morningBrand = product ? product.brand : ""; // 朝の記事と同じブランドは避ける
  const brandsRecent = Object.entries(picks).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3).map(([, x]) => (masters.find((p) => p.id === x.id) || {}).brand);
  const ok = (p) => p && !skip.has(p.id) && !used.has(p.id) && !weekIds.has(p.id) && p.image && p.image.url && p.price && !/^US /.test(p.name) && !brandsRecent.includes(p.brand) && p.brand !== morningBrand;
  for (const c of order) {
    const fromRec = ((rec.categories || {})[c] || []).map((x) => masters.find((p) => p.id === x.id)).find(ok);
    const any = fromRec || masters.filter((p) => p.category === c && ok(p)).sort((a, b) => (b.evaluation?.pros?.length || 0) - (a.evaluation?.pros?.length || 0))[0];
    if (any) { picks[date] = { id: any.id, cat: c }; return { picks, pick: picks[date] }; }
  }
  return { picks, pick: null };
}
function inputForProduct(p, cat) {
  const rows = [p.price ? `価格：${p.price.toLocaleString()}円（税込・公式サイトの表示）` : "", p.weight_g ? `重量：${p.weight_note || p.weight_g + "g"}` : "", p.material ? `素材：${p.material}` : "", p.waterproof ? `防水・撥水：${p.waterproof}` : "", p.warmth ? `保温：${p.warmth}` : "", p.capacity_l ? `容量：${p.capacity_l}L` : "", p.size_note ? `サイズ：${p.size_note}` : ""].filter(Boolean);
  const official = (p.image && p.image.src_page) || ((p.sources || [])[0] || {}).url || "";
  const d = { brand: p.brand, model: p.name, modelJa: "", color: "", source: [official, ...rows].filter(Boolean).join("\n"), reader: "", usage: "", aspect: SIZE.aspect, attach: "sheet", fixed: true, full: false };
  for (const [id] of KOBO.CATS[cat].specs) d[id] = "";
  d.facts = factsFromProduct(p);
  return d;
}
export function productCaption(p) {
  const e = p.evaluation || {};
  const url = `${SITE_URL}products/${p.id}.html`;
  const slot = kobo(p.category) === "shoes" ? "shoes" : kobo(p.category);
  const tags = hashtags({ slot }, p).filter((t) => t !== "#今週の7選");
  return [keywordLine(p), "", e.summary || "", ...((e.pros || []).length ? ["", "【ポイント】", ...e.pros.slice(0, 3).map((m) => "・" + cut(String(m).replace(/\s+/g, " "), 70))] : []),
    ...(p.price ? ["", `価格：¥${p.price.toLocaleString()}（税込・公式サイトの表示）`] : []), "", "▼くわしくはプロフィールのリンクから", url, "",
    "※画像はAIで作成したイメージです。実際の商品とは細部が異なる場合があります。", "※価格・仕様はメーカー公式の記載です。", "", tags.join(" ")].join("\n").slice(0, 2200);
}
async function noonPrep() {
  // 公式画像が取れない商品は飛ばして、次の候補にする（最大6件）
  const skip = new Set();
  let picks, pick, p, cat, d, ref;
  for (let i = 0; i < 6; i++) {
    ({ picks, pick } = noonPickFor(today, skip));
    if (!pick) return log("昼に紹介できる商品が見つかりませんでした");
    p = masters.find((x) => x.id === pick.id);
    cat = kobo(p.category);
    d = inputForProduct(p, cat);
    try { ref = await findReferenceImage({}, p); break; }
    catch (e) { log(`公式画像が取れないので次の候補へ：${p.brand} ${p.name}`); skip.add(p.id); ref = null; }
  }
  if (!ref) throw new Error("昼の候補の公式画像がどれも取れませんでした");
  fs.writeFileSync(NOON, JSON.stringify(picks, null, 1) + "\n");
  const prompt = KOBO.plain(KOBO.buildPrompt(d, cat));
  const sheet = await renderSheet(d, cat, ref.buf);
  fs.mkdirSync("out/noon", { recursive: true });
  fs.writeFileSync("out/noon/sheet.png", sheet);
  fs.writeFileSync("out/noon/prompt.txt", prompt);
  fs.writeFileSync("out/noon/caption.txt", productCaption(p));
  fs.writeFileSync("out/noon/info.json", JSON.stringify({ date: today, id: p.id, product: `${p.brand} ${p.name}`, category: KOBO.CATS[cat].title, price: p.price, ref: ref.from, page: `${SITE_URL}products/${p.id}.html`, at: new Date().toISOString() }, null, 1));
  log(`昼の商品：${p.brand} ${p.name}（${p.id}）`);
}
async function noonInstagram() {
  const picks = readJSON(NOON, {});
  const pick = picks[today];
  if (!pick) return log("今日の昼の商品はまだ決まっていません");
  if (pick.posted && process.env.CAROUSEL_NO_PUBLISH !== "1") return log("今日の昼はもう投稿済みです:", pick.posted.permalink);
  const reg = readJSON(REG, {});
  const img = (reg[pick.id] && reg[pick.id].noon === today && reg[pick.id].image) || pick.image;
  if (!img || !fs.existsSync(img)) return log("昼の写真がまだありません（チャットに写真が貼られたら投稿します）");
  const p = masters.find((x) => x.id === pick.id);
  const caption = productCaption(p);
  if (DRY) { const f = makeVideo(img, videoFeatures(null, p), `noon-${today}`); return log("DRY_RUN: 投稿しません（動画 " + f + "）\n" + caption); }
  const r = await publishWithVideo(img, `${SITE_URL}${img}`, caption, p, null, `noon-${today}`);
  r.story = await publishStory(img, p, "昼のおすすめ", `${SITE_URL}products/${p.id}.html`);
  if (process.env.CAROUSEL_NO_PUBLISH === "1") { const m = "テスト：" + JSON.stringify(r); if (process.env.GITHUB_ACTIONS) console.log("::notice::" + m); return log(m); }
  pick.posted = { ...r, posted_at: new Date().toISOString(), image: img };
  fs.writeFileSync(NOON, JSON.stringify(picks, null, 1) + "\n");
  posts[`noon:${today}:${pick.id}`] = pick.posted;
  fs.writeFileSync(POSTS, JSON.stringify(posts, null, 1) + "\n");
  log("昼の投稿をしました:", r.permalink || r.media_id);
}

async function videoOnly() { // 確認用：今日の朝（VIDEO_FOR=noon なら昼）の動画だけを作る
  if (process.env.VIDEO_FOR === "noon") {
    const pick = readJSON(NOON, {})[today]; const reg = readJSON(REG, {});
    const p = masters.find((x) => x.id === pick.id); const img = (reg[pick.id] && reg[pick.id].image) || pick.image;
    const feats = videoFeatures(null, p); log(feats.join("\n")); return log(makeVideo(img, feats, `noon-${today}`));
  }
  const feats = videoFeatures(article, product); log(feats.join("\n")); log(makeVideo(article.image, feats, `morning-${today}`));
}
async function storyOnly() { // ストーリーズだけ投稿（朝の記事。投稿済みの記録に追記）
  if (!article || !article.image) return log("今日の朝の写真がありません");
  const st = await publishStory(article.image, product, "朝のおすすめ", `${SITE_URL}articles/${article.slug}.html`);
  if (posts[article.slug]) { posts[article.slug].story = st; fs.writeFileSync(POSTS, JSON.stringify(posts, null, 1) + "\n"); }
  if (process.env.GITHUB_ACTIONS) console.log(`::notice::ストーリーズ ${JSON.stringify(st)}`);
}
const cmd = process.argv[2];
const run = { plan, prep, image, instagram, "noon-prep": noonPrep, "noon-instagram": noonInstagram, reel, video: videoOnly, story: storyOnly }[cmd];
if (!run) { console.error("使い方: node tools/daily-image-post.mjs plan|prep|image|instagram|noon-prep|noon-instagram|reel"); process.exit(1); }
if (import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  Promise.resolve().then(run).catch((e) => { console.error("失敗:", e.message); if (process.env.GITHUB_ACTIONS) console.log(`::error::失敗: ${String(e.message).replace(/\n/g, " ")}`); process.exit(1); });
}
