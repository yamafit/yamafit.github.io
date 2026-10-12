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
    const items = (f.items || []).map((x) => ({ p: byId[x.id], c: x.comment, a: x.article })).filter((x) => x.p);
    if (!items.length) return;
    document.getElementById("featured-list").innerHTML = items.map(({ p, c, a }) => `<a class="feat" href="${SITE_BASE}${a ? "articles/" + escF(a) : "products/" + escF(p.id)}.html">
      ${p.ai_image ? `<span class="prod-img"><img src="${SITE_BASE}${escF(p.ai_image)}" alt="" loading="lazy"></span>` : ""}
      <span class="feat-top"><span class="badge-slot">${{ pack: "ザック", boots: "シューズ" }[p.category] || "ウェア"}</span><span class="eyebrow">${escF(p.brand)}</span></span><b>${escF(p.name)}</b>
      <p>${escF(c || p.default_reason || p.spec)}</p>
      <span class="price-row">${p.price ? `<span class="price-tag">¥${p.price.toLocaleString()}<small>（税込）</small></span>` : '<span class="sub">価格：不明</span>'}</span>
      <span class="cta-pill">${a ? "記事を読む" : "詳しく見る"}</span></a>`).join("");
    if (f.updated) document.getElementById("featured-note").textContent = `運営者が選んだ商品です（${f.updated} 更新）。詳細ページで、メリット・デメリットと購入先を確認できます。`;
    sec.hidden = false;
  } catch {}
});
