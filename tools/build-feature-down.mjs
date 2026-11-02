// 使い方: node tools/build-feature-down.mjs   data/master の公式情報 → tokushu/down.html
// 特集「ダウンジャケット」（2026-11-02〜2027-02-28）。ノース・フェイスとモンベルを中心に、商品マスターの公式記載だけで作る。
import fs from "node:fs";
import { esc, head, chrome } from "./shell.mjs";

const M = {};
for (const f of fs.readdirSync("data/master").filter((f) => f.endsWith(".json"))) {
  for (const p of JSON.parse(fs.readFileSync(`data/master/${f}`, "utf8")).products || []) M[p.id] = p;
}
const yen = (n) => `¥${Number(n).toLocaleString()}`;
const short = (n) => n.replace(/ Men's$/, "");
const fp = (p) => ((`${p.warmth || ""} ${p.material || ""}`).match(/(\d{3,4})\s?(?:フィルパワー|FP|FIL)/i) || [])[1] || "";
const OUTLET = (p) => (p.evaluation?.cons || []).some((c) => /アウトレット/.test(c));

// 表地のタイプ（公式の素材表記から）
function shell(p) {
  const t = `${p.material || ""} ${p.waterproof || ""}`;
  if (/WINDSTOPPER/i.test(t)) return ["wind", "防風（GORE-TEX WINDSTOPPER）"];
  if (/ドライテック/.test(t)) return ["wp", "防水透湿（シームテープなし）"];
  return ["dwr", "はっ水"];
}
const weight = (p) => (!p.weight_g ? "記載なし" : /\d+g/.test(p.weight_note || "") ? p.weight_note : `${p.weight_g}g${p.weight_note ? `（${p.weight_note}）` : ""}`);

// 女性用のモデル（同じシリーズ）
const WOMEN = {
  "montbell-1101661": "montbell-1101662", "montbell-1101493": "montbell-1101529", "montbell-1101606": "montbell-1101675",
  "montbell-1101706": "montbell-1101707", "montbell-1101713": "montbell-1101714", "montbell-1101708": "montbell-1101709",
  "montbell-1101673": "montbell-1101674", "tnf-light-heat-jacket-m": "tnf-light-heat-jacket-w", "tnf-zi-aconcagua-jacket-m": "tnf-zi-aconcagua-jacket-w",
  "tnf-nuptse-jacket": "tnf-short-nuptse-jacket-w",
};

function card(id) {
  const p = M[id];
  if (!p) throw new Error("商品マスターにありません: " + id);
  const ev = p.evaluation || {};
  const [sk, sl] = shell(p);
  const f = fp(p);
  const w = WOMEN[id] && M[WOMEN[id]];
  const cons = (ev.cons || []).filter((c) => !/アウトレット/.test(c));
  const img = p.image?.url ? `<div class="tk-card-img"><img src="${esc(p.image.url)}" alt="${esc(p.brand + " " + p.name)}" width="400" height="400" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : "";
  return `<article class="tk-card" id="p-${id}">
  <div class="tk-card-side">${img}
  <div class="tk-dspec">
    <div class="tk-dspec-cell"><small>フィルパワー</small><b>${f ? `${f}<span>FP</span>` : "<em>記載なし</em>"}</b></div>
    <div class="tk-dspec-cell"><small>重さ</small><b>${p.weight_g ? `${p.weight_g}<span>g</span>` : "<em>記載なし</em>"}</b></div>
    <div class="tk-dspec-cell tk-dspec-cell--${sk}"><small>表地</small><b class="tk-dspec-shell">${esc(sl)}</b></div>
  </div></div>
  <div class="tk-card-body">
    <div class="tk-card-top"><span class="eyebrow">${esc(p.brand)}</span></div>
    <h3 class="tk-name">${esc(short(p.name))}</h3>
    <div class="tk-price"><span class="price-tag">${yen(p.price)}<small>（税込${OUTLET(p) ? "・通常価格" : ""}）</small></span></div>
    <p class="tk-spec">${[p.weight_g ? `重さ ${weight(p)}` : "", p.size_note ? `サイズ ${p.size_note}` : ""].filter(Boolean).map(esc).join("<span>／</span>")}</p>
    <p class="tk-sum">${esc(ev.summary || "")}</p>
    <ul class="tk-pts">${(ev.pros || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="fit-grid tk-fit">
      ${ev.good_for?.length ? `<div class="fit fit--good"><h4 class="fit-h"><span class="fit-ic">◎</span>向いている人</h4><ul>${ev.good_for.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      ${cons.length ? `<div class="fit fit--bad"><h4 class="fit-h"><span class="fit-ic">△</span>注意点</h4><ul>${cons.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
    </div>
    ${OUTLET(p) ? `<p class="tk-caution">※価格は通常価格です。公式ストアではアウトレット価格で販売されていました（2026年10月12日確認）。</p>` : ""}
    ${w ? `<p class="tk-women">女性用：<a href="../products/${w.id}.html">${esc(w.name)}</a>（${yen(w.price)}${w.weight_g ? `・${w.weight_g}g` : ""}）</p>` : ""}
    <div class="tk-btns"><a class="cta-pill" href="#" data-product="${id}">購入先を見る</a><a class="cta-pill cta-pill--ghost" href="../products/${id}.html">詳しい情報</a></div>
  </div>
</article>`;
}

const USES = [
  { id: "hut", tag: "軽さ重視", title: "秋の山小屋泊・高い山の防寒に", lead: "歩いているあいだはザックに入れておき、休憩や山小屋で着る1枚。軽くて小さくたためるものが向いています。", ids: ["montbell-1101661", "montbell-1101493", "tnf-light-heat-jacket-m"] },
  { id: "tent", tag: "フード付き・バランス型", title: "テント泊・冬の低山に", lead: "朝晩の冷え込みが強いテント泊や、冬の低山の休憩用。頭まで暖かいフード付きや、少し厚手のものが安心です。", ids: ["montbell-1101606", "tnf-zi-aconcagua-jacket-m", "tnf-thunder-jacket-m"] },
  { id: "snow", tag: "濡れ・風に強い", title: "雪山・湿った雪の日に", lead: "ダウンは濡れると膨らみが落ちて暖かさが下がります。雪や結露で濡れやすい場面では、表地が防水透湿や防風のモデルが向いています。", ids: ["montbell-1101706", "montbell-1101713", "montbell-1101708", "tnf-belayer-parka"] },
  { id: "town", tag: "街・山麓", title: "冬の街・登山口までの移動に", lead: "重さは気にせず、街でも山麓でも着られるボリュームのあるダウン。登山で持ち歩くには重めのものも含みます。", ids: ["tnf-nuptse-jacket", "montbell-1101673", "tnf-baltro-jacket"] },
];

const all = USES.flatMap((u) => u.ids);
const rows = all.map((id) => {
  const p = M[id];
  return `<tr><th><a href="#p-${id}">${esc(short(p.name))}</a><small>${esc(p.brand)}</small></th><td>${fp(p) ? fp(p) + "FP" : "－"}</td><td>${p.weight_g ? p.weight_g + "g" : "－"}</td><td>${esc(shell(p)[1].replace(/（.*）/, ""))}</td><td>${yen(p.price)}</td></tr>`;
}).join("");

const title = "ダウンジャケット特集";
const desc = "ノース・フェイスとモンベルを中心に、登山向けのダウンジャケットをフィルパワー・重さ・表地（はっ水／防水透湿／防風）で比べ、山小屋泊・テント泊・雪山・街の用途別に選び方を解説します。";
const c = chrome("../");
const html = `${head(title, desc, "/tokushu/down.html")}
${c.top}
<main class="tk">
  <section class="tk-hero tk-hero--down">
    <div class="tk-hero-inner">
      <span class="tk-hero-tag">特集｜2026.11.2 — 2027.2.28</span>
      <h1>山で選ぶ<br>ダウンジャケット特集</h1>
      <p>ノース・フェイスとモンベルを中心に${all.length}着を、公式の仕様（フィルパワー・重さ・表地・価格）から比べました。<br>「どこで着るか」から選べるように、用途別に整理しています。</p>
      <div class="tk-hero-chips">${USES.map((u) => `<a href="#${u.id}">${esc(u.title.replace(/に$/, ""))}</a>`).join("")}</div>
    </div>
  </section>
  <div class="tk-pr"><span class="pr-badge">PR</span>この特集はアフィリエイト広告を含みます。価格は確認時点の税込価格で、変わることがあります。</div>

  <nav class="tk-toc" aria-label="この特集の目次">
    <a href="#guide">選び方</a>${USES.map((u) => `<a href="#${u.id}">${esc(u.tag)}</a>`).join("")}<a href="#compare">比較表</a>
  </nav>

  <section class="tk-sec" id="guide">
    <h2 class="h-section">ダウンは「4つ」を見て選ぶ</h2>
    <p class="tk-lead">見た目が似ていても、山での使いやすさは中身と表地で大きく変わります。まずはこの4つを見てください。</p>
    <div class="tk-types tk-types--4">
      <div class="tk-type tk-type--warm"><b>フィルパワー（FP）</b><p>ダウンのかさ高さを表す数字。数字が大きいほど、少ない量で暖かく、軽くできます。</p><small>登山用は700〜800FP台が多く、1000FPは軽さを最優先したい人向け</small></div>
      <div class="tk-type tk-type--shell"><b>重さ</b><p>ザックに入れて持ち歩くなら、軽さが大事。厚手で重いものは、休憩や雪山、街向きです。</p><small>この特集では、持ち歩き向けは400g前後までを目安にしています</small></div>
      <div class="tk-type tk-type--soft"><b>表地</b><p>はっ水は小雨や雪をはじく程度。防水透湿や防風の表地は、濡れや風からダウンを守ります。</p><small>雪山や湿った雪の日は、防水透湿・防風が安心</small></div>
      <div class="tk-type tk-type--hood"><b>フードの有無</b><p>冷え込むテント泊や冬山は、頭まで暖かいフード付きが安心。街や中間着なら、フードなしがすっきりします。</p><small>モンベルは名前が「パーカ」ならフード付き、「ジャケット」ならフードなし</small></div>
    </div>
    <ul class="tk-check">
      <li><b>着るタイミング</b>：ダウンは登りで着ると汗で暑くなりすぎます。歩くときは脱いでザックへ、休憩・山小屋・テントで着るのが基本です。</li>
      <li><b>雨の日</b>：防水透湿の表地でも、シームテープ処理のないモデルは完全防水ではありません。雨の日はレインウェアを上に重ねてください。</li>
    </ul>
  </section>

  ${USES.map((u) => `<section class="tk-sec" id="${u.id}">
    <span class="tk-use-tag">${esc(u.tag)}</span>
    <h2 class="h-section">${esc(u.title)}</h2>
    <p class="tk-lead">${esc(u.lead)}</p>
    <div class="tk-list">${u.ids.map(card).join("")}</div>
  </section>`).join("\n  ")}

  <section class="tk-sec" id="compare">
    <h2 class="h-section">比較表（${all.length}着）</h2>
    <div class="tk-table-wrap"><table class="tk-table tk-table--down">
      <thead><tr><th>商品</th><th>フィルパワー</th><th>重さ</th><th>表地</th><th>価格</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="news-note">重さは公式の記載（モンベルは平均重量、ノース・フェイスは記載のサイズ）。－は公式に記載がないものです。ノース・フェイスの多くはフィルパワーの記載がありません。</p>
    <a class="tk-more" href="../category.html?c=down">ダウンをすべて見る（ほかのブランドも）</a>
  </section>

  <div class="notice">
    <div class="notice-head"><span class="pr-badge">PR</span><span>広告について</span></div>
    <p>当サイトはアフィリエイト広告を利用しています。掲載する商品と内容は運営編集部が選んでいます。商品の仕様・価格は、各ブランドの公式オンラインストアの記載にもとづきます。</p>
  </div>
</main>
${c.bottom}`;
fs.mkdirSync("tokushu", { recursive: true });
fs.writeFileSync("tokushu/down.html", html);
console.log(`tokushu/down.html を作りました（${all.length}着）`);
