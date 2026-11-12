// 使い方: node tools/build-feature-fleece.mjs   data/master の記載 → tokushu/fleece.html
// 特集「フリース」（2026-11-12〜2027-02-28）。山の中間着にも街の上着にもなるフリースを、商品マスターの記載だけで作る。
import fs from "node:fs";
import { esc, head, chrome } from "./shell.mjs";

const M = {};
for (const f of fs.readdirSync("data/master").filter((f) => f.endsWith(".json"))) {
  for (const p of JSON.parse(fs.readFileSync(`data/master/${f}`, "utf8")).products || []) M[p.id] = p;
}
const yen = (n) => `¥${Number(n).toLocaleString()}`;
const clean = (n) => n.replace(/^メンズ /, "").replace(/ (メンズ|ウィメンズ)$/, "");
const weightNote = (p) => (!p.weight_g ? "記載なし" : /\d+g/.test(p.weight_note || "") ? p.weight_note : `${p.weight_g}g${p.weight_note && p.weight_note !== "公式記載" ? `（${p.weight_note}）` : ""}`);
const GENDER = { mens: "男性用", womens: "女性用" };

// 商品ごとの記載（素材・形・文章は、すべて data/master の記載から。書いていない項目は「記載なし」）
const D = {
  "wildthings-wt26124ad": {
    form: "ジャケット", mat: "記載なし",
    sum: "90年代のフリースアイテムからインスピレーションを得たジャケットです。",
    pros: ["90年代のフリースから着想を得たデザイン"],
  },
  "kavu-19821106": {
    form: "ジャケット", mat: "外側は起毛フリース／裏地は細かいフリース",
    sum: "ボアフリースを使ったジャケットです。外側は発色と保温性の高い起毛フリース、裏地は肌ざわりのよい細かいフリースです。",
    pros: ["外側は発色と保温性の高い起毛フリース", "裏地は肌ざわりのよい細かいフリース"],
  },
  "hellyhansen-hh52473": {
    form: "ジャケット", mat: "シャギーフリース（毛足の長いフリース）",
    sum: "柔らかな肌ざわりで暖かい、シャギーフリースのジャケットです。",
    pros: ["毛足の長いシャギーフリースは、デッドエア（動かない空気）をためやすく、保温力が高いと記載", "防水アウター「イェラグライトジャケット」と連結できるZIP IN ZIP仕様"],
  },
  "millet-miv10693": {
    form: "ジャケット", mat: "パイル（2WAYストレッチ）とフリース（4WAYストレッチ）",
    sum: "ソフトな肌ざわりと高い保温性を兼ね備えたフリースジャケットです。",
    pros: ["ソフトな肌ざわりと高い保温性", "パイルは2WAYストレッチ、フリースは4WAYストレッチ素材"],
  },
  "tnf-expedition-grid-fleece-light-crew": {
    form: "クルー（プルオーバー）", mat: "グリッド構造フリース（リサイクル中空繊維）",
    sum: "毛足の短いグリッド構造のフリースです。夏山の朝晩の冷えに合わせた軽い1枚です。",
    pros: ["約90g（Lサイズ）と非常に軽い", "メッシュ構造で通気性が高い", "サムループ付き"],
    cons: ["夏山向けで、冬の主な防寒着には薄い"],
    good: ["荷物を軽くしたい人", "重ね着の1枚目にしたい人"],
  },
  "millet-miv10448": {
    form: "ジャケット", mat: "ポーラテック ミニグリッド フリース",
    sum: "適度な保温性と快適性があり、季節やアクティビティを問わず使える軽量フリースジャケットです。",
    pros: ["運動時に快適な暖かさのポーラテック ミニグリッド フリース", "ストレッチ性の記載あり"],
  },
  "marmot-polarlite-ambient-fleece-jacket-m": {
    form: "ジャケット", mat: "POLARTEC 100（ポリエステル100%）",
    sum: "軽量ながら適度な保温性と通気性がある、POLARTEC 100のフリースジャケットです。",
    pros: ["適度な保温性と通気性", "秋冬は行動着、真冬はミドラーとして使えると記載"],
    cons: ["Lサイズで389g"],
    good: ["行動着にもミドラーにも使いたい人"],
  },
  "marmot-alpinist-tech-sweater-m": {
    form: "ジャケット", mat: "POLARTEC 100",
    sum: "1990年代のヘリテージモデルをもとにした、POLARTEC 100のフリースジャケットです。",
    pros: ["軽量ながら保温性と通気性があると記載", "秋冬は行動着、厳しい寒さの冬はミドラーとして使えると記載"],
    cons: ["Lサイズで454gと、軽量フリースより重い"],
    good: ["クラシックなデザインが好きな人"],
  },
  "arcteryx-kyanite-lt-hoody-w": {
    form: "フーディ", mat: "フリース（詳しい素材は記載なし）",
    sum: "春秋シーズンにちょうどよい保温性を備えたフリースのフーディです。",
    pros: ["春秋にちょうどよい保温性", "ストレッチ性の記載あり"],
  },
  "kavu-19822516": {
    form: "ジャケット", mat: "表地は軽量ナイロン／裏地はフリース",
    sum: "90年代に作られた名作を、ナイロンとフリースでアップデートしたジャケットです。",
    pros: ["表地は軽量なナイロン、裏地は暖かなフリース", "防風性と保温性を両立したと記載"],
  },
  "wildthings-wt26130ad": {
    form: "ジャケット", mat: "撥水ナイロン／裏地はフリース",
    sum: "撥水ナイロン生地に、裏地はフリースを使ったジャケットです。",
    pros: ["撥水加工（公式記載）", "中わたやダウンのヘビーアウターにない気軽さ。秋から春先まで長く活躍すると記載"],
  },
  "millet-miv10539": {
    form: "ジャケット", mat: "3層防風素材（裏地はグリッド状の起毛フリース）",
    sum: "防風素材の裏にグリッド状の起毛フリースを使った、寒い季節向けのジャケットです。",
    pros: ["裏地はグリッド状の起毛フリースの3層防風素材", "撥水加工（公式記載）"],
  },
  "kavu-19823002": {
    form: "ベスト", mat: "フリース（中肉・軽量）",
    sum: "中肉で軽量、やわらかくなめらかな質感のフリースを使ったベストです。",
    pros: ["保温性と通気性に優れると記載"],
  },
  "wildthings-wt26125ad": {
    form: "ベスト", mat: "記載なし",
    sum: "90年代のフリースアイテムからインスピレーションを得たベストです。",
    pros: ["90年代のフリースから着想を得たデザイン"],
  },
  "patagonia-r1-jacket-m": {
    form: "ジャケット", mat: "ポーラテック パワーグリッド（リサイクル・ポリエステル93％／ポリウレタン7％）",
    sum: "伸縮性・耐久性・通気性のあるポーラテック パワーグリッドを使った、山の涼しい日に多用途に使える中間着です。",
    pros: ["グリッド構造のフリースで、伸縮性・耐久性・通気性があると記載", "343gと軽く、コンパクトに収納できると記載"],
    cons: ["スリム・フィットなので、厚手の服の上には重ねにくい", "真冬の主な防寒着にするには、薄めです。"],
    good: ["歩いている間も着ていたい人", "重ね着で温度を調整したい人"],
  },
  "marmot-polartec-compass-fleece-jacket-pro": {
    form: "ジャケット", mat: "ポーラテック サーマルプロ（ポリエステル100％）",
    sum: "軽量で保温性と通気性に優れたポーラテック サーマルプロを使った、総裏仕様のフリースジャケットです。",
    pros: ["総裏仕様で、暖かい空気を保持すると記載", "ややオーバーサイズのシルエットで、街でも着やすいと記載", "同じ素材のパンツとセットアップにできる"],
    cons: ["Lサイズで553gと、薄手のフリースより重い"],
    good: ["休憩中や山小屋で暖かく過ごしたい人", "街でも着るフリースを探している人"],
  },
  "mhw-polartec-power-grid-fz-hoody": {
    form: "フーディ", mat: "ポーラテック パワーグリッド",
    sum: "保温と通気のバランスがいい、ポーラテック パワーグリッドの薄手フーディです。",
    pros: ["裏面のグリッド構造で、汗を逃がしやすいと記載", "夏の高所登山では羽織り、冬季登山では行動中の中間着に使えると記載", "フードとサムホール付き"],
    cons: ["薄手なので、真冬の主な防寒着には足りない"],
    good: ["歩いている間も着ていたい人", "フード付きの中間着がほしい人"],
  },
  "tnf-denali-jacket-m-2026": {
    form: "ジャケット", mat: "ポーラテック 300 マイクロ（ポリエステル100％）／肩はナイロン",
    sum: "1989年にエクスペディション向けに開発された、ヘリテージモデルのフリースジャケットです。2026年モデルは、本体にポーラテック 300 マイクロフリースを使っています。",
    pros: ["保温性に優れ、通気性を備えたポーラテック 300 マイクロフリースと記載", "パックなどに干渉しやすい肩部分はナイロン生地を配置", "ZIP IN ZIP対応。左右サイドと左右胸にファスナーポケット"],
    cons: ["Lサイズで約710gと、薄手のフリースより重い"],
    good: ["休憩中や山小屋で暖かく過ごしたい人", "街でも山でも着られる定番のフリースがほしい人"],
  },
};

