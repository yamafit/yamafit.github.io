// 使い方: node tools/refresh-offers.mjs [--brand モンベル] [--limit 20] [--dry]
// マスターの各商品について、公式ページを開き直して「価格」「在庫」「確認日」を更新する（スペックは変えない）。
//  - モンベル：サイズ別の在庫表示（在庫あり／完売など）を数える
//  - サロモン・マーモット・メレル：Shopifyの商品JSON（variantsのavailable・price）
//  - それ以外：ページ内の価格・在庫のデータ（JSON-LD等）。マムートはサイズ別のため在庫は「不明」のまま
//  - ページが消えている（404）場合は「在庫なし」とし、note に残す。ここで消すかどうかは運営者が決める。
import fs from "node:fs";
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const brandFilter = arg("--brand"), limit = Number(arg("--limit") || 1e9), dry = process.argv.includes("--dry");
const today = new Date().toISOString().slice(0, 10);
const H = { "user-agent": "Mozilla/5.0", "accept-language": "ja" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY = { "www.patagonia.jp": 25000 };
const lastHit = {};
async function polite(host) { const d = DELAY[host] || 1500; const w = (lastHit[host] || 0) + d - Date.now(); if (w > 0) await sleep(w); lastHit[host] = Date.now(); }
const STOCK_LINE = /^(在庫あり|直営店在庫あり|在庫なし|完売|入荷待ち|販売終了|予約受付中)$/;
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|th|td|h\d|dt|dd|span)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").split("\n").map((s) => s.trim()).filter(Boolean);

async function check(url) {
  const u = new URL(url); await polite(u.host);
  if (/\/products\//.test(u.pathname) && /(salomon\.jp|marmot\.jp|merrell\.jp)$/.test(u.host)) { // Shopify
    const r = await fetch(`${u.origin}${u.pathname}.js`, { headers: H, signal: AbortSignal.timeout(30000) }); // .js には在庫(available)が入る。価格は銭単位
    if (r.status === 404) return { gone: true };
    const product = await r.json();
    const prices = product.variants.map((v) => Number(v.price) / 100).filter((x) => x > 0);
    return { price: prices.length ? Math.min(...prices) : null, in_stock: product.variants.some((v) => v.available) };
  }
  const r = await fetch(url, { headers: H, redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (r.status === 404) return { gone: true };
  const html = await r.text();
  if (/お探しのページは見つかりませんでした|ページが見つかりません|Page Not Found|商品エラー/.test((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || "")) return { gone: true };
  if (/montbell\.jp/.test(u.host)) {
    const lines = text(html), s = lines.filter((l) => STOCK_LINE.test(l));
    const m = lines.find((l) => /¥[\d,]+（税込）/.test(l));
    return { price: m ? Number(m.match(/¥([\d,]+)/)[1].replace(/,/g, "")) : null, in_stock: s.some((l) => /在庫あり/.test(l)) ? true : s.length ? false : null };
  }
  if (/mammut\.jp/.test(u.host)) { const p = [...html.matchAll(/"price"\s*:\s*"?(\d{3,7})/g)].map((x) => Number(x[1])); return { price: p.length ? Math.min(...p) : null, in_stock: null }; } // サイズ別のため不明
  const av = [...html.matchAll(/"availability"\s*:\s*"[^"]*?(InStock|OutOfStock|SoldOut|LimitedAvailability)"/g)].map((m) => m[1]);
  const prices = [...html.matchAll(/"price"\s*:\s*"?(\d{3,7})(?:\.\d+)?"?/g)].map((m) => Number(m[1])).filter((n) => n >= 500);
  const jp = text(html).map((l) => (l.match(/[¥￥]\s?([\d,]{4,})/) || [])[1]).filter(Boolean).map((s) => Number(s.replace(/,/g, "")));
  const sold = text(html).some((l) => /SOLD ?OUT/i.test(l)) && !av.some((a) => /InStock/.test(a));
  return { price: (jp.length ? Math.max(...jp.slice(0, 3)) : prices.length ? Math.max(...prices) : null) || null, in_stock: av.length ? av.some((a) => /InStock|Limited/.test(a)) : sold ? false : null };
}

let n = 0, changed = 0;
for (const f of fs.readdirSync("data/master").filter((x) => x.endsWith(".json")).sort()) {
  const d = JSON.parse(fs.readFileSync(`data/master/${f}`, "utf8"));
  if (brandFilter && d.brand !== brandFilter) continue;
  for (const p of d.products) {
    if (n >= limit) break;
    const o = p.offers.find((x) => x.shop === "official"); if (!o) continue;
    n++;
    try {
      const res = await check(o.url);
      const before = `¥${p.price} ${o.in_stock}`;
      if (res.gone) { o.in_stock = false; o.note = "公式ページが見つからない（取り扱い終了の可能性）"; }
      else {
        if (res.price && res.price !== p.price) p.price = res.price;
        if (res.in_stock !== undefined && res.in_stock !== null) o.in_stock = res.in_stock;
        delete o.note;
      }
      o.checked_at = today; if (p.sources[0]) p.sources[0].checked_at = today;
      const after = `¥${p.price} ${o.in_stock}`;
      if (before !== after) { changed++; console.log(`変更 ${d.brand} ${p.name}: ${before} → ${after}${res.gone ? "（ページなし）" : ""}`); }
    } catch (e) { console.warn("確認失敗", p.name, e.message); }
  }
  if (!dry) fs.writeFileSync(`data/master/${f}`, JSON.stringify(d, null, 1));
}
console.log(`確認 ${n}件 / 変更 ${changed}件${dry ? "（dry：保存なし）" : ""}`);
