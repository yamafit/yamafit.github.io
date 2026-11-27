// 使い方: node tools/eval-auto.mjs <slug> [--only 正規表現] [--max 件数] [--per-cat カテゴリごとの上限] [--price first|ld|max] [--strip 正規表現] [--map "正規表現=カテゴリ;…"] [--exclude 正規表現] [--cat 強制カテゴリ]
// data/raw/<slug>.json（公式ページの記載）から data/evals/<slug>.json を作る。
// 公式の記載にある事実（重量・防水・素材・保温・容量）だけを転記し、評価は記載から導ける範囲に限る。
// 記載がないものは null / 「不明」。弱点は、記載から読み取れないときは「不明」と書く（推測で埋めない）。
import fs from "node:fs";
const args = process.argv.slice(2);
const slug = args[0];
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const only = opt("--only") ? new RegExp(opt("--only"), "i") : null;
const max = Number(opt("--max") || 999);
const forceCat = opt("--cat");
const priceMode = opt("--price"); // first = ページ最初の価格表記 / ld = JSON-LDの価格（既定：master-genericの規則）
const strip = opt("--strip") ? new RegExp(opt("--strip")) : null; // 商品名の先頭などに付くブランド名を外す
const excl = opt("--exclude") ? new RegExp(opt("--exclude"), "i") : null;
const catMap = (opt("--map") || "").split(";").filter(Boolean).map((x) => { const i = x.lastIndexOf("="); return [new RegExp(x.slice(0, i), "i"), x.slice(i + 1)]; }); // 名前→カテゴリの指定（例: "ランドロック|オフトン=tent"）
const stockUnknown = args.includes("--stock-unknown"); // 在庫の記載が信頼できないサイトでは「未確認」にする
const perCat = Number(opt("--per-cat") || 999);
const catCount = {};
const raw = JSON.parse(fs.readFileSync(`data/raw/${slug}.json`, "utf8"));

