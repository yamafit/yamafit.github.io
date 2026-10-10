// 使い方: node tools/sitemap.mjs <sitemap URL> [絞り込み正規表現]   サイトマップ（入れ子対応）からURLを列挙する
const [root, filter] = process.argv.slice(2);
const re = filter ? new RegExp(filter) : null;
const seen = new Set(), urls = [];
async function walk(u, depth = 0) {
  if (seen.has(u) || depth > 3 || seen.size > 60) return; seen.add(u);
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
    let t = await r.text();
    if (u.endsWith(".gz")) return;
    for (const m of t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const loc = m[1].replace(/&amp;/g, "&");
      if (/\.xml(\.gz)?(\?.*)?$/.test(loc) || /sitemap/i.test(loc) && /xml/.test(loc)) await walk(loc, depth + 1);
      else if (!re || re.test(loc)) urls.push(loc);
    }
  } catch (e) { console.error("ERR", u, e.message); }
}
await walk(root);
console.log(`# ${urls.length} urls (sitemaps: ${seen.size})`);
console.log(urls.slice(0, Number(process.env.N || 12)).join("\n"));
