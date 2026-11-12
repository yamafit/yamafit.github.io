#!/bin/sh
# 追加の取り込み（.github/workflows/collect-extra.yml が実行し、data/raw の変更を保存する）。取り込みたいときに書き換える。
# 2026-11-12：フリース特集に足すポーラテックのフリース4着（作成者の指示）
node tools/collect-generic.mjs tnf wear https://www.goldwin.co.jp/ap/item/i/m/NA62650
node tools/collect-generic.mjs patagonia wear https://www.patagonia.jp/product/mens-r1-fleece-midlayer-jacket/40129.html
node tools/collect-generic.mjs marmot wear https://marmot.jp/products/mtfw25ufl041
node tools/collect-generic.mjs mhw wear "https://www.mountainhardwear.jp/shop/g/gOM0793219----S000/"
