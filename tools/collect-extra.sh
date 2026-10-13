#!/bin/sh
# 追加の取り込み（.github/workflows/collect-extra.yml が実行し、data/raw の変更を保存する）。取り込みたいときに書き換える。
# 2026-10-12：ダウンジャケット（モンベル・ザ・ノース・フェイスを多めに）
ONLY="ダウン" SKIP="キッズ|ベビー|スリーピング|ハガー|シュラフ|スカート|パンツ|ソックス|ブーティ|シューズ|手袋|グローブ|ミトン|帽|キャップ|ネック|ケープ|ブランケット|クッション|ピロー" \
  node tools/collect-montbell.mjs wear "search:ダウン" 45
B=https://www.goldwin.co.jp/ap/item/i/m
node tools/collect-generic.mjs tnf wear \
  $B/ND92555 $B/NDW92555 $B/ND92335 $B/NDW92557 $B/ND92553 $B/ND92652 $B/ND92341 $B/ND92215 $B/ND92515 \
  $B/ND92451 $B/NDW92451 $B/ND92550 $B/NDW92550 $B/ND92561 $B/ND92520 $B/ND92460 $B/ND92402 $B/ND92360 \
  $B/NY82510 $B/ND92237 $B/ND92238 $B/ND92340
