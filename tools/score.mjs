// 使い方: node tools/score.mjs   （data/market.json を読んで、売れそうな順に表示）
// 期待報酬 ≒ 月間検索数 × クリック率 × 購入率 × 価格 × 報酬率 を、競合の強さと購入意欲で補正
import { readJson } from "./lib.mjs";
const CTR = 0.03, CVR = 0.02;
const { items } = readJson("data/market.json");
const rows = items.map((m) => {
  const base = m.monthly_search * CTR * CVR * m.price * m.commission_rate;
  const score = base * (m.intent / 3) / m.competition;
  return { id: m.id, 検索数: m.monthly_search, 競合: m.competition, 価格: m.price, 報酬率: m.commission_rate, 意欲: m.intent, 月間見込み円: Math.round(score) };
}).sort((a, b) => b.月間見込み円 - a.月間見込み円);
console.table(rows);
