// 商品一覧：検索・カテゴリー・ブランド（複数）・価格帯などで絞り込む。条件は URL に残す（共有・戻るで復元）。
const escP = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const normP = (s) => String(s).normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const SEASONP = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

// カテゴリーのまとまり（アウター = レインウェア + ウェア）
const GROUPS = [
  ["all", "すべて", null],
  ["outer", "アウター", ["rain", "wear"]],
  ["pack", "ザック", ["pack"]],
  ["boots", "シューズ", ["boots"]],
  ["pants", "パンツ", ["pants"]],
  ["poles", "ポール", ["poles"]],
  ["tent", "テント", ["tent"]],
];
// 追加の絞り込み。ここに足せば画面に出る（重量・防水・容量などは、今後ここに追加する）
const GTX = (p) => /gore|ゴア|gtx/i.test([p.name, p.waterproof, p.material].join(" "));
const FILTERS = [
  { id: "price", label: "価格帯", type: "select", options: [["", "指定なし"], ["0-10000", "1万円以下"], ["10000-20000", "1〜2万円"], ["20000-40000", "2〜4万円"], ["40000-", "4万円以上"]],
    test: (p, v) => { const [a, b] = v.split("-"); return p.price != null && p.price >= Number(a || 0) && (b === "" || p.price <= Number(b)); } },
  { id: "gtx", label: "ゴアテックス製のみ", type: "check", test: (p) => GTX(p) },
];

