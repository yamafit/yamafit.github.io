// メニュー：ブランド名から直接さがす（data/brands.json の一覧）＋サイト内リンク
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

document.addEventListener("DOMContentLoaded", async () => {
  const openers = [...document.querySelectorAll('button[aria-label="メニューを開く"]')];
  if (!openers.length) return;

  let brands = [];
  try { brands = (await (await fetch(SITE_BASE + "data/brands.json", { cache: "no-cache" })).json()).brands; } catch {}

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
      <h2>ブランド（公式サイトへ）</h2>
      ${brands.map((b) => `<a href="${esc(b.site || SITE_BASE + "news.html?q=" + encodeURIComponent(b.name))}"${b.site ? ' target="_blank" rel="noopener"' : ""}><span>${esc(b.name)}</span><small>${esc(b.aliases.find((x) => /^[A-Za-z]/.test(x)) || "")}</small></a>`).join("") || '<a href="${SITE_BASE}news.html">最新記事</a>'}
      <h2>カテゴリから探す</h2>
      <a href="${SITE_BASE}category.html?c=boots">登山靴</a><a href="${SITE_BASE}category.html?c=pack">ザック</a><a href="${SITE_BASE}category.html?c=poles">ポール</a><a href="${SITE_BASE}category.html?c=gtx">ゴアテックス</a><a href="${SITE_BASE}category.html?c=rain">レインウェア</a><a href="${SITE_BASE}category.html?c=wear">ウェア</a><a href="${SITE_BASE}category.html?c=pants">パンツ</a><a href="${SITE_BASE}category.html?c=tent">テント泊</a>
      <h2>サイト</h2>
      <a href="${SITE_BASE}question.html">装備診断</a><a href="${SITE_BASE}articles.html">記事</a><a href="${SITE_BASE}news.html">最新記事</a><a href="${SITE_BASE}about.html">運営者情報</a><a href="${SITE_BASE}privacy.html">プライバシーポリシー</a><a href="${SITE_BASE}contact.html">お問い合わせ</a>
    </nav></div>`;
  document.body.appendChild(overlay);

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
