// 使い方: node tools/probe.mjs <商品ページURL> [--full]
// 公式ページのHTMLを直接取得し、og:image・タイトル・JSON-LD・仕様まわりの本文を表示する（要約モデルを通さない）。
const url = process.argv[2];
const full = process.argv.includes("--full");
const linksIdx = process.argv.indexOf("--links");
const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "ja" }, redirect: "follow" });
const html = await res.text();
const meta = (p) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`, "i")) || [])[1];
if (linksIdx > 0) { // 一覧ページから商品リンクを抜き出す: --links <正規表現>
  const re = new RegExp(process.argv[linksIdx + 1]);
  const seenL = new Set();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g)) {
    const href = new URL(m[1].replace(/&amp;/g, "&"), res.url).href;
    if (re.test(href) && !seenL.has(href)) { seenL.add(href); console.log(href, "|", m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)); }
  }
  process.exit(0);
}
console.log("STATUS", res.status, res.url);
console.log("TITLE ", (html.match(/<title[^>]*>([^<]*)/i) || [])[1]?.trim());
console.log("OGIMG ", meta("og:image"));
console.log("OGDESC", meta("og:description"));
for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
  try { const j = JSON.parse(m[1]); const arr = Array.isArray(j) ? j : j["@graph"] || [j];
    for (const x of arr) if (/Product/.test(JSON.stringify(x["@type"]))) console.log("LDJSON", JSON.stringify({ name: x.name, image: x.image, sku: x.sku, offers: x.offers, brand: x.brand }).slice(0, 700)); } catch {}
}
const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/g, " ")
  .replace(/<br\s*\/?>|<\/(p|div|li|tr|th|td|h\d|dt|dd)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&yen;/g, "¥").replace(/[ \t　]+/g, " ").split("\n").map((s) => s.trim()).filter(Boolean);
const KEY = /(価格|円|税込|重量|重さ|g\b|素材|表地|アッパー|ソール|防水|ゴアテックス|GORE|保温|中綿|サイズ|カラー|シーズン|用途|容量|ℓ|L\b|在庫|SOLD|完売|カートに|仕様|機能|特徴)/;
const seen = new Set();
const out = (full ? text : text.filter((l) => KEY.test(l) && l.length < 200)).filter((l) => (seen.has(l) ? false : seen.add(l)));
console.log("---- TEXT", out.length, "lines");
console.log(out.slice(0, full ? 400 : 45).join("\n"));
