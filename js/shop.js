// 商品をクリック → 購入先（Amazon / 楽天市場 / Yahoo!ショッピング）の選択シートを出す
// アフィリエイトURLは data/products.json の affiliate に入れる。GA4が有効なら、クリックをイベントとして記録する。
const SHOPS = [["amazon", "Amazon"], ["rakuten", "楽天市場"], ["yahoo", "Yahoo!ショッピング"]];
const escS = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const track = (name, params) => { try { if (window.gtag) window.gtag("event", name, params); } catch {} };

let productsPromise = null;
const loadProducts = () => (productsPromise ||= fetch(SITE_BASE + "data/products.json", { cache: "no-cache" }).then((r) => r.json()).then((d) => d.products));

let overlay = null, lastFocus = null;
function close() { if (!overlay) return; overlay.hidden = true; document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }

const SHOP_LABEL = { official: "公式サイト", amazon: "Amazon", rakuten: "楽天市場", yahoo: "Yahoo!ショッピング" };
const SHOP_ORDER = { amazon: 0, rakuten: 1, yahoo: 2, official: 3 };
const arrowS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
const imgTag = (p, cls) => p.image ? `<img class="thumb ${cls || ""}" src="${escS(p.image)}" alt="${escS(p.brand + " " + p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=\\'photo photo--thumb\\'>写真</div>'">` : "";

// 購入先の並び：在庫あり → 未確認 → 在庫なし。同じ状態なら Amazon・楽天・Yahoo!・公式の順
function rankOffers(p) {
  const state = (o) => (o.in_stock === true ? 0 : o.in_stock === null || o.in_stock === undefined ? 1 : 2);
  const offers = (p.offers && p.offers.length ? p.offers : SHOPS.map(([k]) => ({ shop: k, url: "", affiliate_url: (p.affiliate || {})[k] || "", in_stock: null })))
    .filter((o) => o.url || o.affiliate_url);
  return offers.sort((a, b) => state(a) - state(b) || (SHOP_ORDER[a.shop] ?? 9) - (SHOP_ORDER[b.shop] ?? 9));
}

async function openSheet(id, trigger) {
  const all = await loadProducts().catch(() => []);
  const p = all.find((x) => x.id === id);
  if (!p) return;
  track("select_item", { item_id: id, item_name: `${p.brand} ${p.name}`, item_category: p.category });
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "sheet-overlay";
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });
    document.body.appendChild(overlay);
  }
  const offers = rankOffers(p);
  const anyStock = offers.some((o) => o.in_stock !== false);
  const buttons = offers.map((o) => {
    const href = o.affiliate_url || o.url;
    const isAff = !!o.affiliate_url;
    const note = o.in_stock === true ? '<small class="stock stock-ok">在庫あり</small>' : o.in_stock === false ? "<small>在庫なし</small>" : "<small>在庫は各サイトで確認</small>";
    const cls = o.in_stock === false ? "shop-btn is-out" : "shop-btn";
    return `<a class="${cls}" href="${escS(href)}" target="_blank" rel="${isAff ? "sponsored " : ""}noopener" data-shop="${o.shop}" data-item="${escS(id)}"><span>${SHOP_LABEL[o.shop] || o.shop}で見る</span><span style="display:flex;align-items:center;gap:6px">${note}${arrowS}</span></a>`;
  }).join("") || '<span class="shop-btn is-off"><span>購入先</span><small>リンク準備中</small></span>';
  // どこにも在庫がないときは、同じカテゴリの代わりの商品を出す
  const alts = anyStock ? [] : all.filter((x) => x.category === p.category && x.id !== id && (x.offers || []).some((o) => o.in_stock !== false)).slice(0, 2);
  const altHtml = alts.length ? `<div class="sheet-alt"><h3>在庫のある、近い商品</h3>${alts.map((a) => `<a class="res-item" href="#" data-product="${escS(a.id)}"><div class="res-row">${imgTag(a, "thumb--sm")}<span class="res-text"><b>${escS(a.brand)} ${escS(a.name)}</b><span class="spec">${escS(a.spec)}</span></span></div></a>`).join("")}</div>` : "";
  const checked = (offers.find((o) => o.checked_at) || {}).checked_at || "不明";
  const outMsg = anyStock ? "" : '<p class="news-note" style="color: var(--accent)">いま確認できた販売先では、在庫がありません。入荷は公式サイトでご確認ください。</p>';
  overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="購入先を選ぶ">
    <div class="sheet-head"><b>購入先を選ぶ</b><button class="icon-btn" type="button" aria-label="閉じる"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="res-row">${imgTag(p)}<div class="sheet-item"><b>${escS(p.brand)} ${escS(p.name)}</b><span class="sub">${escS(p.spec)}</span>${p.price ? `<span class="mono" style="font-size:13px">¥${p.price.toLocaleString()}（税込）</span>` : ""}</div></div>
    ${outMsg}<div class="sheet-shops">${buttons}</div>${altHtml}
    <p class="news-note"><span class="pr-badge">PR</span> アフィリエイトリンクを含みます。価格・在庫は確認時点（${checked}）の情報で、変わることがあります。商品の画像・仕様は各公式サイトの記載にもとづきます。</p></div>`;
  overlay.querySelector(".icon-btn").addEventListener("click", close);
  lastFocus = trigger || null;
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  overlay.querySelector(".icon-btn").focus();
}

document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-product]");
  if (trigger) { e.preventDefault(); openSheet(trigger.dataset.product, trigger); return; }
  const shop = e.target.closest("a[data-shop]");
  if (shop && shop.getAttribute("href") !== "#") track("affiliate_click", { item_id: shop.dataset.item || "", shop: shop.dataset.shop });
  if (shop && shop.getAttribute("href") === "#") e.preventDefault();
});
