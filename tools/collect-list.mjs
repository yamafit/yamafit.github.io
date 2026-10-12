// 使い方: node tools/collect-list.mjs <slug> <category> <一覧URL> <商品リンクの正規表現> [最大件数]
// 一覧ページから商品ページのURLを拾い、collect-generic.mjs で公式ページの記載を取り込む（低頻度）。
import { execFileSync } from "node:child_process";
const [slug, cat, list, re, maxArg] = process.argv.slice(2);
const max = Number(maxArg || 8);
const html = await (await fetch(list, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "ja" }, redirect: "follow" })).text();
const rx = new RegExp(re);
const urls = [];
for (const m of html.matchAll(/href=["']([^"'#]+)["']/g)) {
  let u; try { u = new URL(m[1].replace(/&amp;/g, "&"), list).href.replace(/\?clr_id=\d+/, ""); } catch { continue; }
  if (rx.test(u) && !urls.includes(u)) urls.push(u);
}
console.log(`${list} → ${urls.length}件中 ${Math.min(max, urls.length)}件を取得`);
if (urls.length) execFileSync("node", ["tools/collect-generic.mjs", slug, cat, ...urls.slice(0, max)], { stdio: "inherit", env: { ...process.env, DELAY: process.env.DELAY || "2000" } });
