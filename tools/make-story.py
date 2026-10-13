#!/usr/bin/env python3
"""解説画像（4:5）から Instagram ストーリーズ用の縦画像（1080x1920・JPEG）を作る。

使い方:
  python3 tools/make-story.py <画像> <出力.jpg> --label "朝のおすすめ" --title "レインウェア｜ミレー" [--url "yamafit.github.io/..."]

※ API ではストーリーズに押せるリンク（リンクスタンプ）を付けられないため、画像の下に「プロフィールのリンクから」と URL を文字で入れる。
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FONT_DIR = "/usr/share/fonts/opentype/noto/"
for cand in [FONT_DIR, "/usr/share/fonts/opentype/noto-cjk/", "/usr/share/fonts/noto-cjk/"]:
    if os.path.exists(cand + "NotoSansCJK-Bold.ttc"):
        FONT_DIR = cand
        break


def font(weight, size):
    return ImageFont.truetype(FONT_DIR + f"NotoSansCJK-{weight}.ttc", size, index=0)


def fit(d, text, weight, size, maxw):
    while size > 20:
        f = font(weight, size)
        if d.textlength(text, font=f) <= maxw:
            return f
        size -= 2
    return font(weight, size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--label", default="今日のおすすめ")
    ap.add_argument("--title", default="")
    ap.add_argument("--url", default="")
    a = ap.parse_args()

    src = Image.open(a.image).convert("RGB")
    iw, ih = src.size
    s = max(W / iw, H / ih)
    bg = src.resize((int(iw * s), int(ih * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H)).filter(ImageFilter.GaussianBlur(40))
    bg = Image.blend(bg, Image.new("RGB", (W, H), (12, 18, 16)), 0.5)

    # 解説画像を中央に（上下に文字の余白。ストーリーズの上端・下端は操作ボタンと重なるので避ける）
    cw = 960
    ch = int(ih * cw / iw)
    card = src.resize((cw, ch), Image.LANCZOS)
    y0 = 330
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw, ch), 28, fill=255)
    bg.paste(card, ((W - cw) // 2, y0), mask)

    d = ImageDraw.Draw(bg)
    # 上：ラベル＋タイトル
    lf = font("Black", 40)
    lw = d.textlength(a.label, font=lf) + 64
    d.rounded_rectangle(((W - lw) / 2, 150, (W + lw) / 2, 214), 32, fill=(240, 120, 30))
    d.text((W / 2, 182), a.label, font=lf, fill="white", anchor="mm")
    if a.title:
        tf = fit(d, a.title, "Black", 60, W - 100)
        d.text((W / 2, 270), a.title, font=tf, fill="white", anchor="mm", stroke_width=3, stroke_fill=(0, 0, 0))
    # 下：案内
    yb = y0 + ch + 50
    d.rounded_rectangle((90, yb, W - 90, yb + 110), 55, fill=(240, 120, 30))
    d.text((W / 2, yb + 55), "詳しくはプロフィールのリンクから", font=font("Black", 44), fill="white", anchor="mm")
    if a.url:
        uf = fit(d, a.url, "Bold", 30, W - 140)
        d.text((W / 2, yb + 160), a.url, font=uf, fill=(235, 235, 235), anchor="mm")
    d.text((W / 2, yb + 215), "@yama_fit2026｜YAMA FIT", font=font("Bold", 30), fill=(210, 210, 210), anchor="mm")
    bg.save(a.out, "JPEG", quality=90)
    print("ストーリーズ画像を作りました:", a.out)


if __name__ == "__main__":
    main()
