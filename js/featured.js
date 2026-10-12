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
    const items = (f.items || []).map((x) => ({ p: byId[x.id], c: x.comment })).filter((x) => x.p);
    if (!items.length) return;
    document.getElementById("featured-list").innerHTML = items.map(({ p, c }) => `<a class="feat" href="${SITE_BASE}products/${escF(p.id)}.html">
      <span class="eyebrow">${escF(p.brand)}</span><b>${escF(p.name)}</b>
      <p>${escF(c || p.default_reason || p.spec)}</p>
      <span class="mono" style="font-size:13px">${p.price ? "¥" + p.price.toLocaleString() + "（税込）" : "価格：不明"}　詳しく見る →</span></a>`).join("");
    if (f.updated) document.getElementById("featured-note").textContent = `運営者が選んだ商品です（${f.updated} 更新）。詳細ページで、メリット・デメリットと購入先を確認できます。`;
    sec.hidden = false;
  } catch {}
});
