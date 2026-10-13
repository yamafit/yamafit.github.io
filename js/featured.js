// ホーム「今週のおすすめ」：data/featured.json（管理者が選んだ商品）を表示。載せる商品・順番は管理者が決める
document.addEventListener("DOMContentLoaded", async () => {
  const sec = document.getElementById("featured");
  if (!sec) return;
  const escF = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  try {
    const [f, pr] = await Promise.all([
      fetch(SITE_BASE + "data/featured.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch(SITE_BASE + "data/products.json", { cache: "no-cache" }).then((r) => r.json()),
    ]);
    const byId = Object.fromEntries(pr.products.map((p) => [p.id, p]));
    // 日曜〜土曜の1週間ごとに切り替え：from（日曜日）が今日以前で一番新しい週を使う
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const wk = (f.weeks || []).filter((w) => w.from <= today).sort((a, b) => b.from.localeCompare(a.from))[0];
    const src = wk ? wk.items : f.items || [];
    const items = src.map((x) => ({ p: byId[x.id], c: x.comment, a: x.article, l: x.label, im: x.image })).filter((x) => x.p);
    if (!items.length) return;
    document.getElementById("featured-list").innerHTML = items.map(({ p, c, a, l, im }) => `<a class="feat" href="${SITE_BASE}${a ? "articles/" + escF(a) : "products/" + escF(p.id)}.html">
      ${p.ai_image || im || p.image ? `<span class="prod-img"><img src="${p.ai_image ? SITE_BASE + escF(p.ai_image) : escF(im || p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></span>` : ""}
      <span class="feat-top"><span class="badge-slot">${escF(l || { pack: "ザック", boots: "シューズ" }[p.category] || "ウェア")}</span><span class="eyebrow">${escF(p.brand)}</span></span><b>${escF(p.name)}</b>
      <p>${escF(c || p.default_reason || p.spec)}</p>
      <span class="price-row">${p.price ? `<span class="price-tag">¥${p.price.toLocaleString()}<small>（税込）</small></span>` : '<span class="sub">価格：不明</span>'}</span>
      <span class="cta-pill">${a ? "記事を読む" : "詳しく見る"}</span></a>`).join("");
    if (wk && wk.title) { const h = sec.querySelector(".h-section"); if (h) h.innerHTML = `今週のおすすめ<span class="feat-theme">${escF(wk.title)}</span>`; }
    const md = (d) => { const [, m, dd] = d.split("-").map(Number); return `${m}/${dd}`; };
    const upd = wk ? wk.from : f.updated;
    if (upd) document.getElementById("featured-note").textContent = `運営者が選んだ商品です（${md(upd)} 更新・毎週日曜に入れ替え）。詳細ページで、メリット・デメリットと購入先を確認できます。`;
    sec.hidden = false;
  } catch {}
});
