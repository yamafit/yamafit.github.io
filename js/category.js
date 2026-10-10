// カテゴリページ：?c=boots など。アイテム（products.json）と関連する最新記事（news.json）を表示
const CATS = {
  boots: { label: "登山靴", lead: "ローカットとミッドカットの違い、行き先に合う一足の選び方。", product: "boots", words: ["登山靴", "トレッキングシューズ", "シューズ", "ブーツ"] },
  pack: { label: "ザック", lead: "日帰りから泊まりまで、容量と背負い心地の選び方。", product: "pack", words: ["ザック", "バックパック", "リュック"] },
  poles: { label: "ポール", lead: "膝への負担や荷物の軽さに合わせた、トレッキングポールの選び方。", product: "poles", words: ["トレッキングポール", "ポール", "ストック"] },
  gtx: { label: "ゴアテックス", lead: "防水・透湿のゴアテックス製品を、ジャケット・パンツ・靴にまとめて比較できます。", product: null, words: ["ゴアテックス", "GORE-TEX"] },
  rain: { label: "レインウェア", lead: "耐水圧だけでなく、蒸れにくさで選ぶレインウェア。", product: "rain", words: ["レインウェア", "レインジャケット", "ゴアテックス", "GORE-TEX"] },
  wear: { label: "ウェア", lead: "季節に合わせた重ね着と、街でも着られる山のウェア。", product: "wear", words: ["ジャケット", "ウェア", "フリース", "パンツ"] },
  pants: { label: "パンツ", lead: "動きやすさと撥水、街でも穿ける山のパンツの選び方。", product: "pants", words: ["パンツ", "トレッキングパンツ", "ショーツ", "タイツ", "レギンス"] },
  tent: { label: "テント泊", lead: "テントや寝具など、泊まりの装備を選ぶヒント。", product: "tent", words: ["テント", "シュラフ", "寝袋", "キャンプ"] },
};
const isGtx = (p) => /gore|ゴア|gtx/i.test([p.name, p.waterproof, p.material].join(" "));
const gtxKind = (p) => (p.category === "boots" ? "boots" : /パンツ|pants/i.test(p.name) ? "pants" : "jacket");
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
    '<a class="cat cat--primary" href="question.html">装備診断</a>' +
    Object.entries(CATS).map(([id, c]) => `<a class="cat" href="category.html?c=${id}"${id === k ? ' aria-current="page" style="border-color: var(--green); background: var(--green-tint); font-weight: 700"' : ""}>${c.label}</a>`).join("");

  // おすすめ（季節・クリック・購入の傾向から、最大3つ）
  const recoEl = document.getElementById("cat-reco");
  const SEASON = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
  try {
    const [rec, pr] = await Promise.all([
      fetch("data/recommendations.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch("data/products.json", { cache: "no-cache" }).then((r) => r.json()),
    ]);
    const byId = Object.fromEntries(pr.products.map((p) => [p.id, p]));
    let picks;
    if (k === "gtx") { // 靴・ジャケット・パンツから1つずつ（おすすめ順）
      const all = ["boots", "rain", "wear", "pants"].flatMap((c) => (rec.categories || {})[c] || []).filter((x) => byId[x.id] && isGtx(byId[x.id]));
      picks = ["jacket", "pants", "boots"].map((kd) => all.find((x) => gtxKind(byId[x.id]) === kd)).filter(Boolean);
      if (picks.length < 3) {
        const used = new Set(picks.map((x) => x.id));
        picks = picks.concat(pr.products.filter((p) => isGtx(p) && !used.has(p.id)).slice(0, 3 - picks.length).map((p) => ({ id: p.id, reason: p.default_reason })));
      }
    } else picks = ((rec.categories || {})[cat.product] || []).slice(0, 3);
    recoEl.innerHTML = picks.length ? picks.map((x, i) => {
      const p = byId[x.id]; if (!p) return "";
      return `<a class="res-item" href="#" data-product="${esc(p.id)}"><div class="res-row">${imgTag(p)}<span class="res-text">
        <span class="eyebrow">おすすめ ${i + 1}</span><b>${esc(p.brand)} ${esc(p.name)}</b>
        <span class="spec">${esc(p.spec)}</span><span class="reco-reason">${esc(x.reason)}</span></span></div></a>`;
    }).join("") : '<div class="empty">このカテゴリのおすすめは準備中です。</div>';
    if (picks.length) document.getElementById("cat-reco-note").textContent =
      `${SEASON[rec.season] || ""}の時期に合わせ、閲覧・クリックの傾向をもとに選んでいます（${(rec.updated || "").slice(0, 10)} 更新）`;
  } catch { recoEl.innerHTML = '<div class="empty">このカテゴリのおすすめは準備中です。</div>'; }

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
  const mine = k === "gtx" ? products.filter(isGtx) : cat.product ? products.filter((p) => p.category === cat.product) : [];
  const groups = k === "gtx"
    ? [["ジャケット", "jacket"], ["パンツ", "pants"], ["靴", "boots"]].map(([label, kd]) => ({ label, items: mine.filter((p) => gtxKind(p) === kd) })).filter((g) => g.items.length)
    : [{ label: "", items: mine }];
  const row = (p) => `<a class="res-item" href="#" data-product="${esc(p.id)}"><div class="res-row">${imgTag(p)}<span class="res-text">
      <b>${esc(p.brand)} ${esc(p.name)}</b><span class="spec">${esc(p.spec)}</span>${p.price ? `<span class="mono" style="font-size:13px">¥${p.price.toLocaleString()}（税込）</span>` : ""}</span></div></a>`;
  const PAGE = 20;
  const shown = groups.map(() => PAGE);
  const draw = () => {
    itemsEl.innerHTML = groups.map((g, gi) => (g.label ? `<h3 class="grp-title">${g.label}（${g.items.length}件）</h3>` : "") +
      g.items.slice(0, shown[gi]).map(row).join("") +
      (g.items.length > shown[gi] ? `<button class="btn more-items" data-g="${gi}" type="button" style="margin-top: 12px; width: 100%; background: var(--surface); color: var(--ink); border: 1.5px solid var(--ink)">もっと見る（残り${g.items.length - shown[gi]}件）</button>` : "")).join("");
    itemsEl.querySelectorAll(".more-items").forEach((b) => b.addEventListener("click", () => { shown[+b.dataset.g] += PAGE; draw(); }));
  };
  if (mine.length) draw(); else itemsEl.innerHTML = '<div class="empty">このカテゴリのアイテムは準備中です。</div>';

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
