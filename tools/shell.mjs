// ページ共通の head / ヘッダー / フッター（記事・商品ページの生成で共有）
import fs from "node:fs";
export const SITE_URL = (fs.readFileSync("js/site.js", "utf8").match(/url:\s*"([^"]+)"/) || [])[1] || "";
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const V = Date.now().toString().slice(0, 10);
export const head = (title, desc, path, extra = "") => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}｜ヤマフィット</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${path.startsWith("/articles/") ? "article" : "website"}">
<meta property="og:site_name" content="ヤマフィット">
${SITE_URL ? `<link rel="canonical" href="${SITE_URL}${path}">` : ""}
<link rel="stylesheet" href="${path.split("/").length > 2 ? "../" : ""}css/style.css?v=${V}">
${extra}</head>`;
export const chrome = (rel) => ({
  top: `<body>
<div class="page">
<header class="header header--line" id="top">
  <a class="logo" href="${rel}index.html"><b>ヤマフィット</b><span>YAMAFIT</span></a>
  <button class="icon-btn" type="button" aria-label="メニューを開く"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
</header>
`,
  bottom: `</div>
<footer class="footer">
  <div class="footer-inner">
    <nav aria-label="フッター"><a href="${rel}products.html">商品一覧</a><a href="${rel}articles.html">記事</a><a href="${rel}weekly.html">今週の7選</a><a href="${rel}news.html">最新記事</a><a href="${rel}about.html">運営者情報</a><a href="${rel}privacy.html">プライバシーポリシー</a><a href="${rel}contact.html">お問い合わせ</a><a href="https://www.instagram.com/yama_fit2026/" target="_blank" rel="noopener">Instagram</a></nav>
    <div class="mono">YAMAFIT</div>
  </div>
</footer>
<script src="${rel}js/site.js?v=${V}"></script>
<script src="${rel}js/app.js?v=${V}"></script>
<script src="${rel}js/menu.js?v=${V}"></script>
<script src="${rel}js/articles.js?v=${V}"></script>
<script src="${rel}js/shop.js?v=${V}"></script>
</body>
</html>
`,
});