// 女性用／男性用の対になるモデル（マスターにあるもの）
const PAIR = { "kavu-19821106": ["女性用", "kavu-19822529"] };

const USES = [
  {
    id: "fluffy", tag: "もこもこの厚手", title: "もこもこの厚手フリース",
    lead: "ボリュームがあって、見た目もあたたかい1着です。山小屋や休憩中の保温に、街の上着としても使えます。",
    good: ["山小屋や休憩中に着る保温着がほしい人", "街で着る上着を探している人"],
    cons: ["かさばりやすく、ザックの中で場所をとります。", "風を通しやすいので、風の強い日は上に風を防ぐ服を重ねます。"],
    ids: ["wildthings-wt26124ad", "kavu-19821106", "hellyhansen-hh52473", "millet-miv10693"],
  },
  {
    id: "thin", tag: "薄手・グリッド", title: "薄手〜中くらいの厚さ。歩く間の中間着",
    lead: "動いても暑くなりにくく、重ね着しやすいタイプです。歩いている間の中間着として、また街の軽い羽織りとしても。",
    good: ["歩いている間も着ていたい人", "重ね着で温度を調整したい人"],
    cons: ["真冬の主な防寒着にするには、薄めです。", "風を通しやすいので、風の日は上に重ねます。"],
    ids: ["tnf-expedition-grid-fleece-light-crew", "millet-miv10448", "marmot-polarlite-ambient-fleece-jacket-m", "marmot-alpinist-tech-sweater-m", "arcteryx-kyanite-lt-hoody-w"],
  },
  {
    id: "polartec", tag: "ポーラテック", title: "ポーラテックのフリース",
    lead: "ポーラテックは、1981年に生まれた合成フリースから続く、アメリカのフリース素材のブランドです（POLARTECのブランドは1991年に誕生）。汗をかく行動中は軽くて通気性のあるパワーグリッド、休憩中は保温性と通気性のバランスがよいサーマルプロが目安です。厚手の300シリーズは、保温を重視する人に向きます。",
    good: ["素材から選びたい人", "山でも街でも長く着たい人"],
    cons: ["フリースは風を通しやすいので、風の日は上に風を防ぐ上着を重ねます。"],
    ids: ["tnf-denali-jacket-m-2026", "patagonia-r1-jacket-m", "mhw-polartec-power-grid-fz-hoody", "marmot-polartec-compass-fleece-jacket-pro"],
  },
  {
    id: "wind", tag: "風を防ぐタイプ", title: "表地や裏地に工夫のある、風を防ぐタイプ",
    lead: "ナイロンなどの表地にフリースを合わせたタイプです。風のある日の上着として、また山でも街でも着られます。",
    good: ["風のある日に1枚で着たい人", "フリースの暖かさと、すっきりした見た目の両方がほしい人"],
    cons: ["表地が風を防ぐ分、蒸れを感じることがあります。歩いている間は前を開けて調整します。"],
    ids: ["kavu-19822516", "wildthings-wt26130ad", "millet-miv10539"],
  },
  {
    id: "vest", tag: "ベスト", title: "重ね着しやすいベスト",
    lead: "腕まわりが軽く、ジャケットやシェルの下に重ねやすいタイプです。着たまま動きやすく、足したい暖かさだけ足せます。",
    good: ["体の中心だけ暖かくしたい人", "ほかの上着と重ねて使いたい人"],
    cons: ["腕は暖かくならないので、寒い日は長袖と合わせます。"],
    ids: ["kavu-19823002", "wildthings-wt26125ad"],
  },
];

