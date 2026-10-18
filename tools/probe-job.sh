#!/bin/sh
# 調査用（.github/workflows/probe.yml が実行し、結果を probe-out ブランチに置く）。中身は調べたいときに書き換える。
for q in スノーボード スノーボードウェア パウダー ドライテック%20インシュレーテッド; do
  node tools/probe.mjs "https://webshop.montbell.jp/goods/list_search.php?top_sk=$q" --links "disp(_fo)?\.php\?product_id=|list\.php\?category=" > "out/probe/mb-$q.txt" 2>&1
done
node tools/probe.mjs "https://webshop.montbell.jp/goods/category/?c=6" --links "list\.php\?category=" > out/probe/montbell-cat6.txt 2>&1
node tools/probe.mjs "https://webshop.montbell.jp/goods/category/?c=5" --links "list\.php\?category=" > out/probe/montbell-cat5.txt 2>&1