document.addEventListener("DOMContentLoaded", async () => {
  const listEl = document.getElementById("pf-list");
  let products = [];
  try { products = (await (await fetch(SITE_BASE + "data/products.json", { cache: "no-cache" })).json()).products; } catch { listEl.innerHTML = '<div class="empty">商品を読み込めませんでした。</div>'; return; }

  const qs = new URLSearchParams(location.search);
  const state = { q: qs.get("q") || "", g: qs.get("g") || "all", brands: new Set((qs.get("brand") || "").split(",").filter(Boolean)), sort: qs.get("sort") || "", f: {} };
  FILTERS.forEach((f) => { state.f[f.id] = qs.get(f.id) || ""; });

  const brandNames = [...new Set(products.map((p) => p.brand))];
  document.getElementById("pf-q").value = state.q;
  document.getElementById("pf-sort").value = state.sort;
  const catsEl = document.getElementById("pf-cats"), brandsEl = document.getElementById("pf-brands"), extraEl = document.getElementById("pf-extra");
  const drawControls = () => {
    catsEl.innerHTML = GROUPS.map(([id, label]) => `<button type="button" class="cat" data-g="${id}" ${id === state.g ? 'aria-current="page" style="border-color: var(--green); background: var(--green-tint); font-weight: 700"' : ""}>${label}</button>`).join("");
    brandsEl.innerHTML = brandNames.map((b) => `<label><input type="checkbox" value="${escP(b)}" ${state.brands.has(b) ? "checked" : ""}>${escP(b)}</label>`).join("");
    extraEl.innerHTML = FILTERS.map((f) => f.type === "select"
      ? `<label for="pf-${f.id}"><b>${f.label}</b></label><select id="pf-${f.id}" data-f="${f.id}">${f.options.map(([v, l]) => `<option value="${v}" ${state.f[f.id] === v ? "selected" : ""}>${l}</option>`).join("")}</select>`
      : `<label class="pf-opt"><input type="checkbox" data-f="${f.id}" ${state.f[f.id] ? "checked" : ""}>${f.label}</label>`).join("");
  };

  const apply = () => {
    const words = normP(state.q).split(/[,、]/).filter(Boolean);
    const cats = (GROUPS.find((g) => g[0] === state.g) || GROUPS[0])[2];
    let r = products.filter((p) => {
      if (cats && !cats.includes(p.category)) return false;
      if (state.brands.size && !state.brands.has(p.brand)) return false;
      if (words.length) { const hay = normP([p.brand, p.name, p.id, p.spec, p.material].join(" ")); if (!words.every((w) => hay.includes(w))) return false; }
      return FILTERS.every((f) => !state.f[f.id] || f.test(p, state.f[f.id]));
    });
    if (state.sort === "price-asc") r.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
    else if (state.sort === "price-desc") r.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    else if (state.sort === "weight-asc") r.sort((a, b) => (a.weight_g ?? 1e9) - (b.weight_g ?? 1e9));
    return r;
  };

  let shown = 20;
  const draw = () => {
    const r = apply();
    document.getElementById("pf-count").textContent = `${r.length}件`;
    listEl.innerHTML = r.slice(0, shown).map((p) => {
      const tags = [(p.season || []).map((s) => SEASONP[s]).filter(Boolean).join("・"), GTX(p) ? "ゴアテックス" : "", p.capacity_l ? `${p.capacity_l}L` : ""].filter(Boolean);
      const meta = [p.price ? `¥${p.price.toLocaleString()}（税込）` : "価格：不明", p.weight_g ? `重量 ${p.weight_g.toLocaleString()}g` : ""].filter(Boolean).join("　");
      return `<div class="pcard">${p.ai_image ? `<a class="pcard-img" href="${SITE_BASE}products/${escP(p.id)}.html"><img src="${SITE_BASE}${escP(p.ai_image)}" alt="${escP(p.brand + " " + p.name)}の特徴をまとめたイメージ（AI生成）" loading="lazy"></a>` : ""}<span class="eyebrow">${escP(p.brand)}</span><b>${escP(p.name)}</b>
        <span class="spec">${escP(p.spec)}</span>
        ${tags.length ? `<span class="tags">${tags.map((t) => `<span class="tag">${escP(t)}</span>`).join("")}</span>` : ""}
        ${(p.features || []).length ? `<span class="sub">${escP(p.features[0])}</span>` : ""}
        <span class="mono" style="font-size:13px">${escP(meta)}</span>
        <span class="acts"><a href="${SITE_BASE}products/${escP(p.id)}.html">詳しく見る</a><button type="button" data-product="${escP(p.id)}">購入先を見る</button></span></div>`;
    }).join("") + (r.length > shown ? `<button class="btn" type="button" id="pf-more" style="margin-top: 12px; width: 100%; background: var(--surface); color: var(--ink); border: 1.5px solid var(--ink)">もっと見る（残り${r.length - shown}件）</button>` : "") || '<div class="empty">条件に合う商品がありません。条件をゆるめてみてください。</div>';
    const m = document.getElementById("pf-more"); if (m) m.addEventListener("click", () => { shown += 20; draw(); });
    const u = new URLSearchParams();
    if (state.q) u.set("q", state.q); if (state.g !== "all") u.set("g", state.g); if (state.brands.size) u.set("brand", [...state.brands].join(","));
    if (state.sort) u.set("sort", state.sort); FILTERS.forEach((f) => { if (state.f[f.id]) u.set(f.id, state.f[f.id]); });
    history.replaceState(null, "", u.toString() ? "?" + u : location.pathname);
  };

  drawControls(); draw();
  const reset = () => { shown = 20; draw(); };
  document.getElementById("pf-q").addEventListener("input", (e) => { state.q = e.target.value; reset(); });
  document.getElementById("pf-sort").addEventListener("change", (e) => { state.sort = e.target.value; reset(); });
  catsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-g]"); if (b) { state.g = b.dataset.g; drawControls(); reset(); } });
  brandsEl.addEventListener("change", (e) => { e.target.checked ? state.brands.add(e.target.value) : state.brands.delete(e.target.value); reset(); });
  extraEl.addEventListener("change", (e) => { const id = e.target.dataset.f; if (!id) return; state.f[id] = e.target.type === "checkbox" ? (e.target.checked ? "1" : "") : e.target.value; reset(); });
});
