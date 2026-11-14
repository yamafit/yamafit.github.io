# 使い方（かんたん版）

この道具は **Phase 2 で開発を終了**しました。管理画面（ボタンで操作する画面）はありません。
動画を作る方法は、次の2つです。

## 方法1：Claude に頼む（おすすめ）

Claude Code のチャットで、次の3つを送って「動画を作って」と頼みます。

1. 商品の写真（正面と背面。背景が白か透明のもの）
2. 公式の商品ページのURL
3. 紹介したいパーツ（分かる範囲で）

Claude が商品データを作り、30秒の動画（MP4）を書き出してチャットに送ります。
ターミナルの操作は要りません。

## 方法2：自分の Mac で書き出す

ターミナル（Mac に最初から入っているアプリ）で、コマンドを入力します。

### 最初の1回だけ

```sh
# 1. ヤマフィットのフォルダへ移動する（場所が違うときは読み替えてください）
cd ~/Desktop/ヤマフィット

# 2. この道具が入っているブランチに切り替える
git fetch origin
git checkout claude/loving-keller-5zghir

# 3. 道具のフォルダへ移動し、必要なものを入れる
cd tools/yamafit-video
npm install
npx playwright install chromium
```

`ffmpeg` という道具も必要です。`ffmpeg -version` と入力してバージョンが表示されなければ、
[Homebrew](https://brew.sh/ja/) を入れてから `brew install ffmpeg` を実行します。

### 動画を書き出す

```sh
cd ~/Desktop/ヤマフィット/tools/yamafit-video

# サンプル（架空の商品）を書き出す
npm run export -- examples/sample-pack

# サロモン TRAILBLAZER 10 を書き出す
npm run export -- projects/salomon-trailblazer-10
```

書き出しが終わると、`tools/yamafit-video/out/` に MP4 ができます（開発用のクラウド環境では6〜7分かかりました。Mac での時間は測っていません）。
Finder でそのフォルダを開き、ダブルクリックで再生できます。

### 別の商品の動画を作る

1. `projects/salomon-trailblazer-10` フォルダをコピーして、名前を変える（例：`projects/gregory-zulu-30`）。
2. 中の `project.json` をテキストエディタで開き、商品名・メーカー・型番・特徴・パーツを書き換える。
3. 写真を `images/` に入れる（`front.webp` などの名前は `project.json` の `images` に合わせる）。
4. `npm run export -- projects/gregory-zulu-30` を実行する。

`project.json` の形（`model.shape`）は、商品ごとに写真から数値を決める必要があり、手作業では難しい部分です。
形を合わせない場合は、`"model": { "kind": "placeholder-pack", ... }`（どの商品にも同じ仮の形）にします。
書き方は `examples/sample-pack/project.json` が見本です。

## できること・できないこと

| できること | できないこと |
|---|---|
| 30秒の縦型動画（1080×1920、MP4）を書き出す | 音（ナレーション、BGM）を入れる |
| 商品名・特徴・パーツ名と役割・まとめの文字を入れる | ボタンで操作する管理画面 |
| パーツを分解して1つずつ紹介する | GitHub 上のボタンで書き出す |
| 商品写真を「実物写真」として入れる | 写真のようにリアルな3D（下の注意を参照） |

## 3Dの見た目についての注意

3Dモデルは、2枚の写真と公式の寸法から作った**近似の形**です。
色は1色で、ロゴ・縫い目・ジッパー・生地の質感は入っていません。そのため、**実物のようには見えません。**

リアルに見せるには、実物をスキャンした3Dモデルが必要です。この道具の延長では実現できません。
書き出した動画には「検証用・公開不可」の透かしが入ります。

## GitHub で見るには

この道具は `main` ではなく、`claude/loving-keller-5zghir` というブランチにあります。
GitHub を開いただけでは `main` が表示されるので、見つかりません。次のリンクから開いてください。

- 道具のフォルダ：https://github.com/yamafit/yamafit.github.io/tree/claude/loving-keller-5zghir/tools/yamafit-video
- この使い方：https://github.com/yamafit/yamafit.github.io/blob/claude/loving-keller-5zghir/tools/yamafit-video/docs/USAGE.md

動画（MP4）は GitHub には置いていません。Claude のチャットに送られたファイルか、自分の Mac の `out/` フォルダで見ます。
