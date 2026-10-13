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
        const meta = [p.weight_g ? `重量 ${p.weight_g.toLocaleString()}g` : "", p.capacity_l ? `容量 ${p.capacity_l}L` : ""].filter(Boolean).join("・");
        const checked = ((p.offers || []).find((o) => o.checked_at) || {}).checked_at;
        return `<a class="prod-card" href="#" data-product="${escA(p.id)}">
          ${p.ai_image && el.dataset.noimg === undefined ? `<span class="prod-img"><img src="${SITE_BASE}${escA(p.ai_image)}" alt="" loading="lazy"></span>` : ""}
          <span class="eyebrow">${escA(p.brand)}</span><b>${escA(p.name)}</b>
          <span class="spec">${escA(p.spec)}</span>
          <span class="price-row">${p.price ? `<span class="price-tag">¥${p.price.toLocaleString()}<small>（税込）</small></span>` : '<span class="sub">価格：不明</span>'}${meta ? `<span class="spec-mini">${escA(meta)}</span>` : ""}</span>
          <span class="cta-pill">購入先を見る</span>${checked ? `<span class="prod-cta"><small>価格は公式の記載（${escA(checked)} 確認）</small></span>` : ""}</a>`;
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
        // 今日のおすすめ：朝（今日の記事）。昼の商品が入ったら、横スワイプで朝⇄昼を切り替え
        const slides = [];
        if (t) slides.push({ label: "朝", html: `<a class="feat" href="${SITE_BASE}articles/${escA(t.slug)}.html">${t.image ? `<img src="${SITE_BASE}${escA(t.image)}" alt="" loading="lazy" style="width: 100%; max-width: 420px; height: auto; border-radius: 6px; align-self: center">` : ""}<span class="feat-top">${t.date === today ? '<span class="badge-today">TODAY</span>' : '<span class="badge-slot">最新</span>'}<span class="badge-slot">朝のおすすめ｜${DAYS[t.day]}曜 ${escA(SLOT[t.day])}</span></span><b>${escA(t.title)}</b><p>${escA(t.desc || "")}</p><span class="cta-pill">記事を読む</span></a>` });
        try {
          const noon = ((await (await fetch(SITE_BASE + "data/noon-picks.json", { cache: "no-cache" })).json()) || {})[today];
          if (noon && noon.image) {
            const prods = (await (await fetch(SITE_BASE + "data/products.json", { cache: "no-cache" })).json()).products || [];
            const p = prods.find((x) => x.id === noon.id);
            if (p) slides.push({ label: "昼", html: `<a class="feat" href="${SITE_BASE}products/${escA(p.id)}.html"><img src="${SITE_BASE}${escA(noon.image)}" alt="" loading="lazy" style="width: 100%; max-width: 420px; height: auto; border-radius: 6px; align-self: center"><span class="feat-top"><span class="badge-today">TODAY</span><span class="badge-slot">昼のおすすめ</span></span><b>${escA(p.brand)} ${escA(p.name)}</b><p>${escA(p.spec || "")}</p>${p.price ? `<span class="price-tag">¥${p.price.toLocaleString()}<small>（税込）</small></span>` : ""}<span class="cta-pill">商品を見る</span></a>` });
          }
        } catch {}
        const box = document.getElementById("weekly-home-today");
        if (slides.length === 1) box.innerHTML = `<h3 class="today-h">今日のおすすめ</h3>${slides[0].html}`;
        else if (slides.length > 1) {
          box.innerHTML = `<div class="today-head"><h3 class="today-h">今日のおすすめ</h3><div class="today-tabs" role="tablist">${slides.map((x, i) => `<button type="button" role="tab" class="today-tab${i ? "" : " is-on"}" data-i="${i}">${x.label}</button>`).join("")}</div></div>
            <div class="today-swipe">${slides.map((x) => `<div class="today-slide">${x.html}</div>`).join("")}</div>
            <div class="today-dots">${slides.map((x, i) => `<span class="${i ? "" : "is-on"}"></span>`).join("")}<small>← 横にスワイプで切り替え →</small></div>`;
          const sw = box.querySelector(".today-swipe"), tabs = box.querySelectorAll(".today-tab"), dots = box.querySelectorAll(".today-dots span");
          const mark = (k) => { tabs.forEach((b, i) => b.classList.toggle("is-on", i === k)); dots.forEach((d, i) => d.classList.toggle("is-on", i === k)); };
          sw.addEventListener("scroll", () => mark(Math.round(sw.scrollLeft / sw.clientWidth)), { passive: true });
          tabs.forEach((b) => b.addEventListener("click", () => sw.scrollTo({ left: sw.clientWidth * +b.dataset.i, behavior: "smooth" })));
          // 昼（12時以降）は昼のおすすめを先に見せる
          if (new Date(Date.now() + 9 * 3600e3).getUTCHours() >= 12) {
            const toNoon = () => { sw.style.scrollSnapType = "none"; sw.scrollLeft = sw.scrollWidth; sw.style.scrollSnapType = ""; mark(1); };
            requestAnimationFrame(toNoon);
            window.addEventListener("load", toNoon, { once: true });
          }
        }
        document.getElementById("weekly-home-list").innerHTML = DAYS.map((d, i) => {
          const a = byDay[i], date = addDays(week, i);
          return a ? `<a class="news-item${date === today ? " is-today" : ""}" href="${SITE_BASE}articles/${escA(a.slug)}.html"><span class="news-meta"><span class="news-brand">${d}曜 ${escA(SLOT[i])}</span><span>${md(date)}</span></span><span class="news-title">${escA(a.title)}</span></a>`
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
