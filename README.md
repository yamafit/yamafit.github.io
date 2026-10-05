# ヤマフィット AI診断版

| 画面 | ファイル |
|---|---|
| ホーム | index.html |
| 運営記事 | article.html |
| 診断（選択式） | question.html |
| 診断（自由記述） | freetext.html |
| 診断結果 | result.html |

デザインは `css/style.css`（色は先頭の `:root` 変数）、動きは `js/app.js`。

## 起動
```
cd ~/Desktop/ヤマフィット
python3 -m http.server 8000
```
Chrome で http://localhost:8000 を開く。

## スマホ表示で編集する
1. 画面の左半分にエディタ、右半分に Chrome を並べる
2. Chrome で F12（Mac は Cmd+Option+I）→ Cmd+Shift+M でデバイス表示
3. 上部のプルダウンで機種を選ぶ（iPhone 14 など）
4. ファイルを保存したら Chrome を再読み込み（Cmd+R）

## 診断（動く部分）
質問 → 自由記述 → 結果 は、`data/products.json` の商品を回答でスコアリングして3点を表示します（ブラウザ内で完結、AI APIは使いません）。
商品を追加するときは products.json にエントリを足すだけです（brand / name / price / affiliate のURLを埋める）。

## AI ツール（Node.js・ターミナルで実行）
`export ANTHROPIC_API_KEY=...` を設定してから、このフォルダで実行します。`--dry` を付けるとAPIを呼ばずに送る内容だけ確認できます。

| 目的 | コマンド | 出力 |
|---|---|---|
| 1商品 → 記事・比較記事案・Instagram・ショート台本・X | `node tools/generate.mjs <商品id>` | out/<商品id>/ |
| 売れそうな商品のスコア | `node tools/score.mjs` | 表（data/market.json を編集） |
| 週次の分析と改善案 | `node tools/weekly.mjs` | out/weekly.md（data/analytics.csv を編集） |

生成物は必ず自分で読んで直してから公開してください（商品データにない仕様は `[要確認]` になる設定です）。

## 最新記事（1時間ごとに自動更新）
- 取得元：ブランドごとのニュース検索RSS。**タイトルにブランド名が入る記事だけ**を `data/news.json` に保存（タイトル・出典・日時・リンクのみ。本文は転載しない）。
- 対象ブランドの追加・削除：`data/brands.json` を編集。`extra_feeds` に好きなRSSのURLを足せます。
- 手動更新：`node tools/fetch-news.mjs`
- 自動更新：`.github/workflows/news.yml`（GitHub Actions が毎時実行して news.json を保存）。GitHub に置いて Pages で公開する構成が前提です。
- 画面：ホームに新着5件、`news.html` にキーワード検索とブランド絞り込み。

## 編集できるのは運営者だけ
サイトに編集画面はありません。内容を変えられるのは、GitHub のリポジトリに書き込み権限がある人（運営者のみ）です。リポジトリは自分だけに権限を付け、2段階認証を有効にしてください。お問い合わせフォームは受信するだけで、サイトの内容は変えられません。

## ランキング（ホーム）
- 「アクセス」と「購入」の2つをタブで切り替え、上位5件を表示します。数字がまだ無い間は、アクセスは見本の記事一覧、購入は「集計中です」と表示されます。
- 数字の入れ方：`data/access.csv`（GA4のページ別閲覧数）と `data/sales.csv`（ASPの成果レポートから商品ごとの購入数）に貼り（access.csv は `title,url,count`、sales.csv は `title,url,count,category`。category は boots / pack / rain / wear / tent）、`node tools/build-rankings.mjs` を実行すると `data/rankings.json` ができます。
- 購入数は、アフィリエイトの成果が確定した数字を使ってください（クリック数ではありません）。

- カテゴリページには、sales.csv の category ごとに購入数の上位3件を表示します。
- メニューの「ブランド（公式サイトへ）」は、`data/brands.json` の `site` に書いた公式サイトへ飛びます。
