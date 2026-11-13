# YAMA FIT 商品紹介3D動画制作システム

商品情報とパーツ情報から、30秒の縦型動画（1080×1920）を書き出すための道具です。
計画の全体は [docs/PLAN.md](docs/PLAN.md)、各フェーズの結果は `docs/PHASE*.md` にあります。

## いまの状態（Phase 1 まで完了）

| できること | 状態 |
|---|---|
| 30秒・900フレームの映像をMP4に書き出す（音声なし） | できる |
| 書き出したMP4を自動で検証する（解像度・尺・コーデックなど） | できる |
| 同じ入力から同じフレームが出ることを確かめる | できる |
| 商品写真を「実物写真」のカードとして動画に表示する | できる |
| 文字（商品名・特徴・パーツの説明）、ロゴ | Phase 2 |
| ナレーション、BGM | Phase 3 |
| 管理画面 | Phase 4 |
| クラウド（GitHub Actions）での書き出し | Phase 5 |

**3Dは仮モデルです。** 箱や帯を組み合わせた形で、実物の形・ロゴ・素材感は再現していません。
書き出した動画には「検証用・公開不可」の透かしが入ります。

## 必要なもの

- Node.js 22.18 以上
- ffmpeg と ffprobe（`ffmpeg -version` で確認できます）
- 書き出し用のブラウザ（初回だけ `npx playwright install chromium` で入れます）

## 使い方

```sh
cd tools/yamafit-video
npm install

# サンプル（架空の商品）を30秒のMP4に書き出す。out/ に保存される
npm run export -- examples/sample-pack

# 一部だけ書き出す（0〜89フレーム＝3秒）。決めた時刻の静止画も保存する
npm run export -- examples/sample-pack --frames 0-90 --stills 0,2.5

# 同じ入力から同じフレームが出るかを確かめる（2回書き出して比べる）
npm run verify -- examples/sample-pack

# テスト
npm test            # 計算部分のテスト（数秒）
npm run test:e2e    # 実際に書き出して確かめるテスト（約20秒）
npm run typecheck   # 型チェック
```

書き出しが終わると、次のファイルができます。

| ファイル | 内容 |
|---|---|
| `out/yamafit_{型番}_{YYYYMMDD}.mp4` | 動画。同じ名前があれば `_2`、`_3` が付く |
| `out/yamafit_…​.report.json` | 検証結果、所要時間、描画環境、全フレームのハッシュ値 |
| `out/yamafit_…​_stills/` | `--stills` で指定した時刻の静止画 |

## プロジェクト（商品1つぶんのデータ）

1商品＝1フォルダで、その中の `project.json` に商品情報・パーツ・演出の設定を書きます。
書き方の見本は [examples/sample-pack/project.json](examples/sample-pack/project.json) です（架空の商品）。

実在の商品のプロジェクトは `projects/<ID>/` に置きます。

```
projects/salomon-trailblazer-10/
  project.json   商品情報・パーツ・色・演出の設定（Gitに入れる）
  README.md      各項目の根拠（公式ページのどの記載から取ったか）
  images/        商品写真（Gitには入れない）
```

### 商品写真の入れ方

1. 写真を `projects/<ID>/images/` に置く（JPEG・PNG・WebP）。
2. `project.json` の `images` に、ファイル名と向き（`front` 正面／`back` 背面／`side` 側面／`detail` 細部）を書く。

```json
"images": [
  { "file": "images/front.webp", "view": "front" },
  { "file": "images/back.webp", "view": "back" }
]
```

写真は2つの使い方をします。

- **色の参考**：写真から主要な色を取り出し、`model.colors` に入れます（いまは手作業。管理画面では自動になります）。
- **実物写真のカード**：動画の中に「実物写真」と明記して表示します。3Dモデルには貼りません。表示したくないときは `"direction": { "showPhotos": false }` と書きます。

写真は公開リポジトリに入れないよう、Gitの対象から外してあります。写真がない環境で書き出すと、カードは表示されず、注意が出ます。
メーカーの公式画像を使う場合は、動画を公開する前に利用条件を確認してください。

守っていること：

- 描かれるのは、`parts` に登録され、`confirmed: true`（実物にあると確認した）のパーツだけです。未登録のパーツは、仮モデルからも消えます。
- 候補にないパーツIDは受け付けません。
- 特徴や役割の文は、入力した文をそのまま使います。システムが文を作ることはありません。

## フォルダ構成

```
src/core/     画面にもサーバーにも依存しない計算（データの検証、タイムライン、ファイル名）
src/stage/    three.js の描画（仮モデル、照明、背景、透かしの合成）
src/render.ts 書き出し専用ページ
server/       書き出し（ヘッドレスChromium → PNG → ffmpeg）、検証、コマンド
tests/        ユニットテスト（unit）と、実際に書き出すテスト（e2e）
assets/       フォント、ロゴ、BGM
examples/     サンプルのプロジェクト
docs/         計画書と各フェーズの結果
```

## 再現性のための決まり

描画は「プロジェクトの内容と時刻 t だけ」で決まるように作っています。

- 前のフレームの結果を使わない（500フレーム目だけを描いても、通しで描いても同じ絵になる）
- 描画の中で、現在時刻・経過時間・乱数を使わない
- フォントとモデルを読み込み終えてから1フレーム目を描く
- フォントは同梱のファイルを使い、外部には取りに行かない

同じ環境（同じ Chromium、同じ描画方式）なら、画素が完全に一致します。
MacのGPU描画とクラウドのソフトウェア描画では、見た目は同じでも画素単位では一致しません。
`YF_GL=software` を付けて実行すると、GPUがあってもソフトウェア描画に固定できます。

## 環境変数

| 名前 | 用途 |
|---|---|
| `FFMPEG_PATH` / `FFPROBE_PATH` | ffmpeg / ffprobe の場所（PATHにない場合） |
| `YF_CHROMIUM_PATH` | 書き出しに使う Chromium の場所（指定しなければ Playwright のものを使う） |
| `YF_GL=software` | ソフトウェア描画に固定する |
