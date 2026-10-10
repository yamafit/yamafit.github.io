// 使い方: node tools/collect-montbell.mjs <カテゴリ名> <一覧のcategory番号,...> [最大件数]
// モンベル公式オンラインストアの一覧→各商品ページを取得し、記載された事実だけを data/raw/montbell.json に追記する。
import fs from "node:fs";
const [cat, lists, maxArg] = process.argv.slice(2);
const REFRESH = cat === "--refresh";
const MAX = Number(maxArg || 8);
const H = { "user-agent": "Mozilla/5.0", "accept-language": "ja" };
const today = new Date().toISOString().slice(0, 10);
const get = async (u) => { const r = await fetch(u, { headers: H, redirect: "follow" }); return { url: r.url, html: await r.text() }; };
const toText = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|th|td|h\d|dt|dd)>/gi, "\n")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&reg;/g, "®").replace(/&yen;/g, "¥").replace(/[ \t　]+/g, " ").split("\n").map((s) => s.trim()).filter(Boolean);
const field = (lines, label) => { const i = lines.findIndex((l) => l.startsWith(`【${label}】`)); if (i < 0) return null;
  let s = lines[i].replace(`【${label}】`, "").trim(); for (let j = i + 1; j < lines.length && !lines[j].startsWith("【") && j < i + 6; j++) { if (/^(機能|サイズ表|仕様|特長)$/.test(lines[j])) break; s += " / " + lines[j]; } return s.replace(/\s*\/\s*$/, ""); };

const weightField = (lines) => { for (const l of lines) { const m = l.match(/^【([^】]*重量[^】]*)】(.*)$/); if (m) return `${m[1]}：${m[2].trim()}`; } return null; };
const STOCK_LINE = /^(在庫あり|直営店在庫あり|在庫なし|完売|入荷待ち|販売終了|予約受付中)$/;
const stockOf = (lines) => { const s = lines.filter((l) => STOCK_LINE.test(l)); return { in: s.filter((l) => /在庫あり/.test(l)).length, out: s.filter((l) => !/在庫あり/.test(l)).length }; };
const out = fs.existsSync("data/raw/montbell.json") ? JSON.parse(fs.readFileSync("data/raw/montbell.json", "utf8")) : {};
const seenTitles = new Set(Object.values(out).map((x) => x.name + "|" + x.category));
if (REFRESH) { // 収集済みの商品を、同じ取り出し方で取り直す
  for (const id of Object.keys(out)) {
    const { html: ph } = await get(`https://webshop.montbell.jp/goods/disp.php?product_id=${id}`);
    const lines = toText(ph);
    out[id].weight = weightField(lines);
    out[id].capacity = field(lines, "容量");
    out[id].material = field(lines, "素材");
    out[id].stock = stockOf(lines);
    out[id].checked_at = today;
    console.log(id, out[id].name, "|", out[id].weight || "重量不明");
  }
  fs.writeFileSync("data/raw/montbell.json", JSON.stringify(out, null, 1));
  process.exit(0);
}
for (const l of lists.split(",")) {
  const { url, html } = await get(`https://webshop.montbell.jp/goods/list.php?category=${l}`);
  const ids = [...new Set([...html.matchAll(/disp(?:_fo)?\.php\?product_id=(\d+)/g)].map((m) => m[1]))].slice(0, MAX * 3);
  let got = 0;
  for (const id of ids) {
    if (got >= MAX) break;
    try {
      const { url: pu, html: ph } = await get(`https://webshop.montbell.jp/goods/disp.php?product_id=${id}`);
      const title = (ph.match(/<title[^>]*>([^<]*)/i) || [])[1]?.split("｜").pop().trim();
      if (!title) continue;
      const key = title + "|" + cat; if (seenTitles.has(key)) continue; seenTitles.add(key);
      const lines = toText(ph);
      const priceIdx = lines.findIndex((l) => /¥[\d,]+（税込）/.test(l));
      const price = priceIdx >= 0 ? Number(lines[priceIdx].match(/¥([\d,]+)（税込）/)[1].replace(/,/g, "")) : null;
      const priceLabel = priceIdx > 0 ? lines[priceIdx - 1] : "";
      const stockLines = lines.filter((l) => STOCK_LINE.test(l));
      out[id] = {
        id, category: cat, name: title, url: pu, price, price_label: /アウトレット|セール|特別/.test(priceLabel + pu) ? priceLabel : "", 
        material: field(lines, "素材"), weight: weightField(lines), size: field(lines, "サイズ"), features: field(lines, "特長") || field(lines, "特徴"),
        capacity: field(lines, "容量"), desc: (ph.match(/property="og:description" content="([^"]*)"/) || [])[1]?.slice(0, 260) || null,
        image: (ph.match(/property="og:image" content="([^"]*)"/) || [])[1] || null,
        stock: stockOf(lines),
        checked_at: today,
      };
      got++;
      console.log(`${cat} ${id} ${title} ¥${price}${out[id].price_label ? " [" + out[id].price_label + "]" : ""} | ${out[id].weight || "重量不明"}`);
    } catch (e) { console.warn("skip", id, e.message); }
  }
}
fs.writeFileSync("data/raw/montbell.json", JSON.stringify(out, null, 1));
