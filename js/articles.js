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
  // ホームの「今週の7選」：今日の記事を大きく、その週の7本を曜日順に（公開前の日は「公開予定」）
  const wk = document.getElementById("weekly-home");
  if (wk) {
    try {
      const all = await (await fetch(SITE_BASE + "data/articles.json", { cache: "no-cache" })).json();
      const auto = all.filter((a) => a.week);
      if (auto.length) {
        const DAYS = ["月", "火", "水", "木", "金", "土", "日"], SLOT = ["アウター", "ザック", "アウター", "シューズ", "アウター", "ザック", "シューズ"];
        const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
        const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
        const md = (s) => { const [, m, d] = s.split("-").map(Number); return `${m}/${d}`; };
        const week = auto.map((a) => a.week).sort().pop();
        const byDay = Object.fromEntries(auto.filter((a) => a.week === week).map((a) => [a.day, a]));
        const t = Object.values(byDay).find((a) => a.date === today) || Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date))[0];
        document.getElementById("weekly-home-note").textContent = `${md(week)}〜${md(addDays(week, 6))}　季節と天気に合わせて、1日1つずつ紹介します。`;
        if (t) document.getElementById("weekly-home-today").innerHTML = `<a class="feat" href="${SITE_BASE}articles/${escA(t.slug)}.html">${t.image ? `<img src="${SITE_BASE}${escA(t.image)}" alt="" loading="lazy" style="width: 100%; max-width: 420px; height: auto; border-radius: 6px; align-self: center">` : ""}<span class="eyebrow">${t.date === today ? "今日のトピック" : "最新のトピック"}｜${DAYS[t.day]}曜 ${escA(SLOT[t.day])}</span><b>${escA(t.title)}</b><p>${escA(t.desc || "")}</p><span class="mono" style="font-size:13px">記事を読む →</span></a>`;
        document.getElementById("weekly-home-list").innerHTML = DAYS.map((d, i) => {
          const a = byDay[i], date = addDays(week, i);
          return a ? `<a class="news-item" href="${SITE_BASE}articles/${escA(a.slug)}.html"><span class="news-meta"><span class="news-brand">${d}曜 ${escA(SLOT[i])}</span><span>${md(date)}</span></span><span class="news-title">${escA(a.title)}</span></a>`
            : `<div class="news-item" aria-disabled="true"><span class="news-meta"><span class="news-brand">${d}曜 ${escA(SLOT[i])}</span><span>${md(date)}</span></span><span class="news-title" style="color: var(--ink-sub)">${date < today ? "準備中" : "公開予定"}</span></div>`;
        }).join("");
        wk.hidden = false;
      }
    } catch {}
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
