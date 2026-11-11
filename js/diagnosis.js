// 装備診断：回答（行き先・悩み・自由記述）を保存 → 結果ページで data/products.json から選んで表示する。
// 自由記述は AI を使わず、キーワードで悩みや条件に置き換える（サーバーには送らない）。
const TERRAIN = {
  low: { label: "日帰りの低山", title: "整備された道へ。<br>軽さと歩きやすさを。" },
  mid: { label: "日帰りの中級山岳", title: "日帰りで中級山岳へ。<br>軽さより「安定」を。" },
  hut: { label: "山小屋泊の縦走", title: "稜線を歩きつなぐ。<br>荷物と足元の両立を。" },
  tent: { label: "テント泊", title: "すべてを背負って歩く。<br>まず土台の装備を。" },
};
const CONCERN = { knee: "膝が不安", sweat: "汗をかきやすい", cold: "寒がり", budget: "予算をおさえたい", light: "荷物を軽くしたい", rain: "雨にそなえたい" };
const CATEGORY = { boots: "登山靴", pack: "ザック", rain: "レインウェア", poles: "トレッキングポール", wear: "防寒ウェア" };
const KEY = "yamafit.answers";

const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (patch) => { try { sessionStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch {} };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const BASE = typeof SITE_BASE !== "undefined" ? SITE_BASE : "";

// 自由記述 → 条件（キーワードで拾う）
const WORDS = [
  [/膝|ひざ|ヒザ|関節|下り(が|で)/, { concern: "knee", note: "膝の負担" }],
  [/汗|蒸れ|むれ|ムレ|暑がり|暑い/, { concern: "sweat", note: "汗・蒸れ" }],
  [/寒|冷え|冷たい|冬|雪|凍/, { concern: "cold", note: "寒さ" }],
  [/予算|安く|安い|お金|節約|コスパ|お手頃|手頃|高い/, { concern: "budget", note: "予算" }],
  [/軽|重(い|く|さ)|体力|疲れ/, { concern: "light", note: "軽さ" }],
  [/雨|濡れ|ぬれ|防水|梅雨/, { concern: "rain", note: "雨・防水" }],
  [/女性|レディース|ウィメンズ|彼女|妻|娘/, { gender: "w", note: "レディース" }],
  [/男性|メンズ|彼氏|夫|息子/, { gender: "m", note: "メンズ" }],
  [/初心者|はじめて|初めて|初登山|デビュー/, { beginner: true, note: "はじめての登山" }],
];
function readText(text) {
  const out = { concerns: [], notes: [], gender: "", maxPrice: 0, beginner: false };
  if (!text) return out;
  const t = text.normalize("NFKC");
  for (const [re, v] of WORDS) if (re.test(t)) {
    if (v.concern && !out.concerns.includes(v.concern)) out.concerns.push(v.concern);
    if (v.gender && !out.gender) out.gender = v.gender;
    if (v.beginner) out.beginner = true;
    out.notes.push(v.note);
  }
  // 「2万円以内」「15000円まで」→ 1点あたりの上限
  const m = t.match(/(\d+(?:\.\d+)?)\s*(万)?\s*円/);
  if (m) { out.maxPrice = Math.round(parseFloat(m[1]) * (m[2] ? 10000 : 1)); if (out.maxPrice >= 1000) out.notes.push(`1点${out.maxPrice.toLocaleString()}円まで`); else out.maxPrice = 0; }
  return out;
}

document.addEventListener("DOMContentLoaded", () => {
  const next = document.getElementById("next");
  if (next) next.addEventListener("click", () => {
    const on = document.querySelector('.option[aria-pressed="true"]');
    save({ terrain: on ? on.dataset.value : "" });
  });
  const skip = document.getElementById("skip");
  if (skip) skip.addEventListener("click", () => save({ terrain: "" }));
  const toResult = document.getElementById("to-result");
  if (toResult) toResult.addEventListener("click", () => {
    const concerns = [...document.querySelectorAll('.chip[data-value][aria-pressed="true"]')].map((c) => c.dataset.value);
    const g = [...document.querySelectorAll('.chip[data-gender][aria-pressed="true"]')].map((c) => c.dataset.gender);
    save({ concerns, gender: g.length === 1 ? g[0] : "", text: ((document.getElementById("concern") || {}).value || "").slice(0, 300) });
  });
  if (document.getElementById("picks")) renderResult();
});

const SEASON_NOW = (() => { const m = new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1; return m >= 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "autumn"; })();
const NOT_HIKING = /クロッグ|サンダル|スリッポン|ラバーブーツ|レインブーツ|長靴|スニーカー|モック|ウォーターシュー|キッズ|ジュニア|トートバッグ|ショルダーバッグ|サコッシュ|ウエストバッグ|ボディバッグ|ポーチ|傘/;
const inStock = (p) => (p.offers || []).some((o) => o.in_stock !== false);

function packFit(p, terrain) { // 行き先に合う容量
  const l = p.capacity_l; if (!l) return 0;
  const [lo, hi] = { low: [15, 30], mid: [20, 35], hut: [30, 50], tent: [45, 75] }[terrain] || [15, 40];
  return l >= lo && l <= hi ? 3 : l < lo - 10 || l > hi + 15 ? -3 : 0;
}

function pick(products, cat, a, used) {
  let list = products.filter((p) => p.category === cat && !used.has(p.id) && p.price && !NOT_HIKING.test(p.name) && inStock(p));
  if (a.gender) list = list.filter((p) => !p.gender || p.gender === "unisex" || p.gender === a.gender);
  if (cat === "wear") list = list.filter((p) => (p.concerns || []).includes("cold") && /ジャケット|パーカ|フーディ|ベスト|JACKET|HOODY/i.test(p.name));
  if (cat === "rain") list = list.filter((p) => /ジャケット|パーカ|スーツ|シェル|アノラック|JACKET|PARKA/i.test(p.name) && !/カバー|パンツ|ポンチョ|傘/.test(p.name));
  if (a.maxPrice) { const under = list.filter((p) => p.price <= a.maxPrice); if (under.length) list = under; }
  if (!list.length) return null;
  const prices = list.map((p) => p.price).sort((x, y) => x - y), median = prices[Math.floor(prices.length / 2)];
  const weights = list.map((p) => p.weight_g).filter(Boolean).sort((x, y) => x - y), wMed = weights[Math.floor(weights.length / 2)] || 0;
  const score = (p) => {
    let s = 0;
    if (a.terrain) s += (p.terrain || []).includes(a.terrain) ? 3 : -2;
    if (cat === "pack") s += packFit(p, a.terrain);
    for (const c of a.concerns) {
      if ((p.concerns || []).includes(c)) s += 2;
      if (c === "light" && p.weight_g && wMed) s += p.weight_g <= wMed ? 1.5 : -1;
      if (c === "budget") s += p.price <= median ? 2 : -1;
      if (c === "rain" && p.waterproof && /防水|GORE|ゴア/i.test(p.waterproof)) s += 2;
      if (c === "knee" && cat === "boots" && /ミッド|ハイ|MID|HIGH/i.test(p.name)) s += 1;
    }
    if (a.beginner && p.price > median * 1.5) s -= 1;
    if ((p.season || []).includes(SEASON_NOW)) s += 0.5;
    if (p.ai_image) s += 1.5; // 写真と紹介記事がある商品を優先
    if (p.weight_g) s += 0.5;
    if ((p.features || []).length >= 3) s += 0.5;
    return s;
  };
  return list.map((p) => [score(p), p]).sort((x, y) => y[0] - x[0] || x[1].price - y[1].price)[0][1];
}

function reasonFor(p, a) {
  const parts = [];
  if (a.terrain && (p.terrain || []).includes(a.terrain)) parts.push(`「${TERRAIN[a.terrain].label}」に合う装備として登録しています。`);
  const first = { wear: "cold", poles: "knee", rain: "rain" }[p.category];
  const order = first && a.concerns.includes(first) ? [first, ...a.concerns.filter((c) => c !== first)] : a.concerns;
  const hit = order.find((c) => p.reasons && p.reasons[c]);
  if (hit) parts.push(`${CONCERN[hit]}：${p.reasons[hit]}`);
  if (a.concerns.includes("light") && p.weight_g) parts.push(`重さは${p.weight_g.toLocaleString()}g（公式の記載）。`);
  if (a.concerns.includes("budget") && p.price && hit !== "budget") parts.push(`価格は¥${p.price.toLocaleString()}（税込）。`);
  if (p.category === "pack" && p.capacity_l) parts.push(`容量は${p.capacity_l}L。`);
  if (!parts.length && p.for_whom) parts.push(`${p.for_whom}に向いています。`);
  return parts.join(" ");
}

async function renderResult() {
  const saved = load();
  const fromText = readText(saved.text || "");
  const a = {
    terrain: saved.terrain || "",
    concerns: [...new Set([...(saved.concerns || []), ...fromText.concerns])],
    gender: saved.gender || fromText.gender,
    maxPrice: fromText.maxPrice,
    beginner: fromText.beginner,
  };
  if (!a.terrain && !a.concerns.length && !saved.text && !a.gender) return; // 回答なし：案内メッセージのまま
  let products;
  try { products = (await (await fetch(BASE + "data/products.json", { cache: "no-cache" })).json()).products; } catch { return; }

  const t = TERRAIN[a.terrain];
  if (t) document.getElementById("result-title").innerHTML = t.title;
  const tags = [t && t.label, ...a.concerns.map((c) => CONCERN[c]), a.gender === "w" ? "レディース" : a.gender === "m" ? "メンズ" : "", a.maxPrice ? `1点${a.maxPrice.toLocaleString()}円まで` : ""].filter(Boolean);
  document.getElementById("result-tags").innerHTML = tags.map((x) => `<span>${esc(x)}</span>`).join("");

  // まず揃えたい3つ（登山靴・ザック・レインウェア）＋ 悩みに応じて1つ
  const used = new Set();
  const cats = ["boots", "pack", "rain"];
  if (a.concerns.includes("knee")) cats.push("poles");
  else if (a.concerns.includes("cold") || SEASON_NOW === "winter") cats.push("wear");
  const picks = cats.map((cat) => { const p = pick(products, cat, a, used); if (p) used.add(p.id); return p; }).filter(Boolean);
  const head = document.querySelector(".products-head .h-section");
  if (head && picks.length > 3) head.textContent = `まず揃えたい${picks.length}つ`;

  document.getElementById("picks").innerHTML = picks.map((p, i) => {
    const meta = [p.weight_g ? `重量 ${p.weight_g.toLocaleString()}g` : "", p.capacity_l ? `容量 ${p.capacity_l}L` : ""].filter(Boolean).join("・");
    return `<article class="product">
      <div class="product-head">
        ${p.ai_image ? `<img class="thumb" src="${BASE}${esc(p.ai_image)}" alt="${esc(p.brand + " " + p.name)}" loading="lazy">` : ""}
        <div class="product-body">
          <div class="product-no"><span class="mono">0${i + 1}</span><span>${CATEGORY[p.category]}</span></div>
          <h3>${esc(p.brand)} ${esc(p.name)}</h3>
          <div class="spec">${esc(p.spec)}${meta && !/\d+\s*g|\d+\s*L/i.test(p.spec) ? `　${esc(meta)}` : ""}</div>
          <div class="price">¥${p.price.toLocaleString()}<small>（税込）</small></div>
        </div>
      </div>
      <div class="reason"><b>あなたに選んだ理由</b><p>${esc(reasonFor(p, a))}</p></div>
      <div class="shops"><a class="btn" href="#" data-product="${esc(p.id)}"><span>購入先を見る</span></a>
      <a class="link-more" href="${BASE}products/${esc(p.id)}.html"><span>くわしい情報を見る</span></a></div></article>`;
  }).join("") || '<p class="sub">条件に合う商品が見つかりませんでした。条件を少し減らして、もう一度お試しください。</p>';

  const c = document.getElementById("result-summary");
  if (c) {
    const parts = [t ? `行き先は「${t.label}」` : "", a.concerns.length ? `気になることは「${a.concerns.map((x) => CONCERN[x]).join("」「")}」` : ""].filter(Boolean).join("、");
    const textNote = saved.text ? (fromText.notes.length ? `自由記述からは「${[...new Set(fromText.notes)].join("」「")}」を読み取って条件に加えました。` : "自由記述からは、条件にできる言葉を読み取れませんでした。") : "";
    c.textContent = `${parts || "いただいた回答"}をもとに、登録している${products.length}点の中から、公式の記載で条件に合うものを選びました。${textNote}サイズや足の形は人によって違うので、購入前に試着・試し履きをおすすめします。`;
  }
  try { if (window.gtag) window.gtag("event", "diagnosis_result", { terrain: a.terrain || "none", concerns: a.concerns.join(",") || "none" }); } catch {}
}
