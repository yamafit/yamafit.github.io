// ホームのランキング：data/rankings.json（tools/build-rankings.mjs が作る）を表示
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("rank-list");
  if (!list) return;
  const section = document.getElementById("ranking");
  let data;
  try { data = await (await fetch("data/rankings.json", { cache: "no-cache" })).json(); } catch { return; }
  if (!((data.access || []).length || (data.purchase || []).length)) return; // 集計前は、ランキング欄そのものを出さない
  if (section) section.hidden = false;
  const tabs = { access: document.getElementById("tab-access"), purchase: document.getElementById("tab-purchase") };
  const note = document.getElementById("rank-note");
  const unit = { access: "PV", purchase: "件" };
  const label = { access: "直近30日のページ閲覧数", purchase: "直近30日のリンク経由の購入数" };

  function show(kind) {
    Object.entries(tabs).forEach(([k, b]) => b.setAttribute("aria-selected", String(k === kind)));
    const rows = (data[kind] || []).slice(0, 5);
    if (!rows.length) { // 集計前：元の表示のまま。購入だけは空表示
      if (kind === "purchase") { list.innerHTML = '<li class="empty">集計中です。</li>'; note.textContent = ""; }
      return;
    }
    note.textContent = `${label[kind]}${data.updated ? "（" + data.updated.slice(0, 10) + " 時点）" : ""}`;
    list.innerHTML = rows.map((r, i) => `<li class="rank"><a href="${esc(r.url)}">
      <span class="rank-no">${i + 1}</span>
      <span class="item-body"><span class="item-title">${esc(r.title)}</span></span>
      <span class="rank-count">${Number(r.count).toLocaleString()}${unit[kind]}</span></a></li>`).join("");
  }
  const initial = list.innerHTML;
  tabs.access.addEventListener("click", () => { if ((data.access || []).length) show("access"); else { list.innerHTML = initial; note.textContent = ""; Object.entries(tabs).forEach(([k, b]) => b.setAttribute("aria-selected", String(k === "access"))); } });
  tabs.purchase.addEventListener("click", () => show("purchase"));
  show("access");
});
