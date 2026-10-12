#!/usr/bin/env python3
"""作成者が ChatGPT で作った写真をサイトに入れる。
使い方: python3 tools/attach_image.py morning <画像ファイル> [記事slug]   … 今日の今週の7選の記事の写真にする
        python3 tools/attach_image.py noon <画像ファイル>                … 今日の昼の商品（data/noon-picks.json）の写真にする
写真は 1280×1600（4:5、白で余白）の JPEG にし、どちらも data/product-images.json に記録して、
商品ページ・一覧・検索・購入先の画面にも出す（翌週以降も消さない）。最後にサイトを作り直す。
"""
import json, os, sys, subprocess, datetime
from PIL import Image

W, H = 1280, 1600
mode, src = sys.argv[1], sys.argv[2]
today = (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime("%Y-%m-%d")
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
load = lambda p, d: json.load(open(p)) if os.path.exists(p) else d
def save(p, v): json.dump(v, open(p, "w"), ensure_ascii=False, indent=1); open(p, "a").write("\n")
def to_jpeg(dst):
    im = Image.open(src).convert("RGB")
    k = min(W / im.width, H / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    c = Image.new("RGB", (W, H), (255, 255, 255)); c.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    os.makedirs(os.path.dirname(dst), exist_ok=True); c.save(dst, quality=88, optimize=True)
masters = {}
for f in os.listdir("data/master"):
    if f.endswith(".json") and " " not in f:
        for p in load(f"data/master/{f}", {"products": []})["products"]: masters[p["id"]] = p
reg = load("data/product-images.json", {})
if mode == "morning":
    arts = load("content/auto-articles.json", [])
    slug = sys.argv[3] if len(sys.argv) > 3 else None
    a = next((x for x in arts if x["slug"] == slug), None) if slug else next((x for x in sorted(arts, key=lambda x: x.get("day") or 0) if x["date"] == today), None)
    if not a: sys.exit("今日の記事が見つかりません")
    p = masters.get((a.get("products") or [""])[0], {})
    rel = f"img/articles/{a['slug']}.jpg"; to_jpeg(rel)
    a.update(image=rel, image_w=W, image_h=H, image_alt=f"{p.get('brand','')} {p.get('name','')}の特徴をまとめたイメージ画像（AI生成）", image_by="ChatGPT（作成者が生成）", image_at=now)
    save("content/auto-articles.json", arts)
    print("朝の写真を入れました:", a["slug"], rel)
elif mode == "noon":
    picks = load("data/noon-picks.json", {})
    pick = picks.get(today)
    if not pick: sys.exit("今日の昼の商品が決まっていません（data/noon-picks.json）")
    p = masters[pick["id"]]
    rel = f"img/products/{p['id']}.jpg"; to_jpeg(rel)
    reg[p["id"]] = {"image": rel, "w": W, "h": H, "article": (reg.get(p["id"]) or {}).get("article", ""), "date": today, "noon": today, "alt": f"{p['brand']} {p['name']}の特徴をまとめたイメージ画像（AI生成）"}
    save("data/product-images.json", reg)
    pick["image"] = rel; save("data/noon-picks.json", picks)
    print("昼の写真を入れました:", p["id"], rel)
else:
    sys.exit("morning か noon を指定してください")
for c in ["node tools/build-articles.mjs", "node tools/build-products.mjs", "node tools/build-product-pages.mjs"]:
    subprocess.run(c, shell=True, check=True, stdout=subprocess.DEVNULL)
print("サイトを作り直しました。git add -A → commit → push してください。")
