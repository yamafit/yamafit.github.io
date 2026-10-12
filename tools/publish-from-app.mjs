// 使い方: node tools/publish-from-app.mjs <入力.json>
// 管理アプリ「YAMA FIT 管理」で承認された記事を、サイトの原稿（content/auto-articles.json）に入れてビルドする。
//  - 商品がサイトの商品マスターに無いときは、data/raw・data/evals に追記し、data/master/<slug>.json に1件だけ加える
//    （ほかの商品は作り直さない。モンベルは master-montbell の対象なのでここでは追加しない）
//  - 出典は載せない。本文中のURL・リンクは消す（購入リンクは商品カードから：楽天市場（A8.net経由）と公式サイトのみ）
//  - 最後に validate-master → build-products → build-product-pages → build-articles を実行し、
//    1行目が "RESULT " で始まるJSON（記事ごとの公開URLなど）を出力する
//
// 入力（1件または配列）:
// { "app_id": "a-2026-10-12-0", "date": "2026-10-12", "week": "2026-10-12", "day": 0, "slot": "outer|pack|shoes",
//   "title": "…", "desc": "（任意）", "body": "Markdown本文",
//   "ref_images": [{ "url": "https://…（公式ページの商品画像）", "role": "main|detail", "note": "何が写っているか", "page": "公式ページURL" }]（任意。朝の記事写真の参照画像。main は1枚、detail は3枚まで）,
//   "product": { "site_id": "tnf-climb-light-jacket-m" }
//           または { "new": { "slug": "millet", "brand": "ミレー", "raw": { url, category, name, title, price_min, price_max, availability, checked_at, image? },
//                              "eval": { id, name, gender, category, price?, weight_g?, weight_note?, capacity_l?, material?, waterproof?, waterproof_level?, warmth?, size_note?,
//                                        eval: { season, uses, concerns, fit, summary, pros, cons, good_for, not_for, concern_reasons } } } } }
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const readJson = (p, d) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d);
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1));
const fail = (m) => { console.error("エラー: " + m); process.exit(1); };

const arg = process.argv[2];
if (!arg) fail("入力ファイルを指定してください");
const input = readJson(arg);
const items = Array.isArray(input) ? input : [input];
const AUTO_PATH = "content/auto-articles.json";
const auto = readJson(AUTO_PATH, []);
const LABEL = { boots: "登山靴", pack: "ザック", rain: "レインウェア", wear: "ウェア", pants: "パンツ", poles: "トレッキングポール", tent: "テント泊" };
const CATS = Object.keys(LABEL);
const SITE_URL = (fs.readFileSync("js/site.js", "utf8").match(/url:\s*"([^"]+)"/) || [])[1] || "";

const masterFiles = () => fs.readdirSync("data/master").filter((f) => f.endsWith(".json"));
const allMasters = () => Object.fromEntries(masterFiles().flatMap((f) => readJson(`data/master/${f}`).products.map((p) => [p.id, p])));

