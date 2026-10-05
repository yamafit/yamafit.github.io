// カテゴリページ：?c=boots など。アイテム（products.json）と関連する最新記事（news.json）を表示
const CATS = {
  boots: { label: "登山靴", lead: "ローカットとミッドカットの違い、行き先に合う一足の選び方。", product: "boots", words: ["登山靴", "トレッキングシューズ", "シューズ", "ブーツ"] },
  pack: { label: "ザック", lead: "日帰りから泊まりまで、容量と背負い心地の選び方。", product: "pack", words: ["ザック", "バックパック", "リュック"] },
  rain: { label: "レインウェア", lead: "耐水圧だけでなく、蒸れにくさで選ぶレインウェア。", product: null, words: ["レインウェア", "レインジャケット", "ゴアテックス", "GORE-TEX"] },
  wear: { label: "ウェア", lead: "季節に合わせた重ね着と、街でも着られる山のウェア。", product: null, words: ["ジャケット", "ウェア", "フリース", "パンツ"] },
  tent: { label: "テント泊", lead: "テントや寝具など、泊まりの装備を選ぶヒント。", product: null, words: ["テント", "シュラフ", "寝袋", "キャンプ"] },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = (s) => String(s).normalize("NFKC").toLowerCase();
const ago = (iso) => { const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000)); if (m < 60) return `${m}分前`; if (m < 1440) return `${Math.floor(m / 60)}時間前`; const d = new Date(iso); return `${d.getMonth() + 1}月${d.getDate()}日`; };

document.addEventListener("DOMContentLoaded", async () => {
  const key = new URLSearchParams(location.search).get("c");
  const cat = CATS[key] || CATS.boots;
  const k = CATS[key] ? key : "boots";

  document.title = `${cat.label}｜ヤマフィット`;
  document.getElementById("cat-title").textContent = cat.label;
  document.getElementById("cat-lead").textContent = cat.lead;
  document.getElementById("crumb").textContent = cat.label;
  document.getElementById("cat-nav").innerHTML =
    '<a class="cat cat--primary" href="question.html">AI診断</a>' +
    Object.entries(CATS).map(([id, c]) => `<a class="cat" href="category.html?c=${id}"${id === k ? ' aria-current="page" style="border-color: var(--green); background: var(--green-tint); font-weight: 700"' : ""}>${c.label}</a>`).join("");

  // 購入ランキング（このカテゴリの上位3位）
  const rankEl = document.getElementById("cat-rank");
  try {
    const r = await (await fetch("data/rankings.json", { cache: "no-cache" })).json();
    const top3 = ((r.purchaseByCategory || {})[k] || []).slice(0, 3);
    rankEl.innerHTML = top3.length ? top3.map((x, i) => `<li class="rank"><a href="${esc(x.url)}">
      <span class="rank-no">${i + 1}</span><span class="item-body"><span class="item-title">${esc(x.title)}</span></span>
      <span class="rank-count">${Number(x.count).toLocaleString()}件</span></a></li>`).join("") : '<li class="empty">集計中です。</li>';
    if (top3.length) document.getElementById("cat-rank-note").textContent = `直近30日のリンク経由の購入数${r.updated ? "（" + r.updated.slice(0, 10) + " 時点）" : ""}`;
  } catch { rankEl.innerHTML = '<li class="empty">集計中です。</li>'; }

  // アイテム
  const itemsEl = document.getElementById("cat-items");
  let products = [];
  try { products = (await (await fetch("data/products.json", { cache: "no-cache" })).json()).products; } catch {}
  const mine = cat.product ? products.filter((p) => p.category === cat.product) : [];
  itemsEl.innerHTML = mine.length ? mine.map((p) => {
    const url = p.affiliate && p.affiliate.amazon;
    return `<a class="res-item" href="${url ? esc(url) : "question.html"}"${url ? ' target="_blank" rel="sponsored noopener"' : ""}>
      <b>${esc(p.brand)} ${esc(p.name)}</b><span class="spec">${esc(p.spec)}${url ? "" : "　／　AI診断で選ぶ"}</span></a>`;
  }).join("") : '<div class="empty">このカテゴリのアイテムは準備中です。</div>';

  // 関連する最新記事
  const newsEl = document.getElementById("cat-news");
  document.getElementById("cat-news-all").href = "news.html?q=" + encodeURIComponent(cat.words[0]);
  try {
    const items = (await (await fetch("data/news.json", { cache: "no-cache" })).json()).items;
    const hit = items.filter((n) => cat.words.some((w) => norm(n.title).includes(norm(w)))).slice(0, 8);
    newsEl.innerHTML = hit.length ? hit.map((n) => `<a class="news-item" href="${esc(n.url)}" target="_blank" rel="noopener">
      <span class="news-meta"><span class="news-brand">${esc(n.brands.join("・"))}</span><span>${esc(n.source || "")}</span><span>${ago(n.date)}</span></span>
      <span class="news-title">${esc(n.title)}</span></a>`).join("") : '<div class="empty">このカテゴリの最新記事はまだありません。</div>';
  } catch { newsEl.innerHTML = '<div class="empty">最新記事を読み込めませんでした。</div>'; }
});
