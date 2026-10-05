// ホームのアイテム検索：data/products.json から探す（カテゴリ名・仕様・ブランド・商品名など）
const KEYWORDS = {
  boots: ["登山靴", "靴", "シューズ", "ブーツ", "トレッキングシューズ", "ミッドカット", "ローカット"],
  poles: ["トレッキングポール", "ポール", "ストック", "杖"],
  pack: ["ザック", "リュック", "バックパック", "バッグ"],
};
const LABEL = { boots: "登山靴", poles: "トレッキングポール", pack: "ザック" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = (s) => String(s).normalize("NFKC").toLowerCase();

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("item-search");
  if (!form) return;
  const input = document.getElementById("item-q");
  const box = document.getElementById("item-results");
  let products = [];
  try { products = (await (await fetch("data/products.json", { cache: "no-cache" })).json()).products; } catch {}

  const haystack = (p) => norm([LABEL[p.category], ...KEYWORDS[p.category], p.brand, p.name, p.spec, p.for_whom, ...(p.features || [])].join(" "));

  function render() {
    const raw = input.value.trim();
    if (!raw) { box.hidden = true; return; }
    const words = norm(raw).split(/\s+/).filter(Boolean);
    const hit = products.filter((p) => words.every((w) => haystack(p).includes(w)));
    const rows = hit.map((p) => {
      const url = p.affiliate && p.affiliate.amazon;
      const href = url ? esc(url) : "question.html";
      const ext = url ? ' target="_blank" rel="sponsored noopener"' : "";
      return `<a class="res-item" href="${href}"${ext}>
        <span class="eyebrow">${LABEL[p.category]}</span>
        <b>${esc(p.brand)} ${esc(p.name)}</b>
        <span class="spec">${esc(p.spec)}${url ? "" : "　／　AI診断で選ぶ"}</span></a>`;
    }).join("");
    box.innerHTML = `<div class="res-head"><span>「${esc(raw)}」のアイテム ${hit.length}件</span><button type="button" id="res-close">閉じる</button></div>
      ${rows || '<div class="empty" style="padding: 12px 0">見つかりませんでした。「登山靴」「ザック」「ポール」などで探してみてください。</div>'}
      <a class="res-more" href="news.html?q=${encodeURIComponent(raw)}">「${esc(raw)}」の最新記事を見る →</a>`;
    box.hidden = false;
    document.getElementById("res-close").addEventListener("click", () => { box.hidden = true; input.value = ""; });
  }

  input.addEventListener("input", render);
  form.addEventListener("submit", (e) => { e.preventDefault(); render(); });
  document.querySelectorAll("[data-q]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); input.value = a.dataset.q; render(); input.focus();
  }));
});
