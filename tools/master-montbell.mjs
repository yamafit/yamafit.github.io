// 使い方: node tools/master-montbell.mjs   data/raw/montbell.json（公式ページの記載）→ data/master/montbell.json
// 事実は raw から機械的に変換。評価（evaluation）は EVAL の表で、公式の記載にもとづいて商品の系列ごとに与える。
import fs from "node:fs";
const raw = Object.values(JSON.parse(fs.readFileSync("data/raw/montbell.json", "utf8")));
const SKIP = /オプショナルキャノピー|カモフライ|スノーフライ|レインフライ/; // 別売の付属品は商品として載せない
const A3 = ["spring", "summer", "autumn"];

const EVAL = [
  // ---- 登山靴 ----
  [/アルパインクルーザー ?800 .*レザー/, { season: ["spring", "summer", "autumn", "winter"], uses: ["mid", "hut", "tent"], concerns: ["knee", "cold"], fit: "不明（公式にサイズ感の記載なし。ワイド展開あり）",
    summary: "荷物の重い長期縦走や、積雪の少ない冬のトレッキングに向く、スエードレザーのゴアテックスブーツです。", pros: ["ゴアテックス ファブリクスのライニングで防水", "柔らかい履き心地と高い安定感を両立する設計と記載", "ソールの張り替えができる"], cons: ["ブーツ型で、軽快さを求める日帰りの低山には大がかり"], good_for: ["荷物の重い縦走をする人", "積雪の少ない冬も歩く人"], not_for: ["低山の散策だけの人"], concern_reasons: { knee: "高い安定感を両立する設計と記載があり、重い荷物での下りの足運びを支えたい人に向きます。", cold: "積雪量の少ない冬季トレッキングに適すると記載されています。" } }],
  [/アルパインクルーザー ?800 BOA/, { season: A3, uses: ["mid", "hut", "tent"], concerns: ["knee"], fit: "不明（ベルクロとBOAダイヤルで調節）",
    summary: "夏場の長期縦走やトレッキングに向く、BOAダイヤルでフィットを素早く調節できるゴアテックスブーツです。", pros: ["BOAダイヤルで素早くフィットを調節でき、脱ぎ履きも容易", "ゴアテックス ファブリクスのライニング", "ソールの張り替えができる"], cons: ["全天候型のブーツで、軽さ重視の人には重め"], good_for: ["夏の長期縦走をする人", "フィット調整を手早く済ませたい人"], not_for: ["厳冬期の登山をする人"], concern_reasons: { knee: "足首をベルクロとBOAで固定でき、安定した歩行を求める人に向きます。" } }],
  [/アルパインクルーザー ?800/, { season: A3, uses: ["mid", "hut", "tent"], concerns: ["knee", "sweat"], fit: "不明（ワイド展開あり）",
    summary: "夏場の長期縦走やトレッキングに向く、全天候型のゴアテックスブーツです。", pros: ["柔らかい履き心地と高い安定感を両立する設計と記載", "アッパーにゴアテックスの透湿性を活かすメッシュを使用と記載", "ソールの張り替えができる"], cons: ["ブーツ型で、散策だけなら大げさ"], good_for: ["夏の縦走・トレッキングをする人"], not_for: ["厳冬期の登山をする人"], concern_reasons: { knee: "高い安定感を両立する設計と記載があり、下りの足運びを安定させたい人に向きます。", sweat: "ゴアテックスの透湿性を活かすメッシュのアッパーと記載されています。" } }],
  [/アルパインクルーザー ?3000/, { season: ["winter"], uses: ["winter"], concerns: ["cold"], fit: "不明（公式にサイズ感の記載なし）",
    summary: "保温材入りで、冬季登山に対応する保温性と剛性を備えた、モンベルのアルパインブーツです。", pros: ["保温材入りで冬の足元の冷えに備えられる", "防水透湿性の素材を使用", "ソールの張り替えができる"], cons: ["冬季登山向けのため、春から秋の山には不向き", "価格が高め"], good_for: ["冬の高山に行く人"], not_for: ["日帰りの低山だけ歩く人", "軽さを重視する人"], concern_reasons: { cold: "保温材入りの構造で、冬の足元の冷えに備えられます。" } }],
  [/トレールウォーカー/, { season: A3, uses: ["low", "town"], concerns: ["light", "sweat"], fit: "不明（ワイド展開あり）",
    summary: "軽量で、低山ハイキングやキャンプに向く、ゴアテックスの全天候型シューズです。", pros: ["片足300g台と軽い（25.5cm）", "ゴアテックス ファブリクスのライニング", "ゲーター付きなら小石や泥の侵入を防げる"], cons: ["ローカットで、岩場や重い荷物には向かない"], good_for: ["低山ハイキングの人", "軽さを重視する人"], not_for: ["重い荷物の縦走をする人"], concern_reasons: { light: "片足300g台と、ブーツ型に比べて軽い設計です。", sweat: "ゴアテックスの透湿性を活かすアッパーと記載されています。" } }],
  // ---- ザック ----
  [/ポケッタブル ライトパック/, { season: ["spring", "summer", "autumn", "winter"], uses: ["low", "town"], concerns: ["light"], fit: "不明",
    summary: "パック全体を内ポケットに収納できる、軽量コンパクトなデイパックです。", pros: ["パック全体を内ポケットに収納でき、持ち運びやすい", "軽量（200g前後）"], cons: ["薄手の生地で、重い荷物には向かない"], good_for: ["サブザックが欲しい人", "日常使いも兼ねたい人"], not_for: ["重い荷物を運ぶ人"], concern_reasons: { light: "パック全体を小さく収納できる、軽量なデイパックです。" } }],
  [/トレッキングパック/, { season: ["spring", "summer", "autumn", "winter"], uses: [], concerns: [], fit: "ベルクロでショルダーハーネスの位置を変え、背面長を調節できる（30〜40Lは公式記載）",
    summary: "軽量でシンプルな構造の、必要な機能を備えたバックパックです。", pros: ["パックカバーを内蔵", "背面長を調節できるバックパネル（30〜40L）", "ピッケルストラップなど登山向けの装備"], cons: ["不明（公式の記載から読み取れる弱点は限られます）"], good_for: ["体格に合わせて背面長を調節したい人"], not_for: [], concern_reasons: {} }],
  [/ディライトパック/, { season: ["spring", "summer", "autumn", "winter"], uses: ["low", "town"], concerns: ["budget"], fit: "不明",
    summary: "普段使いから低山ハイクまで使える、PCや書類用のポケットがあるデイパックです。", pros: ["PCや書類を入れる背面ポケット", "しっかりした生地でシンプルなデザイン", "価格が7,500円台"], cons: ["本格的な登山向けの装備（ヒップベルトなど）の記載はない"], good_for: ["通勤と低山ハイクを兼ねたい人"], not_for: ["泊まり山行の人"], concern_reasons: { budget: "7,500円台で、普段使いと低山ハイクを兼ねられるデイパックです。" } }],
  // ---- ポール ----
  [/アルパイン カーボンポール.*アンチショック/, { season: ["spring", "summer", "autumn", "winter"], uses: ["low", "mid", "hut", "tent"], concerns: ["knee", "light"], fit: "使用サイズ105〜130cm（Sはスモールハンドグリップ）",
    summary: "内蔵スプリングで衝撃を吸収する、軽量なI型グリップのカーボンポールです（1本売り）。", pros: ["内蔵スプリングで着地の衝撃を吸収", "軽量モデル", "ポイントプロテクター・バスケット付き"], cons: ["1本単位の販売（2本使うなら2本購入が必要）"], good_for: ["下りの衝撃が気になる人"], not_for: ["折りたたんでザックに入れたい人"], concern_reasons: { knee: "内蔵スプリングが着地の衝撃を吸収する仕組みと記載されています。", light: "軽量モデルと記載されています。" } }],
  [/アルパイン カーボンポール カムロック/, { season: ["spring", "summer", "autumn", "winter"], uses: ["low", "mid", "hut", "tent"], concerns: ["light"], fit: "不明",
    summary: "ワンタッチで素早く長さを調節できる、軽量なカーボンポールです（1本売り）。", pros: ["ワンタッチで長さの調節と組み立て・収納ができる", "軽量モデル", "ポイントプロテクター・バスケット付き"], cons: ["1本単位の販売"], good_for: ["長さを頻繁に変えたい人"], not_for: [], concern_reasons: { light: "軽量モデルと記載されています。" } }],
  [/アルパイン カーボンポール/, { season: ["spring", "summer", "autumn", "winter"], uses: ["low", "mid", "hut", "tent"], concerns: ["light"], fit: "使用サイズ105〜130cm（Sはスモールハンドグリップ）",
    summary: "軽さと強度を両立した、I型グリップのカーボンポールです（1本売り）。", pros: ["軽量モデル", "軽い力で確実に固定できるツイストロック（無印・アンチショック）", "ポイントプロテクター・バスケット付き"], cons: ["1本単位の販売"], good_for: ["軽さを重視する人", "手が小さい人（Sタイプ）"], not_for: ["折りたたんでザックに入れたい人"], concern_reasons: { light: "軽量モデルと記載されています。" } }],
  [/アルパイン フォールディングポール/, { season: ["spring", "summer", "autumn", "winter"], uses: ["low", "mid", "hut", "tent"], concerns: ["light"], fit: "不明（長さ別のモデルあり）",
    summary: "バックパックの中に収納できる、軽量コンパクトな折りたたみ式ポールです。", pros: ["バックパックの中に収納できる", "素早く組み立て・折りたたみができる", "アルミとカーボンの組み合わせで軽量と記載"], cons: ["不明（公式の記載から読み取れる弱点は限られます）"], good_for: ["持ち運びやすさを重視する人"], not_for: [], concern_reasons: { light: "アルミとカーボンの組み合わせで、軽量コンパクトと記載されています。" } }],
  // ---- レインウェア ----
  [/テンペスト ジャケット/, { season: A3, uses: ["low", "mid", "hut", "tent"], concerns: ["sweat"], fit: "不明",
    summary: "脇のベンチレーションで蒸れを逃がせる、ゴアテックスの高機能レインジャケットです。", pros: ["脇のベンチレーション（ピットジップ）で汗の蒸れを逃がせる", "ゴアテックス ファブリクス 3レイヤー（耐水圧20,000mm以上）", "胸ポケット2つ"], cons: ["価格が3万円台と高め"], good_for: ["運動量が多い山行をする人"], not_for: ["とにかく安く済ませたい人"], concern_reasons: { sweat: "脇のベンチレーションで衣服内の汗の蒸れを逃がせる設計と記載されています。" } }],
  [/GORE-TEX レインパンツ/, { season: A3, uses: ["low", "mid", "hut", "tent"], concerns: [], fit: "ショート丈の展開あり",
    summary: "ゴアテックスのレインパンツ。裾のジッパーで、登山靴を履いたまま着脱できます。", pros: ["ゴアテックス ファブリクス 3レイヤー（耐水圧20,000mm以上）", "登山靴を履いたまま着脱できる", "立体裁断（膝）"], cons: ["不明（公式の記載から読み取れる弱点は限られます）"], good_for: ["急な雨にすばやく対応したい人"], not_for: [], concern_reasons: {} }],
  [/レイントレッカー/, { season: A3, uses: ["low", "mid", "hut", "tent"], concerns: [], fit: "厚みのある中間着の上にも着やすい、ややゆとりのあるシルエットと記載",
    summary: "表地に丈夫な生地を使った、エントリーからハードユースまで幅広く使えるゴアテックスのレインジャケットです。", pros: ["表地50デニールの丈夫な生地", "ゴアテックス ファブリクス 3レイヤー", "ややゆとりのあるシルエット"], cons: ["表地が厚めのぶん、軽量モデルより重い（平均300g前後）"], good_for: ["丈夫さを重視する人", "初めてのレインウェアを探す人"], not_for: ["軽さを最優先する人"], concern_reasons: {} }],
  [/ピークシェル/, { season: A3, uses: ["low", "mid", "hut", "tent"], concerns: ["sweat", "light"], fit: "不明",
    summary: "脇のベンチレーションを備えながら非常に軽く、コンパクトに収納できるゴアテックスのレインジャケットです。", pros: ["平均重量が200g未満（メンズ185g）", "脇のベンチレーション（ピットジップ）", "コンパクトに収納できる"], cons: ["表地が15デニールと薄く、擦れには気を使う"], good_for: ["軽さを重視する人", "運動量が多い人"], not_for: [], concern_reasons: { sweat: "脇のベンチレーションで蒸れを逃がせると記載されています。", light: "平均重量185g（メンズ）と軽量です。" } }],
  [/ストームクルーザー/, { season: A3, uses: ["low", "mid", "hut", "tent"], concerns: ["sweat"], fit: "ゆったり幅の展開あり",
    summary: "高い透湿性の独自素材を使った、モンベルのフラッグシップのレインジャケットです。", pros: ["透湿性40,000g/m²・24hrs（参考値）", "耐水圧20,000mm以上", "裏地に保水しにくい高密度ニットでさらっとした着心地"], cons: ["不明（公式の記載から読み取れる弱点は限られます）"], good_for: ["蒸れが気になる人", "登山用の定番を探す人"], not_for: [], concern_reasons: { sweat: "透湿性40,000g/m²・24hrs（参考値）の素材を使用と記載されています。" } }],
  [/ドライテック レインパンツ/, { season: A3, uses: ["low", "mid", "hut", "tent"], concerns: ["sweat"], fit: "ショート丈の展開あり",
    summary: "高い透湿性の独自素材を使った、登山向けのレインパンツです。", pros: ["透湿性40,000g/m²・24hrs（参考値）", "登山靴を履いたまま着脱できるジッパー", "ゴアテックス製より価格が抑えめ"], cons: ["不明（公式の記載から読み取れる弱点は限られます）"], good_for: ["コストを抑えつつ登山用のレインパンツが欲しい人"], not_for: [], concern_reasons: { sweat: "透湿性40,000g/m²・24hrs（参考値）の素材と記載されています。" } }],
  [/トレントフライヤー/, { season: A3, uses: ["low", "mid", "hut", "tent"], concerns: ["sweat", "light"], fit: "不明",
    summary: "優れたストレッチ性としなやかな着心地を実現した、軽量なレインジャケットです。", pros: ["透湿性50,000g/m²・24hrs（参考値）", "ストレッチ性が高く、動きに追随する", "平均重量が200g台前半"], cons: ["表地が15デニールと薄い"], good_for: ["動きやすさと蒸れにくさを重視する人"], not_for: [], concern_reasons: { sweat: "透湿性50,000g/m²・24hrs（参考値）と記載されています。", light: "平均重量が200g台前半と軽量です。" } }],
  // ---- パンツ ----
  [/O\.D\.パンツ ライト/, { season: A3, uses: ["low", "mid", "hut", "town"], concerns: ["light"], fit: "ダブルショート丈などの展開あり",
    summary: "薄手でハリ・コシのある素材の、春から秋の登山に向くパンツです。", pros: ["軽量でコンパクトにまとめられる", "1WAYストレッチ", "はっ水加工"], cons: ["薄手のため、寒い時季には向かない"], good_for: ["春から秋に歩く人"], not_for: ["冬の山に行く人"], concern_reasons: { light: "薄手で、軽量にまとめられる素材と記載されています。" } }],
  [/O\.D\.パンツ/, { season: ["spring", "summer", "autumn", "winter"], uses: ["low", "mid", "hut", "town"], concerns: [], fit: "ダブルショート丈などの展開あり",
    summary: "耐摩耗性と速乾性に優れた中厚手のパンツで、季節を問わず使えると記載されています。", pros: ["耐摩耗性と速乾性", "1WAYストレッチ", "はっ水加工"], cons: ["不明（公式の記載から読み取れる弱点は限られます）"], good_for: ["1本で通年使いたい人"], not_for: [], concern_reasons: {} }],
  [/サウスリムショーツ|クールショーツ|キャニオンショーツ/, { season: ["summer"], uses: ["low", "mid", "town"], concerns: ["sweat"], fit: "不明",
    summary: "暑い時季の登山やアウトドアに向くショーツです。", pros: ["速乾性・通気性やストレッチ性（モデルにより記載）", "はっ水加工"], cons: ["肌の露出が多く、藪や寒い場所には向かない"], good_for: ["夏に歩く人"], not_for: ["肌を守りたい人", "寒い時季に歩く人"], concern_reasons: { sweat: "通気性・速乾性に優れた素材と記載されています（モデルにより異なる）。" } }],
  [/マルチトラウザーズ/, { season: ["spring", "autumn", "winter"], uses: ["low", "mid", "hut"], concerns: ["cold"], fit: "ショート丈の展開あり",
    summary: "防水透湿素材を使い、雨天から寒い時季のトレッキングまで使えるパンツです。", pros: ["防水透湿性素材（スーパー ドライテック）", "風の侵入を防ぎつつ汗の水蒸気を逃がす", "立体裁断（膝）"], cons: ["ポケットは完全防水ではない", "夏の暑い時季には暑い可能性がある"], good_for: ["雨や寒い時季に歩く人"], not_for: ["真夏に歩く人"], concern_reasons: { cold: "風の侵入を防ぐ防水透湿素材で、寒い時季のトレッキングに使えると記載されています。" } }],
  [/クリフ ハーフシェル/, { season: A3, uses: ["low", "mid", "hut"], concerns: ["sweat"], fit: "ショート丈の展開あり",
    summary: "腰から太ももは通気性のある生地、膝から下は防水透湿素材のハイブリッドパンツです。", pros: ["2種類の生地のハイブリッドで全体がストレッチ", "膝から下は防水透湿素材で、泥汚れも洗い落としやすい", "立体裁断（膝）"], cons: ["不明（公式の記載から読み取れる弱点は限られます）"], good_for: ["汗をかきやすい人", "沢や雨の多い山を歩く人"], not_for: [], concern_reasons: { sweat: "発汗の多い腰回りには、通気性と2方向ストレッチの生地を使うと記載されています。" } }],
  // ---- テント ----
  [/ムーンライト ?テント/, { season: [], uses: ["tent"], concerns: [], fit: "収容人数は商品名（テント2・テント4）のとおり",
    summary: "月明かりの中でも簡単に設営できることをコンセプトにした、モンベルのロングセラーのテントです。", pros: ["設営が簡単なコンセプト", "保水しにくい生地で、雨の多い日本の気候に合わせた設計と記載", "蒸れにくい通気性"], cons: ["2人用で本体2.21kgと、ステラリッジ2（本体0.89kg）より重い"], good_for: ["キャンプや、手軽に設営したい人"], not_for: ["軽さが最優先の縦走"], concern_reasons: {} }],
  [/ステラリッジ ?テント/, { season: [], uses: ["tent"], concerns: ["light"], fit: "1人用・2人用",
    summary: "過酷な環境に耐える、軽量な山岳用テントです（本体はレインフライ別売）。", pros: ["薄くても強度のある生地で耐風性と軽量性を両立と記載", "本体は0.8kg〜（1人用・ポールを含む）"], cons: ["レインフライは別売（別途購入が必要）"], good_for: ["軽量な山岳テントを探す人"], not_for: ["レインフライ込みの価格で選びたい人"], concern_reasons: { light: "1人用の本体重量が0.80kg（ポールを含む）と記載されています。" } }],
  [/マイティドーム/, { season: [], uses: ["tent"], concerns: ["light"], fit: "1人用・2人用",
    summary: "極めて軽量・コンパクトな、シングルウォール構造のテントです。", pros: ["高い軽量・コンパクト性", "防水透湿性と通気性のある生地を使用", "表面にはっ水加工"], cons: ["価格が高め（6万円台）"], good_for: ["軽さと収納性を重視する人"], not_for: ["予算を抑えたい人"], concern_reasons: { light: "極めて高い軽量・コンパクト性を備えたシングルウォール構造と記載されています。" } }],
];

