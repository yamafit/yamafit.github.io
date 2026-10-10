// 使い方: node tools/build-products.mjs（画像も含めるなら PRODUCT_IMAGES=1 node tools/build-products.mjs）   data/master/*.json → data/products.json（サイトが読む形）
import fs from "node:fs";
const out = [];
for (const f of fs.readdirSync("data/master").filter((x) => x.endsWith(".json")).sort()) {
  for (const p of JSON.parse(fs.readFileSync(`data/master/${f}`, "utf8")).products) {
    const e = p.evaluation;
    const aff = (shop) => (p.offers.find((o) => o.shop === shop) || {}).affiliate_url || "";
    const parts = [];
    if (p.waterproof) parts.push(p.waterproof);
    if (p.weight_g) parts.push(`${p.weight_g}g${p.weight_note ? "（" + p.weight_note + "）" : ""}`);
    out.push({
      id: p.id, category: p.category, brand: p.brand, name: p.name, gender: p.gender,
      spec: parts.join("／") || e.summary,
      price: p.price, capacity_l: p.capacity_l ?? null, weight_g: p.weight_g, weight_note: p.weight_note || null, material: p.material, waterproof: p.waterproof,
      warmth: p.warmth, size_note: p.size_note,
      season: e.season, features: e.pros, cons: e.cons, for_whom: (e.good_for || []).join("・"), not_for: (e.not_for || []).join("・"),
      terrain: (e.uses || []).filter((u) => ["low", "mid", "hut", "tent"].includes(u)), uses: e.uses,
      concerns: e.concerns, reasons: e.concern_reasons || {}, default_reason: e.summary, fit: e.fit || null,
      image: process.env.PRODUCT_IMAGES === "1" && p.image && p.image.ok !== false ? p.image.url : "", // 公式画像の直リンクは権利確認ができるまで出さない（出すときは PRODUCT_IMAGES=1）
      sources: p.sources,
      offers: p.offers.map((o) => ({ shop: o.shop, url: o.url, affiliate_url: o.affiliate_url || "", in_stock: o.in_stock, checked_at: o.checked_at })),
      related: [],
      affiliate: { amazon: aff("amazon"), rakuten: aff("rakuten"), yahoo: aff("yahoo") },
    });
  }
}
fs.writeFileSync("data/products.json", JSON.stringify({ _note: "tools/build-products.mjs が data/master から作る。直接編集しない。", products: out }, null, 1));
console.log(`products.json: ${out.length}件`);
