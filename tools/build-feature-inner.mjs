// 使い方: node tools/build-feature-inner.mjs   data/raw/inner-2026.json → tokushu/inner.html
// 特集「山のインナー（ベースレイヤー）」（2026-11-12〜2027-02-28）。各メーカー公式ページの記載だけで作る。
import fs from "node:fs";
import { esc, head, chrome } from "./shell.mjs";

const R = JSON.parse(fs.readFileSync("data/raw/inner-2026.json", "utf8"));
const yen = (n) => `¥${Number(n).toLocaleString()}`;
const arrow = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
const weight = (p) => (p.weight_g ? `${p.weight_g}g${p.weight_note ? `（${p.weight_note}）` : ""}` : "記載なし");

const GROUPS = [
  { id: "dry", kind: "shell", tag: "汗を肌から離す", title: "ドライ系（肌に直接着るメッシュ）", lead: "肌に直接着る、あみ目の薄い肌着です。汗を上に重ねたウエアへ移して、肌がぬれた状態になりにくくします。これ1枚ではなく、上にベースレイヤーを重ねて使います。" },
  { id: "synthetic", kind: "soft", tag: "乾きが速い", title: "化繊のベースレイヤー", lead: "ポリエステルなどの化学繊維の肌着です。水を含みにくく、乾きが速いのが特徴。汗をよくかく山行や、洗ってすぐ着たい人に向いています。" },
  { id: "merino", kind: "warm", tag: "冷えにくい・においにくい", title: "ウール・メリノウールのベースレイヤー", lead: "羊毛を使った肌着です。ぬれても冷たさを感じにくく、においがつきにくいのが持ち味。泊まりの山行や、長い時間着たい日に向いています。" },
];
const KIND = Object.fromEntries(GROUPS.map((g) => [g.id, [g.kind, g.tag]]));
const P = R.products;
const byGroup = (g) => P.filter((p) => p.group === g);

