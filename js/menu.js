// メニュー：ブランド名から直接さがす（data/brands.json の一覧）＋サイト内リンク
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

document.addEventListener("DOMContentLoaded", async () => {
  const openers = [...document.querySelectorAll('button[aria-label="メニューを開く"]')];
  if (!openers.length) return;

  let brands = [], products = [];
  try { brands = (await (await fetch(SITE_BASE + "data/brands.json", { cache: "no-cache" })).json()).brands; } catch {}
  try { products = (await (await fetch(SITE_BASE + "data/products.json", { cache: "no-cache" })).json()).products; } catch {}
  const CAT_LABEL = { boots: "靴", pack: "ザック", wear: "ウェア", rain: "レインウェア", pants: "パンツ", poles: "ポール", tent: "テント" };
  const CAT_ORDER = ["boots", "pack", "wear", "rain", "pants", "poles", "tent"];

  const overlay = document.createElement("div");
  overlay.className = "menu-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="menu-panel" role="dialog" aria-modal="true" aria-label="メニュー">
    <div class="menu-head"><span>メニュー</span>
      <button class="icon-btn" type="button" aria-label="メニューを閉じる"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <nav class="menu-body" aria-label="メニュー">
      <form class="search" action="${SITE_BASE}news.html" role="search" style="margin-top: 16px">
        <label for="menu-q" style="position:absolute; left:-9999px">キーワードで検索</label>
        <input class="input" id="menu-q" name="q" type="search" placeholder="キーワードで検索" autocomplete="off">
        <button type="submit" aria-label="検索"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></button>
      </form>
      <div id="menu-brands"></div>
      <h2>カテゴリから探す</h2>
      <a href="${SITE_BASE}category.html?c=boots">登山靴</a><a href="${SITE_BASE}category.html?c=pack">ザック</a><a href="${SITE_BASE}category.html?c=poles">ポール</a><a href="${SITE_BASE}category.html?c=gtx">ゴアテックス</a><a href="${SITE_BASE}category.html?c=rain">レインウェア</a><a href="${SITE_BASE}category.html?c=wear">ウェア</a><a href="${SITE_BASE}category.html?c=pants">パンツ</a><a href="${SITE_BASE}category.html?c=tent">テント泊</a>
      <h2>サイト</h2>
      <span class="menu-off" aria-disabled="true">装備診断（実施予定）</span><a href="${SITE_BASE}articles.html">記事</a><a href="${SITE_BASE}news.html">最新記事</a><a href="${SITE_BASE}about.html">運営者情報</a><a href="${SITE_BASE}privacy.html">プライバシーポリシー</a><a href="${SITE_BASE}contact.html">お問い合わせ</a>
    </nav></div>`;
  document.body.appendChild(overlay);

  // ブランド → カテゴリ → 商品、と順に絞り込む。公式サイトは各画面の一番下
  const box = overlay.querySelector("#menu-brands");
  const arrow = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const officialLink = (b) => b.site ? `<a class="menu-official" href="${esc(b.site)}" target="_blank" rel="noopener"><span>${esc(b.name)}の公式サイトへ</span>${arrow}</a>` : "";
  const back = (to, label, bi) => `<button class="menu-back" type="button" data-go="${to}"${bi === undefined ? "" : ` data-b="${bi}"`}>‹ ${esc(label)}</button>`;
  const show = (view, bi, cat) => {
    const b = brands[bi];
    if (view === "list") {
      box.innerHTML = "<h2>ブランドから探す</h2>" + brands.map((x, i) => `<button class="menu-row" type="button" data-go="brand" data-b="${i}"><span>${esc(x.name)}</span><small>${esc((x.aliases.find((y) => /^[A-Za-z]/.test(y)) || ""))}</small>${arrow}</button>`).join("");
    } else if (view === "brand") {
      const mine = products.filter((p) => p.brand === b.name);
      const cats = CAT_ORDER.filter((c) => mine.some((p) => p.category === c));
      box.innerHTML = back("list", "ブランド一覧") + `<h2>${esc(b.name)}</h2>` +
        (cats.length ? cats.map((c) => `<button class="menu-row" type="button" data-go="items" data-b="${bi}" data-c="${c}"><span>${CAT_LABEL[c]}</span><small>${mine.filter((p) => p.category === c).length}件</small>${arrow}</button>`).join("") : '<p class="menu-note">このブランドの商品は、まだ掲載していません。</p>') +
        `<a class="menu-row" href="${SITE_BASE}news.html?q=${encodeURIComponent(b.name)}"><span>${esc(b.name)}の最新ニュース</span>${arrow}</a>` + officialLink(b);
    } else {
      const mine = products.filter((p) => p.brand === b.name && p.category === cat);
      box.innerHTML = back("brand", b.name, bi) + `<h2>${esc(b.name)} ／ ${CAT_LABEL[cat]}</h2>` +
        mine.map((p) => `<a class="menu-item" href="#" data-product="${esc(p.id)}"><b>${esc(p.name)}</b><span>${esc(p.spec)}</span>${p.price ? `<small>¥${p.price.toLocaleString()}（税込）</small>` : ""}</a>`).join("") + officialLink(b);
    }
    overlay.querySelector(".menu-panel").scrollTop = 0;
  };
  box.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go]");
    if (!t) return;
    show(t.dataset.go, t.dataset.b === undefined ? undefined : +t.dataset.b, t.dataset.c);
  });
  // 商品をえらんだらメニューを閉じて、購入先のシートを出す（shop.js が処理する）
  box.addEventListener("click", (e) => { if (e.target.closest("[data-product]")) setTimeout(() => close(), 0); });
  show("list");

  let opener = null;
  const close = () => { overlay.hidden = true; document.body.style.overflow = ""; if (opener) opener.focus(); };
  openers.forEach((b) => b.addEventListener("click", () => {
    opener = b; overlay.hidden = false; document.body.style.overflow = "hidden";
    overlay.querySelector("#menu-q").focus();
  }));
  overlay.querySelector(".icon-btn").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });
});
