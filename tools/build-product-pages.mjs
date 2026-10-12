// 使い方: node tools/build-product-pages.mjs   data/master/*.json → products/<id>.html（商品詳細ページ）
// 構成：基本情報／主な特徴／メーカー公表の仕様／ヤマフィットの評価（メリット・デメリット・向いている人・向いていない人・購入前の注意点）／参考情報源／購入先
// 購入リンク（楽天など）は js/shop.js が表示時に作る。URLが未確認のものは作らない。
import fs from "node:fs";
import { SITE_URL, esc, head, chrome } from "./shell.mjs";
import { ARTICLES } from "../content/articles.mjs";

export const CAT_LABEL = { boots: "シューズ（登山靴）", pack: "ザック", rain: "アウター（レインウェア）", wear: "アウター（ウェア）", pants: "パンツ", poles: "ポール", tent: "テント" };
const SEASON = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
const USES = { low: "低山", mid: "中級山岳", hut: "山小屋泊", tent: "テント泊", winter: "冬山", town: "街歩き" };
const GENDER = { mens: "メンズ", womens: "ウィメンズ", unisex: "ユニセックス" };
const CONCERN = { knee: "膝への負担", cold: "寒さ", sweat: "蒸れ", light: "軽さ", budget: "価格" };

const masters = fs.readdirSync("data/master").filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(fs.readFileSync(`data/master/${f}`, "utf8")).products);
const dateOf = (p) => ((p.offers || []).find((o) => o.checked_at) || {}).checked_at || (p.sources && p.sources[0] && p.sources[0].checked_at) || "不明";
const host = (u) => { try { return new URL(u).hostname; } catch { return u; } };
const li = (a) => (a && a.length ? `<ul class="article-list">${a.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
const row = (k, v) => (v === null || v === undefined || v === "" ? "" : `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`);
const unknown = (v) => (v === null || v === undefined || v === "" ? "不明（公式ページに記載なし）" : v);

fs.mkdirSync("products", { recursive: true });
for (const f of fs.readdirSync("products")) if (f.endsWith(".html")) fs.unlinkSync(`products/${f}`);

const articlesOf = (p) => ARTICLES.filter((a) => a.products.some((id) => { const q = masters.find((m) => m.id === id); return q && q.category === p.category; })).slice(0, 3);
const ids = [];
for (const p of masters) {
  const e = p.evaluation || {};
  const checked = dateOf(p);
  const title = `${p.brand} ${p.name}`;
  const desc = `${title}の価格・重量・素材などの公式記載と、メリット・デメリット、向いている人・向いていない人をまとめました（${checked} 確認）。`;
  const same = masters.filter((q) => q.id !== p.id && q.category === p.category && q.brand === p.brand).slice(0, 4);
  const peers = masters.filter((q) => q.id !== p.id && q.category === p.category && q.brand !== p.brand).slice(0, 4);
  const stock = (p.offers || []).some((o) => o.in_stock === true) ? "公式ストアで在庫ありと確認できました" : (p.offers || []).some((o) => o.in_stock === false) ? "確認時点で在庫なしでした" : "在庫は確認できていません";
  const notes = [
    e.fit && !/^不明/.test(e.fit) ? `サイズ感：${e.fit}` : null,
    p.size_note ? `サイズ：${p.size_note}` : null,
    `価格・在庫・仕様は変わります。${checked} 時点の確認内容で、${stock}。購入前に各販売サイトで最新情報をご確認ください。`,
    ...(e.cons || []).filter((c) => !/^不明/.test(c)).map((c) => `デメリットの再掲：${c}`).slice(0, 0),
    "山行の前には、最新の気象とルートの状況を必ずご確認ください。",
  ].filter(Boolean);
  const cs = (e.concerns || []).map((c) => CONCERN[c]).filter(Boolean);
  const rel = (list) => list.map((q) => `<a class="prod-card" href="${q.id}.html"><span class="eyebrow">${esc(q.brand)}</span><b>${esc(q.name)}</b><span class="prod-meta">${q.price ? `¥${q.price.toLocaleString()}（税込）` : "価格：不明"}</span></a>`).join("");
  const ld = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: title, brand: { "@type": "Brand", name: p.brand }, description: e.summary || desc })}</script>\n`;
  const c = chrome("../");
  fs.writeFileSync(`products/${p.id}.html`, `${head(title, desc, `/products/${p.id}.html`, ld)}
${c.top}
<main class="doc" style="gap: 24px">
  <div class="stack" style="gap: 12px">
    <div class="crumb"><a href="../index.html">ホーム</a> ／ <a href="../products.html">商品一覧</a> ／ ${esc(CAT_LABEL[p.category] || p.category)}</div>
    <div class="eyebrow">${esc(p.brand)}</div>
    <h1 class="article-title">${esc(p.name)}</h1>
    <div class="meta"><span class="mono">${checked} 確認</span><span class="pr-badge">PR</span></div>
    <p class="body-text">${esc(e.summary || "")}</p>
  </div>

  <section>
    <h2 class="article-h2">購入先</h2>
    <div id="buy" data-pid="${esc(p.id)}"></div>
  </section>

  <section>
    <h2 class="article-h2">基本情報</h2>
    <div class="table-wrap"><table class="table table--kv"><tbody>
      ${row("ブランド", p.brand)}${row("カテゴリー", CAT_LABEL[p.category] || p.category)}${row("対象", GENDER[p.gender])}
      ${row("価格", p.price ? `¥${p.price.toLocaleString()}（税込・${checked} 確認）` : "不明（公式ページに記載なし）")}
    </tbody></table></div>
  </section>

  <section>
    <h2 class="article-h2">主な特徴</h2>
    ${li(e.pros && e.pros.length ? e.pros.slice(0, 3) : [])}
    <p class="sub">用途・季節の目安：${esc([(e.season || []).map((s) => SEASON[s]).filter(Boolean).join("・") || "通年", (e.uses || []).map((u) => USES[u]).filter(Boolean).join("・")].filter(Boolean).join("／"))}${cs.length ? `　気になりやすい点への対応：${esc(cs.join("・"))}` : ""}</p>
  </section>

  <section>
    <h2 class="article-h2">メーカー公表の仕様</h2>
    <p class="sub" style="margin-bottom: 8px">ブランド公式ページの記載をそのまま整理しています。記載がない項目は「不明」とし、推測では書きません。</p>
    <div class="table-wrap"><table class="table table--kv"><tbody>
      ${row("重量", unknown(p.weight_g ? `${p.weight_g.toLocaleString()}g${p.weight_note ? "（" + p.weight_note + "）" : ""}` : null))}
      ${row("素材", unknown(p.material))}
      ${row("防水・撥水", unknown(p.waterproof))}
      ${p.capacity_l ? row("容量", `${p.capacity_l}L`) : ""}
      ${p.warmth ? row("保温", p.warmth) : ""}
      ${row("サイズ展開", unknown(p.size_note))}
    </tbody></table></div>
  </section>

  <section>
    <h2 class="article-h2">ヤマフィットの評価</h2>
    <p class="sub" style="margin-bottom: 8px">上の公式記載をもとにヤマフィットが整理した評価です。メディアやユーザーの評価・レビューは、まだ収集していないため掲載していません。</p>
    <h3 class="article-h3">メリット</h3>${li(e.pros)}
    <h3 class="article-h3">デメリット</h3>${li(e.cons)}
    <h3 class="article-h3">向いている人</h3>${li(e.good_for && e.good_for.length ? e.good_for : ["不明（公式の記載から判断できません）"])}
    <h3 class="article-h3">向いていない人</h3>${li(e.not_for && e.not_for.length ? e.not_for : ["不明（公式の記載から判断できません）"])}
    <h3 class="article-h3">購入前の注意点</h3>${li(notes)}
  </section>

  <section>
    <h2 class="article-h2">参考情報源と確認日</h2>
    <ul class="article-list">${(p.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(host(s.url))}（公式ページ）</a>　<span class="mono">${esc(s.checked_at)} 確認</span></li>`).join("")}</ul>
  </section>

  <div class="notice" style="margin: 0">
    <div class="notice-head"><span class="pr-badge">PR</span><span>広告・免責について</span></div>
    <p>このページにはアフィリエイト広告が含まれます。リンク先での購入により、当サイトが報酬を受け取る場合があります。掲載順や評価は、報酬の有無や大小では決めていません。</p>
  </div>

  ${same.length ? `<section><h2 class="h-section" style="margin-bottom: 8px">同じブランドの商品</h2><div class="prod-list">${rel(same)}</div></section>` : ""}
  ${peers.length ? `<section><h2 class="h-section" style="margin-bottom: 8px">同じカテゴリーの他の商品</h2><div class="prod-list">${rel(peers)}</div></section>` : ""}
  ${articlesOf(p).length ? `<section><h2 class="h-section" style="margin-bottom: 8px">関連記事</h2>${articlesOf(p).map((a) => `<a class="news-item" href="../articles/${a.slug}.html"><span class="news-meta"><span class="news-brand">${esc(a.category)}</span><span>${a.date}</span></span><span class="news-title">${esc(a.title)}</span></a>`).join("")}</section>` : ""}
  <div id="insta"></div>
</main>
${c.bottom}`);
  ids.push(p.id);
}
fs.writeFileSync("data/product-pages.json", JSON.stringify(ids));
console.log(`商品ページ ${ids.length}件`);
