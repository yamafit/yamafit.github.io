#!/bin/sh
# 使い方: sh tools/build-brands.sh   data/raw/<slug>.json（公式ページの記載）→ evals → data/master/<slug>.json を、ブランドごとの条件で作り直す。
# 条件（--only / --exclude など）を変えたいブランドは、この行を編集する。モンベル・TNF・コロンビア・パタゴニア・MHW・マムート・マーモットは手書きの評価（data/evals）を使うため対象外。
set -e
e() { slug=$1; name=$2; shift 2; node tools/eval-auto.mjs "$slug" "$@" | tail -1; node tools/master-generic.mjs "$slug" "$name"; }
e wildthings ワイルドシングス --only "ハードシェル|マシーフ|ソフトシェル|ウィンドパーカー|スタンドアップ|ブースター|プリマロフトエボルブフーディー|デナリ|ビバーク|バルキーフリース"
e millet ミレー --per-cat 8
e arcteryx アークテリクス --per-cat 8
e snowpeak スノーピーク --price ld --per-cat 12 --map "ランドロック|リビングシェル|オフトン|SSシングル=tent" --only "ランドロックX$|^ランドロック$|リビングシェル \[|SSシングル|コンパクトオフトン|オフトン シングル|DOWN JACKET|Down Jacket|Down Parka|Insulated|DOWN JKT|Down Collarless|Hoodie" --exclude "ペグ|ステーク|ハンマー|ピロー|グランドシート|ルーフ|フライカバー|マットシート|ウォームアダプター|Cooling|ロープ|インナーマット|ZIP-UP|TAKIBI|Shirt|Vest"
e coleman コールマン --price ld --per-cat 14
e nanga ナンガ --price ld --per-cat 12 --only "オーロラテックス ライト|ドライドレイト|リバイブ|ミニマリスム ゼロ|ソナエバッグ 350DX|ライコット|ダウンパーカ|ダウンベスト|ウィンドレックス|ヒノック マウンテン|ウェザー シールド|オーロラテックス ダウンパンツ|ミニマリスム ダウンパンツ" --exclude "インナー|シーツ|ピロー|カバー|ストレージ|ギフト|Tシャツ|キッズ|Re:ACT|LEVEL8|South2|Alpha"
e workman ワークマン --price ld --per-cat 12
e karrimor カリマー --price first --per-cat 6
e hellyhansen ヘリーハンセン --price max --per-cat 10 --strip "^【公式[^】]*】|｜ヘリーハンセン公式ストア|\\s*-\\s*ヘリーハンセン公式ストア"
e kavu KAVU --only "バラノフ|チリワックパンツ|ナイロンパンツ|シェルテックパンツ|ポーラテック|ダック NW|ノースウエスト|ボアジャケット" --per-cat 8 --strip "^カブー\\s*"
e llbean エルエルビーン --price first --per-cat 8 --stock-unknown --strip "^(メンズ|ウィメンズ)\\s*"
e aigle エーグル --price ld --per-cat 8 --strip "^【[^】]*】\\s*"
