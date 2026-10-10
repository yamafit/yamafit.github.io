// 使い方: node tools/show-raw.mjs <slug>   rawの内容を評価用に短く表示
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(`data/raw/${process.argv[2]}.json`, "utf8"));
for (const [k, v] of Object.entries(d)) {
  if (/404|Not Found|Hang Tight/i.test(v.name)) continue;
  const pr = v.price_text.map((x) => (x.match(/[¥￥]\s?[\d,]+/) || [])[0]).filter(Boolean)[0];
  console.log(`## ${k.replace(/[?&]create_s_(key|token)=[^&]*/g, "")}|${v.category}|${v.name.replace(/｜.*|\|.*/, "").slice(0, 60)}|${pr || ""} ${v.price_min ?? ""}-${v.price_max ?? ""}|${(v.availability || []).join("/")}`);
  console.log("  D:", (v.desc || "").replace(/^【[^】]*】/, "").slice(0, Number(process.env.D || 220)));
  if (v.weight_labeled) console.log("  W:", v.weight_labeled);
  else if (v.weight.length) console.log("  w:", v.weight.filter((x) => /\d/.test(x) && x.length < 90).slice(0, 2).join(" ; "));
  const m = v.material.filter((x) => x.length < 150 && !/レビュー|購入|満足/.test(x)).slice(0, Number(process.env.M || 2));
  if (m.length) console.log("  M:", m.join(" ; "));
}
