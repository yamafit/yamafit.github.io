#!/bin/sh
# 調査用（.github/workflows/probe.yml が実行し、結果を probe-out ブランチに置く）。中身は調べたいときに書き換える。
node tools/probe.mjs "https://webshop.montbell.jp/" --links "list\.php\?category=" > out/probe/montbell-top.txt 2>&1
node tools/probe.mjs "https://webshop.montbell.jp/goods/list_search.php?top_sk=%E3%83%80%E3%82%A6%E3%83%B3" --links "disp(_fo)?\.php\?product_id=|list\.php\?category=" > out/probe/montbell-search-down.txt 2>&1
node tools/probe.mjs "https://webshop.montbell.jp/goods/category/?c=1" --links "list\.php\?category=" > out/probe/montbell-cat1.txt 2>&1
