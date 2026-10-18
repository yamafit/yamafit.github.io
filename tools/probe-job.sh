#!/bin/sh
# 調査用（.github/workflows/probe.yml が実行し、結果を probe-out ブランチに置く）。中身は調べたいときに書き換える。
curl -sS -m 30 -o /dev/null -w "webshop %{http_code} %{time_total}\n" -A "Mozilla/5.0" https://webshop.montbell.jp/ > out/probe/net.txt 2>&1
curl -sS -m 30 -o /dev/null -w "www %{http_code} %{time_total}\n" -A "Mozilla/5.0" https://www.montbell.jp/ >> out/probe/net.txt 2>&1
for id in 1102575 1101720 1106570 1102576; do
  node tools/probe.mjs "https://webshop.montbell.jp/goods/disp.php?product_id=$id" > "out/probe/mb-$id.txt" 2>&1
done
node tools/probe.mjs "https://webshop.montbell.jp/goods/list_search.php?top_sk=%E3%82%B9%E3%83%8E%E3%83%BC%E3%83%9C%E3%83%BC%E3%83%89" --links "disp(_fo)?\.php\?product_id=" > out/probe/mb-search.txt 2>&1
