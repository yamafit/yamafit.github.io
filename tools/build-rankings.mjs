// 使い方: node tools/build-rankings.mjs
// data/access.csv（title,url,count）と data/sales.csv（title,url,count,category）から、上位10件の data/rankings.json を作る。
//   access.csv … GA4の「ページとスクリーン」レポートを書き出して title,url,count の形に整える
//   sales.csv  … ASP（Amazonアソシエイト・楽天・もしもなど）の成果レポートから、商品ごとの購入数を集計して貼る
import fs from "node:fs";

function load(path) {
  if (!fs.existsSync(path)) return [];
  const [head, ...lines] = fs.readFileSync(path, "utf8").trim().split(/\r?\n/);
  if (!head) return [];
  return lines.filter(Boolean).map((l) => {
    const [title, url, count, category = ""] = l.split(",").map((s) => s.trim());
    return { title, url, count: Number(count), category };
  }).filter((r) => r.title && r.url && Number.isFinite(r.count) && r.count > 0);
}
const top = (rows) => rows.sort((a, b) => b.count - a.count).slice(0, 10);
// 購入はカテゴリごとの上位3件も持つ（カテゴリ: boots / pack / rain / wear / tent）
const byCategory = (rows) => {
  const out = {};
  for (const r of rows) (out[r.category || "other"] ||= []).push(r);
  for (const k of Object.keys(out)) out[k] = out[k].sort((a, b) => b.count - a.count).slice(0, 3);
  return out;
};

const out = { updated: new Date().toISOString(), access: top(load("data/access.csv")), purchase: top(load("data/sales.csv")), purchaseByCategory: byCategory(load("data/sales.csv")) };
fs.writeFileSync("data/rankings.json", JSON.stringify(out, null, 2));
console.log(`アクセス ${out.access.length}件 / 購入 ${out.purchase.length}件`);
