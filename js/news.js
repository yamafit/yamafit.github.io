// 最新記事：data/news.json（1時間ごとに自動更新）を表示・検索する
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = (s) => String(s).normalize("NFKC").toLowerCase();

function ago(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 60) return `${m || 1}分前`;
  if (m < 1440) return `${Math.floor(m / 60)}時間前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
const row = (n) => `<a class="news-item" href="${esc(n.url)}" target="_blank" rel="noopener">
  <span class="news-meta"><span class="news-brand">${esc(n.brands.join("・"))}</span><span>${esc(n.source || "")}</span><span>${ago(n.date)}</span></span>
  <span class="news-title">${esc(n.title)}</span></a>`;

document.addEventListener("DOMContentLoaded", async () => {
  const latest = document.getElementById("news-latest");
  const list = document.getElementById("news-list");
  if (!latest && !list) return;
  let data;
  try { data = await (await fetch("data/news.json", { cache: "no-cache" })).json(); } catch { return; }
  const items = data.items;

  // ホーム：新着5件
  if (latest && items.length) latest.innerHTML = `<div class="news">${items.slice(0, 5).map(row).join("")}</div>`;

  // 一覧ページ：キーワード検索＋ブランド絞り込み
  if (list) {
    const q = document.getElementById("q");
    const chips = document.getElementById("brand-chips");
    const count = document.getElementById("news-count");
    const updated = document.getElementById("news-updated");
    const brands = [...new Set(items.flatMap((n) => n.brands))].sort((a, b) => a.localeCompare(b, "ja"));
    let brand = "";
    q.value = new URLSearchParams(location.search).get("q") || "";
    chips.innerHTML = ['<button class="chip" type="button" data-b="" aria-pressed="true">すべて</button>',
      ...brands.map((b) => `<button class="chip" type="button" data-b="${esc(b)}" aria-pressed="false">${esc(b)}</button>`)].join("");
    if (updated) updated.textContent = `${new Date(data.updated).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })} 更新`;

    const render = () => {
      const words = norm(q.value).split(/\s+/).filter(Boolean);
      const hit = items.filter((n) => (!brand || n.brands.includes(brand)) &&
        words.every((w) => norm(n.title + " " + n.brands.join(" ") + " " + (n.source || "")).includes(w)));
      count.textContent = `${hit.length}件`;
      list.innerHTML = hit.length ? hit.map(row).join("") : '<div class="empty">該当する記事がありません。キーワードやブランドを変えてみてください。</div>';
    };
    q.addEventListener("input", render);
    document.getElementById("search-form").addEventListener("submit", (e) => { e.preventDefault(); render(); });
    chips.addEventListener("click", (e) => {
      const c = e.target.closest(".chip"); if (!c) return;
      brand = c.dataset.b;
      chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
      render();
    });
    render();
  }
});
