/* プロンプト工房の共通部分（登山靴・ザック・ウェア）。
 * 画像生成AIに渡すプロンプトの文面と、添付する参照シートの描き方をここで一元管理する。
 * - ブラウザ：アーティファクト「○○プロンプト工房」に埋め込まれる（tools/build-kobo.mjs）
 * - Node：tools/daily-image-post.mjs が毎朝の画像生成で使う
 * 文面を変えるときはこのファイルだけを直し、node tools/build-kobo.mjs でアーティファクトも作り直す。
 * 登山靴の文面は、元の「登山靴プロンプト工房」と一字一句同じ（tools/build-kobo.mjs --check で確認）。
 */
(function (root) {
  const ASPECTS = { "16:9": { label: "横長16:9", land: true }, "4:3": { label: "横長4:3", land: true }, "1:1": { label: "正方形1:1", land: false }, "4:5": { label: "縦長4:5", land: false }, "9:16": { label: "縦長9:16", land: false } };
  const DEFAULTS_BASE = { reader: "登山初心者から中級者" };

  const CATS = {
    shoes: {
      key: "tozan-prompt-kobo-v1",
      title: "登山靴プロンプト工房",
      noun: "登山靴",
      thing: "靴",
      photoHint: "貼り付け（Ctrl+V / ⌘V）もできます。靴を真横から撮った画像が向いています。",
      usage: "登山靴の性能比較、商品紹介、SNS投稿、購入検討用資料",
      sample: { brand: "SAMPLE PEAK", model: "Kumotori Mid WP", modelJa: "クモトリ ミッド WP", color: "スレートグレー／シグナルイエロー" },
      specs: [["specWp", "防水透湿素材", "例：GORE-TEX"], ["specUpper", "アッパー素材", "例：スエード＋メッシュ"], ["specMid", "ミッドソール", "例：EVA"], ["specOut", "アウトソール", "例：Vibram Megagrip"], ["specWeight", "重量", "例：約480g（27.0cm片足）"], ["specDrop", "ドロップ・スタックハイト", "例：8mm／32-24mm"]],
      head: "登山靴・アウトドアシューズ 性能解説インフォグラフィック生成プロンプト",
      faithful: ["靴のシルエット、全体の比率、つま先とかかとの形状", "アッパーの素材感、メッシュの模様、補強パーツ", "靴紐、ハトメ、タン、履き口、ヒールループ", "ソールの厚さ、形状、ラグパターン", "ブランドロゴ、コラボロゴ、配色、ラインの位置", "靴の向きと側面から見た構図"],
      research: ["防水性・透湿性", "アッパー素材と通気性", "ミッドソールの素材とクッション性", "アウトソールのメーカー・技術・グリップ特性", "フィット感と足型設計", "かかとの安定性", "つま先の保護・耐摩耗性", "重量と軽量性", "ドロップ値、スタックハイトなどの設計仕様", "想定される使用シーンと適した登山スタイル"],
      techNames: "GORE-TEX、Vibram、EGO、ZERO DROPなど",
      claims: "防水性能、滑りにくさ、疲労軽減など",
      details: ["アッパー素材", "靴紐・フィット構造", "つま先の補強", "ミッドソール", "アウトソールのラグ", "ヒール周辺の構造"],
      rules: ["靴の形状、配色、ロゴ、ソールはこの画像に合わせる", "名称はこのシートの表記をそのまま使う", "画像で確認できない細部を作り込まない", "このシートの枠、ラベル、文字は完成画像に入れない"],
      caption: "商品画像：この靴の形状・配色・ロゴ・ソールを忠実に再現する",
    },
    pack: {
      key: "zack-prompt-kobo-v1",
      title: "ザックプロンプト工房",
      noun: "登山ザック",
      thing: "ザック",
      photoHint: "貼り付け（Ctrl+V / ⌘V）もできます。ザックを正面か斜め前から撮った画像が向いています。",
      usage: "登山ザックの性能比較、商品紹介、SNS投稿、購入検討用資料",
      sample: { brand: "SAMPLE PEAK", model: "Kumotori Pack 30", modelJa: "クモトリ パック 30", color: "スレートグレー／シグナルイエロー" },
      specs: [["specCap", "容量", "例：30L（M/Lサイズ）"], ["specWeight", "重量", "例：約1,200g"], ["specFabric", "本体素材", "例：210デニール ナイロン"], ["specBack", "背面システム・フレーム", "例：メッシュ背面＋アルミフレーム"], ["specHarness", "ショルダー・ヒップベルト", "例：取り外せるヒップベルト"], ["specSize", "サイズ・背面長", "例：S/M、M/L（背面長42〜52cm）"]],
      head: "登山ザック・バックパック 性能解説インフォグラフィック生成プロンプト",
      faithful: ["ザックのシルエット、全体の比率、天蓋（雨蓋）や開口部の形状", "本体生地の素材感、織り模様、補強パネル", "ファスナー、バックル、コンプレッションストラップ、ループ類", "ショルダーハーネス、ヒップベルト、背面パネル", "フロント・サイド・ヒップベルトのポケットの位置と形状", "ブランドロゴ、配色、ラインの位置", "ザックの向きと、正面または斜め前から見た構図"],
      research: ["容量と拡張性", "重量と軽量性", "本体素材と耐久性・撥水性", "背面システムと通気性", "ショルダーハーネスとヒップベルトのフィット感", "フレーム構造と荷重分散", "開口部の形式と荷物の出し入れ", "ポケット・収納・ギアの取り付け（ポール、ピッケルなど）", "ハイドレーション対応、レインカバーの有無", "サイズ展開と背面長の調整", "想定される使用シーン（日帰り、小屋泊、テント泊など）"],
      techNames: "ブランド独自の背面システム名、フレーム名、生地名（Dyneema、CORDURA など）",
      claims: "防水性能、背負い心地、疲労軽減、耐荷重など",
      details: ["本体生地", "背面パネル", "ショルダーハーネス", "ヒップベルト", "バックル・ファスナー", "サイドポケット・ギアループ"],
      rules: ["ザックの形状、配色、ロゴ、ポケットとストラップの位置はこの画像に合わせる", "名称はこのシートの表記をそのまま使う", "画像で確認できない細部を作り込まない", "このシートの枠、ラベル、文字は完成画像に入れない"],
      caption: "商品画像：このザックの形状・配色・ロゴ・ポケットとストラップを忠実に再現する",
    },
    outer: {
      key: "wear-prompt-kobo-v1",
      title: "ウェアプロンプト工房",
      noun: "登山用ウェア（アウター）",
      thing: "ウェア",
      photoHint: "貼り付け（Ctrl+V / ⌘V）もできます。ウェアを正面から撮った画像（平置きやトルソー）が向いています。",
      usage: "登山用ウェアの性能比較、商品紹介、SNS投稿、購入検討用資料",
      sample: { brand: "SAMPLE PEAK", model: "Kumotori Shell Jacket", modelJa: "クモトリ シェルジャケット", color: "スレートグレー／シグナルイエロー" },
      specs: [["specWp", "防水透湿素材", "例：GORE-TEX 3層"], ["specFace", "表地", "例：20デニール ナイロン"], ["specInsul", "中わた・保温材", "例：800FPダウン"], ["specWeight", "重量", "例：約285g（Lサイズ）"], ["specHood", "フード・ベンチレーション", "例：ヘルメット対応フード／脇下ベンチレーション"], ["specSize", "サイズ展開", "例：S〜XXL"]],
      head: "登山用ウェア（ジャケット・アウター） 性能解説インフォグラフィック生成プロンプト",
      faithful: ["ウェアのシルエット、着丈、身幅、袖の形と長さ", "生地の質感、キルティングやバッフル、切り替えパネル", "フードの形状、襟の高さ、ドローコード", "フロントファスナー、ポケット、ベンチレーションの位置と形状", "袖口と裾の仕様（面ファスナー、ゴム、アジャスター）", "ブランドロゴ、配色、ラインの位置", "ウェアの向きと、正面から見た構図"],
      research: ["防水性・透湿性（耐水圧・透湿度の公表値）", "防風性", "保温性と中わた・保温材", "表地の素材と耐久性", "重量と収納性（パッカブル）", "フードの構造とヘルメット対応", "ベンチレーション", "ポケットとファスナーの仕様", "ストレッチ性と動きやすさ", "サイズ展開とシルエット", "想定される使用シーン、季節、重ね着での位置づけ"],
      techNames: "GORE-TEX、PERTEX、Polartec、ダウンのフィルパワー（FP）など",
      claims: "防水性能、保温性、透湿性、耐久性など",
      details: ["生地の表面", "フード", "フロントファスナー・ポケット", "袖口", "裾のアジャスター", "ベンチレーション"],
      rules: ["ウェアの形状、配色、ロゴ、ファスナーとポケットの位置はこの画像に合わせる", "名称はこのシートの表記をそのまま使う", "画像で確認できない細部を作り込まない", "このシートの枠、ラベル、文字は完成画像に入れない"],
      caption: "商品画像：このウェアの形状・配色・ロゴ・ファスナーとポケットを忠実に再現する",
    },
  };

  const V = (s) => "\u0001" + s + "\u0002";
  const M = (s) => "\u0003" + s + "\u0004";
  const defaults = (cat) => ({ reader: DEFAULTS_BASE.reader, usage: CATS[cat].usage });
  const plain = (s) => s.replace(/[\u0001-\u0004]/g, "");

  // d: {brand, model, modelJa, color, source, <specのid>..., reader, usage, aspect, attach:'sheet'|'photo', fixed:boolean}
  // 事前に確認した内容（記事・公式ページから）。プロンプトの最後と参照シートの両方に入れ、これ以外は載せないように指示する
  function factsText(f) {
    const L = [];
    L.push("9. 事前に確認した内容（最優先。ここに書かれていない機能・数値・評価は掲載しない）");
    L.push("");
    if (f.target) L.push(`* 対象：${f.target}`);
    if (f.catch) L.push(`* キャッチコピーの方向：${f.catch}`);
    if (f.features && f.features.length) { L.push(`* 性能解説と特徴一覧に使う項目（この${f.features.length}項目だけ。順番もこのとおり）：`); f.features.forEach((x, i) => L.push(`  ${i + 1}. ${x.h}${x.b ? "：" + x.b : ""}`)); }
    if (f.goodFor && f.goodFor.length) L.push(`* 向いている人：${f.goodFor.join("／")}`);
    if (f.cautions && f.cautions.length) L.push(`* 購入前に確認したい注意点：${f.cautions.join("／")}`);
    if (f.ng && f.ng.length) L.push(`* 使ってはいけない表現（事実と異なるため）：${f.ng.join("／")}`);
    L.push("* 上記と「1. 入力情報」にない部品・機能・数値・評価は、描かない・書かない（足りない項目を自分で作らない）。");
    return L.join("\n");
  }
  function buildPrompt(d, cat) {
    const C = CATS[cat], DF = defaults(cat);
    const v = (s, fb) => (s ? V(s) : M(fb));
    const asp = ASPECTS[d.aspect], sheet = d.attach === "sheet", T = C.thing;
    const specs = C.specs.filter((k) => d[k[0]]).map((k) => "  * " + k[1] + "：" + V(d[k[0]]));
    const src = (d.source || "").replace(/\s*\n\s*/g, " ／ ");
    const li = (a) => a.map((s) => "* " + s).join("\n");
    const P = [];
    P.push(
`${C.head}

あなたの役割

あなたは、登山用品・アウトドアギアに精通したプロダクトデザイナー、テクニカルライター、広告ビジュアルデザイナーです。

入力された商品画像をもとに、${C.noun}の外観を忠実に再現し、性能・構造・素材・使用上の特徴を視覚的に解説する、高品質な日本語インフォグラフィックを作成してください。

単なる広告画像ではなく、${C.noun}の購入を検討している人が、製品の特徴や適した用途を理解できる解説資料にしてください。

1. 入力情報

* ブランド名：${v(d.brand, "未入力（添付画像のロゴから明確に読み取れる場合のみ掲載し、読み取れない場合は掲載しない）")}
* 商品名・モデル名：${v(d.model, "【未入力】")}
* 日本語の商品名：${v(d.modelJa, "未入力（正式な商品名の一般的なカタカナ表記を使用し、確認できない場合は省略）")}
* カラー・バリエーション：${v(d.color, "未入力（添付画像の配色に従い、色名は断定しない）")}
* 商品画像：${sheet ? `添付した参照シートの「商品画像」枠内の${T}を使用` : "添付画像を使用"}
* 商品公式サイト・製品仕様：${v(src, "未入力（検索できる場合は公式メーカーサイトで確認し、確認できない仕様は掲載しない）")}`);
    if (specs.length) P.push("* 利用者が確認済みの仕様：\n" + specs.join("\n"));
    P.push(
`* 想定読者：${V(d.reader || DF.reader)}
* 用途：${V(d.usage || DF.usage)}
* 画像内の言語：日本語
* 画像の縦横比：${V(d.aspect)}

2. 最重要条件：商品画像の忠実な再現
`);
    if (sheet) P.push(
`添付画像は「参照シート」です。シート内の「商品画像」枠に写っている${T}だけを参照対象とし、シートに記載されたブランド名・商品名を正式な表記としてそのまま使用してください。

参照シート自体の枠・ラベル・説明文・余白は、完成画像に描かないでください。
`);
    P.push(
`添付した商品画像を、イラストの中心となる最優先の参照画像として使用してください。

以下の要素を可能な限り正確に維持してください。

${li(C.faithful)}

別モデルの${T}に置き換えたり、元画像に存在しない機能や装飾を追加したりしないでください。

商品画像が小さい場合や細部が不鮮明な場合、確認できない部分を勝手に作り込まず、推測による断定を避けてください。

3. 商品性能の調査・情報の正確性

可能な場合は、公式メーカーサイトの製品ページ、公式技術資料、取扱説明書を優先して製品仕様を確認してください。
`);
    if (specs.length) P.push(
`「1. 入力情報」の「利用者が確認済みの仕様」は、確認済みの事実として使用してください。そこに記載のない技術名称や数値は、公式情報で確認できた場合に限り掲載してください。
`);
    P.push(
`次の項目を調べ、当該モデルに実際に採用されている機能だけを掲載してください。

${li(C.research)}

情報が確認できない項目は掲載しないでください。

特に、${C.techNames}の技術名称は、その商品への採用が確認できた場合に限り使用してください。

${C.claims}についても、過度な保証表現を避けてください。

公式情報に記載された事実と、一般的な構造から考えられる特徴を区別してください。

4. デザイン・レイアウト

${asp.label}の、高解像度のアウトドア用品専門カタログ風インフォグラフィックにしてください。

デザインの方向性：

* 本格的な登山用品ブランドの広告ビジュアル
* 山岳風景、登山道、岩場、森林などの自然背景
* 中央に大きく配置した商品画像
* 商品の周囲に配置した性能解説と指示線
* 各部位を拡大した円形のディテール画像
* 下部に配置した性能アイコンと特徴一覧
* 商品の色に合わせた統一感のある配色
* 見やすい余白と明確な情報の優先順位

背景は商品を引き立てるために使用し、${T}の輪郭や細部が埋もれないようにしてください。

文字・アイコン・指示線が商品本体を不必要に覆わないように配置してください。

5. 掲載する情報の構成

A. タイトルエリア

次の情報を大きく、正確に掲載してください。

* ブランド名
* 正式な商品名
* 日本語の商品名
* 商品の特徴を表す短いキャッチコピー

B. 商品紹介

製品のコンセプト、設計思想、適した使用シーンを2～4行程度で簡潔に説明してください。

C. 商品の各部位と性能

実際の仕様を確認したうえで、重要な特徴を5～7項目程度選択してください。

各項目は次の形式で構成してください。

1. 特徴が一目で分かる見出し
2. どの部位に関係する特徴なのか
3. 技術や素材の説明
4. 登山時にどのような利点が期待できるか

商品の該当箇所に指示線を引き、対応する説明を明確にしてください。

D. ディテール拡大図

商品画像で確認できる範囲を中心に、次のような部位を拡大して表示してください。

${li(C.details)}

元画像で確認できない模様や構造を、実物のディテールであるかのように描写しないでください。

E. 下部の特徴一覧

重要な特徴を5～6項目のアイコン付き一覧にまとめてください。

各項目は「短い見出し＋短い説明」で統一し、スマートフォンでも読める文字サイズにしてください。

F. 総合評価

最後に以下を簡潔に整理してください。

* 向いている人
* 向いている使用シーン
* 購入前に確認したい注意点

製品仕様から判断できない情報は断定しないでください。

6. 日本語の品質

日本語は自然で、専門用語の使い方が正確な文章にしてください。

以下を厳守してください。

* 誤字・脱字・文字化けを可能な限り防ぐ
* 商品名、ブランド名、技術名称を正確に表記する
* 意味のない文字列を生成しない
* 不自然な直訳表現を避ける
* 長文を画像内に詰め込みすぎない
* 文字と背景のコントラストを十分に確保する
* 同じ説明を複数箇所に重複させない

情報量よりも、正確性・視認性・読みやすさを優先してください。

7. 最終品質基準

完成画像は以下の条件を満たすものとします。

* 添付画像の商品が主役になっている
* 商品名とブランドが正しい
* 商品の形状やカラーが元画像に近い
* 各性能の説明が該当する部位と対応している
* 根拠のない技術名称や性能を掲載していない
* 指示線が正しい部位を指している
* 日本語が読みやすい
* 情報が整理されている
* SNSや商品紹介資料として使用できる完成度である
`);
    if (d.fixed) P.push(asp.land ?
`8. 固定レイアウト

毎回同じ配置で生成してください。項目の位置、並び順、項目数を変更しないでください。

* 上部左：タイトルエリア（ブランド名、正式な商品名、日本語の商品名、キャッチコピーの順）
* 上部右：商品紹介（2～4行）
* 中央：商品画像（画面幅の約45%、添付画像と同じ向き）
* 商品の左右：性能解説を6項目（左に3項目、右に3項目）。各項目から商品の該当箇所へ指示線を1本ずつ引く
* 商品の下：円形のディテール拡大図を4点、横一列
* 下部の帯：アイコン付きの特徴一覧を6項目、横一列
* 右下：総合評価（向いている人、向いている使用シーン、購入前に確認したい注意点の順）

確認できた特徴が6項目に満たない場合は、確認できた数だけ掲載し、数を合わせるために特徴を創作しないでください。
` :
`8. 固定レイアウト

毎回同じ配置で生成してください。項目の位置、並び順、項目数を変更しないでください。上から次の順に配置します。

* 1段目：タイトルエリア（ブランド名、正式な商品名、日本語の商品名、キャッチコピーの順）
* 2段目：商品紹介（2～4行）
* 3段目：商品画像（画面幅の約80%、添付画像と同じ向き）と、その上下に配置した性能解説6項目。各項目から商品の該当箇所へ指示線を1本ずつ引く
* 4段目：円形のディテール拡大図を4点、横一列
* 5段目：アイコン付きの特徴一覧を6項目（2列×3行）
* 6段目：総合評価（向いている人、向いている使用シーン、購入前に確認したい注意点の順）

確認できた特徴が6項目に満たない場合は、確認できた数だけ掲載し、数を合わせるために特徴を創作しないでください。
`);
    if (d.facts) P.push(factsText(d.facts) + "\n");
    P.push(`すべての条件を満たすことを目指し、装飾性だけでなく製品情報の正確性を最優先にした、縦横比${d.aspect}の画像を1枚生成してください。`);
    return P.join("\n");
  }

  /* ---------- 参照シート（Canvas。ブラウザとNodeで共通） ---------- */
  function wrap(ctx, text, maxW) {
    const out = [];
    String(text).split("\n").forEach((para) => {
      if (!para) { out.push(""); return; }
      let toks = para.match(/[A-Za-z0-9][A-Za-z0-9_\-.\/:%+#&'?=]*|\s+|./gu) || [];
      toks = toks.flatMap((t) => (ctx.measureText(t).width > maxW ? Array.from(t) : [t]));
      let line = "";
      toks.forEach((t) => {
        const test = line + t;
        if (!line || ctx.measureText(test).width <= maxW || /^[、。，．）」』】！？・ー：；,.\s]+$/.test(t)) line = test;
        else { out.push(line); line = t.replace(/^\s+/, ""); }
      });
      out.push(line);
    });
    return out;
  }
  function layoutPanel(ctx, d, cat, CF, x, y, w, draw) {
    const C = CATS[cat], INK = "#111111", MUTED = "#555555";
    const field = (label, val, size, maxLines) => {
      ctx.font = "500 22px " + CF; if (draw) { ctx.fillStyle = MUTED; ctx.fillText(label, x, y + 22); } y += 38;
      ctx.font = "700 " + size + "px " + CF;
      wrap(ctx, val, w).slice(0, maxLines).forEach((l) => { if (draw) { ctx.fillStyle = INK; ctx.fillText(l, x, y + size * 0.9); } y += Math.round(size * 1.32); });
      y += 24;
    };
    if (d.brand) field("ブランド名", d.brand, 42, 3);
    field("商品名・モデル名", d.model || "未入力", 42, 4);
    if (d.modelJa) field("日本語の商品名", d.modelJa, 34, 3);
    if (d.color) field("カラー・バリエーション", d.color, 30, 3);
    const specs = C.specs.filter((k) => d[k[0]]);
    const heading = (t) => {
      y += 6; if (draw) { ctx.strokeStyle = "#BBBBBB"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); }
      y += 22; ctx.font = "700 24px " + CF; if (draw) { ctx.fillStyle = INK; ctx.fillText(t, x, y + 22); } y += 44;
    };
    const bullets = (items, size) => {
      ctx.font = "400 " + size + "px " + CF;
      items.forEach((t) => {
        wrap(ctx, t, w - size - 4).forEach((l, i) => {
          if (draw) { ctx.fillStyle = INK; if (i === 0) ctx.fillText("・", x, y + size * 0.9); ctx.fillText(l, x + size + 4, y + size * 0.9); }
          y += Math.round(size * 1.45);
        });
        y += 6;
      });
    };
    if (specs.length) { heading("確認済みの仕様"); bullets(specs.map((k) => k[1] + "：" + d[k[0]]), 24); y += 10; }
    if (d.facts) {
      const f = d.facts;
      if (f.target) { heading("対象"); bullets([f.target], 24); }
      if (f.features && f.features.length) { heading(`載せる特徴（この${f.features.length}つだけ・この順番）`); bullets(f.features.map((x) => (x.b && x.b.length <= 28 ? `${x.h}：${x.b}` : x.h)), 24); }
      if (f.goodFor && f.goodFor.length) { heading("向いている人"); bullets(f.goodFor.slice(0, 2), 22); }
      if (f.cautions && f.cautions.length) { heading("注意点"); bullets(f.cautions.slice(0, 2), 22); }
      if (f.catch) { heading("キャッチコピーの方向"); bullets([f.catch], 22); }
      if (f.ng && f.ng.length) { heading("使わない表現（事実と違う）"); bullets([f.ng.join("・")], 22); }
    }
    heading("参照ルール");
    bullets(C.rules, 23);
    return y;
  }
  // 商品画像が無いときの点線の仮の絵
  function drawPlaceholder(ctx, cat, CF, bx, by, bw, bh) {
    const s = Math.min(bw / 400, bh / 300) * 0.72, ox = bx + (bw - 400 * s) / 2, oy = by + (bh - 300 * s) / 2 - 20;
    const p = (x, y) => [ox + x * s, oy + y * s];
    ctx.save(); ctx.strokeStyle = "#9AA3A0"; ctx.lineWidth = 5; ctx.setLineDash([18, 12]); ctx.lineJoin = "round"; ctx.fillStyle = "#F3F5F4";
    const line = (a) => { ctx.beginPath(); ctx.moveTo(...p(a[0], a[1])); ctx.lineTo(...p(a[2], a[3])); ctx.stroke(); };
    if (cat === "shoes") {
      ctx.beginPath();
      ctx.moveTo(...p(70, 232)); ctx.lineTo(...p(64, 95)); ctx.quadraticCurveTo(...p(68, 60), ...p(105, 58)); ctx.lineTo(...p(168, 58));
      ctx.quadraticCurveTo(...p(186, 60), ...p(190, 82)); ctx.lineTo(...p(198, 128)); ctx.quadraticCurveTo(...p(245, 160), ...p(305, 176));
      ctx.quadraticCurveTo(...p(362, 192), ...p(364, 232)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...p(52, 232)); ctx.lineTo(...p(372, 232)); ctx.lineTo(...p(372, 256)); ctx.quadraticCurveTo(...p(372, 266), ...p(360, 266));
      ctx.lineTo(...p(60, 266)); ctx.quadraticCurveTo(...p(50, 266), ...p(50, 256)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 4;
      [[178, 84, 205, 78], [186, 104, 214, 100], [196, 124, 226, 122], [214, 142, 244, 140]].forEach(line);
    } else if (cat === "pack") {
      // 本体
      ctx.beginPath(); ctx.moveTo(...p(140, 70)); ctx.quadraticCurveTo(...p(200, 40), ...p(260, 70)); ctx.lineTo(...p(272, 250));
      ctx.quadraticCurveTo(...p(272, 270), ...p(250, 272)); ctx.lineTo(...p(150, 272)); ctx.quadraticCurveTo(...p(128, 270), ...p(128, 250)); ctx.closePath(); ctx.fill(); ctx.stroke();
      // 雨蓋とフロントポケット
      ctx.beginPath(); ctx.moveTo(...p(136, 76)); ctx.quadraticCurveTo(...p(200, 50), ...p(264, 76)); ctx.lineTo(...p(266, 110)); ctx.quadraticCurveTo(...p(200, 122), ...p(134, 110)); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...p(160, 170)); ctx.lineTo(...p(240, 170)); ctx.lineTo(...p(244, 246)); ctx.lineTo(...p(156, 246)); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 4;
      [[132, 150, 268, 150], [130, 200, 270, 200], [200, 110, 200, 168]].forEach(line);
    } else {
      // ジャケット（正面）
      ctx.beginPath(); ctx.moveTo(...p(170, 52)); ctx.quadraticCurveTo(...p(200, 66), ...p(230, 52)); ctx.lineTo(...p(282, 76)); ctx.lineTo(...p(340, 210));
      ctx.lineTo(...p(312, 222)); ctx.lineTo(...p(272, 136)); ctx.lineTo(...p(274, 272)); ctx.lineTo(...p(126, 272)); ctx.lineTo(...p(128, 136));
      ctx.lineTo(...p(88, 222)); ctx.lineTo(...p(60, 210)); ctx.lineTo(...p(118, 76)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...p(170, 52)); ctx.quadraticCurveTo(...p(200, 18), ...p(230, 52)); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 4;
      [[200, 64, 200, 272], [146, 176, 182, 166], [218, 166, 254, 176]].forEach(line);
    }
    ctx.restore();
    ctx.fillStyle = "#555555"; ctx.textAlign = "center"; ctx.font = "700 34px " + CF;
    ctx.fillText("サンプル枠：商品画像を追加してください", bx + bw / 2, oy + 300 * s + 50);
    ctx.textAlign = "left";
  }
  function fitText(ctx, text, maxW, size, min, weight, CF) {
    let s = size; do { ctx.font = weight + " " + s + "px " + CF; if (ctx.measureText(text).width <= maxW) break; s -= 2; } while (s > min);
    let t = text; while (ctx.measureText(t).width > maxW && t.length > 2) t = t.slice(0, -2) + "…";
    return t;
  }
  // cv: canvas（width/height/getContext）、mctx: 計測用の2Dコンテキスト、img: 商品画像（naturalWidth/naturalHeight か width/height）
  function renderSheet(cv, mctx, d, cat, img, plainPrompt, CF) {
    const C = CATS[cat];
    const W = 2048, PAD = 56, PX = 1392, PW = W - PX - PAD, TOP = 204, LH = 33, GAP = 48;
    const panelBottom = layoutPanel(mctx, d, cat, CF, PX, TOP + 10, PW, false);
    const baseH = Math.max(1290, Math.ceil(panelBottom + 96));
    let lines = null, perCol = 0, fullH = 0; const colW = (W - PAD * 2 - GAP * 2) / 3;
    if (d.full) {
      mctx.font = "400 21px " + CF; lines = wrap(mctx, plainPrompt, colW);
      perCol = Math.ceil(lines.length / 3); fullH = 120 + perCol * LH + 56;
    }
    cv.width = W; cv.height = baseH + fullH;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, cv.height);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = "#555555"; ctx.font = "500 26px " + CF; ctx.fillText("参照シート｜商品画像と正式名称", PAD, 66);
    ctx.textAlign = "right"; ctx.fillText("この枠・ラベル・文字は完成画像に描かない", W - PAD, 66); ctx.textAlign = "left";
    const title = [d.brand, d.model].filter(Boolean).join("　") || "商品名 未入力";
    ctx.fillStyle = "#111111"; ctx.fillText(fitText(ctx, title, W - PAD * 2, 70, 34, "900", CF), PAD, 150);
    ctx.strokeStyle = "#111111"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(PAD, 178); ctx.lineTo(W - PAD, 178); ctx.stroke();
    const bx = PAD, by = TOP, bw = PX - PAD - 44, bh = baseH - TOP - 96;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bx, by, bw, bh);
    if (img) {
      const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
      const inset = 28, s = Math.min((bw - inset * 2) / nw, (bh - inset * 2) / nh);
      const iw = nw * s, ih = nh * s;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, bx + (bw - iw) / 2, by + (bh - ih) / 2, iw, ih);
    } else drawPlaceholder(ctx, cat, CF, bx, by, bw, bh);
    ctx.strokeStyle = "#BBBBBB"; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = "#555555"; ctx.font = "500 26px " + CF;
    ctx.fillText(C.caption, bx, by + bh + 46);
    layoutPanel(ctx, d, cat, CF, PX, TOP + 10, PW, true);
    if (lines) {
      const y = baseH;
      ctx.strokeStyle = "#111111"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
      ctx.fillStyle = "#111111"; ctx.font = "700 30px " + CF; ctx.fillText("生成指示（プロンプト全文）", PAD, y + 58);
      ctx.font = "400 21px " + CF;
      lines.forEach((l, i) => { const c = Math.floor(i / perCol), r = i % perCol; ctx.fillText(l, PAD + c * (colW + GAP), y + 120 + r * LH); });
    }
  }

  root.KOBO = { ASPECTS, CATS, defaults, buildPrompt, factsText, plain, wrap, layoutPanel, drawPlaceholder, fitText, renderSheet };
})(typeof globalThis !== "undefined" ? globalThis : window);
