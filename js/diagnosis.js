// 診断：回答を保存 → 結果ページで data/products.json から商品を選んで表示
const TERRAIN = {
  low: { label: "日帰りの低山", title: "整備された道へ。<br>軽さと歩きやすさを。" },
  mid: { label: "日帰りの中級山岳", title: "日帰りで中級山岳へ。<br>軽さより「安定」を。" },
  hut: { label: "山小屋泊の縦走", title: "稜線を歩きつなぐ。<br>荷物と足元の両立を。" },
  tent: { label: "テント泊", title: "すべてを背負って歩く。<br>まず土台の装備を。" },
};
const CONCERN = { knee: "膝が不安", sweat: "汗をかきやすい", cold: "寒がり", budget: "予算をおさえたい", light: "荷物を軽くしたい" };
const CATEGORY = { boots: "登山靴", poles: "トレッキングポール", pack: "ザック" };
const KEY = "yamafit.answers";

const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (patch) => { try { sessionStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch {} };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

document.addEventListener("DOMContentLoaded", () => {
  // 質問画面：次へ
  const next = document.getElementById("next");
  if (next) next.addEventListener("click", () => {
    const on = document.querySelector('.option[aria-pressed="true"]');
    save({ terrain: on ? on.dataset.value : "" });
  });
  // 自由記述画面：結果を見る
  const toResult = document.getElementById("to-result");
  if (toResult) toResult.addEventListener("click", () => {
    const concerns = [...document.querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.dataset.value);
    save({ concerns, text: (document.getElementById("concern") || {}).value || "" });
  });
  // 結果画面
  if (document.getElementById("picks")) renderResult();
});

function score(p, a) {
  let s = 0;
  if (a.terrain && p.terrain.includes(a.terrain)) s += 3;
  for (const c of a.concerns || []) if (p.concerns.includes(c)) s += 2;
  return s;
}

async function renderResult() {
  const a = load();
  if (!a.terrain && !(a.concerns || []).length) return; // 回答なし：案内メッセージのまま
  let products;
  try { products = (await (await fetch("data/products.json", { cache: "no-cache" })).json()).products; } catch { return; }

  const t = TERRAIN[a.terrain];
  if (t) document.getElementById("result-title").innerHTML = t.title;
  const tags = [t && t.label, ...(a.concerns || []).map((c) => CONCERN[c])].filter(Boolean);
  document.getElementById("result-tags").innerHTML = tags.map((x) => `<span>${esc(x)}</span>`).join("");

  const picks = Object.keys(CATEGORY).map((cat) =>
    products.filter((p) => p.category === cat).sort((x, y) => score(y, a) - score(x, a))[0]).filter(Boolean);
  const arrow = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  const shop = (label, url, key, id) => `<a class="shop" href="${esc(url || "#")}" data-shop="${key}" data-item="${esc(id)}" ${url ? 'target="_blank" rel="sponsored noopener"' : ""}><span>${label}</span>${arrow}</a>`;

  document.getElementById("picks").innerHTML = picks.map((p, i) => {
    const hit = (a.concerns || []).find((c) => p.reasons[c]);
    const reason = hit ? p.reasons[hit] : p.default_reason;
    return `<article class="product">
      <div class="product-head">
        ${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="${esc(p.brand + " " + p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;photo photo--thumb&quot;>写真</div>'">` : '<div class="photo photo--thumb">商品写真</div>'}
        <div class="product-body">
          <div class="product-no"><span class="mono">0${i + 1}</span><span>${CATEGORY[p.category]}</span></div>
          <h3>${esc(p.brand)} ${esc(p.name)}</h3>
          <div class="spec">${esc(p.spec)}</div>
          <div class="price">${p.price ? "¥" + p.price.toLocaleString() : "[価格]"}</div>
        </div>
      </div>
      <div class="reason"><b>あなたに選んだ理由</b><p>${esc(reason)}</p></div>
      <div class="shops"><b>ショップで見る</b><div class="shops-grid">
        ${shop("Amazon", p.affiliate.amazon, "amazon", p.id)}${shop("楽天市場", p.affiliate.rakuten, "rakuten", p.id)}${shop("Yahoo!", p.affiliate.yahoo, "yahoo", p.id)}
      </div></div></article>`;
  }).join("");

  const c = document.getElementById("result-summary");
  if (c) {
    const parts = [t ? `行き先は「${t.label}」` : "", (a.concerns || []).length ? `気になることは「${(a.concerns || []).map((x) => CONCERN[x]).join("」「")}」` : ""].filter(Boolean).join("、");
    c.textContent = `${parts}という条件から、登録している商品の中で条件に合うものを3つ選びました。` + (a.text ? `いただいた自由記述（「${a.text.slice(0, 60)}」）は、選定には使っていません。参考として手元に置いてお読みください。` : "");
  }
}
