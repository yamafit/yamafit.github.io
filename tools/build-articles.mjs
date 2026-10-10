// 使い方: node tools/build-articles.mjs
// content/articles.mjs（原稿）から、articles/<slug>.html・articles.html・data/articles.json・sitemap.xml を作る。
import fs from "node:fs";
import { ARTICLES, AUTHOR } from "../content/articles.mjs";
const SITE_URL = (fs.readFileSync("js/site.js", "utf8").match(/url:\s*"([^"]+)"/) || [])[1] || "";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const V = Date.now().toString().slice(0, 10);
const head = (title, desc, path, extra = "") => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}｜ヤマフィット</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ヤマフィット">
${SITE_URL ? `<link rel="canonical" href="${SITE_URL}${path}">` : ""}
<link rel="stylesheet" href="${path.startsWith("/articles/") ? "../" : ""}css/style.css?v=${V}">
${extra}</head>`;
const chrome = (rel) => ({
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
    <nav aria-label="フッター"><a href="${rel}articles.html">記事</a><a href="${rel}news.html">最新記事</a><a href="${rel}about.html">運営者情報</a><a href="${rel}privacy.html">プライバシーポリシー</a><a href="${rel}contact.html">お問い合わせ</a></nav>
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

fs.mkdirSync("articles", { recursive: true });
const bySlug = Object.fromEntries(ARTICLES.map((a) => [a.slug, a]));
for (const a of ARTICLES) {
  const c = chrome("../");
  const body = a.sections.map((s) => `<section>
  <h2 class="article-h2">${esc(s.h)}</h2>
  ${(s.p || []).map((t) => `<p class="body-text">${esc(t)}</p>`).join("\n  ")}
  ${s.ul ? `<ul class="article-list">${s.ul.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
  ${s.table ? `<div class="table-wrap"><table class="table"><thead><tr>${s.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((d) => `<td>${esc(d)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}
</section>`).join("\n");
  const ld = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: a.title, datePublished: a.date, dateModified: a.date, author: { "@type": "Organization", name: AUTHOR }, publisher: { "@type": "Organization", name: "ヤマフィット" } })}</script>\n`;
  const related = (a.related || []).map((s) => bySlug[s]).filter(Boolean);
  fs.writeFileSync(`articles/${a.slug}.html`, `${head(a.title, a.desc, `/articles/${a.slug}.html`, ld)}
${c.top}
<main class="doc" style="gap: 24px">
  <div class="stack" style="gap: 12px">
    <div class="crumb"><a href="../index.html">ホーム</a> ／ <a href="../articles.html">記事</a> ／ ${esc(a.category)}</div>
    <h1 class="article-title">${esc(a.title)}</h1>
    <div class="meta"><strong>${AUTHOR}</strong><span class="mono">${a.date} 公開</span><span class="pr-badge">PR</span></div>
  </div>
  <p class="body-text">${esc(a.lead)}</p>
  ${body}
  <section>
    <h2 class="article-h2">この記事で紹介した商品</h2>
    <p class="sub" style="margin-bottom: 8px">価格・重量・在庫は各ブランド公式サイトの記載（確認日つき）にもとづきます。商品を押すと、購入先を選べます。</p>
    <div class="prod-list" data-products="${a.products.join(",")}"></div>
  </section>
  <div class="notice" style="margin: 0">
    <div class="notice-head"><span class="pr-badge">PR</span><span>広告・免責について</span></div>
    <p>この記事にはアフィリエイト広告が含まれます。リンク先での購入により、当サイトが報酬を受け取る場合があります。山行の前には、最新の気象とルートの状況を必ずご確認ください。</p>
  </div>
  ${related.length ? `<section><h2 class="h-section" style="margin-bottom: 8px">あわせて読みたい</h2>${related.map((r) => `<a class="news-item" href="${r.slug}.html"><span class="news-meta"><span class="news-brand">${esc(r.category)}</span><span>${r.date}</span></span><span class="news-title">${esc(r.title)}</span></a>`).join("")}</section>` : ""}
</main>
${c.bottom}`);
}

// 記事一覧
{
  const c = chrome("");
  fs.writeFileSync("articles.html", `${head("記事一覧", "登山靴・レインウェア・ザック・ポールなど、登山装備の選び方をまとめた記事の一覧です。", "/articles.html")}
${c.top}
<main class="doc" style="gap: 20px">
  <div class="stack" style="gap: 8px">
    <div class="crumb"><a href="index.html">ホーム</a> ／ 記事</div>
    <h1>記事一覧</h1>
    <p class="doc-lead">登山装備の選び方を、初心者の目線でまとめています。</p>
  </div>
  <div class="news">${[...ARTICLES].sort((a, b) => b.date.localeCompare(a.date)).map((a) => `<a class="news-item" href="articles/${a.slug}.html"><span class="news-meta"><span class="news-brand">${esc(a.category)}</span><span>${a.date}</span></span><span class="news-title">${esc(a.title)}</span><span class="sub">${esc(a.desc)}</span></a>`).join("")}</div>
</main>
${c.bottom}`);
}
fs.writeFileSync("data/articles.json", JSON.stringify(ARTICLES.map(({ slug, title, category, date, desc }) => ({ slug, title, category, date, desc })), null, 1));

// sitemap / robots
const pages = ["index.html", "articles.html", "news.html", "about.html", "contact.html", "privacy.html", "question.html", ...ARTICLES.map((a) => `articles/${a.slug}.html`), ...["boots", "pack", "poles", "rain", "wear", "pants", "tent"].map((k) => `category.html?c=${k}`)];
if (SITE_URL) {
  fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${SITE_URL}${p === "index.html" ? "" : p}</loc></url>`).join("\n")}\n</urlset>\n`);
  fs.writeFileSync("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
}
console.log(`記事 ${ARTICLES.length}本`);
