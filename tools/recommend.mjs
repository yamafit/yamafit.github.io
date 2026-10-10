// 使い方: node tools/recommend.mjs [--no-ai] [--dry]
// カテゴリごとに「AIのおすすめ」を最大3つ選び、data/recommendations.json に保存する。
// 材料: 今の季節 / 商品ごとのクリック数（data/clicks.csv: id,clicks）/ カテゴリ別の購入数（data/rankings.json）
// ANTHROPIC_API_KEY があればClaudeが選んで理由を書く。無ければ（または失敗したら）同じ材料の点数で選ぶ。
import fs from "node:fs";
import { readJson, askClaude, SYSTEM } from "./lib.mjs";

const noAi = process.argv.includes("--no-ai"), dry = process.argv.includes("--dry");
const { products } = readJson("data/products.json");

const month = Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "Asia/Tokyo" }).format(new Date()));
const season = month >= 3 && month <= 5 ? "spring" : month <= 8 && month >= 6 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
const SEASON_JA = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

const clicks = {};
if (fs.existsSync("data/clicks.csv")) {
  for (const l of fs.readFileSync("data/clicks.csv", "utf8").trim().split(/\r?\n/).slice(1)) {
    const [id, n] = l.split(",").map((s) => s.trim()); if (id && Number(n) > 0) clicks[id] = Number(n);
  }
}
let sales = {};
try { sales = readJson("data/rankings.json").purchaseByCategory || {}; } catch {}
const bought = (p) => (sales[p.category] || []).reduce((n, r) => n + (r.title.includes(p.name) && p.name !== "[商品名]" ? r.count : 0), 0);

const ruleScore = (p) => (p.season.includes(season) ? 3 : 0) + Math.log1p(clicks[p.id] || 0) * 2 + Math.log1p(bought(p)) * 3;

function rulePick(cands) {
  // 点数の高い順に選ぶ。ただし同じブランドに偏らないよう、別ブランドを優先する
  const ranked = cands.map((p) => ({ p, s: ruleScore(p) + (stableJitter(p.id) * 0.01) })).sort((a, b) => b.s - a.s).map((x) => x.p);
  const picks = [];
  for (const p of ranked) if (picks.length < 3 && !picks.some((q) => q.brand === p.brand)) picks.push(p);
  for (const p of ranked) if (picks.length < 3 && !picks.includes(p)) picks.push(p);
  return picks.map((p) => ({
    id: p.id, source: "rule",
    reason: p.season.includes(season) ? `${SEASON_JA[season]}の山行に合うため。${p.default_reason}` : p.default_reason,
  }));
}
// 同点のとき、毎回同じ順にならないよう日付で入れ替える（同じ日の中では安定）
function stableJitter(id) { let h = 0; const s = id + new Date().toISOString().slice(0, 10); for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 1000) / 1000; }

async function aiPick(category, cands) {
  const facts = cands.map((p) => ({ id: p.id, spec: p.spec, season: p.season.map((s) => SEASON_JA[s]), for_whom: p.for_whom, features: p.features,
    clicks_30d: clicks[p.id] || 0, purchases_30d: bought(p) }));
  const prompt = `カテゴリ「${category}」のおすすめを、候補から最大3つ選んでください。
今は${month}月（${SEASON_JA[season]}）です。判断材料は、季節との合い方、クリック数、購入数です。数字が全て0なら、季節と商品の特徴だけで選んでください。できるだけ別々のブランドから選んでください。
候補データ:
${JSON.stringify(facts, null, 2)}

次のJSONだけを返してください。reason は60字以内、候補データにある事実と季節・数字だけで書き、仕様や価格を作らないこと。
{"picks":[{"id":"候補のid","reason":"..."}]}`;
  if (dry) { console.log(prompt); return null; }
  const text = await askClaude(prompt, { system: SYSTEM, maxTokens: 800 });
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const ids = new Set(cands.map((p) => p.id));
  const picks = json.picks.filter((x) => ids.has(x.id)).slice(0, 3).map((x) => ({ id: x.id, reason: String(x.reason).slice(0, 80), source: "ai" }));
  if (!picks.length) throw new Error("no valid picks");
  return picks;
}

const categories = [...new Set(products.map((p) => p.category))];
const out = { updated: new Date().toISOString(), season, categories: {} };
for (const cat of categories) {
  const cands = products.filter((p) => p.category === cat);
  let picks = null;
  if (!noAi && process.env.ANTHROPIC_API_KEY) {
    try { picks = await aiPick(cat, cands); } catch (e) { console.warn(`${cat}: AI選定に失敗、点数で選びます (${e.message})`); }
  }
  if (dry) continue;
  out.categories[cat] = picks || rulePick(cands);
  console.log(cat, out.categories[cat].map((x) => `${x.id}(${x.source})`).join(", "));
}
if (!dry) fs.writeFileSync("data/recommendations.json", JSON.stringify(out, null, 2));
