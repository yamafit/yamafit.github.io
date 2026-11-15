// 使い方: node tools/check-a8-links.mjs   data/offers-override.json の A8 リンク（作成者がA8で作ったもの）と、js/site.js の組み立て（himarayaLink／alpenLink／rakutenLink）で同じ飛び先から作ったリンクを、一言一句比べる。
import fs from "node:fs";
const src = fs.readFileSync("js/site.js", "utf8");
const pick = (re) => { const m = src.match(re); return m ? (0, eval)(m[1]) : null; };
const fn = {
  rakuten: pick(/rakutenLink:\s*(\(dest\)\s*=>\s*\{[\s\S]*?\n\s*\}),/),
  himaraya: pick(/himarayaLink:\s*(\(dest\)\s*=>\s*"[^\n]*?),\n/),
  alpen: pick(/alpenLink:\s*(\(dest\)\s*=>\s*"[^\n]*?),\n/),
};
const ovr = JSON.parse(fs.readFileSync("data/offers-override.json", "utf8"));
let ok = 0, ng = 0;
for (const [id, shops] of Object.entries(ovr)) for (const [shop, o] of Object.entries(shops)) {
  const a8 = o.affiliate_url, mine = fn[shop] ? fn[shop](o.url) : null;
  const same = a8 === mine;
  same ? ok++ : ng++;
  console.log(`${same ? "一致" : "不一致"}\t${id}\t${shop}`);
  if (!same) { console.log("  A8で作成：", a8); console.log("  組み立て：", mine); }
}
console.log(`一致 ${ok}件・不一致 ${ng}件`);