// master-generic.mjs と同じ変換（1件分）
const yen = (s) => { const m = (s || "").match(/[¥￥]\s?([\d,]{3,})/); return m ? Number(m[1].replace(/,/g, "")) : null; };
function toMaster(slug, brandName, e, r) {
  const priceFromText = (r.price_text || []).map(yen).filter(Boolean);
  const price = e.price !== undefined ? e.price : (priceFromText.length ? Math.max(...priceFromText) : r.price_min ?? r.price_max);
  const av = r.availability || [];
  const stock = e.in_stock_unknown ? null : av.some((a) => /InStock|LimitedAvailability/.test(a)) ? true : av.length && av.every((a) => /OutOfStock|SoldOut/.test(a)) ? false : e.in_stock ?? null;
  const imageUrl = (e.image || r.image || "").replace(/^http:\/\//, "https://");
  return {
    id: `${slug}-${e.id}`, brand: brandName, name: e.name, category: e.category || r.category, gender: e.gender || "unisex",
    price: price ?? null, weight_g: e.weight_g ?? null, weight_note: e.weight_note ?? null, capacity_l: e.capacity_l ?? null,
    material: e.material ?? null, waterproof: e.waterproof ?? null, waterproof_level: e.waterproof_level ?? null, warmth: e.warmth ?? null, size_note: e.size_note ?? null,
    sources: [{ url: r.url, checked_at: r.checked_at }],
    image: { url: imageUrl, angle: "main", src_page: r.url, checked_at: r.checked_at, ok: null },
    offers: [{ shop: "official", url: r.url, affiliate_url: "", in_stock: stock, checked_at: r.checked_at }],
    evaluation: { by: "claude", at: r.checked_at, ...e.eval },
  };
}

// 1) 新しい商品をマスターへ
for (const it of items) {
  const np = it.product && it.product.new;
  if (!np) continue;
  const { slug, brand, raw, eval: ev } = np;
  if (!/^[a-z0-9-]+$/.test(slug || "")) fail(`slug は英小文字・数字・ハイフンで: ${slug}`);
  if (slug === "montbell") fail("モンベルの商品はここでは追加しません（サイトにある商品から選んでください）");
  if (!brand || !raw || !raw.url || !raw.checked_at || !ev || !ev.id || !ev.name || !ev.eval) fail(`${it.app_id}: 新商品の情報が足りません（brand, raw.url, raw.checked_at, eval.id, eval.name, eval.eval）`);
  if (!/^[a-z0-9-]+$/.test(ev.id)) fail(`eval.id は英小文字・数字・ハイフンで: ${ev.id}`);
  if (!/^https:\/\//.test(raw.image || "")) fail(`${it.app_id}: raw.image（公式ページの商品画像のURL。og:image など）が必要です`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.checked_at)) fail(`${it.app_id}: raw.checked_at は YYYY-MM-DD`);
  if (!CATS.includes(ev.category || raw.category)) fail(`${it.app_id}: category は ${CATS.join(" / ")} のどれか`);
  const E = ev.eval, inSet = (v, set) => Array.isArray(v) && v.every((x) => set.includes(x));
  if (!inSet(E.season, ["spring", "summer", "autumn", "winter"]) || !inSet(E.uses, ["low", "mid", "hut", "tent", "winter", "town"]) || !inSet(E.concerns, ["knee", "sweat", "cold", "budget", "light"])
    || !E.summary || !["pros", "cons", "good_for", "not_for"].every((k) => Array.isArray(E[k]))) fail(`${it.app_id}: eval.eval の season/uses/concerns/summary/pros/cons/good_for/not_for を data/master/SCHEMA.md の形で入れてください`);
  const mpath = `data/master/${slug}.json`;
  const master = readJson(mpath, { brand, products: [] });
  if (master.brand !== brand) fail(`${slug} のブランド名はサイトでは「${master.brand}」です`);
  const key = ev.key || raw.url;
  const rawAll = readJson(`data/raw/${slug}.json`, {});
  rawAll[key] = { status: 200, price_text: [], availability: [], image: "", ...raw };
  const evals = readJson(`data/evals/${slug}.json`, []);
  const e2 = { ...ev, key };
  const ei = evals.findIndex((x) => x.key === key || x.id === ev.id);
  if (ei >= 0) evals[ei] = e2; else evals.push(e2);
  const prod = toMaster(slug, brand, e2, rawAll[key]);
  const mi = master.products.findIndex((p) => p.id === prod.id);
  if (mi >= 0) master.products[mi] = prod; else master.products.push(prod);
  writeJson(`data/raw/${slug}.json`, rawAll);
  writeJson(`data/evals/${slug}.json`, evals);
  writeJson(mpath, master);
  it._siteId = prod.id;
}

// 2) 本文（Markdown）→ サイトの原稿形式
const plain = (s) => String(s)
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1")
  .replace(/<?https?:\/\/[^\s)）>」]+>?/g, "")
  .replace(/\*\*|__|`/g, "")
  .replace(/\[(広告表示|購入リンク|PR)\]/g, "")
  .replace(/\s{2,}/g, " ")
  .trim();
const SKIP_H = /出典|参考|情報源|ソース|購入リンク/;
function convert(md, title) {
  const lines = String(md).replace(/\r/g, "").split("\n");
  const secs = []; const leadParas = []; let cur = null; let para = []; let tbl = null;
  const flushPara = () => { const t = plain(para.join("")); para = []; if (!t) return; if (cur) (cur.p ||= []).push(t); else leadParas.push(t); };
  const flushTbl = () => { if (!tbl) return; if (cur && tbl.length >= 2) { const rows = tbl.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c))); if (!cur.table && rows.length >= 2) cur.table = { head: rows[0], rows: rows.slice(1) }; else rows.forEach((r) => (cur.p ||= []).push(r.join("：")));} tbl = null; };
  for (const raw of lines) {
    const ln = raw.trim();
    if (/^#\s/.test(ln)) { flushPara(); flushTbl(); continue; }               // タイトル行は使わない
    const h = ln.match(/^#{2,4}\s+(.*)$/);
    if (h) { flushPara(); flushTbl(); const ht = plain(h[1]).replace(/^\d+[.．、)]\s*/, ""); cur = { h: ht, skip: SKIP_H.test(ht) }; secs.push(cur); continue; }
    if (/^\|.*\|$/.test(ln)) { flushPara(); (tbl ||= []).push(ln.slice(1, -1).split("|").map((c) => plain(c))); continue; }
    flushTbl();
    const li = ln.match(/^(?:[-*・]|\d+[.)])\s+(.*)$/);
    if (li) { flushPara(); const t = plain(li[1]); if (t) { if (cur) (cur.ul ||= []).push(t); else leadParas.push(t); } continue; }
    if (!ln) { flushPara(); continue; }
    para.push(ln);
  }
  flushPara(); flushTbl();
  const sections = secs.filter((s) => !s.skip && (s.p || s.ul || s.table)).map(({ skip, ...s }) => s);
  const lead = leadParas.filter((t) => t && t !== plain(title)).join("") || (sections[0] && sections[0].p && sections[0].p[0]) || "";
  return { lead, sections };
}

const siteSrc = fs.readFileSync("js/site.js", "utf8");
const rl = siteSrc.match(/rakutenLink:\s*(\(dest\)\s*=>\s*\{[\s\S]*?\n\s*\}),/);
const rakutenLink = rl ? (0, eval)(rl[1]) : null;
const rakutenSearch = (p) => `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(`${p.brand} ${p.name}`.replace(/\s*(Men's|Women's|メンズ|レディース|ユニセックス)\s*/g, " ").trim())}/`;

const masters = allMasters();
const results = [];
for (const it of items) {
  const siteId = it._siteId || (it.product && it.product.site_id);
  const p = masters[siteId];
  if (!p) fail(`${it.app_id}: 商品 ${siteId} がサイトの商品マスターにありません`);
  if (!it.title || !it.body || !/^\d{4}-\d{2}-\d{2}$/.test(it.date || "")) fail(`${it.app_id}: title・body・date が必要です`);
  const { lead, sections } = convert(it.body, it.title);
  if (!sections.length || !lead) fail(`${it.app_id}: 本文から見出しと導入文を読み取れませんでした`);
  const slug = `${it.date}-${siteId}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").slice(0, 90);
  const label = LABEL[p.category] || "装備";
  const desc = plain(it.desc || "") || (lead.length > 110 ? lead.slice(0, 108) + "…" : lead);
  const others = auto.filter((a) => a.app_id !== it.app_id && a.slug !== slug);
  const entry = { slug, category: label, date: it.date, title: plain(it.title), desc, lead, sections, products: [siteId],
    related: others.filter((a) => a.category === label).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2).map((a) => a.slug),
    week: it.week || null, day: Number.isInteger(it.day) ? it.day : null, slot: it.slot || null, app_id: it.app_id || null };
  const refs = (Array.isArray(it.ref_images) ? it.ref_images : []).filter((r) => r && /^https?:\/\//.test(r.url || "") && ["main", "detail"].includes(r.role))
    .map((r) => ({ url: r.url.replace(/^http:/, "https:"), role: r.role, note: plain(r.note || "").slice(0, 80), page: /^https?:\/\//.test(r.page || "") ? r.page : "" }));
  const i = auto.findIndex((a) => (it.app_id && a.app_id === it.app_id) || a.slug === slug);
  const prev = i >= 0 ? auto[i] : {};
  if (refs.length) entry.ref_images = [...refs.filter((r) => r.role === "main").slice(0, 1), ...refs.filter((r) => r.role === "detail").slice(0, 3)];
  else if (prev.ref_images) entry.ref_images = prev.ref_images;
  for (const k of Object.keys(prev)) if (k.startsWith("image")) entry[k] = prev[k]; // 朝に作った記事の写真は残す
  if (i >= 0) auto[i] = entry; else auto.push(entry);
  const official = (p.offers || []).find((o) => o.shop === "official");
  const dest = rakutenSearch(p);
  results.push({ app_id: it.app_id, slug, url: `${SITE_URL}articles/${slug}.html`, product_id: siteId, category: p.category,
    official_url: official ? official.url : "", rakuten_dest: dest, rakuten_aff: rakutenLink ? rakutenLink(dest) : "" });
}
auto.sort((a, b) => a.date.localeCompare(b.date) || (a.day ?? 0) - (b.day ?? 0));
writeJson(AUTO_PATH, auto);

// ホームの「今週のおすすめ」（ザック・アウター・シューズの3つ）を、最新の週に公開した記事の商品へ入れ替える。
// その週にまだ公開していない枠は、前の週の記事の商品 → 今の data/featured.json の同じ種類の商品の順で残す。
{
  const FEAT = [["pack", ["pack"]], ["outer", ["rain", "wear"]], ["shoes", ["boots"]]];
  const fpath = "data/featured.json";
  const feat = readJson(fpath, { items: [] });
  const ms = allMasters();
  const weeks = auto.filter((a) => a.week).map((a) => a.week).sort();
  const latest = weeks[weeks.length - 1];
  const short = (s) => { const t = plain(s || ""); return t.length > 70 ? t.slice(0, 68) + "…" : t; };
  const items = FEAT.map(([slot, cats]) => {
    const cands = auto.filter((a) => a.slot === slot && a.week && ms[a.products[0]]).sort((a, b) => b.date.localeCompare(a.date));
    const a = cands.find((x) => x.week === latest) || cands[0];
    if (a) return { id: a.products[0], comment: short(a.desc), article: a.slug };
    return (feat.items || []).find((x) => ms[x.id] && cats.includes(ms[x.id].category)) || null;
  }).filter(Boolean);
  const before = JSON.stringify((feat.items || []).map((x) => x.id));
  if (items.length && JSON.stringify(items.map((x) => x.id)) !== before) {
    feat.items = items;
    feat.updated = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    feat._note = "ホームの「今週のおすすめ」。tools/publish-from-app.mjs が、最新の週に公開した記事の商品（ザック・アウター・シューズ）へ自動で入れ替える。items は表示順。";
    writeJson(fpath, feat);
  }
}

// 3) ビルド
const run = (f) => execFileSync("node", [f], { stdio: ["ignore", "inherit", "inherit"] });
run("tools/validate-master.mjs");
run("tools/build-products.mjs");
run("tools/build-product-pages.mjs");
run("tools/build-articles.mjs");
for (const r of results) if (!fs.existsSync(`articles/${r.slug}.html`)) fail(`articles/${r.slug}.html が作られていません`);
console.log("RESULT " + JSON.stringify(results));
