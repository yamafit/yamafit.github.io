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
- 数字の入れ方：`data/access.csv`（GA4のページ別閲覧数）と `data/sales.csv`（ASPの成果レポートから商品ごとの購入数）に貼り（access.csv は `title,url,count`、sales.csv は `title,url,count,category`。category は boots / pack / rain / wear / pants / tent）、`node tools/build-rankings.mjs` を実行すると `data/rankings.json` ができます。
- 購入数は、アフィリエイトの成果が確定した数字を使ってください（クリック数ではありません）。

- カテゴリページには、sales.csv の category ごとに購入数の上位3件を表示します。
- メニューの「ブランド（公式サイトへ）」は、`data/brands.json` の `site` に書いた公式サイトへ飛びます。

## AIのおすすめ（カテゴリページに3つ）
- `node tools/recommend.mjs` が、カテゴリごとに最大3つを選んで `data/recommendations.json` に保存します（`.github/workflows/recommend.yml` が毎朝6時に自動実行）。
- 材料：今の季節（商品の `season`）、商品ごとのクリック数（`data/clicks.csv` の `id,clicks`）、購入数（`data/rankings.json`）。
- AIキーがある場合は Claude が選んで理由を書き、無い場合は同じ材料の点数で選びます。AIを使うには、GitHub の Settings → Secrets and variables → Actions に `ANTHROPIC_API_KEY` を登録します。
- 「学習」といっても、モデルを再訓練するのではなく、毎回その時点のデータを材料にして選び直す仕組みです。データが貯まるほど、おすすめが傾向に沿っていきます。

## 商品マスター
- 設計と項目は `data/master/SCHEMA.md`。ブランドごとの商品は `data/master/<ブランド>.json`（サイトが読む `data/products.json` はここから作られる）。
- スペックは公式ページの記載だけを使い、書かれていない項目は `null`（画面では「不明」）。各商品に情報源URLと確認日（`sources`）を残している。
- 価格と在庫は毎日自動で確認し直す（`.github/workflows/master.yml` → `tools/refresh-offers.mjs`）。ページが消えた商品は「在庫なし」になり、`note` に残る。
- 購入先シート（商品をクリック）は、`offers` の在庫あり → 未確認 → 在庫なし の順に並べ、アフィリエイトURLがあればそちらへ、無ければ公式サイトへ誘導する。どこにも在庫がないときは「在庫なし」と表示し、同じカテゴリで在庫のある近い商品を2つ出す。
- 商品の写真は、各公式サイトの画像URLをそのまま参照している（`image.url`）。表示できない場合は仮の枠に切り替わる。権利面は運営者の確認が必要（`node tools/check-images.mjs` で表示可否を確認）。
- アフィリエイトURLは `offers[].affiliate_url` に入れる（ASP登録後）。


## A8.net 審査前チェックリスト

公開前に運営者が行うこと（コードでは解決できないもの）:

1. **お問い合わせ先を設定**: `js/site.js` の `contactFormEmbed`（Googleフォームの埋め込みURL）か `formUrl`（Formspree等）のどちらかを入れる。未設定だと送信時にエラー表示になる。入れたら実際に送信して届くか確認。
2. **記事を自分の言葉で確認・加筆**: `content/articles.mjs` の11本は下書き。自分の体験・写真を足して `node tools/build-articles.mjs`。
3. **画像**: 公式画像の直リンクは既定でオフ（`PRODUCT_IMAGES=1 node tools/build-products.mjs` で再度オン）。トップ画像（img/hero.jpg）の権利も確認。
4. **GA4**: 使うなら `ga4Id` を入れる（プライバシーポリシーは「利用することがあります」表記）。
5. **Amazonアソシエイト**に参加した後で、プライバシーポリシーに指定文言を追記する。
6. 承認後、`data/master/*.json` の `offers[].affiliate_url` にA8の広告リンクを入れ、`node tools/build-products.mjs`。

公開: `git add . && git commit -m "A8審査準備" && git pull --rebase && git push`
