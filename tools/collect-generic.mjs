// 使い方: node tools/collect-generic.mjs <ブランドslug> <category> <URL> [<URL>...]
// 商品ページのHTMLを直接取得し、JSON-LD / og:meta / 本文から「書かれている事実」だけを data/raw/<slug>.json に追記する。
import fs from "node:fs";
const [slug, cat, ...urls] = process.argv.slice(2);
const path = `data/raw/${slug}.json`;
const out = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
const today = new Date().toISOString().slice(0, 10);
const dec = (s) => (s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&reg;/g, "®").replace(/&trade;/g, "™").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const toText = (html) => dec(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/g, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|th|td|h\d|dt|dd|span)>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t　]+/g, " ").split("\n").map((s) => s.trim()).filter(Boolean);
const meta = (html, p) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`, "i")); return m ? dec(m[1]) : null; };
const uniq = (a) => [...new Set(a)];

const DELAY = Number(process.env.DELAY || 1500);
const BLOCKED = /Hang Tight|Routing to checkout|Access Denied|Just a moment|Attention Required|Robot|ロボット/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const url of urls) {
  await sleep(DELAY);
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "ja,en;q=0.5" }, redirect: "follow", signal: AbortSignal.timeout(30000) });
    let html = await r.text();
    for (let t = 0; t < 2 && BLOCKED.test((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || ""); t++) { await sleep(DELAY * 3); html = await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "ja,en;q=0.5" }, signal: AbortSignal.timeout(30000) })).text(); }
    if (BLOCKED.test((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || "")) { console.warn("blocked(制限の画面):", url); continue; }
    let ld = null;
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      try { const j = JSON.parse(m[1]); const arr = Array.isArray(j) ? j : j["@graph"] || [j]; for (const x of arr) if (/Product/.test(JSON.stringify(x["@type"] || ""))) ld = ld || x; } catch {}
    }
    const offers = ld ? [].concat(ld.offers && ld.offers.offers ? ld.offers.offers : ld.offers || []) : [];
    let prices = uniq(offers.map((o) => Number(o.price || (o.priceSpecification || {}).price)).filter((n) => n > 0));
    let avail = offers.map((o) => String(o.availability || "").split("/").pop());
    if (!prices.length) prices = uniq([...html.matchAll(/"price"\s*:\s*"?(\d{3,7})(?:\.\d+)?"?/g)].map((m) => Number(m[1])).filter((n) => n >= 500));
    if (!avail.length) avail = uniq([...html.matchAll(/"availability"\s*:\s*"[^"]*?(InStock|OutOfStock|SoldOut|PreOrder|LimitedAvailability)"/g)].map((m) => m[1]));
    const lines = toText(html);
    const pick = (re, max = 4) => uniq(lines.filter((l) => re.test(l) && l.length < 240)).slice(0, max);
    const og = meta(html, "og:image");
    const img = (ld && (Array.isArray(ld.image) ? ld.image[0] : typeof ld.image === "object" && ld.image ? ld.image.url : ld.image)) || og;
    const key = new URL(r.url).pathname + new URL(r.url).search;
    out[key] = {
      url: r.url, category: cat, status: r.status,
      name: dec((ld && ld.name) || meta(html, "og:title") || (html.match(/<title[^>]*>([^<]*)/i) || [])[1] || "").trim(),
      title: dec((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || "").trim(),
      price_min: prices.length ? Math.min(...prices) : null, price_max: prices.length ? Math.max(...prices) : null,
      price_text: pick(/[¥￥][\d,]{3,}|[\d,]{3,}円/, 3),
      availability: avail.length ? uniq(avail) : null,
      image: img || null, og_image: og,
      desc: ((ld && ld.description) ? dec(String(ld.description)).replace(/<[^>]+>/g, " ") : meta(html, "og:description") || meta(html, "description") || "").replace(/\s+/g, " ").slice(0, 400),
      weight_labeled: (() => { const i = lines.findIndex((l) => /^(重さ|重量|平均重量|Weight)$/.test(l)); return i >= 0 && /[\d.,]+\s?(g|kg)/i.test(lines[i + 1] || "") ? lines[i + 1] : null; })(),
      weight: pick(/(重量|重さ|Weight|[\d.,]+\s?(g|kg)\b)/i, 5),
      material: pick(/(素材|表地|Material|ナイロン|ポリエステル|ゴアテックス|GORE|レザー|革)/i, 5),
      waterproof: pick(/(防水|耐水|waterproof|GORE|ゴアテックス)/i, 4),
      warmth: pick(/(保温|中綿|ダウン|フィルパワー|insulat|PrimaLoft|プリマロフト)/i, 3),
      size: pick(/(サイズ|容量|\d+\s?L\b|Size)/i, 4),
      checked_at: today,
    };
    const o = out[key];
    console.log(`${cat} | ${o.name.slice(0, 50)} | ¥${o.price_min ?? "?"}${o.price_max !== o.price_min ? "-" + o.price_max : ""} | ${o.availability ? o.availability.join(",") : "在庫不明"} | img:${o.image ? "有" : "無"} | ${r.url.slice(0, 80)}`);
  } catch (e) { console.warn("skip", url, e.message); }
}
fs.writeFileSync(path, JSON.stringify(out, null, 1));
