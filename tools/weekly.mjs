// 使い方: node tools/weekly.mjs [--dry]   （data/analytics.csv を読んで改善案を out/weekly.md に出力）
// CSVの作り方: GA4やASP管理画面の数値を page,sessions,product_clicks,exit_rate の形で貼る
import fs from "node:fs";
import { askClaude, SYSTEM } from "./lib.mjs";
const csv = fs.readFileSync("data/analytics.csv", "utf8");
const prompt = `次はヤマフィットの今週のページ別データです。
${csv}
次の形で答えてください。
1. 今週わかったこと（3点まで。数字を引用）
2. 商品リンクのクリック率（product_clicks ÷ sessions）が低いページと、直す案
3. 離脱が多いページと、直す案
4. 来週つくる記事の候補を3本
データが少なく判断できない場合は、そう書いてください。`;
if (process.argv.includes("--dry")) { console.log(prompt); process.exit(0); }
const text = await askClaude(prompt, { system: SYSTEM, maxTokens: 1500 });
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/weekly.md", text);
console.log("作成: out/weekly.md");
