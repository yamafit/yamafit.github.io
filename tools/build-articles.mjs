// 使い方: node tools/build-articles.mjs
// content/articles.mjs（原稿）から、articles/<slug>.html・articles.html・data/articles.json・sitemap.xml を作る。
import fs from "node:fs";
import { ARTICLES, AUTHOR } from "../content/articles.mjs";
import { SITE_URL, esc, V, head, chrome } from "./shell.mjs";
fs.mkdirSync("articles", { recursive: true });
const bySlug = Object.fromEntries(ARTICLES.map((a) => [a.slug, a]));
for (const a of ARTICLES) {
  const c = chrome("../");
  // 見出しで見た目を変える：メリット＝✓、デメリット・注意＝！、まとめ＝囲み
  const listCls = (h) => /デメリット|注意|弱点/.test(h) ? "article-list article-list--con" : /メリット|特徴|ポイント|良い/.test(h) ? "article-list article-list--pro" : "article-list";
  // 「向いている人・向いていない人」は2つの色付きの枠に分ける（good / bad。古い書き方の記事も読み分ける）
  const fitSplit = (s) => {
    if (s.good || s.bad) return { good: s.good || [], bad: s.bad || [] };
    const p = s.p || [], ul = s.ul || [];
    if (ul.length && p.length === 2 && /向いている/.test(p[0]) && /向いていない/.test(p[1])) {
      const n = s.split ?? Math.ceil(ul.length / 2);
      return { good: ul.slice(0, n), bad: ul.slice(n) };
    }
    const good = p.filter((t) => /^向いている/.test(t)).map((t) => t.replace(/^向いているのは、?/, ""));
    const bad = p.filter((t) => /^向いていない/.test(t)).map((t) => t.replace(/^向いていないのは、?/, ""));
    if (good.length || bad.length) return { good: [...good, ...(ul.length ? ul : [])], bad };
    return null;
  };
  const fitBox = (f) => `<div class="fit-grid">
    <div class="fit fit--good"><h3 class="fit-h"><span class="fit-ic">◎</span>向いている人</h3><ul>${f.good.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
    <div class="fit fit--bad"><h3 class="fit-h"><span class="fit-ic">△</span>向いていない人</h3><ul>${f.bad.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
  </div>`;
  const body = a.sections.map((s) => /向いて/.test(s.h) && fitSplit(s) ? `<section>
  <h2 class="article-h2">${esc(s.h)}</h2>
  ${fitBox(fitSplit(s))}
</section>` : `<section${/まとめ/.test(s.h) ? ' class="sec-summary"' : ""}>
  <h2 class="article-h2">${esc(s.h)}</h2>
  ${(s.p || []).map((t) => { const m = /特徴|メリット/.test(s.h) && !/デメリット/.test(s.h) && String(t).match(/^([^。]{2,30})。(.+)$/); return m ? `<p class="body-text"><b class="pt-h">${esc(m[1])}</b>${esc(m[2])}</p>` : `<p class="body-text">${esc(t)}</p>`; }).join("\n  ")}
  ${s.ul ? `<ul class="${listCls(s.h)}">${s.ul.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
  ${s.table ? `<div class="table-wrap"><table class="table"><thead><tr>${s.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((d) => `<td>${esc(d)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}
</section>`).join("\n");
  const ld = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: a.title, datePublished: a.date, dateModified: a.date, author: { "@type": "Organization", name: AUTHOR }, publisher: { "@type": "Organization", name: "ヤマフィット" } })}</script>\n`;
  const related = (a.related || []).map((s) => bySlug[s]).filter(Boolean);
  // 記事の写真（毎朝の画像生成で入る。AIで作ったイメージであることを必ず添える）
  const hero = a.image ? `<figure style="margin: 0; display: flex; flex-direction: column; gap: 6px">
    <img src="../${esc(a.image)}" alt="${esc(a.image_alt || a.title)}" width="${a.image_w || 1280}" height="${a.image_h || 1600}" style="width: 100%; max-width: 640px; height: auto; border-radius: 8px; align-self: center" loading="eager">
    <figcaption class="sub" style="text-align: center">画像はAIで作成したイメージです。実際の商品とは細部が異なる場合があります。</figcaption>
  </figure>` : "";
  const og = a.image && SITE_URL ? `<meta property="og:image" content="${SITE_URL}${esc(a.image)}">\n<meta name="twitter:card" content="summary_large_image">\n` : "";
  fs.writeFileSync(`articles/${a.slug}.html`, `${head(a.title, a.desc, `/articles/${a.slug}.html`, og + ld)}
${c.top}
<main class="doc" style="gap: 24px">
  <div class="stack" style="gap: 12px">
    <div class="crumb"><a href="../index.html">ホーム</a> ／ <a href="../articles.html">記事</a> ／ ${esc(a.category)}</div>
    <h1 class="article-title">${esc(a.title)}</h1>
    <div class="meta"><strong>${AUTHOR}</strong><span class="mono">${a.date} 公開</span><span class="pr-badge">PR</span></div>
  </div>
  ${hero}
  <p class="body-text">${esc(a.lead)}</p>
  ${a.week && a.products && a.products.length ? `<div class="top-pick"><span class="eyebrow">この記事で紹介する商品</span><div class="prod-list" data-products="${a.products[0]}"${a.image ? " data-noimg" : ""}></div></div>` : ""}
  ${body}
  <section>
    <h2 class="article-h2">この記事で紹介した商品</h2>
    <p class="sub" style="margin-bottom: 8px">価格・重量・在庫は各ブランド公式サイトの記載（確認日つき）にもとづきます。商品を押すと、購入先を選べます。</p>
    <div class="prod-list" data-products="${a.products.join(",")}"${a.image ? " data-noimg" : ""}></div>
  </section>
  <a class="ig-banner" href="https://www.instagram.com/yama_fit2026/" target="_blank" rel="noopener">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
    <span class="ig-banner-text"><b>Instagramでも毎朝7時に紹介しています</b><small>@yama_fit2026 をフォロー</small></span>
    <span class="ig-banner-btn">フォロー</span>
  </a>
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
    <p><a class="link-more" href="weekly.html"><span>今週の7選を見る</span></a></p>
  </div>
  <div class="news">${[...ARTICLES].sort((a, b) => b.date.localeCompare(a.date)).map((a) => `<a class="news-item" href="articles/${a.slug}.html"><span class="news-meta"><span class="news-brand">${esc(a.category)}</span><span>${a.date}</span></span><span class="news-title">${esc(a.title)}</span><span class="sub">${esc(a.desc)}</span></a>`).join("")}</div>
</main>
${c.bottom}`);
}
// 記事が扱うカテゴリー（カテゴリーページの「記事」欄で使う）
const PROD_CAT = Object.fromEntries((JSON.parse(fs.readFileSync("data/products.json", "utf8")).products || []).map((p) => [p.id, p.category]));
const LABEL_CAT = { "登山靴": "boots", "ザック": "pack", "レインウェア": "rain", "ウェア": "wear", "パンツ": "pants", "トレッキングポール": "poles", "ポール": "poles", "テント泊": "tent" };
const catsOf = (a) => [...new Set([LABEL_CAT[a.category], ...(a.products || []).map((id) => PROD_CAT[id])].filter(Boolean))];
fs.writeFileSync("data/articles.json", JSON.stringify(ARTICLES.map((a) => ({ slug: a.slug, title: a.title, category: a.category, date: a.date, desc: a.desc, cats: catsOf(a), ...(a.week ? { week: a.week, day: a.day, slot: a.slot } : {}), ...(a.image ? { image: a.image } : {}) })), null, 1));

// 今週の7選（管理アプリの週間選定から公開された記事を、週ごと・曜日順に並べる）
{
  const c = chrome("");
  const DAYS = ["月", "火", "水", "木", "金", "土", "日"];
  const SLOT = { outer: "アウター", pack: "ザック", shoes: "シューズ" };
  const md = (s) => { const [, m, d] = s.split("-").map(Number); return `${m}/${d}`; };
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const weeks = {};
  for (const a of ARTICLES.filter((x) => x.week)) (weeks[a.week] ||= []).push(a);
  const keys = Object.keys(weeks).sort().reverse();
  const block = (w, i) => `<section>
    <h2 class="h-section" style="margin-bottom: 4px">${i === 0 ? "最新の週" : "過去の週"}　<span class="mono">${md(w)}〜${md(addDays(w, 6))}</span></h2>
    <div class="news">${weeks[w].sort((a, b) => (a.day ?? 0) - (b.day ?? 0)).map((a) => `<a class="news-item" href="articles/${a.slug}.html"><span class="news-meta"><span class="news-brand">${a.day != null ? DAYS[a.day] + "曜" : ""} ${esc(SLOT[a.slot] || a.category)}</span><span>${a.date}</span></span><span class="news-title">${esc(a.title)}</span></a>`).join("")}</div>
  </section>`;
  fs.writeFileSync("weekly.html", `${head("今週の7選", "季節と天気に合わせて選んだ登山装備を、アウター3・ザック2・シューズ2の7つ、1日1つずつ紹介します。", "/weekly.html")}
${c.top}
<main class="doc" style="gap: 24px">
  <div class="stack" style="gap: 8px">
    <div class="crumb"><a href="index.html">ホーム</a> ／ 今週の7選</div>
    <h1>今週の7選</h1>
    <p class="doc-lead">季節と天気に合わせて選んだ登山装備を、アウター3・ザック2・シューズ2の7つ、1日1つずつ紹介します。</p>
  </div>
  ${keys.length ? keys.map(block).join("\n") : '<div class="empty">今週の記事は準備中です。公開され次第、ここに並びます。</div>'}
  <p><a class="link-more" href="articles.html"><span>記事一覧へ</span></a></p>
</main>
${c.bottom}`);
}

// sitemap / robots
const pages = ["index.html", "articles.html", "weekly.html", "news.html", "about.html", "contact.html", "privacy.html", "products.html", ...JSON.parse(fs.readFileSync("data/product-pages.json", "utf8")).map((id) => `products/${id}.html`), ...ARTICLES.map((a) => `articles/${a.slug}.html`), ...["boots", "pack", "poles", "rain", "wear", "pants", "tent"].map((k) => `category.html?c=${k}`)];
if (SITE_URL) {
  fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${SITE_URL}${p === "index.html" ? "" : p}</loc></url>`).join("\n")}\n</urlset>\n`);
  fs.writeFileSync("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
}
console.log(`記事 ${ARTICLES.length}本`);
