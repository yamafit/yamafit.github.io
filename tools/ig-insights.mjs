// Instagram の反応（リーチ・いいね・保存など）を集めて data/ig-insights.json に保存する。投稿はしない。
// 使い方: INSTAGRAM_ACCESS_TOKEN=... node tools/ig-insights.mjs
import fs from "node:fs";
const T = process.env.INSTAGRAM_ACCESS_TOKEN;
if (!T) { console.error("INSTAGRAM_ACCESS_TOKEN がありません"); process.exit(1); }
const V = process.env.IG_API_VERSION || "v23.0";
const base = `https://graph.instagram.com/${V}`;
const get = async (path, params = {}) => {
  const u = new URL(base + path);
  for (const [k, v] of Object.entries({ ...params, access_token: T })) u.searchParams.set(k, v);
  const r = await fetch(u); const j = await r.json();
  if (j.error) throw new Error(`${j.error.code || ""} ${j.error.message || "error"}`.trim());
  return j;
};
const OUT = "data/ig-insights.json";
const db = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { _note: "Instagramの反応の記録（tools/ig-insights.mjs が更新）", profile: [], media: {} };
const now = new Date().toISOString();
const errors = [];
try {
  const me = await get("/me", { fields: "username,followers_count,follows_count,media_count" });
  db.profile.push({ at: now, followers: me.followers_count, following: me.follows_count, media: me.media_count });
  db.profile = db.profile.slice(-400);
} catch (e) { errors.push(`プロフィール: ${e.message}`); }
// 共通で使える指標（動画つきのカルーセルも含め、取れない指標は1つずつ外して取り直す）
const METRICS = ["reach", "likes", "comments", "saved", "shares", "total_interactions", "views"];
async function insights(id) {
  let ms = [...METRICS];
  for (let i = 0; i < METRICS.length; i++) {
    try {
      const j = await get(`/${id}/insights`, { metric: ms.join(",") });
      const o = {}; for (const d of j.data || []) o[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? null;
      return o;
    } catch (e) {
      const bad = ms.find((m) => e.message.includes(m));
      if (!bad) throw e;
      ms = ms.filter((m) => m !== bad);
    }
  }
  return {};
}
try {
  const list = await get("/me/media", { fields: "id,timestamp,permalink,media_type,caption", limit: "40" });
  for (const m of list.data || []) {
    const rec = db.media[m.id] || { permalink: m.permalink, timestamp: m.timestamp, type: m.media_type, title: (m.caption || "").split("\n")[0].slice(0, 80) };
    try { rec.insights = await insights(m.id); rec.updated = now; delete rec.error; }
    catch (e) { rec.error = e.message; errors.push(`${m.permalink}: ${e.message}`); }
    db.media[m.id] = rec;
  }
} catch (e) { errors.push(`投稿一覧: ${e.message}`); }
db.last_run = { at: now, errors: errors.slice(0, 10) };
fs.writeFileSync(OUT, JSON.stringify(db, null, 1) + "\n");
const n = Object.values(db.media).filter((m) => m.insights && m.updated === now).length;
console.log(`反応を取得した投稿: ${n} 件` + (errors.length ? `／エラー ${errors.length} 件: ${errors[0]}` : ""));
if (!n && errors.length) process.exit(1);
