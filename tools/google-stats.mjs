// GA4 とサーチコンソールの数字を集めて data/google-stats.json に保存する（週次レポート用。サイトの表示は変えない）。
// 使い方: GOOGLE_SA_JSON='<サービスアカウントの鍵JSON>' node tools/google-stats.mjs
// 追加のパッケージは使わない（鍵の署名は node:crypto）。
import fs from "node:fs";
import crypto from "node:crypto";

const GA4_PROPERTY = process.env.GA4_PROPERTY_ID || "555749476";
const GSC_SITE = process.env.GSC_SITE_URL || "https://yamafit.github.io/";
const OUT = "data/google-stats.json";

const raw = process.env.GOOGLE_SA_JSON;
if (!raw) { console.error("GOOGLE_SA_JSON がありません（GitHub の Secrets を確認）"); process.exit(1); }
let sa;
try { sa = JSON.parse(raw); } catch { console.error("GOOGLE_SA_JSON が JSON として読めません"); process.exit(1); }

const b64u = (s) => Buffer.from(s).toString("base64url");
async function token(scopes) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`認証に失敗: ${j.error_description || j.error || r.status}`);
  return j.access_token;
}
async function post(url, tk, payload) {
  const r = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${tk}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${j.error?.message || JSON.stringify(j).slice(0, 200)}`);
  return j;
}

// 日付（日本時間）
const jst = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const daysAgo = (n) => jst(new Date(Date.now() - n * 86400e3));
const today = jst(new Date());
const week = { start: daysAgo(7), end: daysAgo(1) };          // 直近7日（昨日まで）
const prev = { start: daysAgo(14), end: daysAgo(8) };          // その前の7日
const gscWeek = { start: daysAgo(10), end: daysAgo(4) };       // サーチコンソールは2〜3日遅れるので少しずらす
const gsc28 = { start: daysAgo(31), end: daysAgo(4) };

const errors = [];
const snap = { at: new Date().toISOString(), date: today, range: week, prev_range: prev };

// ---- GA4 ----
const ga = (tk, body) => post(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`, tk, body);
const rows = (j, dims, mets) => (j.rows || []).map((r) => {
  const o = {};
  dims.forEach((d, i) => (o[d] = r.dimensionValues[i].value));
  mets.forEach((m, i) => (o[m] = Number(r.metricValues[i].value)));
  return o;
});
try {
  const tk = await token(["https://www.googleapis.com/auth/analytics.readonly"]);
  const dr = [{ startDate: week.start, endDate: week.end, name: "week" }, { startDate: prev.start, endDate: prev.end, name: "prev" }];
  // 全体（今週と前週）
  const tot = await ga(tk, { dateRanges: dr, metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "totalUsers" }] });
  snap.ga4_total = {};
  for (const r of tot.rows || []) {
    const name = r.dimensionValues?.[0]?.value || "week";
    snap.ga4_total[name] = { views: +r.metricValues[0].value, sessions: +r.metricValues[1].value, users: +r.metricValues[2].value };
  }
  // ページ別（今週）
  const pages = await ga(tk, {
    dateRanges: [{ startDate: week.start, endDate: week.end }],
    dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
    metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 50,
  });
  snap.ga4_pages = rows(pages, ["pagePath", "pageTitle"], ["screenPageViews", "sessions"]);
  // 流入元（今週）
  const src = await ga(tk, {
    dateRanges: [{ startDate: week.start, endDate: week.end }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }, { name: "sessionSource" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 20,
  });
  snap.ga4_sources = rows(src, ["channel", "source"], ["sessions"]);
  // イベント（affiliate_click・diagnosis_result・select_item）の件数とページ別
  const ev = await ga(tk, {
    dateRanges: [{ startDate: week.start, endDate: week.end }],
    dimensions: [{ name: "eventName" }, { name: "pagePath" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: ["affiliate_click", "diagnosis_result", "select_item"] } } },
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }], limit: 100,
  });
  snap.ga4_events = rows(ev, ["eventName", "pagePath"], ["eventCount"]);
  // 商品ごとのクリック（item_id はカスタムディメンションに登録済みのときだけ取れる。無ければ飛ばす）
  try {
    const it = await ga(tk, {
      dateRanges: [{ startDate: week.start, endDate: week.end }],
      dimensions: [{ name: "customEvent:item_id" }, { name: "customEvent:shop" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { value: "affiliate_click" } } }, limit: 100,
    });
    snap.ga4_affiliate_items = rows(it, ["item_id", "shop"], ["eventCount"]);
  } catch (e) { snap.ga4_affiliate_items = null; snap.ga4_note = "商品ごとのクリック（item_id）は、GA4 のカスタムディメンションに未登録のため未取得"; }
} catch (e) { errors.push(`GA4: ${e.message}`); }

// ---- サーチコンソール ----
try {
  const tk = await token(["https://www.googleapis.com/auth/webmasters.readonly"]);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`;
  const q = (range, dims, limit) => post(url, tk, { startDate: range.start, endDate: range.end, dimensions: dims, rowLimit: limit });
  const map = (j, dims) => (j.rows || []).map((r) => {
    const o = {}; dims.forEach((d, i) => (o[d] = r.keys[i]));
    return { ...o, clicks: r.clicks, impressions: r.impressions, ctr: +r.ctr.toFixed(4), position: +r.position.toFixed(1) };
  });
  const totW = await q(gscWeek, [], 1);
  const tot28 = await q(gsc28, [], 1);
  const t = (j) => { const r = j.rows?.[0]; return r ? { clicks: r.clicks, impressions: r.impressions, ctr: +r.ctr.toFixed(4), position: +r.position.toFixed(1) } : { clicks: 0, impressions: 0 }; };
  snap.gsc = {
    site: GSC_SITE, range_week: gscWeek, range_28d: gsc28,
    total_week: t(totW), total_28d: t(tot28),
    queries_28d: map(await q(gsc28, ["query"], 50), ["query"]),
    pages_28d: map(await q(gsc28, ["page"], 50), ["page"]),
  };
} catch (e) { errors.push(`サーチコンソール: ${e.message}`); }

snap.errors = errors;
const db = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { _note: "GA4とサーチコンソールの数字（tools/google-stats.mjs が毎週更新）", snapshots: [] };
db.snapshots = db.snapshots.filter((s) => s.date !== today);
db.snapshots.push(snap);
db.snapshots = db.snapshots.slice(-60);
db.last_run = { at: snap.at, errors };
fs.writeFileSync(OUT, JSON.stringify(db, null, 1) + "\n");

const w = snap.ga4_total?.week;
console.log(`GA4: ${w ? `閲覧 ${w.views}・セッション ${w.sessions}・ユーザー ${w.users}` : "取得できず"}`);
console.log(`サーチコンソール: ${snap.gsc ? `28日 表示 ${snap.gsc.total_28d.impressions}・クリック ${snap.gsc.total_28d.clicks}` : "取得できず"}`);
if (errors.length) { for (const e of errors) console.log(`::warning::${e}`); }
if (!snap.ga4_total && !snap.gsc) process.exit(1);
