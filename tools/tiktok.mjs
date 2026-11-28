// 作ってある縦動画を TikTok に投稿する（TikTok Content Posting API。.github/workflows/tiktok-post.yml から実行）
//
//   node tools/tiktok.mjs        環境変数 TIKTOK_FILE（動画）と TIKTOK_CAPTION_FILE（投稿文）を使って投稿
//
// 環境変数:
//   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REFRESH_TOKEN  … TikTok for Developers のアプリと、本人の認可で得たもの（必須）
//   TIKTOK_FILE, TIKTOK_CAPTION_FILE  … 動画と投稿文（Instagramのリールと同じファイルでよい）
//   TIKTOK_MODE        direct（既定。そのまま投稿）／ inbox（下書きとして TikTok アプリの受信箱に送る。video.upload だけで動く）
//   TIKTOK_PRIVACY     SELF_ONLY（既定。自分だけ）／ PUBLIC_TO_EVERYONE など。
//                      ※ TikTok の審査（Audit）を通るまでは、公開で投稿しようとしても API が拒否する
//   TIKTOK_COVER_MS    表紙にする位置（ミリ秒）
//   TIKTOK_BRAND_CONTENT=1  「広告・タイアップ」として申告する（自分のブランドではなく他社商品を紹介する投稿向け）
//   DRY_RUN=1          API を呼ばず、投稿内容の確認だけする
import fs from "node:fs";
import path from "node:path";

const API = "https://open.tiktokapis.com";
const POSTS = "data/tiktok-posts.json";
const env = process.env;
const DRY = env.DRY_RUN === "1";
const log = (...a) => console.log(...a);

const file = env.TIKTOK_FILE, capFile = env.TIKTOK_CAPTION_FILE;
if (!file || !fs.existsSync(file)) throw new Error("TIKTOK_FILE の動画がありません: " + file);
if (!capFile || !fs.existsSync(capFile)) throw new Error("TIKTOK_CAPTION_FILE の投稿文がありません: " + capFile);
const caption = fs.readFileSync(capFile, "utf8").trim();
if (!/#PR/.test(caption)) throw new Error("投稿文に #PR がありません（Instagramと同じく広告表記を必須にしています）");
if ([...caption].length > 2200) throw new Error("投稿文が2200文字を超えています: " + [...caption].length);

const mode = env.TIKTOK_MODE || "direct";
const privacy = env.TIKTOK_PRIVACY || "SELF_ONLY";
const size = fs.statSync(file).size;
const key = `tiktok:${path.basename(file)}`;
const posts = fs.existsSync(POSTS) ? JSON.parse(fs.readFileSync(POSTS, "utf8")) : {};

if (posts[key] && !DRY) { log("この動画はもう投稿済みです:", posts[key].publish_id); process.exit(0); }
if (DRY) {
  log(`DRY_RUN: ${file}（${(size / 1e6).toFixed(1)}MB） mode=${mode} privacy=${privacy}\n${caption}`);
  process.exit(0);
}
for (const k of ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN"]) if (!env[k]) throw new Error(`${k} が未設定です`);

async function call(url, opt, what) {
  const r = await fetch(url, opt);
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  const code = j.error && j.error.code;
  if (!r.ok || (code && code !== "ok")) throw new Error(`${what}に失敗: HTTP ${r.status} ${code || ""} ${(j.error && j.error.message) || j.error_description || j.raw || ""}`);
  return j;
}

// 1. アクセストークンを更新（有効期限24時間。リフレッシュトークンは1年）
const tok = await call(`${API}/v2/oauth/token/`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: env.TIKTOK_REFRESH_TOKEN }),
}, "トークンの更新");
if (!tok.access_token) throw new Error("アクセストークンが返りませんでした");
if (tok.refresh_token && tok.refresh_token !== env.TIKTOK_REFRESH_TOKEN) {
  const m = "TikTok のリフレッシュトークンが新しくなりました。Secrets の TIKTOK_REFRESH_TOKEN を更新してください（古いほうは近いうちに使えなくなります）";
  log(m); if (env.GITHUB_ACTIONS) console.log("::warning::" + m);
}
const auth = { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json; charset=UTF-8" };

// 2. 投稿できる範囲を確認（direct のときだけ）
let init;
const chunk = size < 5 * 1024 * 1024 ? size : 10 * 1024 * 1024; // 5MB未満は1回で送る。それ以上は10MBずつ（最後の1つは大きくなってよい）
const total = Math.max(1, Math.floor(size / chunk));
const source_info = { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: total };
if (mode === "direct") {
  const ci = (await call(`${API}/v2/post/publish/creator_info/query/`, { method: "POST", headers: auth }, "投稿先の確認")).data || {};
  log("投稿先:", ci.creator_username || "?", "選べる公開範囲:", (ci.privacy_level_options || []).join(","));
  if (!(ci.privacy_level_options || []).includes(privacy)) throw new Error(`公開範囲 ${privacy} は今は選べません（審査前は SELF_ONLY のみのことがあります）`);
  const post_info = {
    title: caption, privacy_level: privacy,
    disable_duet: true, disable_stitch: true, disable_comment: false,
    ...(env.TIKTOK_COVER_MS ? { video_cover_timestamp_ms: parseInt(env.TIKTOK_COVER_MS, 10) } : {}),
    ...(env.TIKTOK_BRAND_CONTENT === "1" ? { brand_content_toggle: true } : {}),
  };
  init = await call(`${API}/v2/post/publish/video/init/`, { method: "POST", headers: auth, body: JSON.stringify({ post_info, source_info }) }, "投稿の開始");
} else {
  init = await call(`${API}/v2/post/publish/inbox/video/init/`, { method: "POST", headers: auth, body: JSON.stringify({ source_info }) }, "下書きの開始");
}
const { publish_id, upload_url } = init.data || {};
if (!publish_id || !upload_url) throw new Error("publish_id / upload_url が返りませんでした: " + JSON.stringify(init));

// 3. 動画を送る
const buf = fs.readFileSync(file);
for (let i = 0; i < total; i++) {
  const start = i * chunk, end = i === total - 1 ? size - 1 : start + chunk - 1;
  const r = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
    body: buf.subarray(start, end + 1),
  });
  if (![200, 201, 206].includes(r.status)) throw new Error(`動画の送信に失敗: HTTP ${r.status} ${await r.text()}`);
}
log("動画を送りました。TikTok の処理を待ちます");

// 4. 処理の完了を待つ
let st = "", last = {};
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 10000));
  last = (await call(`${API}/v2/post/publish/status/fetch/`, { method: "POST", headers: auth, body: JSON.stringify({ publish_id }) }, "状況の確認")).data || {};
  st = last.status;
  if (st === "PUBLISH_COMPLETE" || st === "SEND_TO_USER_INBOX") break;
  if (st === "FAILED") throw new Error("TikTok が処理に失敗しました: " + (last.fail_reason || "不明"));
}
if (st !== "PUBLISH_COMPLETE" && st !== "SEND_TO_USER_INBOX") throw new Error("処理が終わりませんでした: " + st);

posts[key] = { publish_id, status: st, mode, privacy: mode === "direct" ? privacy : "", post_ids: last.publicaly_available_post_id || [], posted_at: new Date().toISOString(), video: file };
fs.writeFileSync(POSTS, JSON.stringify(posts, null, 1) + "\n");
const msg = `TikTok ${st === "SEND_TO_USER_INBOX" ? "下書きを送りました（アプリの受信箱で投稿してください）" : "に投稿しました"}: ${publish_id}`;
log(msg); if (env.GITHUB_ACTIONS) console.log("::notice::" + msg);
