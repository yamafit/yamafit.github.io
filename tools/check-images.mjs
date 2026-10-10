// 使い方: node tools/check-images.mjs   マスターの画像URLが実際に表示できるか確認し、image.ok に記録する
import fs from "node:fs";
const today = new Date().toISOString().slice(0, 10);
let ok = 0, ng = 0;
for (const f of fs.readdirSync("data/master").filter((x) => x.endsWith(".json"))) {
  const path = `data/master/${f}`;
  const d = JSON.parse(fs.readFileSync(path, "utf8"));
  for (const p of d.products) {
    try {
      const r = await fetch(p.image.url, { headers: { referer: "https://yamafit.github.io/", "user-agent": "Mozilla/5.0" }, redirect: "follow" });
      p.image.ok = r.ok && (r.headers.get("content-type") || "").startsWith("image/");
      await r.body?.cancel();
    } catch { p.image.ok = false; }
    p.image.checked_at = today;
    p.image.ok ? ok++ : (ng++, console.log("NG:", p.id, p.image.url));
  }
  fs.writeFileSync(path, JSON.stringify(d, null, 1));
}
console.log(`画像 OK ${ok} / NG ${ng}`);
