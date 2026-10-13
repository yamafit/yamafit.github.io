#!/usr/bin/env python3
"""解説画像（4:5）から Instagram リール用の縦動画（1080x1920・約10秒）を作る。

使い方:
  python3 tools/make-reel.py <画像> <出力.mp4> --top "今日の登山ギア" --title "防水登山靴｜コロンビア" \
      --feat "防水と高グリップ" --feat "リップストップ素材" ... [--cta "詳しくはプロフィールのリンクから"]

構成: 0〜2.6秒 商品に寄った画面から全体へ引く → 2.6〜8.4秒 特徴を1つずつ表示 → 最後 全体＋案内文。
"""
import argparse, math, subprocess, os, sys, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS, DUR = 1080, 1920, 30, 10.0
FONT_DIR = "/usr/share/fonts/opentype/noto/"
for cand in [FONT_DIR, "/usr/share/fonts/opentype/noto-cjk/", "/usr/share/fonts/noto-cjk/"]:
    if os.path.exists(cand + "NotoSansCJK-Bold.ttc"):
        FONT_DIR = cand
        break


def font(weight, size):
    return ImageFont.truetype(FONT_DIR + f"NotoSansCJK-{weight}.ttc", size, index=0)  # index 0 = JP


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def fit_text(draw, text, weight, size, maxw):
    while size > 20:
        f = font(weight, size)
        if draw.textlength(text, font=f) <= maxw:
            return f
        size -= 2
    return font(weight, size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--top", default="今日の登山ギア")
    ap.add_argument("--title", required=True)
    ap.add_argument("--feat", action="append", default=[])
    ap.add_argument("--cta", default="詳しくはプロフィールのリンクから")
    ap.add_argument("--focus", type=float, nargs=2, default=[0.5, 0.42], help="寄りの中心（画像内の割合 x y）")
    a = ap.parse_args()

    src = Image.open(a.image).convert("RGB")
    iw, ih = src.size
    # 背景：画像をぼかして暗くしたもの
    bg = src.resize((W, int(W * ih / iw * 1.0)), Image.LANCZOS)
    bg = bg.resize((int(H * iw / ih), H), Image.LANCZOS) if bg.height < H else bg
    bx = (bg.width - W) // 2
    by = (bg.height - H) // 2
    bg = bg.crop((bx, by, bx + W, by + H)).filter(ImageFilter.GaussianBlur(38))
    bg = Image.blend(bg, Image.new("RGB", (W, H), (12, 18, 16)), 0.55)

    top_h, bot_h = 300, 270
    area_y, area_h = top_h, H - top_h - bot_h  # 画像を置く範囲 1080x1350
    base = min(W / iw, area_h / ih)              # 全体が入る倍率

    f_top = font("Bold", 40)
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    f_title = fit_text(tmp, a.title, "Black", 76, W - 100)
    f_feat = font("Black", 62)
    f_num = font("Black", 44)
    f_cta = font("Bold", 46)
    feats = a.feat[:5]

    tmpdir = os.path.join(os.path.dirname(os.path.abspath(a.out)), "_reel_frames")
    shutil.rmtree(tmpdir, ignore_errors=True)
    os.makedirs(tmpdir)
    n = int(DUR * FPS)
    t_intro, t_end = 2.2, 8.6
    for i in range(n):
        t = i / FPS
        # 倍率と中心：寄り→全体→商品へゆっくり寄る→最後に全体
        fx, fy = a.focus
        if t < t_intro:
            k = ease(t / t_intro)
            z = 1.75 + (1.0 - 1.75) * k
            cx, cy = fx + (0.5 - fx) * k, fy + (0.5 - fy) * k
        elif t < t_intro + 0.8:
            z, cx, cy = 1.0, 0.5, 0.5
        elif t < t_end:
            k = ease((t - t_intro - 0.8) / (t_end - t_intro - 0.8))
            z = 1.0 + 0.3 * k
            cx, cy = 0.5 + (fx - 0.5) * k, 0.5 + (fy - 0.5) * k
        else:
            k = ease((t - t_end) / 0.6)
            z = 1.3 + (1.0 - 1.3) * k
            cx, cy = fx + (0.5 - fx) * k, fy + (0.5 - fy) * k
        s = base * z
        sw, sh = int(iw * s), int(ih * s)
        im = src.resize((sw, sh), Image.BILINEAR)
        # 表示範囲（画像を置く範囲）に合わせて切り出す
        vx = int(cx * sw - W / 2)
        vy = int(cy * sh - area_h / 2)
        vx = max(0, min(vx, max(0, sw - W)))
        vy = max(0, min(vy, max(0, sh - area_h)))
        crop = im.crop((vx, vy, vx + min(W, sw), vy + min(area_h, sh)))
        frame = bg.copy()
        frame.paste(crop, ((W - crop.width) // 2, area_y + (area_h - crop.height) // 2))
        d = ImageDraw.Draw(frame)

        # 上の帯：小見出し＋タイトル
        d.text((W / 2, 120), a.top, font=f_top, fill=(255, 196, 92), anchor="mm")
        d.text((W / 2, 215), a.title, font=f_title, fill=(255, 255, 255), anchor="mm",
               stroke_width=3, stroke_fill=(0, 0, 0))

        # 特徴を1つずつ（画像の上に帯で重ねる）
        if feats and t_intro <= t < t_end:
            seg = (t_end - t_intro) / len(feats)
            j = min(len(feats) - 1, int((t - t_intro) / seg))
            lt = (t - t_intro) - j * seg
            alpha = min(1.0, lt / 0.25, (seg - lt) / 0.2 if j < len(feats) - 1 else 1.0)
            text = feats[j]
            ff = fit_text(d, text, "Black", 62, W - 260)
            tw = d.textlength(text, font=ff)
            bw, bh = int(tw + 200), 132
            bx0 = (W - bw) // 2
            by0 = area_y + int(area_h * 0.70)
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            od = ImageDraw.Draw(ov)
            od.rounded_rectangle((bx0, by0, bx0 + bw, by0 + bh), 30, fill=(20, 26, 22, int(230 * alpha)))
            od.ellipse((bx0 + 28, by0 + 26, bx0 + 108, by0 + 106), fill=(240, 120, 30, int(255 * alpha)))
            od.text((bx0 + 68, by0 + 66), str(j + 1), font=f_num, fill=(255, 255, 255, int(255 * alpha)), anchor="mm")
            od.text((bx0 + 135, by0 + bh / 2), text, font=ff, fill=(255, 255, 255, int(255 * alpha)), anchor="lm")
            frame = Image.alpha_composite(frame.convert("RGBA"), ov).convert("RGB")
            d = ImageDraw.Draw(frame)

        # 下の帯：案内文（最後は強調）
        if t >= t_end:
            k = ease((t - t_end) / 0.4)
            pw = int(W - 120)
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            od = ImageDraw.Draw(ov)
            y0 = H - bot_h + 50
            od.rounded_rectangle((60, y0, 60 + pw, y0 + 120), 60, fill=(240, 120, 30, int(255 * k)))
            od.text((W / 2, y0 + 60), a.cta, font=f_cta, fill=(255, 255, 255, int(255 * k)), anchor="mm")
            frame = Image.alpha_composite(frame.convert("RGBA"), ov).convert("RGB")
        else:
            d.text((W / 2, H - bot_h + 110), "YAMA FIT｜登山ギアをわかりやすく", font=font("Bold", 36),
                   fill=(230, 230, 230), anchor="mm")
        frame.save(os.path.join(tmpdir, f"{i:04d}.jpg"), quality=92)

    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(tmpdir, "%04d.jpg"),
           "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
           "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-crf", "20",
           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", a.out]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmpdir, ignore_errors=True)
    print("リール動画を作りました:", a.out)


if __name__ == "__main__":
    main()
