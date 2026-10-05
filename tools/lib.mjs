import fs from "node:fs";
export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const MODEL = "claude-sonnet-5-5";

export async function askClaude(prompt, { system = "", maxTokens = 2000 } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("環境変数 ANTHROPIC_API_KEY が未設定です（--dry なら不要）");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.map((b) => b.text ?? "").join("");
}

// アフィリエイトサイトとして守るルール（全プロンプト共通）
export const SYSTEM = `あなたは登山装備サイト「ヤマフィット」の編集者です。
- 商品データに書かれていない仕様・数値・価格・口コミを作らない。不明なら「[要確認]」と書く。
- 効果の断定（「絶対」「必ず」）をしない。安全に関わる内容は、最新の気象とルート確認を促す。
- 広告を含む記事には冒頭に「PR」の一行を入れる。
- 文体はです・ます調。初心者に近い目線で、短い文で書く。`;
