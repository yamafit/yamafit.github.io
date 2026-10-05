// 使い方: node tools/fetch-news.mjs
// ブランドごとにニュース検索のRSSを取得し、タイトルにブランド名（別名含む）が入る記事だけを data/news.json に保存する。
// 保存するのは「タイトル・出典・日時・元記事リンク」のみ（本文は転載しない）。
import fs from "node:fs";
import { readJson } from "./lib.mjs";

const { brands, extra_feeds = [] } = readJson("data/brands.json");
const MAX_AGE_DAYS = 60, MAX_ITEMS = 300;

const decode = (s) => s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]).trim() : ""; };
const norm = (s) => s.normalize("NFKC").toLowerCase();

function parse(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    let title = tag(it, "title"), source = tag(it, "source");
    // Googleニュースは「タイトル - 出典」の形
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    const d = new Date(tag(it, "pubDate"));
    return { title, url: tag(it, "link"), source, date: isNaN(d) ? null : d.toISOString() };
  }).filter((x) => x.title && x.url && x.date);
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "yamafit-news/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const jobs = [
  ...brands.map((b) => ({ brand: b, url: `https://news.google.com/rss/search?q=${encodeURIComponent('"' + b.name + '"')}+when:7d&hl=ja&gl=JP&ceid=JP:ja` })),
  ...extra_feeds.map((url) => ({ brand: null, url })),
];

const found = new Map();
for (const job of jobs) {
  try {
    for (const it of parse(await get(job.url))) {
      const hay = norm(it.title);
      const hits = brands.filter((b) => [b.name, ...b.aliases].some((a) => hay.includes(norm(a)))).map((b) => b.name);
      if (!hits.length) continue; // タイトルにブランド名が無い記事は載せない
      const key = norm(it.title);
      if (!found.has(key)) found.set(key, { ...it, brands: hits });
    }
  } catch (e) { console.warn("取得失敗:", e.message); }
}

// 既存データと合算（取得に失敗した回でも消えないように）
let old = [];
try { old = readJson("data/news.json").items; } catch {}
for (const it of old) if (!found.has(norm(it.title))) found.set(norm(it.title), it);

const limit = Date.now() - MAX_AGE_DAYS * 864e5;
const items = [...found.values()].filter((x) => new Date(x.date) >= limit)
  .sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ITEMS);

fs.writeFileSync("data/news.json", JSON.stringify({ updated: new Date().toISOString(), items }, null, 2));
console.log(`保存: ${items.length}件`);
