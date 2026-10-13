#!/usr/bin/env python3
"""解説画像（4:5）から Instagram リール用の縦動画（1080x1920・約10秒）を作る。

使い方:
  python3 tools/make-reel.py <画像> <出力.mp4> --top "今日の登山ギア" --title "防水登山靴｜コロンビア" \
      --feat "防水と高グリップ" --feat "リップストップ素材" ... [--cta "詳しくはプロフィールのリンクから"]

構成: 画面（解説画像）は動かさず、特徴をスライド形式で1枚ずつ表示（1枚2.6秒）→ 最後に案内文。
"""
import argparse, math, subprocess, os, sys, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
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
    # 時間割：最初1.0秒は全体だけ → 特徴を1枚ずつスライド（入る0.4秒・読む2.2秒・出る0.4秒）→ 最後2.0秒は案内文
    t_intro, slide_in, hold, slide_out, t_cta = 1.0, 0.4, 2.2, 0.4, 2.0
    per = slide_in + hold
    t_end = t_intro + per * len(feats) + (slide_out if feats else 0)
    dur = t_end + t_cta
    n = int(dur * FPS)
    # 画面は動かさない：画像は全体が入る大きさで固定
    sw, sh = int(iw * base), int(ih * base)
    still = bg.copy()
    still.paste(src.resize((sw, sh), Image.LANCZOS), ((W - sw) // 2, area_y + (area_h - sh) // 2))
    sd = ImageDraw.Draw(still)
    sd.text((W / 2, 120), a.top, font=f_top, fill=(255, 196, 92), anchor="mm")
    sd.text((W / 2, 215), a.title, font=f_title, fill=(255, 255, 255), anchor="mm", stroke_width=3, stroke_fill=(0, 0, 0))
    f_cnt = font("Bold", 30)

    def card(j, x_off, alpha):
        text = feats[j]
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        ff = fit_text(od, text, "Black", 64, W - 100 - 165 - 110)
        bw, bh = W - 100, 170
        bx0 = 50 + int(x_off)
        by0 = area_y + int(area_h * 0.66)
        A = lambda v: int(v * alpha)
        od.rounded_rectangle((bx0, by0, bx0 + bw, by0 + bh), 34, fill=(20, 26, 22, A(235)))
        od.rounded_rectangle((bx0, by0, bx0 + 16, by0 + bh), 8, fill=(240, 120, 30, A(255)))
        od.ellipse((bx0 + 44, by0 + 40, bx0 + 134, by0 + 130), fill=(240, 120, 30, A(255)))
        od.text((bx0 + 89, by0 + 86), str(j + 1), font=f_num, fill=(255, 255, 255, A(255)), anchor="mm")
        od.text((bx0 + 165, by0 + bh / 2), text, font=ff, fill=(255, 255, 255, A(255)), anchor="lm")
        od.text((bx0 + bw - 28, by0 + 26), f"{j + 1}/{len(feats)}", font=f_cnt, fill=(255, 196, 92, A(255)), anchor="ra")
        return ov

    for i in range(n):
        t = i / FPS
        frame = still.copy()
        # 特徴をスライド形式で1枚ずつ（右から入って、読む時間止まり、左へ出る）
        if feats and t_intro <= t < t_end:
            lt = t - t_intro
            j = min(len(feats) - 1, int(lt / per))
            u = lt - j * per
            layers = []
            if u < slide_in:  # 入ってくる
                k = ease(u / slide_in)
                layers.append((j, (1 - k) * W, k))
                if j > 0:     # 前の札は左へ出ていく
                    layers.append((j - 1, -k * W, 1 - k))
            elif j == len(feats) - 1 and u > per:  # 最後の札が出ていく
                k = ease((u - per) / slide_out)
                layers.append((j, -k * W, 1 - k))
            else:
                layers.append((j, 0, 1.0))
            fr = frame.convert("RGBA")
            for (jj, xo, al) in layers:
                fr = Image.alpha_composite(fr, card(jj, xo, al))
            frame = fr.convert("RGB")
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
