// 使い方: node tools/build-feature-montbell-snow.mjs   data/raw/montbell-snow-2026.json → tokushu/montbell-snow.html
// 特集「モンベルのスノーボードウエア」（2026-10-25〜2027-01-31）。公式ストアの記載だけで作る。
import fs from "node:fs";
import { esc, head, chrome } from "./shell.mjs";

const R = JSON.parse(fs.readFileSync("data/raw/montbell-snow-2026.json", "utf8"));
const M = Object.fromEntries(JSON.parse(fs.readFileSync("data/master/montbell.json", "utf8")).products.map((p) => [p.id, p]));
const yen = (n) => `¥${n.toLocaleString()}`;
const IMG = (id) => `../img/feature/montbell-snow/${id}.jpg`;
const official = (id) => `https://webshop.montbell.jp/goods/disp.php?product_id=${id}`;
const arrow = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
const has = (x, re) => x.features.some((f) => re.test(f));

// 種類ごとの色分け
const KIND = (t) => (/一枚地/.test(t) ? ["shell", "一枚地シェル"] : /中綿|インシュ/.test(t) ? ["warm", "中綿入り"] : /ソフト|防風/.test(t) ? ["soft", "防風・保温"] : ["shell", t]);

// 商品カード（ウエアは商品ページ・購入先シートあり、道具は公式ストアへ）
function card(x, opt = {}) {
  const mid = "montbell-" + x.id;
  const ev = (M[mid] || {}).evaluation;
  const [k, kl] = opt.kind || KIND(x.type);
  const pts = opt.points || (ev ? ev.pros : x.features.slice(0, 4));
  const good = ev ? ev.good_for : opt.good || [];
  const bad = ev ? ev.not_for : opt.bad || [];
  const spec = [x.weight ? `平均重量 ${x.weight}g${x.weight_note ? `（${x.weight_note}）` : ""}` : "", x.sizes ? `サイズ ${x.sizes}` : "", x.colors ? `カラー ${x.colors.length}色` : ""].filter(Boolean);
  return `<article class="tk-card" id="p-${x.id}">
  <div class="tk-card-img"><img src="${IMG(x.id)}" alt="モンベル ${esc(x.name)}" width="800" height="800" loading="lazy"></div>
  <div class="tk-card-body">
    <div class="tk-card-top"><span class="tk-kind tk-kind--${k}">${esc(kl)}</span><span class="eyebrow">モンベル</span></div>
    <h3 class="tk-name">${esc(x.name)}</h3>
    <div class="tk-price"><span class="price-tag">${yen(x.price)}<small>（税込）</small></span></div>
    <p class="tk-spec">${spec.map(esc).join("<span>／</span>")}</p>
    <ul class="tk-pts">${pts.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    ${good.length || bad.length ? `<div class="fit-grid tk-fit">
      ${good.length ? `<div class="fit fit--good"><h4 class="fit-h"><span class="fit-ic">◎</span>向いている人</h4><ul>${good.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      ${bad.length ? `<div class="fit fit--bad"><h4 class="fit-h"><span class="fit-ic">△</span>向いていない人</h4><ul>${bad.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
    </div>` : ""}
    ${x.caution ? `<p class="tk-caution">※${esc(x.caution)}（公式の記載）</p>` : ""}
    <div class="tk-btns">
      ${M[mid] ? `<a class="cta-pill" href="#" data-product="${mid}">購入先を見る</a><a class="cta-pill cta-pill--ghost" href="../products/${mid}.html">詳しい情報</a>`
        : `<a class="shop-btn" data-shop="official" data-item="${mid}" href="${official(x.id)}" target="_blank" rel="noopener"><span>公式ストアで見る</span>${arrow}</a>`}
    </div>
  </div>
</article>`;
}

const J = Object.fromEntries(R.jackets.map((x) => [x.id, x]));
const P = Object.fromEntries(R.pants.map((x) => [x.id, x]));
const G = Object.fromEntries(R.gear.map((x) => [x.id, x]));

// 比較表（ジャケット）
const ok = (b) => (b ? '<span class="tk-yes">○</span>' : '<span class="tk-no">－</span>');
const jRows = ["1102575", "1102582", "1102576", "1102551", "1106790", "1106723"].map((id) => {
  const x = J[id];
  return `<tr><th><a href="#p-${id}">${esc(x.name.replace(" Men's", ""))}</a></th><td>${esc(KIND(x.type)[1])}</td><td>${yen(x.price)}</td><td>${x.weight}g</td><td>${ok(/ゴアテックス|ドライテック/.test(x.material))}</td><td>${ok(has(x, /ピットジップ/))}</td><td>${ok(has(x, /パウダースカート/))}</td><td>${ok(has(x, /左袖/))}</td></tr>`;
}).join("");

const set = (title, sub, a, b, note) => `<div class="tk-set">
  <div class="tk-set-imgs"><img src="${IMG(a.id)}" alt="" loading="lazy"><span>＋</span><img src="${IMG(b.id)}" alt="" loading="lazy"></div>
  <div class="tk-set-body">
    <span class="tk-set-sub">${esc(sub)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(a.name)}＋${esc(b.name)}</p>
    <p class="tk-set-price">上下で <b>${yen(a.price + b.price)}</b><small>（税込・合計）</small></p>
    <p class="tk-set-note">${esc(note)}</p>
  </div>
</div>`;

const gear = [
  card(G["1118711"], { kind: ["gear", "グローブ"], points: ["防水透湿インサートと保温材エクセロフト入りの厚手・防水モデル", "手のひらは低温でも硬くなりにくく、凍結しないデュラグリップ", "グローブを着けたまま、片手で手首を絞れるワンハンドアジャスター", "左右をつなぐバックル、リーシュ用ループ付き"], good: ["ビンディングの操作など、指先を使う場面が多い人"], bad: ["とにかく暖かさを優先したい人（ミトン向き）"] }),
  card(G["1118713"], { kind: ["gear", "ミトン"], points: ["パウダーグローブシリーズの中で最も保温性に優れたミトンと記載", "グローブと同じ防水透湿インサート・エクセロフト・デュラグリップ", "平均重量134gと軽い"], good: ["手が冷えやすい人", "真冬の寒い日に滑る人"], bad: ["細かい指先の作業が多い人"] }),
  card(G["1109167"], { kind: ["gear", "ゴーグル"], points: ["偏光（PL）レンズで、晴れた日の雪面のギラつきをカット", "ダブルレンズのアンチフォグで曇りにくい", "日本人の頭の形のデータで設計。すき間ができにくく、雪や呼気が入りにくい", "フレームレスで平均重量80g。ヘルメットの上から着けられるバックル付きベルト"], good: ["晴れの日が多いゲレンデで滑る人", "ゴーグルの曇りやすき間が気になっていた人"], bad: ["曇りや雪の日に、明るいレンズを使いたい人（可視光線透過率はグレー13%・ピンク17%）"] }),
  card(G["1124652"], { kind: ["gear", "ヘルメット"], points: ["ヨーロッパのスキー・スノーボード用ヘルメット規格（EN 1077 クラスB）に適合", "日本人の頭の形に合わせたデザイン", "取り外せるイヤーウォーマー、洗えるインナーパッド", "ゴーグルホルダーと背面のダイヤルアジャスター"], good: ["初めてヘルメットを買う人", "価格を抑えたい人"], bad: ["軽さを重視する人（S/Mで550g）"] }),
  card(G["1134152"], { kind: ["gear", "ヘルメット"], points: ["フォールラインより軽い477g（S/M）", "頭頂部のベンチレーションを開け閉めして換気を調節できる", "グローブのままでも外しやすいマグネット式バックル", "ヨーロッパ規格（EN 1077 クラスB）に適合"], good: ["長時間かぶっても首が疲れにくい軽さが欲しい人", "天気に合わせて換気を変えたい人"], bad: ["予算を1万円以下に抑えたい人"] }),
].join("");

const title = "モンベルのスノーボードウエア特集";
const desc = "モンベルのスノーボード向けジャケット・パンツ・ビブと、グローブ・ゴーグル・ヘルメットを、公式の仕様（素材・重さ・価格）から比べて選び方を解説します。";
const c = chrome("../");
const html = `${head(title, desc, "/tokushu/montbell-snow.html")}
${c.top}
<main class="tk">
  <section class="tk-hero">
    <div class="tk-hero-inner">
      <span class="tk-hero-tag">特集｜2026.10.25 — 2027.1.31</span>
      <h1>モンベルの<br>スノーボードウエア特集</h1>
      <p>ジャケット6着・パンツ3本・小物5点を、公式の仕様（素材・重さ・価格）から比べました。<br>「どれを選べばいいか」が分かるように、タイプ別に整理しています。</p>
      <div class="tk-hero-imgs"><img src="${IMG("1102582")}" alt=""><img src="${IMG("1102591")}" alt=""><img src="${IMG("1109167")}" alt=""></div>
    </div>
  </section>
  <div class="tk-pr"><span class="pr-badge">PR</span>この特集はアフィリエイト広告を含みます。価格は確認時点（2026年10月18日）の税込価格で、変わることがあります。</div>

  <nav class="tk-toc" aria-label="この特集の目次">
    <a href="#guide">選び方</a><a href="#set">上下セット</a><a href="#jacket">ジャケット</a><a href="#pants">パンツ</a><a href="#gear">小物</a><a href="#compare">比較表</a>
  </nav>

  <section class="tk-sec" id="guide">
    <h2 class="h-section">まずはジャケットの「タイプ」を決める</h2>
    <p class="tk-lead">モンベルのスノー向けジャケットは、大きく3つのタイプに分かれます。滑り方と、寒さへの強さで選ぶと迷いません。</p>
    <div class="tk-types">
      <div class="tk-type tk-type--shell"><b>一枚地シェル</b><p>中綿なし。蒸れにくく動きやすい。寒い日は中に着るもので調節します。</p><small>ハイクアップ・運動量が多い人／長いシーズン使いたい人</small></div>
      <div class="tk-type tk-type--warm"><b>中綿入り</b><p>保温材が入っていて、1枚で暖かい。リフト待ちでも冷えにくい。</p><small>ゲレンデ中心の人／寒がりの人</small></div>
      <div class="tk-type tk-type--soft"><b>防風・保温</b><p>クリマバリア素材。風に強く、ストレッチがきいて手ごろ。防水素材ではありません。</p><small>晴れた日中心の人／予算を抑えたい人</small></div>
    </div>
    <h3 class="tk-h3">パンツは「暖かさ」と「形」で選ぶ</h3>
    <ul class="tk-check">
      <li><b>中綿入り</b>：パウダーグライド パンツ（全体）、インシュレーテッド アルパインパンツ（お尻と膝だけ）。雪の上に座ることが多いスノーボードで冷えにくい。</li>
      <li><b>ビブ</b>：胸まで覆うので、転んだときや深い雪で雪が入りにくい。</li>
      <li><b>丈</b>：3本ともショート丈・ロング丈を選べます。ブーツに裾がかぶる長さを選びましょう。</li>
    </ul>
    <h3 class="tk-h3">スノーボード向けに見ておきたい機能</h3>
    <ul class="tk-check">
      <li><b>パウダースカート</b>：転んだときに、裾から雪が入るのを防ぐ。</li>
      <li><b>左袖のポケット</b>：リフト券やICチップを入れておける。</li>
      <li><b>ピットジップ・ベンチレーション</b>：脇や脚のジッパーで、こもった熱を逃がす。</li>
      <li><b>エッジガード</b>：パンツの裾の内側を、ボードのエッジから守る（パンツ3本すべてに付いています）。</li>
    </ul>
  </section>

  <section class="tk-sec" id="set">
    <h2 class="h-section">同じシリーズで上下をそろえる</h2>
    <p class="tk-lead">同じ名前のシリーズは上下でそろえられます。迷ったら、まずこの2セットから。</p>
    ${set("暖かさ重視なら「パウダーグライド」", "中綿入り × 中綿入り", J["1102576"], P["1102585"], "どちらも防風・透湿のウィンドストッパー ファブリクスに中綿入り。ゲレンデ中心で、寒い日も1枚で滑りたい人に。")}
    ${set("動きやすさ重視なら「パウダートラック」", "一枚地 × 一枚地ビブ", J["1102582"], P["1102591"], "どちらもストレッチ性のあるスーパー ドライテック3レイヤー。中に着るもので暖かさを調節し、初冬から春まで長く使いたい人に。")}
  </section>

  <section class="tk-sec" id="jacket">
    <h2 class="h-section">ジャケット（6着）</h2>
    <div class="tk-list">${["1102575", "1102582", "1102576", "1102551", "1106790", "1106723"].map((id) => card(J[id])).join("")}</div>
  </section>

  <section class="tk-sec" id="pants">
    <h2 class="h-section">パンツ・ビブ（3本）</h2>
    <div class="tk-list">${["1102585", "1102591", "1102560"].map((id) => card(P[id])).join("")}</div>
  </section>

  <section class="tk-sec" id="gear">
    <h2 class="h-section">小物（グローブ・ゴーグル・ヘルメット）</h2>
    <p class="tk-lead">ウエアと一緒にそろえたい小物です。ゴーグルはヘルメットの上から着けられるベルト付きです（ヘルメットの形によっては合わない場合があると公式に記載）。</p>
    <div class="tk-list">${gear}</div>
  </section>

  <section class="tk-sec" id="compare">
    <h2 class="h-section">ジャケット比較表</h2>
    <div class="tk-table-wrap"><table class="tk-table">
      <thead><tr><th>商品</th><th>タイプ</th><th>価格</th><th>重さ</th><th>防水透湿素材</th><th>ピットジップ</th><th>パウダースカート</th><th>左袖ポケット</th></tr></thead>
      <tbody>${jRows}</tbody>
    </table></div>
    <p class="news-note">重さは公式の平均重量。○は公式の仕様に記載があるもの、－は記載がないものです。</p>
  </section>

  <div class="notice">
    <div class="notice-head"><span class="pr-badge">PR</span><span>広告について</span></div>
    <p>当サイトはアフィリエイト広告を利用しています。掲載する商品と内容は運営編集部が選んでいます。商品の仕様・価格は、モンベル公式オンラインストアの記載（2026年10月18日確認）にもとづきます。</p>
  </div>
</main>
${c.bottom}`;
fs.mkdirSync("tokushu", { recursive: true });
fs.writeFileSync("tokushu/montbell-snow.html", html);
console.log("tokushu/montbell-snow.html を作りました");