function card(p) {
  const [k, kl] = KIND[p.group];
  const img = p.image ? `<div class="tk-card-img"><img src="${esc(p.image)}" alt="${esc(p.brand + " " + p.name)}" width="400" height="400" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : "";
  return `<article class="tk-card" id="p-${p.id}">
  ${img}
  <div class="tk-card-body">
    <div class="tk-card-top"><span class="tk-kind tk-kind--${k}">${esc(kl)}</span><span class="eyebrow">${esc(p.brand)}</span></div>
    <h3 class="tk-name">${esc(p.name)}</h3>
    <div class="tk-price"><span class="price-tag">${yen(p.price)}<small>（税込）</small></span></div>
    ${p.price_note ? `<p class="tki-note">※${esc(p.price_note)}（確認日 ${esc(p.checked_at)}）</p>` : ""}
    <dl class="tki-spec">
      <div><dt>素材</dt><dd>${esc(p.material)}</dd></div>
      <div><dt>重さ</dt><dd>${esc(weight(p))}</dd></div>
      <div><dt>厚さ</dt><dd>${esc(p.thickness || "記載なし")}</dd></div>
    </dl>
    <ul class="tk-pts">${p.features.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="fit fit--bad tki-cau"><h4 class="fit-h"><span class="fit-ic">△</span>注意点</h4><ul>${p.cautions.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
    <div class="tk-btns">
      <a class="shop-btn" data-shop="official" data-item="inner-${esc(p.id)}" href="${esc(p.url)}" target="_blank" rel="noopener"><span>公式ページで見る</span>${arrow}</a>
    </div>
  </div>
</article>`;
}

const SHORT = { dry: "ドライ系", synthetic: "化繊", merino: "ウール" };
const rows = GROUPS.flatMap((g) => byGroup(g.id)).map((p) =>
  `<tr><th><a href="#p-${p.id}">${esc(p.name.replace(/ Men's$/, ""))}</a><small>${esc(p.brand)}</small></th><td>${yen(p.price)}</td><td class="tki-mat">${esc(p.material_short)}</td><td>${p.weight_g ? p.weight_g + "g" : "－"}</td><td>${esc(SHORT[p.group])}</td></tr>`).join("");

const n = P.length;
const title = "山のインナー特集｜ベースレイヤー";
const desc = "山で汗冷えしにくく、街でも毎日着られる、登山ブランドのベースレイヤー（肌着）を、素材・重さ・厚さ・価格から選べるように整理しました。";
const c = chrome("../");
const style = `<style>
.tki-note { font-size: 12px; line-height: 1.6; color: var(--ink-sub); }
.tki-spec { display: flex; flex-direction: column; gap: 0; margin: 2px 0; border-top: 1px solid var(--line); }
.tki-spec > div { display: flex; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13px; line-height: 1.6; }
.tki-spec dt { flex: 0 0 3em; font-weight: 700; color: var(--ink-sub); }
.tki-spec dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.tki-cau { margin-top: 2px; }
.tki-cau ul { list-style: disc; padding-left: 1.2em; font-size: 13px; line-height: 1.7; }
.tki-steps { display: grid; gap: 10px; counter-reset: s; }
@media (min-width: 640px) { .tki-steps { grid-template-columns: repeat(2, 1fr); } }
.tki-mat { white-space: normal !important; min-width: 120px; text-align: left !important; }
.tki-table { min-width: 0; table-layout: auto; }
.tki-table th, .tki-table td { padding: 10px 6px; }
.tki-table tbody th small { display: block; font-size: 11px; color: var(--ink-sub); font-weight: 400; }
.tki-table tbody th { white-space: normal; min-width: 130px; }
</style>
`;
const html = `${head(title, desc, "/tokushu/inner.html", style)}
${c.top}
<main class="tk">
  <section class="tk-hero">
    <div class="tk-hero-inner">
      <span class="tk-hero-tag">特集｜2026.11.12 — 2027.2.28</span>
      <h1>山のインナー特集<br><small style="font-size:16px;font-weight:700">ベースレイヤー</small></h1>
      <p>山で汗冷えしにくく、街でも毎日着られる。登山ブランドの肌着を${n}点、素材・重さ・厚さ・価格から比べました。<br>肌に直接着るタイプ別に整理しています。</p>
      <div class="tk-hero-chips">${GROUPS.map((g) => `<a href="#${g.id}">${esc(g.title.replace(/（.*）/, ""))}</a>`).join("")}</div>
    </div>
  </section>
  <div class="tk-pr"><span class="pr-badge">PR</span>この特集はアフィリエイト広告を含みます。価格は確認時点（2026年11月11日）の税込価格で、変わることがあります。</div>

  <nav class="tk-toc" aria-label="この特集の目次">
    <a href="#guide">選び方</a>${GROUPS.map((g) => `<a href="#${g.id}">${esc(g.tag)}</a>`).join("")}<a href="#compare">比較表</a>
  </nav>

  <section class="tk-sec" id="guide">
    <h2 class="h-section">インナー選びは「汗冷え」から</h2>
    <p class="tk-lead">肌に直接着るインナーは、山でいちばん体に近いウエアです。上に着るものが同じでも、インナーで快適さが変わります。まずは4つの考え方を。</p>
    <div class="tk-types tk-types--4">
      <div class="tk-type tk-type--shell"><b>1. 汗冷えのしくみ</b><p>歩くと汗をかきます。その汗でぬれた肌着が、休憩や風で体の熱をうばいます。これが汗冷えです。</p><small>汗をかかない対策ではなく、ぬれたままにしない選び方をします</small></div>
      <div class="tk-type tk-type--soft"><b>2. 素材の違い</b><p>化繊は乾きやすい。メリノウールは、ぬれても冷えにくく、においにくい。ドライ系のメッシュは、汗を肌から離します。</p><small>汗をたくさんかく日は化繊、泊まりや寒い日はウール、が目安</small></div>
      <div class="tk-type tk-type--warm"><b>3. 厚さの選び方</b><p>薄手は動くと暑くなりにくく、通年で使えます。中厚手は寒い季節向き。極厚手は止まっている時間が長い日向きです。</p><small>厚いほど暖かい分、動くと暑くなりやすくなります</small></div>
      <div class="tk-type tk-type--hood"><b>4. 重ね着の順番</b><p>肌に近い順に、ドライ系（使う場合）、ベースレイヤー、中間着（フリースなど）、アウターです。</p><small>ドライ系は、その上にベースレイヤーを重ねて使います</small></div>
    </div>
    <ul class="tk-check">
      <li><b>綿や街用の保温インナー</b>：綿や、汗をかく場面を想定していない保温用の肌着は、ぬれると乾きにくく、山では冷えやすくなります。山には、汗をかく前提でつくられた登山向けの肌着を選びましょう。</li>
      <li><b>山でも街でも</b>：薄手〜中厚手の長袖は、シャツやニットの下に着る肌着としても使えます。毎日着るなら、洗いやすさも大事です。洗濯の条件は商品によって違うので、カードの注意点を見てください。</li>
    </ul>
  </section>

  ${GROUPS.map((g) => `<section class="tk-sec" id="${g.id}">
    <span class="tk-use-tag">${esc(g.tag)}</span>
    <h2 class="h-section">${esc(g.title)}</h2>
    <p class="tk-lead">${esc(g.lead)}</p>
    <div class="tk-list">${byGroup(g.id).map(card).join("")}</div>
  </section>`).join("\n  ")}

  <section class="tk-sec" id="compare">
    <h2 class="h-section">比較表（${n}点）</h2>
    <div class="tk-table-wrap"><table class="tk-table tki-table">
      <thead><tr><th>商品</th><th>価格</th><th>素材</th><th>重さ</th><th>タイプ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="news-note">価格は税込。重さは各商品ページの記載で、サイズが書かれていないものや、モンベルのように平均重量のものがあります。－は記載がないものです。</p>
  </section>

  <div class="notice">
    <div class="notice-head"><span class="pr-badge">PR</span><span>広告について</span></div>
    <p>当サイトはアフィリエイト広告を利用しています。掲載する商品と内容は運営編集部が選んでいます。商品の仕様・価格は、各ブランドの公式サイトの記載（2026年11月11日確認）にもとづきます。</p>
  </div>
</main>
${c.bottom}`;
fs.mkdirSync("tokushu", { recursive: true });
fs.writeFileSync("tokushu/inner.html", html);
console.log(`tokushu/inner.html を作りました（${n}点）`);