const EXCLUDE = /キャップ|帽子|ハット|ビーニー|マフラー|ネックウォーマー|ソックス|靴下|グローブ|手袋|ベルト|財布|ステッカー|Tシャツ|TEE\b|タンク|ストラップ|タオル|ボトル|マグ|カップ|ランタン|チェア|テーブル|バーナー|ストーブ|クッカー|シェラ|コット|ギフト|ラッピング|ケース|アクセサリー|\bCAP\b|\bBEANIE\b|\bHAT\b|\bGLOVE/i;
const CATS = [
  ["boots", /登山靴|トレッキングシューズ|ハイキングシューズ|シューズ|ブーツ|スニーカー|サンダル/],
  ["tent", /SleepingBag|テント|タープ(?!ルーフ)|シュラフ|寝袋|スリーピングバッグ|スリーピングマット|マット|フライシート|ツェルト|ビビィ/],
  ["poles", /ポール|ストック|ステッキ/],
  ["pack", /バックパック|ザック|リュック|デイパック|パック\b|バッグ|ボディバッグ/],
  ["pants", /パンツ|ショーツ|トラウザー|タイツ|レギンス|スカート|ボトムス|\bPANTS?\b|\bSHORTS?\b/i],
  ["rain", /レイン|雨具|シェル|ハードシェル|ウインドシェル|ゴアテックス|GORE-?TEX|ポンチョ|\bRAIN\b|\bSHELL\b/i],
  ["wear", /ジャケット|フリース|ダウン|ベスト|パーカー|セーター|ニット|シャツ|コート|インナー|ブルゾン|スウェット|フーディ|\bJACKET\b|\bJKT\b|\bHOODIE?\b|\bHOODY\b|\bFLEECE\b|\bDOWN\b|\bVEST\b|\bPARKA\b|\bZIP[- ]?UP\b/i],
];
const CAT_WORD = { boots: "靴", pack: "ザック・バッグ", pants: "パンツ", rain: "レインウェア・シェル", wear: "ウェア", tent: "テント・寝具", poles: "ポール" };
const classify = (r) => {
  if (forceCat) return forceCat;
  for (const [re, c] of catMap) if (re.test(r.name)) return c;
  if (["boots", "pack", "poles", "rain", "wear", "pants", "tent"].includes(r.category) && !/jkt|jacket|hoodie|parka|pants|shorts|ジャケット|フーディ|パンツ|ショーツ|ベスト/i.test(r.name)) return r.category;
  const tagsText = (r.tags || []).join(" ");
  if (/\d+[〜~]?\d*リットル|バックパック|リュックサック|ザック/.test(tagsText) && !/ポーチ|ケース|カバー/.test(r.name)) return "pack";
  const t = `${r.name} ${r.product_type || ""}`;
  for (const [c, re] of CATS) if (re.test(t)) return c;
  return null;
};
const cleanName = (s) => (s || "").replace(/【公式】|\s*[｜|]\s*[^｜|│]*(公式|ストア|オンライン|ONLINE)[^｜|│]*$/gi, "").split(/[│｜|]/)[0].replace(/\s+-\s*\d+$/, "").replace(/\s+/g, " ").trim();
const gender = (n) => (/ウィメンズ|レディース|ウーマン|W['’]S|Women|WOMEN/.test(n) ? "womens" : /メンズ|Men['’]?s|\bMEN\b|MEN'S/i.test(n) ? "mens" : "unisex");
const num = (s) => Number(String(s).replace(/,/g, ""));
const firstSentence = (d) => { const s = (d || "").replace(/\s+/g, " ").trim(); const m = s.match(/^(.{20,90}?[。.!！])/); return (m ? m[1] : s.slice(0, 80)).trim(); };
const idOf = (key) => {
  const parts = key.replace(/\?.*$/, "").replace(/\.html?$/, "").split("/").filter(Boolean);
  const pi = parts.indexOf("products");
  const seg = pi >= 0 && parts.length > pi + 2 ? parts[pi + 1] : parts.pop(); // /products/<型番>/<色> のときは型番を使う
  return seg.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
};

const out = [];
const seen = new Set();
const seenNames = new Set();
for (const [key, r] of Object.entries(raw)) {
  if (out.length >= max) break;
  const name = cleanName(r.name || r.title).replace(/\s*[（(][^）)]{1,12}[）)]\s*$/, "").replace(strip || /$^/, "").trim(); // 末尾の色名（ブラック等）は商品名から外す
  if (!name || (only && !only.test(name))) continue;
  if ((excl && excl.test(name)) || EXCLUDE.test(name) || /^(エラー|404|Not Found)/i.test(name)) continue;
  let category = classify(r);
  if (!category) continue;
  if ((r.availability || []).length && r.availability.every((a) => /OutOfStock|SoldOut/.test(a))) continue; // 在庫がなく販売終了の可能性があるものは載せない
  if ((catCount[category] || 0) >= perCat) continue;
  const id = idOf(key);
  const dupKey = `${name}|${gender(name)}|${classify(r)}`;
  if (seenNames.has(dupKey)) continue; seenNames.add(dupKey); // 色違いは1件にまとめる
  if (!id || seen.has(id)) continue; seen.add(id);
  const lines = [...(r.weight || []), ...(r.material || []), ...(r.waterproof || []), ...(r.warmth || []), ...(r.size || []), ...String(r.body || r.desc || "").split(/\n|。/)].map((l) => l.trim()).filter(Boolean);
  const body = lines.join("\n");

  // 重量：「重量」「重さ」「総重量」などと一緒に書かれた数値だけを使う
  let weight_g = null, weight_note = null;
  const wm = body.match(/(?:総?重量|重さ|質量|weight)[^\d]{0,12}(?:約)?\s*([\d,.]+)\s*(kg|g|ｇ)/i);
  if (wm) { weight_g = Math.round(num(wm[1]) * (/kg/i.test(wm[2]) ? 1000 : 1)); weight_note = "公式記載"; }
  const cm = category === "pack" ? (`${name} ${body}`.match(/(\d{1,3})\s?(?:L|ℓ|リットル)\b/i) || `${name} ${body}`.match(/(\d{1,3})\s?(?:L|ℓ)/)) : null;
  let capacity_l = null;
  if (category === "pack" && /リットル/.test((r.tags || []).join(" "))) { const nm = name.match(/(?:^|\s)(\d{2,3})(?:\+\d+)?(?:\s|$)/); if (nm) capacity_l = Number(nm[1]); }
  if (!capacity_l && cm) capacity_l = Number(cm[1]);
  if (category === "pack" && !capacity_l) { const tm = name.match(/(?:^|[^\d])(\d{2,3})$/); if (tm) capacity_l = Number(tm[1]); } // 商品名の末尾の数字（例: ステティンド20）を容量とみなす

  // 防水・撥水
  // 防水の判定は、メニューやタグの単独ラベル（例:「GORE-TEX」だけの行）や「｜」区切りの見出しを除いた文章からだけ行う
  const wpBody = [name, ...lines.filter((l) => (l.length > 14 || /\d/.test(l)) && !/[｜|]/.test(l))].join("\n");
  const spec = wpBody.match(/GORE-?TEX\s?(?:INFINIUM|PRO|PACLITE|Paclite|ACTIVE|SHAKEDRY)?|ゴアテックス(?:\s?(?:ファブリクス|プロ|パックライト|インフィニアム))?|eVent|耐水圧\s*[\d,]+\s*mm(?:以上)?|OUTDRY|アウトドライ|H2No[^\s、。/]*/i);
  // 防水の判定は、メニューやタグの単独ラベル（例:「GORE-TEX」だけの行）や「｜」区切りの見出しを除いた文章からだけ行う
  let waterproof = null, waterproof_level = null;
  if (spec) { waterproof = spec[0].replace(/\s+/g, " ").trim(); waterproof_level = "waterproof"; }
  else if (/防水/.test(wpBody)) { waterproof = "防水（公式記載）"; waterproof_level = "waterproof"; }
  else if (/撥水|はっ水|DWR/i.test(wpBody)) { waterproof = "撥水加工（公式記載）"; waterproof_level = "water_repellent"; }

  if (category === "wear" && waterproof_level === "waterproof" && (/GORE|ゴア|eVent|OUTDRY/i.test(waterproof) || Number((waterproof.match(/耐水圧\s*([\d,]+)/) || [])[1]?.replace(/,/g, "")) >= 10000)) category = "rain";
  if (category === "rain" && !waterproof && !/レイン|雨|RAIN|ポンチョ/i.test(name)) category = "wear";
  const mat = (r.material || []).find((l) => l.length >= 4 && l.length < 160 && /[：:]|表地|素材|アッパー|ナイロン|ポリエステル|綿|コットン|ウール|レザー/.test(l)) || lines.find((l) => /^(素材|表地|アッパー)[：:\s]/.test(l));
  const material = mat ? mat.replace(/\s+/g, " ").slice(0, 150) : null;
  const wm2 = lines.find((l) => /(中綿|ダウン(?!ロード)|フィルパワー|\d+\s?FP|プリマロフト|PRIMALOFT|シンサレート|保温|ウール)/i.test(l) && l.length < 120);
  const warmth = (["wear", "pants", "rain"].includes(category) || (category === "tent" && /オフトン|シュラフ|寝袋|スリーピング|バッグ|SleepingBag/i.test(name + (r.product_type || "")))) && wm2 && /中綿|ダウン(?!ロード)|フィルパワー|FP|プリマロフト|PRIMALOFT|シンサレート|保温/i.test(wm2) ? wm2.replace(/\s+/g, " ") : null;

  // 評価（記載から導ける範囲）
  const text = `${name} ${r.desc || ""}`;
  const warm = /ダウン(?!ロード)|中綿|プリマロフト|PRIMALOFT|シンサレート|フリース|保温|防寒|ウィンター|DOWN|FLEECE/i.test(text);
  const summerish = /夏|クール|ショーツ|SHORTS|ハーフパンツ|通気|メッシュ|UV/.test(text);
  const season = category === "tent" ? [] : warm ? ["autumn", "winter", "spring"] : summerish ? ["spring", "summer", "autumn"] : ["spring", "autumn", "summer"];
  const uses = category === "tent" ? ["tent"] : category === "pack" ? (capacity_l ? (capacity_l <= 20 ? ["low", "town"] : capacity_l <= 40 ? ["mid", "hut"] : ["tent", "hut"]) : []) : category === "boots" ? ["low", "mid"] : category === "poles" ? ["low", "mid", "hut"] : ["low", "mid", "hut"];
  const concerns = [];
  if (weight_g && ((category === "rain" && weight_g < 350) || (category === "wear" && weight_g < 400) || (category === "pack" && weight_g < 800))) concerns.push("light");
  if (warm && ["wear", "tent"].includes(category)) concerns.push("cold");
  if (/ベンチレーション|通気|蒸れ|透湿|ピットジップ/.test(text) && ["rain", "wear", "pants"].includes(category)) concerns.push("sweat");
  const price = r.price_min ?? r.price_max ?? null;
  const pros = [];
  if (waterproof) pros.push(`防水・撥水：${waterproof}（公式記載）`);
  if (weight_g) pros.push(`重量 ${weight_g.toLocaleString()}g（公式記載）`);
  if (capacity_l) pros.push(`容量 ${capacity_l}L`);
  if (warmth) pros.push(`保温：${warmth.slice(0, 40)}`);
  if (/ベンチレーション|ピットジップ/.test(text)) pros.push("ベンチレーション（換気用の開閉部）の記載あり");
  if (/ストレッチ/.test(text)) pros.push("ストレッチ性の記載あり");
  if (/ポケッタブル|パッカブル|収納/.test(text)) pros.push("コンパクトに収納できると記載");
  if (!pros.length) pros.push("公式ページに仕様の詳しい記載が少ないため、特徴は商品ページで確認してください");
  const cons = [];
  if (price && price >= 50000) cons.push(`価格が${Math.floor(price / 10000)}万円台と高め`);
  if (!cons.length) cons.push("不明（公式の記載から読み取れる弱点は限られます）");
  const good_for = { boots: ["足元を安定させたい人"], pack: ["荷物を整理して背負いたい人"], pants: ["動きやすいパンツを探す人"], rain: ["雨や風に備えたい人"], wear: ["季節に合わせて重ね着をしたい人"], tent: ["泊まりのキャンプ・山行をする人"], poles: ["歩行を補助したい人"] }[category];
  const concern_reasons = {};
  if (concerns.includes("light")) concern_reasons.light = `重量 ${weight_g}g と公式に記載されています。`;
  if (concerns.includes("cold")) concern_reasons.cold = "保温材やフリースなど、保温を目的とした素材が記載されています。";
  if (concerns.includes("sweat")) concern_reasons.sweat = "通気・透湿・ベンチレーションに関する記載があります。";
  catCount[category] = (catCount[category] || 0) + 1;
  out.push({
    key, id, name, in_stock_unknown: stockUnknown || undefined, in_stock: (r.stock_lines || []).length ? (r.stock_lines.some((l) => /在庫あり|在庫わずか/.test(l)) ? true : false) : undefined, gender: gender(name), category, price: priceMode === "first" ? (((r.price_text || [])[0] || "").match(/[¥￥]\s?([\d,]{3,})/) || [])[1] ? Number(((r.price_text || [])[0].match(/[¥￥]\s?([\d,]{3,})/))[1].replace(/,/g, "")) : null : priceMode === "ld" ? (r.price_min ?? null) : priceMode === "max" ? (r.price_max ?? r.price_min ?? null) : undefined, weight_g, weight_note, capacity_l, material, waterproof, waterproof_level, warmth, size_note: null,
    eval: { season, uses, concerns, fit: "不明（公式にサイズ感の記載なし）", summary: `${CAT_WORD[category]}。${firstSentence(r.desc)}`.slice(0, 140), pros: pros.slice(0, 4), cons, good_for, not_for: [], concern_reasons },
  });
}
fs.writeFileSync(`data/evals/${slug}.json`, JSON.stringify(out, null, 1));
console.log(`${slug}: evals ${out.length}件`);
const c = {}; out.forEach((x) => (c[x.category] = (c[x.category] || 0) + 1)); console.log(c);
