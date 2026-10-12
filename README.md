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

## 商品ページ・商品一覧・今週のおすすめ・Instagram素材

- **商品詳細ページ**: `node tools/build-product-pages.mjs` が `data/master/*.json` から `products/<id>.html` を作る（基本情報／主な特徴／メーカー公表の仕様／ヤマフィットの評価／参考情報源と確認日／購入先）。仕様は公式の記載のみ。記載がない項目は「不明」。メディア・ユーザーの評価は未収集で、その旨を明記している。購入リンクは js/shop.js が表示時に作る（未確認のURLは作らず「未設定」）。
- **商品一覧** `products.html`（js/products.js）: 商品名・ブランドの検索、カテゴリー（アウター／ザック／シューズ ほか）、ブランドの複数選択、価格帯、ゴアテックス。条件は URL に残る。**絞り込みを足す**ときは js/products.js の `FILTERS` に1つ書き足す（重量・防水・容量など）。
- **今週のおすすめ**: `data/featured.json` を運営者が編集する（`items` の id と順番、`comment` は空なら商品の要約）。記事を公開しても自動では載らない。
- **ランキング**: 順位はアクセス数・購入数の集計だけで決め、アフィリエイト報酬は使わない（画面にも明記）。
- **Instagram素材**: `node tools/instagram.mjs <商品ID|記事のslug>` → `out/instagram/<名前>.md`（キャプション・カルーセル構成・見出し・ハッシュタグ候補）。数字は商品マスターから取る。投稿は手動。`SITE.instagramUrl` を入れると商品ページに導線が出る。
- 更新の流れ: マスター更新 → `node tools/build-products.mjs` → `node tools/build-product-pages.mjs` → `node tools/build-articles.mjs`（sitemap も更新）。


## ブランドと商品の対象（24ブランド）

ブランドは CAMP HACK「アウトドアウェアの人気ブランド24選」（https://camphack.nap-camp.com/12815）に合わせた24社（`data/brands.json`）。
商品は、各ブランドの**公式ページに書かれた事実だけ**を取り込む。記載がない項目は「不明」。

- 取り込み: `tools/collect-montbell.mjs`（モンベル）／`tools/collect-shopify.mjs`（Shopify系：マーモット・ミレー・アークテリクス・ワイルドシングス・ナンガ・KAVU）／`tools/collect-list.mjs`・`tools/collect-generic.mjs`（その他。一覧または検索で見つけた公式の商品ページ）
- 評価の作成: `node tools/eval-auto.mjs <slug> [--only …] [--exclude …] [--per-cat N] [--price first|ld|max] [--map "…=カテゴリ"]` が `data/evals/<slug>.json` を作る。**記載から導ける範囲だけ**を書く（弱点などが読み取れないときは「不明」）。→ `node tools/master-generic.mjs <slug> <表示名>` → `node tools/validate-master.mjs` → `node tools/build-products.mjs` → `node tools/build-product-pages.mjs` → `node tools/build-articles.mjs`
- 商品の毎日追加（.github/workflows/products-daily.yml、毎日3:00）：Shopify製の公式ストア（ミレー・アークテリクス・ワイルドシングス・ナンガ・KAVU）の商品一覧から未取り込みの商品だけを data/raw に足し、`sh tools/build-brands.sh` で評価→マスター→商品ページを作り直す。1カテゴリーの上限は build-brands.sh の --per-cat。
- 価格・在庫の毎日更新: `tools/refresh-offers.mjs`（取り込み時と同じ価格の読み方にそろえている）
- サロモン・メレルは24社に含まれないため、`data/archive/` に退避した（サイトには出ない）。

### 取り込めていないブランド（理由）
- チャムス: 商品ページが画面表示後に読み込まれる方式で、公式ページの記載を取得できない。
- ロゴス: 公式サイトがプログラムからのアクセスを拒否している（403）。
- ホグロフス: 公式サイトがJavaScriptで描画する方式で、取得できない。
- グリップスワニー・クリフメイヤー: 公式サイトのURLを確認できていないため、メニューの公式サイトリンクも空にしている。
これらは、公式サイトの許可を得た取得方法（楽天APIなど）が使えるようになってから追加する。

## 毎朝の記事写真と Instagram 投稿（.github/workflows/daily-image.yml）
- 日本時間6:35ごろ（取りこぼしは12:35まで1時間ごとに再実行）に、今日の自動記事（content/auto-articles.json）の写真を作り、7:00 に Instagram に投稿する（7時前に写真ができたら7時まで待つ）。
- 参照画像：記事を書いたAIが公式ページで調べて選んだ `ref_images`（main＝商品全体1枚、detail＝記事で触れた部位の細部写真3枚まで）を優先。無ければ商品マスターの image.url、さらに無ければ公式ページの og:image。detail は細部確認用として画像生成に一緒に渡す。
- 写真：参照画像 → 参照シート → プロンプト工房と同じ文面で OpenAI の画像生成（既定 gpt-image-2、1280×1600）。`img/articles/<slug>.jpg` に保存し、記事に「AIで作成したイメージ」と明記して載せる。
- プロンプトの文面は `tools/kobo-core.js`（靴・ザック・ウェア）。変えたら `node tools/build-kobo.mjs --check` と `node tools/build-kobo.mjs` でアーティファクト用のページも作り直す。
- 投稿：写真＋記事の要点＋記事URL＋#PR。楽天リンクは入れない。ハッシュタグはブランド（日本語・英語）＋商品名＋よく検索される登山タグ10個＋#ヤマフィット（tools/daily-image-post.mjs の hashtags）。記録は `data/ig-posts.json`。
- 必要な Secrets：`OPENAI_API_KEY`、`INSTAGRAM_ACCESS_TOKEN`。未登録なら警告を出して何もしない。
- 手動：Actions →「朝の記事写真とInstagram投稿」→ Run workflow（slug を入れるとその記事）。
