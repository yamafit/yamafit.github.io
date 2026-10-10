// 使い方: node tools/validate-master.mjs   data/master/*.json を検査する
import fs from "node:fs";
const CAT = ["boots", "pack", "poles", "rain", "wear", "pants", "tent"];
const GENDER = ["unisex", "mens", "womens"];
const WP = ["none", "water_repellent", "waterproof", null];
const SEASON = ["spring", "summer", "autumn", "winter"];
const USES = ["low", "mid", "hut", "tent", "winter", "town"];
const CONCERN = ["knee", "sweat", "cold", "budget", "light"];
const SHOP = ["official", "amazon", "rakuten", "yahoo"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const errs = [], ids = new Set(); let n = 0;
const bad = (id, m) => errs.push(`${id}: ${m}`);
const numOrNull = (v) => v === null || (typeof v === "number" && v >= 0);
const strOrNull = (v) => v === null || typeof v === "string";

for (const f of fs.readdirSync("data/master").filter((x) => x.endsWith(".json"))) {
  const { brand, products } = JSON.parse(fs.readFileSync(`data/master/${f}`, "utf8"));
  for (const p of products) {
    n++; const id = p.id || `${f}#?`;
    if (ids.has(p.id)) bad(id, "id重複"); ids.add(p.id);
    if (p.brand !== brand) bad(id, "brandがファイルと違う");
    if (!p.name) bad(id, "name無し");
    if (!CAT.includes(p.category)) bad(id, `category不正: ${p.category}`);
    if (!GENDER.includes(p.gender)) bad(id, `gender不正: ${p.gender}`);
    if (!numOrNull(p.price)) bad(id, "price は数値かnull");
    if (!numOrNull(p.weight_g)) bad(id, "weight_g は数値かnull");
    for (const k of ["material", "waterproof", "warmth", "size_note", "weight_note"]) if (!strOrNull(p[k])) bad(id, `${k} は文字列かnull`);
    if (!WP.includes(p.waterproof_level)) bad(id, "waterproof_level不正");
    if (!Array.isArray(p.sources) || !p.sources.length) bad(id, "sources が必要（情報源URLと確認日）");
    else for (const s of p.sources) if (!/^https?:\/\//.test(s.url || "") || !DATE.test(s.checked_at || "")) bad(id, "sources の url/checked_at が不正");
    const im = p.image;
    if (!im || !/^https?:\/\//.test(im.url || "") || !im.angle || !im.src_page || !DATE.test(im.checked_at || "")) bad(id, "image の url/angle/src_page/checked_at が必要");
    if (!Array.isArray(p.offers) || !p.offers.length) bad(id, "offers が必要");
    else for (const o of p.offers) {
      if (!SHOP.includes(o.shop)) bad(id, `offers.shop不正: ${o.shop}`);
      if (!/^https?:\/\//.test(o.url || "")) bad(id, "offers.url不正");
      if (![true, false, null].includes(o.in_stock)) bad(id, "in_stock は true/false/null");
      if (!DATE.test(o.checked_at || "")) bad(id, "offers.checked_at不正");
    }
    const e = p.evaluation;
    if (!e || e.by !== "claude" || !DATE.test(e.at || "")) bad(id, "evaluation(by/at)が必要");
    else {
      if (!e.season?.every((s) => SEASON.includes(s))) bad(id, "evaluation.season不正");
      if (!e.uses?.every((s) => USES.includes(s))) bad(id, "evaluation.uses不正");
      if (!e.concerns?.every((s) => CONCERN.includes(s))) bad(id, "evaluation.concerns不正");
      for (const k of ["pros", "cons", "good_for", "not_for"]) if (!Array.isArray(e[k])) bad(id, `evaluation.${k}は配列`);
      if (!e.summary) bad(id, "evaluation.summary無し");
    }
  }
}
console.log(`商品 ${n}件 / エラー ${errs.length}件`);
errs.slice(0, 60).forEach((m) => console.log(" -", m));
process.exit(errs.length ? 1 : 0);
