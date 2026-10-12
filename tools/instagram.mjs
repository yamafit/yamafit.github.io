// 使い方: node tools/instagram.mjs <商品ID | 記事のslug>   →  out/instagram/<名前>.md
// 商品マスター（data/master）の同じデータから、Instagram用の紹介文・カルーセル構成・見出し・ハッシュタグ候補を作る。
// 投稿は手動（API自動投稿は利用条件を確認してから）。Web記事と価格・仕様が食い違わないよう、数字は必ずマスターから取る。
import fs from "node:fs";
import { ARTICLES } from "../content/articles.mjs";
const SITE_URL = (fs.readFileSync("js/site.js", "utf8").match(/url:\s*"([^"]+)"/) || [])[1] || "";
const masters = fs.readdirSync("data/master").filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(fs.readFileSync(`data/master/${f}`, "utf8")).products);
const byId = Object.fromEntries(masters.map((p) => [p.id, p]));
const CAT_TAG = { boots: ["#登山靴", "#トレッキングシューズ"], pack: ["#登山ザック", "#バックパック"], rain: ["#レインウェア", "#登山雨具"], wear: ["#登山ウェア"], pants: ["#登山パンツ"], poles: ["#トレッキングポール"], tent: ["#テント泊"] };
const BASE_TAG = ["#登山", "#登山装備", "#登山初心者", "#山登り", "#ヤマフィット"];
const arg = process.argv[2];
if (!arg) { console.error("使い方: node tools/instagram.mjs <商品ID | 記事のslug>"); process.exit(1); }
fs.mkdirSync("out/instagram", { recursive: true });
const checked = (p) => ((p.offers || []).find((o) => o.checked_at) || {}).checked_at || (p.sources[0] || {}).checked_at || "不明";
const tags = (list) => [...new Set(list)].join(" ");

if (byId[arg]) {
  const p = byId[arg], e = p.evaluation || {};
  const url = SITE_URL ? `${SITE_URL}products/${p.id}.html` : "（サイトURL未設定）";
  const specs = [p.price ? `価格 ¥${p.price.toLocaleString()}（税込・${checked(p)} 確認）` : null, p.weight_g ? `重量 ${p.weight_g}g${p.weight_note ? "（" + p.weight_note + "）" : ""}` : null, p.capacity_l ? `容量 ${p.capacity_l}L` : null, p.waterproof ? `防水：${p.waterproof}` : null].filter(Boolean);
  const md = `# Instagram素材：${p.brand} ${p.name}

## 見出し候補
- ${p.brand} ${p.name}、買う前に知っておきたいこと
- ${(e.good_for || [])[0] || "こんな人に向いています"}
- メリットとデメリットを公式の記載から整理

## 紹介文（キャプション）
${p.brand} ${p.name}
${e.summary || ""}

${specs.map((s) => "・" + s).join("\n")}

メリット
${(e.pros || []).slice(0, 3).map((s) => "・" + s).join("\n")}

気になる点
${(e.cons || []).filter((s) => !/^不明/.test(s)).slice(0, 2).map((s) => "・" + s).join("\n") || "・公式の記載から読み取れる弱点は限られます"}

向いている人：${(e.good_for || []).join("、") || "不明"}
向いていない人：${(e.not_for || []).join("、") || "不明"}

※価格・在庫・仕様は変わります。最新情報は各販売サイトで確認してください。
詳しくはプロフィールのリンクから。
#PR（アフィリエイト広告を含みます）

${url}

## カルーセル構成（5枚）
1. 表紙：${p.brand} ${p.name}（商品の写真は、権利を確認できるものを使う）
2. スペック：${specs.join(" ／ ")}
3. メリット：${(e.pros || []).slice(0, 3).join(" ／ ")}
4. 気になる点・向いていない人：${[...(e.cons || []).filter((s) => !/^不明/.test(s)).slice(0, 1), ...(e.not_for || []).slice(0, 1)].join(" ／ ") || "公式記載にもとづき整理"}
5. まとめ：向いている人＝${(e.good_for || []).join("、") || "不明"}。詳しくはプロフィールのリンクへ

## ハッシュタグ候補
${tags([...BASE_TAG, ...(CAT_TAG[p.category] || []), `#${p.brand.replace(/[・\s]/g, "")}`])}
`;
  fs.writeFileSync(`out/instagram/${p.id}.md`, md);
  console.log(`out/instagram/${p.id}.md`);
} else {
  const a = ARTICLES.find((x) => x.slug === arg);
  if (!a) { console.error("商品IDにも記事のslugにも一致しません:", arg); process.exit(1); }
  const url = SITE_URL ? `${SITE_URL}articles/${a.slug}.html` : "（サイトURL未設定）";
  const prods = a.products.map((id) => byId[id]).filter(Boolean);
  const md = `# Instagram素材：${a.title}

## 見出し候補
- ${a.title}
${a.sections.slice(0, 3).map((s) => `- ${s.h}`).join("\n")}

## 紹介文（キャプション）
${a.title}
${a.desc}

${a.sections.slice(0, 4).map((s) => "・" + s.h).join("\n")}

紹介した商品（価格は確認日つき・変わることがあります）
${prods.map((p) => `・${p.brand} ${p.name}${p.price ? "　¥" + p.price.toLocaleString() + "（" + checked(p) + " 確認）" : ""}`).join("\n")}

詳しくはプロフィールのリンクから。
#PR（アフィリエイト広告を含みます）

${url}

## カルーセル構成
1. 表紙：${a.title}
${a.sections.slice(0, 5).map((s, i) => `${i + 2}. ${s.h}：${((s.p || [])[0] || (s.ul || [])[0] || "").slice(0, 60)}`).join("\n")}
${a.sections.slice(0, 5).length + 2}. まとめ：記事のリンクへ

## ハッシュタグ候補
${tags([...BASE_TAG, ...(CAT_TAG[prods[0] ? prods[0].category : ""] || [])])}
`;
  fs.writeFileSync(`out/instagram/${a.slug}.md`, md);
  console.log(`out/instagram/${a.slug}.md`);
}