const num = (s) => { if (!s) return null; const m = s.match(/([\d.]+)\s*(kg|g)/); if (!m) return null; return Math.round(Number(m[1]) * (m[2] === "kg" ? 1000 : 1)); };
const wpOf = (m) => { if (!m) return [null, null]; const gt = m.match(/(ゴアテックス ファブリクス[^/]*?|スーパー ドライテック[^/]*?|ブリーズドライテック[^/]*?)(?=\s*[\[［/]|$)/);
  if (/ゴアテックス|ドライテック/.test(m)) return [(gt ? gt[1] : "ゴアテックス/ドライテック").trim().replace(/&[a-z]+;/g, "®"), "waterproof"];
  if (/耐水圧/.test(m)) return ["耐水圧の記載あり（素材欄参照）", "waterproof"];
  if (/はっ水/.test(m)) return ["はっ水加工", "water_repellent"]; return [null, null]; };
const clean = (s) => (s ? s.replace(/&[a-z]+;/g, "").replace(/\s+/g, " ").trim() : null);

const products = [];
for (const r of raw) {
  if (SKIP.test(r.name) || r.price_label) continue;
  const ev = EVAL.find(([re]) => re.test(r.name));
  if (!ev) { console.warn("評価なし:", r.name); continue; }
  const e = ev[1];
  const [wp, lvl] = wpOf(r.material);
  const sizes = r.category === "boots" && r.size ? [...r.size.matchAll(/(\d+\.\d)cm/g)].map((m) => Number(m[1])) : [];
  const cap = r.capacity ? Number((r.capacity.match(/^(\d+)L/) || [])[1]) || null : null;
  const stock = r.stock.in > 0 ? true : r.stock.out > 0 ? false : null;
  const wnote = r.weight ? clean(r.weight.split("：")[0] + (r.weight.match(/[（(][^）)]*cm[^）)]*[）)]/) ? " " + r.weight.match(/[（(][^）)]*cm[^）)]*[）)]/)[0] : "")) : null;
  const ev2 = { by: "claude", at: r.checked_at, season: e.season, uses: e.uses, concerns: e.concerns, fit: e.fit, summary: e.summary, pros: e.pros, cons: e.cons, good_for: e.good_for, not_for: e.not_for, concern_reasons: e.concern_reasons };
  if (r.category === "pack" && cap) { // 容量で用途を決める（公式の用途記載の範囲に限る）
    ev2.uses = cap <= 20 ? ["low", "town"] : cap <= 40 ? ["mid", "hut"] : ["tent", "hut"];
    if (/トレッキングパック/.test(r.name)) ev2.summary = `${cap}Lのトレッキングパック。軽量でシンプルな構造で、必要な機能を備えたバックパックです。`;
  }
  if (/^US /.test(r.name)) { // 海外販売モデル：日本サイズと異なると公式ページに記載
    ev2.cons = [...ev2.cons.filter((c) => !/^不明/.test(c)), "海外販売モデルのため、日本サイズと異なる（公式にサイズ表の確認を促す記載あり）"];
  }
  const g = /Women's/.test(r.name) ? "womens" : /Men's/.test(r.name) ? "mens" : "unisex";
  products.push({
    id: `montbell-${r.id}`, brand: "モンベル", name: r.name, category: r.category, gender: g,
    price: r.price, weight_g: num(r.weight), weight_note: wnote, capacity_l: cap,
    material: clean(r.material), waterproof: wp, waterproof_level: lvl, warmth: /保温材|シンサレート/.test(r.material || "") ? clean((r.material.match(/保温材[^/]*/) || ["保温材入り"])[0]) : null,
    size_note: sizes.length ? `${Math.min(...sizes).toFixed(1)}〜${Math.max(...sizes).toFixed(1)}cm` : clean(r.size && r.size.split("/")[0]) === "不明" ? null : r.size ? clean(r.size).slice(0, 70) : null,
    sources: [{ url: r.url, checked_at: r.checked_at }],
    image: { url: r.image, angle: "front", src_page: r.url, checked_at: r.checked_at, ok: null },
    offers: [{ shop: "official", url: r.url, affiliate_url: "", in_stock: stock, checked_at: r.checked_at }],
    evaluation: ev2,
  });
}
fs.writeFileSync("data/master/montbell.json", JSON.stringify({ brand: "モンベル", products }, null, 1));
console.log(`montbell: ${products.length}件`);
