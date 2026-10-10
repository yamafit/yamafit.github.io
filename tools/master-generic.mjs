// 使い方: node tools/master-generic.mjs <slug> <ブランド表示名>
// data/raw/<slug>.json（公式ページから取った事実）＋ data/evals/<slug>.json（商品ごとの転記・評価）→ data/master/<slug>.json
// evals の各要素: { key, id, name, gender, category?, price?, weight_g?, weight_note?, capacity_l?, material?, waterproof?, waterproof_level?, warmth?, size_note?, eval:{...} }
// 価格・在庫・画像・URL・確認日は raw から取る。evals に書くのは、そのページに書かれている事実の転記と、そこから導いた評価だけ。
import fs from "node:fs";
const [slug, brandName] = process.argv.slice(2);
const clean = (u) => u.replace(/([?&])create_s_(key|token)=[^&]*/g, "$1").replace(/[?&]+$/, "").replace(/\?&/, "?").replace(/&&+/g, "&"); // セッション用の識別子は公開データに残さない
const rawAll = JSON.parse(fs.readFileSync(`data/raw/${slug}.json`, "utf8"));
const raw = {};
for (const [k, v] of Object.entries(rawAll)) { raw[clean(k)] = { ...v, url: clean(v.url) }; }
const evals = JSON.parse(fs.readFileSync(`data/evals/${slug}.json`, "utf8"));
const yen = (s) => { const m = (s || "").match(/[¥￥]\s?([\d,]{3,})/); return m ? Number(m[1].replace(/,/g, "")) : null; };
const products = [];
for (const e of evals) {
  const r = raw[e.key];
  if (!r) { console.warn("rawなし:", e.key); continue; }
  const priceFromText = (r.price_text || []).map(yen).filter(Boolean);
  const price = e.price !== undefined ? e.price : (priceFromText.length ? Math.max(...priceFromText) : r.price_min ?? r.price_max);
  const av = r.availability || [];
  const stock = e.in_stock_unknown ? null : av.some((a) => /InStock|LimitedAvailability/.test(a)) ? true : av.length && av.every((a) => /OutOfStock|SoldOut/.test(a)) ? false : e.in_stock ?? null;
  const imageUrl = (e.image || r.image || "").replace(/^http:\/\//, "https://");
  products.push({
    id: `${slug}-${e.id}`, brand: brandName, name: e.name, category: e.category || r.category, gender: e.gender || "unisex", 
    price: price ?? null, weight_g: e.weight_g ?? null, weight_note: e.weight_note ?? null, capacity_l: e.capacity_l ?? null,
    material: e.material ?? null, waterproof: e.waterproof ?? null, waterproof_level: e.waterproof_level ?? null, warmth: e.warmth ?? null, size_note: e.size_note ?? null,
    sources: [{ url: r.url, checked_at: r.checked_at }],
    image: { url: imageUrl, angle: "main", src_page: r.url, checked_at: r.checked_at, ok: null },
    offers: [{ shop: "official", url: r.url, affiliate_url: "", in_stock: stock, checked_at: r.checked_at }],
    evaluation: { by: "claude", at: r.checked_at, ...e.eval },
  });
}
fs.writeFileSync(`data/master/${slug}.json`, JSON.stringify({ brand: brandName, products }, null, 1));
console.log(`${slug}: ${products.length}件`);
