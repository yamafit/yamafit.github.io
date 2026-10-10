// 記事：本文中の商品カード（商品マスターの最新データ）と、ホームの記事一覧を表示する
const escA = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

document.addEventListener("DOMContentLoaded", async () => {
  // 商品カード
  const lists = document.querySelectorAll(".prod-list[data-products]");
  if (lists.length) {
    let products = [];
    try { products = (await (await fetch(SITE_BASE + "data/products.json", { cache: "no-cache" })).json()).products; } catch {}
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    lists.forEach((el) => {
      el.innerHTML = el.dataset.products.split(",").map((id) => byId[id]).filter(Boolean).map((p) => {
        const meta = [p.price ? `¥${p.price.toLocaleString()}（税込）` : "価格：不明", p.weight_g ? `重量 ${p.weight_g.toLocaleString()}g${p.weight_note ? "（" + p.weight_note + "）" : ""}` : "重量：不明", p.capacity_l ? `容量 ${p.capacity_l}L` : ""].filter(Boolean).join("　／　");
        const checked = ((p.offers || []).find((o) => o.checked_at) || {}).checked_at;
        return `<a class="prod-card" href="#" data-product="${escA(p.id)}">
          <span class="eyebrow">${escA(p.brand)}</span><b>${escA(p.name)}</b>
          <span class="spec">${escA(p.spec)}</span><span class="prod-meta">${escA(meta)}</span>
          <span class="prod-cta">購入先を見る →${checked ? `<small>公式の記載を確認：${escA(checked)}</small>` : ""}</span></a>`;
      }).join("") || '<p class="sub">商品情報を読み込めませんでした。</p>';
    });
  }
  // ホームの記事一覧
  const latest = document.getElementById("articles-latest");
  if (latest) {
    try {
      const items = (await (await fetch(SITE_BASE + "data/articles.json", { cache: "no-cache" })).json()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      latest.innerHTML = `<div class="news">${items.map((a) => `<a class="news-item" href="${SITE_BASE}articles/${a.slug}.html"><span class="news-meta"><span class="news-brand">${escA(a.category)}</span><span>${escA(a.date)}</span></span><span class="news-title">${escA(a.title)}</span></a>`).join("")}</div>`;
    } catch {}
  }
});
