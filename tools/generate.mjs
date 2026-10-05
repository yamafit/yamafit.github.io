// 使い方: node tools/generate.mjs <商品id> [--dry]
// 1商品 → 記事 / 比較記事の案 / Instagram / ショート動画台本 / X投稿 を out/<id>/ に出力
import fs from "node:fs";
import { readJson, askClaude, SYSTEM } from "./lib.mjs";

const [id, ...flags] = process.argv.slice(2);
const dry = flags.includes("--dry");
const { products } = readJson("data/products.json");
const p = products.find((x) => x.id === id);
if (!p) { console.error("商品が見つかりません。候補:", products.map((x) => x.id).join(", ")); process.exit(1); }
const related = (p.related || []).map((r) => products.find((x) => x.id === r)).filter(Boolean);
const data = JSON.stringify({ product: p, related }, null, 2);

const jobs = {
  "article.md": "この商品の紹介記事を書いてください。見出し構成: どんな商品か / 初心者向きか / どんな山行に向くか / 普段使いできるか / 季節 / サイズ選び（データにあれば）/ 合う人・合わない人。各見出しは問いの形にし、最後に比較記事への導線を一文入れる。",
  "compare-ideas.md": "この商品と関連商品を使った比較記事の企画を5本出してください。各案にタイトル案、想定読者、「あなたならどっち？」の結論の出し方（軽さ重視ならA、のような分岐）を付ける。",
  "instagram.md": "Instagram投稿を3案。冒頭1行は読者の悩み、本文は150字以内、ハッシュタグ8個。",
  "shorts-script.md": "TikTok / YouTube Shorts / Instagramリール共通の30秒台本を2案。秒数ごとに「映像」「ナレーション」「字幕」を表にする。冒頭3秒は悩みの提示から始める。",
  "x-posts.md": "X投稿を5案。各140字以内。PRである旨を最初か最後に入れる。",
};

fs.mkdirSync(`out/${id}`, { recursive: true });
for (const [file, task] of Object.entries(jobs)) {
  const prompt = `${task}\n\n# 商品データ\n${data}`;
  if (dry) { console.log(`--- ${file} ---\n${prompt}\n`); continue; }
  const text = await askClaude(prompt, { system: SYSTEM, maxTokens: 2500 });
  fs.writeFileSync(`out/${id}/${file}`, text);
  console.log("作成:", `out/${id}/${file}`);
}
