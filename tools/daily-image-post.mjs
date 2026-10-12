// 毎朝の「記事の写真」と「Instagram投稿」（.github/workflows/daily-image.yml から実行）
//
//   node tools/daily-image-post.mjs plan        今日やることを判定（GitHub Actions の出力 need_image / need_ig）
//   node tools/daily-image-post.mjs image       今日の記事の写真を作り、記事に入れてサイトを作り直す
//   node tools/daily-image-post.mjs prep        手作業用：参照シート・プロンプト・キャプションを out/daily に作る（.github/workflows/daily-prep.yml）
//   node tools/daily-image-post.mjs instagram   その写真と記事の内容・URLで Instagram に投稿し、data/ig-posts.json に記録
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
function inputFor(a, p, cat) {
  const spec = (a.sections || []).find((s) => s.table && /スペック|仕様/.test(s.h));
  const rows = spec ? spec.table.rows.map((r) => r.join("：")) : [];
  const num = rows.find((r) => /^(品番|型番)：/.test(r));
  const official = (p.image && p.image.src_page) || ((p.sources || [])[0] || {}).url || "";
  const d = { brand: p.brand, model: p.name + (num ? `（${num.split("：")[1]}）` : ""), modelJa: "", color: "", source: [official, ...rows].filter(Boolean).join("\n"), reader: "", usage: "", aspect: SIZE.aspect, attach: "sheet", fixed: true, full: false };
  for (const [id] of KOBO.CATS[cat].specs) d[id] = "";
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

export function buildCaption(a, p) {
  const merits = ((a.sections || []).find((s) => /メリット|特徴/.test(s.h) && s.ul) || {}).ul || [];
  const articleUrl = `${SITE_URL}articles/${a.slug}.html`;
  return [
    "#PR",
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
  if (posts[article.slug]) return log("この記事はもう投稿済みです:", posts[article.slug].permalink);
  if (!article.image) throw new Error("記事に写真がまだありません（先に image を実行）");
  if (!product) throw new Error("記事の商品がマスターにありません");
  const caption = buildCaption(article, product);
  const imageUrl = `${SITE_URL}${article.image}`;
  fs.mkdirSync("out/daily", { recursive: true });
  fs.writeFileSync(`out/daily/${article.slug}-caption.txt`, caption);
  log(`キャプション（${caption.length}字）を作りました`);
  if (DRY) return log("DRY_RUN: 投稿しません\n" + caption);
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN が未設定です（GitHub の Settings → Secrets に登録してください）");
  await waitLive(imageUrl);
  const me = await ig("/me?fields=user_id,username", {});
  const uid = me.user_id || me.id;
  const c = await ig(`/${uid}/media`, { image_url: imageUrl, caption }, "POST");
  for (let i = 0; i < 30; i++) {
    const s = await ig(`/${c.id}?fields=status_code`, {});
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram が画像を受け付けませんでした: " + s.status_code);
    await new Promise((r) => setTimeout(r, 5000));
  }
  const pub = await ig(`/${uid}/media_publish`, { creation_id: c.id }, "POST");
  let permalink = "";
  try { permalink = (await ig(`/${pub.id}?fields=permalink`, {})).permalink || ""; } catch {}
  posts[article.slug] = { media_id: pub.id, permalink, account: me.username || "", posted_at: new Date().toISOString(), image: article.image, app_id: article.app_id || "" };
  fs.writeFileSync(POSTS, JSON.stringify(posts, null, 1) + "\n");
  log("Instagram に投稿しました:", permalink || pub.id);
}

const cmd = process.argv[2];
const run = { plan, prep, image, instagram }[cmd];
if (!run) { console.error("使い方: node tools/daily-image-post.mjs plan|prep|image|instagram"); process.exit(1); }
if (import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  Promise.resolve().then(run).catch((e) => { console.error("失敗:", e.message); process.exit(1); });
}