const all = USES.flatMap((u) => u.ids);

// 確認：価格あり・US始まりでない・在庫切れでない・ブランドは最大4着
const brandCount = {};
for (const id of all) {
  const p = M[id];
  if (!p) throw new Error("商品マスターにありません: " + id);
  if (p.category !== "wear") throw new Error("ウェアではありません: " + id);
  if (p.price == null) throw new Error("価格がありません: " + id);
  if (/^US /.test(p.name)) throw new Error("US始まりの商品です: " + id);
  if ((p.offers || []).length && (p.offers || []).every((o) => o.in_stock === false)) throw new Error("在庫切れです: " + id);
  if (!D[id]) throw new Error("記載データがありません: " + id);
  brandCount[p.brand] = (brandCount[p.brand] || 0) + 1;
}
for (const [b, n] of Object.entries(brandCount)) if (n > 4) throw new Error(`${b} が ${n} 着あります`);

function card(id, use) {
  const p = M[id];
  const d = D[id];
  const ev = p.evaluation || {};
  const w = PAIR[id] && M[PAIR[id][1]];
  const good = d.good || use.good;
  const cons = [...(d.cons || []), ...(d.cons ? [] : use.cons)];
  const img = p.image?.url ? `<div class="tk-card-img"><img src="${esc(p.image.url)}" alt="${esc(p.brand + " " + clean(p.name))}" width="400" height="400" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : "";
  return `<article class="tk-card" id="p-${id}">
  <div class="tk-card-side">${img}
  <div class="tk-dspec">
    <div class="tk-dspec-cell"><small>重さ</small><b>${p.weight_g ? `${p.weight_g}<span>g</span>` : "<em>記載なし</em>"}</b></div>
    <div class="tk-dspec-cell"><small>形</small><b class="tkf-txt">${esc(d.form)}</b></div>
    <div class="tk-dspec-cell"><small>素材</small><b class="tkf-txt">${d.mat === "記載なし" ? "<em>記載なし</em>" : esc(d.mat)}</b></div>
  </div></div>
  <div class="tk-card-body">
    <div class="tk-card-top"><span class="eyebrow">${esc(p.brand)}</span>${GENDER[p.gender] ? `<span class="tkf-gender">${GENDER[p.gender]}</span>` : ""}</div>
    <h3 class="tk-name">${esc(clean(p.name))}</h3>
    <div class="tk-price"><span class="price-tag">${yen(p.price)}<small>（税込）</small></span></div>
    <p class="tk-spec">${[p.weight_g ? `重さ ${esc(weightNote(p))}` : "重さ 記載なし"].join("")}</p>
    <p class="tk-sum">${esc(d.sum || ev.summary || "")}</p>
    <ul class="tk-pts">${d.pros.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="fit-grid tk-fit">
      <div class="fit fit--good"><h4 class="fit-h"><span class="fit-ic">◎</span>向いている人</h4><ul>${good.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
      <div class="fit fit--bad"><h4 class="fit-h"><span class="fit-ic">△</span>注意点</h4><ul>${cons.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
    </div>
    ${w ? `<p class="tk-women">${PAIR[id][0]}：<a href="../products/${w.id}.html">${esc(w.name)}</a>（${yen(w.price)}${w.weight_g ? `・${w.weight_g}g` : ""}）</p>` : ""}
    <div class="tk-btns"><a class="cta-pill" href="#" data-product="${id}">購入先を見る</a><a class="cta-pill cta-pill--ghost" href="../products/${id}.html">詳しい情報</a></div>
  </div>
</article>`;
}

const useOf = {};
for (const u of USES) for (const id of u.ids) useOf[id] = u;

const rows = all.map((id) => {
  const p = M[id];
  const d = D[id];
  return `<tr><th><a href="#p-${id}">${esc(clean(p.name))}</a><small>${esc(p.brand)}</small></th><td>${yen(p.price)}</td><td>${p.weight_g ? p.weight_g + "g" : "記載なし"}</td><td class="tkf-mat">${d.mat === "記載なし" ? "記載なし" : esc(d.mat)}</td><td>${esc(d.form)}</td></tr>`;
}).join("");

const STYLE = `<style>
.tk-hero.tkf-hero { background: linear-gradient(160deg, #1E2A1B 0%, #4A5A36 55%, #A8A27A 100%); }
.tkf-hero p { color: #ECEBDD; }
.tk-use-tag.tkf-tag { background: #E8EBD8; color: #3C4A2A; }
.tkf-gender { padding: 2px 9px; border-radius: 999px; background: #EFEFE6; color: #4A5A36; font-size: 11px; font-weight: 700; }
.tkf-txt { font-size: 14px !important; line-height: 1.6 !important; font-weight: 700 !important; }
.tkf-hero + .tk-pr { margin-top: 14px; }
.tkf-table { min-width: 680px; }
.tkf-table tbody th small { display: block; font-size: 11px; color: var(--ink-sub); font-weight: 400; }
.tkf-table td.tkf-mat { white-space: normal; text-align: left; min-width: 200px; line-height: 1.6; }
</style>
`;

const title = "フリース特集";
const desc = "山の中間着にも、街の上着にもなるフリースを、重さ・素材・形で比べました。厚手・薄手・風を防ぐタイプ・ベストに分けて、選び方といっしょにまとめています。";
const c = chrome("../");
const html = `${head(title, desc, "/tokushu/fleece.html", STYLE)}
${c.top}
<main class="tk">
  <section class="tk-hero tkf-hero">
    <div class="tk-hero-inner">
      <span class="tk-hero-tag">特集｜2026.11.12 — 2027.2.28</span>
      <h1>山でも街でも着られる<br>フリース特集</h1>
      <p>山では中間着に、街では上着に。1枚持っていると長く使える${all.length}着を、重さ・素材・形で比べました。<br>厚さや使う場面ごとに分けてあるので、気になるところから見てください。</p>
      <div class="tk-hero-chips">${USES.map((u) => `<a href="#${u.id}">${esc(u.tag)}</a>`).join("")}</div>
    </div>
  </section>
  <div class="tk-pr"><span class="pr-badge">PR</span>この特集はアフィリエイト広告を含みます。価格は確認時点の税込価格で、変わることがあります。</div>

  <nav class="tk-toc" aria-label="この特集の目次">
    <a href="#guide">選び方</a>${USES.map((u) => `<a href="#${u.id}">${esc(u.tag)}</a>`).join("")}<a href="#compare">比較表</a>
  </nav>

  <section class="tk-sec" id="guide">
    <h2 class="h-section">フリースは「4つ」を見て選ぶ</h2>
    <p class="tk-lead">どれも同じように見えて、着る場面で向き不向きがあります。まずはこの4つを見てください。</p>
    <div class="tk-types tk-types--4">
      <div class="tk-type tk-type--warm"><b>厚さと使う場面</b><p>厚手は暖かく、休憩や山小屋、街の上着に向きます。薄手は動いても暑くなりにくく、歩いている間の中間着に向きます。</p><small>どこで着るかを先に決めると選びやすくなります</small></div>
      <div class="tk-type tk-type--shell"><b>風への弱さと重ね着</b><p>フリースは風を通しやすい素材です。風の強い日は、上に風を防ぐ上着を重ねてください。</p><small>表地にナイロンなどを合わせたタイプは、1枚でも着やすくなります</small></div>
      <div class="tk-type tk-type--soft"><b>重さ・かさ</b><p>ザックに入れて持ち歩くなら、軽くて小さくなるものが楽です。厚手は暖かい分、かさばります。</p><small>この特集では、重さを各商品に書いています。記載がないものは「記載なし」です</small></div>
      <div class="tk-type tk-type--hood"><b>手入れ</b><p>洗濯表示を見て洗います。毛玉を防ぐには、洗濯ネットに入れ、ほかの衣類と分けて洗うのが基本です。</p><small>起毛のものは、ほかの服とこすれて毛玉になりやすくなります</small></div>
    </div>
    <ul class="tk-check">
      <li><b>山で着るとき</b>：歩き出しは少し寒いくらいがちょうどよいです。暑くなったら脱いで、休憩のときに着ましょう。</li>
      <li><b>街で着るとき</b>：厚手はシャツやデニムに合わせて上着に。薄手はコートの下に着ても使えます。</li>
    </ul>
  </section>

  ${USES.map((u) => `<section class="tk-sec" id="${u.id}">
    <span class="tk-use-tag tkf-tag">${esc(u.tag)}</span>
    <h2 class="h-section">${esc(u.title)}</h2>
    <p class="tk-lead">${esc(u.lead)}</p>
    <div class="tk-list">${u.ids.map((id) => card(id, u)).join("")}</div>
  </section>`).join("\n  ")}

  <section class="tk-sec" id="compare">
    <h2 class="h-section">比較表（${all.length}着）</h2>
    <div class="tk-table-wrap"><table class="tk-table tkf-table">
      <thead><tr><th>商品</th><th>価格（税込）</th><th>重さ</th><th>素材</th><th>形</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="news-note">重さと素材は商品ページの記載にもとづきます。サイズによって重さは変わります。記載のないものは「記載なし」です。</p>
    <a class="tk-more" href="../category.html?c=wear">ウェアをすべて見る（ほかのブランドも）</a>
  </section>

  <div class="notice">
    <div class="notice-head"><span class="pr-badge">PR</span><span>広告について</span></div>
    <p>当サイトはアフィリエイト広告を利用しています。掲載する商品と内容は運営編集部が選んでいます。商品の仕様・価格は、各ブランドの公式オンラインストアの記載にもとづきます。</p>
  </div>
</main>
${c.bottom}`;
fs.mkdirSync("tokushu", { recursive: true });
fs.writeFileSync("tokushu/fleece.html", html);
console.log(`tokushu/fleece.html を作りました（${all.length}着）`);
