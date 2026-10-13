// 使い方: node tools/collect-shopify.mjs <slug> <host> <コレクションhandle,...（all で全商品）> [絞り込み正規表現]
// すでに取り込んだ商品は飛ばし、新しい商品だけを追記する（毎日の自動追加で使う：.github/workflows/products-daily.yml）。
// Shopify製の公式ストアが公開している商品JSON（/collections/<handle>/products.json）から、書かれている事実を data/raw/<slug>.json に追記する。
// 読み取り専用・低頻度（各ストアのagents.mdが案内する閲覧方法）。
import fs from "node:fs";
const [slug, host, handles, filter] = process.argv.slice(2);
const re = filter ? new RegExp(filter, "i") : null;
const path = `data/raw/${slug}.json`;
const out = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
const today = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (h) => (h || "").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|ul)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/[ \t　]+/g, " ").split("\n").map((s) => s.trim()).filter(Boolean);
let n = 0;
const MAX_PAGES = Number(process.env.MAX_PAGES || 8); // 1ページ250件まで。毎日1回だけ読む
for (const h of handles.split(",")) {
 for (let page = 1; page <= MAX_PAGES; page++) {
  await sleep(1500);
  const r = await fetch(`https://${host}/collections/${h}/products.json?limit=250&page=${page}`, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "ja" }, signal: AbortSignal.timeout(40000) }).catch((e) => ({ ok: false, status: e.message }));
  if (!r.ok) { console.warn("skip", h, page, r.status); break; }
  const { products = [] } = await r.json().catch(() => ({}));
  if (!products.length) break;
  for (const p of products) {
    if (re && !re.test(`${p.title} ${p.product_type} ${(p.tags || []).join(" ")}`)) continue;
    if (process.env.VENDOR && !new RegExp(process.env.VENDOR, "i").test(p.vendor || "")) continue; // 複数ブランドを扱うストアでは、そのブランドの商品だけ
    const key = `/products/${p.handle}`;
    if (out[key]) continue;
    const prices = (p.variants || []).map((v) => Number(v.price)).filter((x) => x > 0);
    const compare = (p.variants || []).map((v) => Number(v.compare_at_price)).filter((x) => x > 0);
    const lines = text(p.body_html);
    out[key] = {
      url: `https://${host}${key}`, category: "auto", status: 200, name: p.title, title: p.title, product_type: p.product_type, tags: p.tags,
      price_min: prices.length ? Math.min(...prices) : null, price_max: compare.length ? Math.max(...compare, ...prices) : prices.length ? Math.max(...prices) : null,
      price_text: [], availability: (p.variants || []).some((v) => v.available) ? ["InStock"] : ["OutOfStock"],
      image: (p.images && p.images[0] && p.images[0].src) || null, og_image: null,
      desc: lines.join(" ").slice(0, 600), body: lines.join("\n").slice(0, 2500),
      weight: lines.filter((l) => /(重量|重さ|weight|[\d,.]+\s?(g|kg)\b)/i.test(l) && l.length < 100).slice(0, 4),
      material: lines.filter((l) => /(素材|アッパー|ソール|ナイロン|ポリエステル|GORE|ゴアテックス|レザー|material)/i.test(l) && l.length < 160).slice(0, 5),
      waterproof: [], warmth: [], size: lines.filter((l) => /(容量|サイズ|\d+\s?L\b)/.test(l) && l.length < 100).slice(0, 3),
      weight_labeled: null, checked_at: today,
    };
    n++;
  }
  if (products.length < 250) break;
 }
}
fs.writeFileSync(path, JSON.stringify(out, null, 1));
console.log(`${slug}: +${n}件（合計 ${Object.keys(out).length}）`);
