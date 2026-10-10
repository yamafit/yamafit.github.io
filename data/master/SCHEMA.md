# 商品マスター（data/master/<ブランド>.json）

1ブランド1ファイル。`{ "brand": "モンベル", "products": [ ... ] }`。
サイトが読む `data/products.json` は、`node tools/build-products.mjs` がここから作る（手で編集しない）。

## 商品1件の項目

| 項目 | 型・単位 | 内容 |
|---|---|---|
| id | 文字列 | `ブランド-商品名` の英数字。重複しない |
| brand / name | 文字列 | 公式表記 |
| category | 選択 | boots / pack / poles / rain / wear / pants / tent |
| gender | 選択 | unisex / mens / womens |
| price | 数値(円・税込) or null | 公式ページの価格。不明は null |
| capacity_l | 数値(L) or null | ザックの容量 |
| weight_g | 数値(g) or null | 重量。測定条件は weight_note に（例：25.5cm・片足） |
| material | 文字列 or null | 公式記載の素材 |
| waterproof | 文字列 or null | 公式記載（例：GORE-TEX）。無記載は null |
| waterproof_level | 選択 or null | none / water_repellent / waterproof（公式記載にもとづく） |
| warmth | 文字列 or null | 公式記載の保温性（保温材の有無・中綿量など） |
| size_note | 文字列 or null | サイズ展開（例：22.0〜29.0cm） |
| sources | 配列 | 情報源 `{ "url": "...", "checked_at": "YYYY-MM-DD" }`。最低1件 |
| image | 物体 | `{ "url", "angle", "src_page", "checked_at", "ok" }`。angle は side / front / three_quarter / flat など |
| offers | 配列 | 販売先ごと。下記 |
| evaluation | 物体 | AI評価の項目（下記）。公式の事実から導いた判断のみ |

**分からない項目は null（画面では「不明」）。推測で埋めない。**

## offers（販売先は複数持てる）
`{ "shop": "official|amazon|rakuten|yahoo", "url": "商品ページ", "affiliate_url": "アフィリエイトURL（未取得は空）", "in_stock": true|false|null, "checked_at": "YYYY-MM-DD", "note": "（任意）ページが消えた等" }`
- `in_stock: null` は「未確認」。サイトの購入先シートは、在庫あり → 未確認 → 在庫なし の順に並べ、アフィリエイトURLがあるものはそれを、なければ公式URLを使う。
- どこにも在庫がない場合は、「在庫なし」と表示し、公式ページへのリンクと、同じカテゴリの代わりの商品を出す。

## evaluation（AIが事実から判断した項目）
`{ "by": "claude", "at": "YYYY-MM-DD", "season": ["spring","summer","autumn","winter"], "uses": ["low","mid","hut","tent","winter","town"], "concerns": ["knee","sweat","cold","budget","light"], "fit": "サイズ感", "summary": "1文の要約", "pros": [], "cons": [], "good_for": [], "not_for": [], "concern_reasons": { "knee": "理由" } }`
- 事実（価格・重量など）に書かれていない性能は書かない。わからない評価は空配列にする。

## 更新の流れ
- 取り込み：`tools/collect-montbell.mjs`（モンベル）、`tools/collect-shopify.mjs`（サロモン・マーモット・メレル）、`tools/collect-generic.mjs`（その他）が、公式ページの記載を `data/raw/<ブランド>.json` に保存する。
- 変換：`tools/master-*.mjs` が raw と評価（`data/evals/`）から `data/master/<ブランド>.json` を作る。
- 価格・在庫の更新：`node tools/refresh-offers.mjs`（毎日、`.github/workflows/master.yml` が実行）。
- 画像の確認：`node tools/check-images.mjs`（表示できない画像は `image.ok: false` になり、サイトは仮の枠を出す）。
- サイト用データ：`node tools/build-products.mjs` が `data/products.json` を作る。
