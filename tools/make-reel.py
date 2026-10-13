#!/usr/bin/env python3
"""解説画像（4:5）から、Instagram の投稿（カルーセル）の1枚目に入れる動画（1080x1350・4:5）を作る。
2枚目は同じ解説画像そのもの。1つの投稿で「動画→スライドで画像」と見られる。

使い方:
  python3 tools/make-reel.py <画像> <出力.mp4> --feat "見出し|説明文" --feat "見出し|説明文" ... [--cta "..."]

構成: 画面（解説画像）は動かさない。下に特徴の札をスライド形式で1枚ずつ表示
      （右から入る0.5秒・読む4.2秒・左へ出る0.5秒）→ 最後に「スライドで解説画像」「プロフィールのリンク」の案内。
"""
import argparse, subprocess, os, shutil
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1350, 30
FONT_DIR = "/usr/share/fonts/opentype/noto/"
for cand in [FONT_DIR, "/usr/share/fonts/opentype/noto-cjk/", "/usr/share/fonts/noto-cjk/"]:
    if os.path.exists(cand + "NotoSansCJK-Bold.ttc"):
        FONT_DIR = cand
        break


def font(weight, size):
    return ImageFont.truetype(FONT_DIR + f"NotoSansCJK-{weight}.ttc", size, index=0)  # index 0 = 日本語


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


def wrap(draw, text, f, maxw, max_lines):
    """日本語を1文字ずつ折り返す（句読点を行頭に置かない）。入りきらなければ末尾を「…」に"""
    lines, cur = [], ""
    for ch in text:
        if draw.textlength(cur + ch, font=f) <= maxw or (ch in "、。）」』,." and cur):
            cur += ch
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and draw.textlength(lines[-1] + "…", font=f) > maxw:
            lines[-1] = lines[-1][:-1]
        lines[-1] += "…"
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--feat", action="append", default=[], help="見出し|説明文")
    ap.add_argument("--cta", default="スライドで解説画像 ▶ 詳しくはプロフィールのリンクから")
    ap.add_argument("--title", default="")  # 互換のため（使わない）
    ap.add_argument("--top", default="")
    ap.add_argument("--focus", type=float, nargs=2, default=[0.5, 0.5])
    a = ap.parse_args()

    src = Image.open(a.image).convert("RGB")
    iw, ih = src.size
    s = max(W / iw, H / ih)
    still = src.resize((int(iw * s), int(ih * s)), Image.LANCZOS)
    still = still.crop(((still.width - W) // 2, (still.height - H) // 2, (still.width - W) // 2 + W, (still.height - H) // 2 + H))

    feats = []
    for x in a.feat[:5]:
        h, _, b = x.partition("|")
        if h.strip():
            feats.append((h.strip(), b.strip()))

    f_num, f_cnt, f_cta = font("Black", 40), font("Bold", 28), font("Bold", 36)
    f_body = font("Medium", 36)
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    bw = W - 80
    text_x = 150
    textw = bw - text_x - 40

    def card(j, x_off, alpha):
        h, b = feats[j]
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        fh = fit_text(tmp, h, "Black", 54, textw - 60)
        lines = wrap(tmp, b, f_body, textw, 3) if b else []
        bh = 120 + 52 * len(lines) + (10 if lines else 0)
        bx0 = 40 + int(x_off)
        by0 = H - bh - 60
        A = lambda v: int(v * alpha)
        od.rounded_rectangle((bx0, by0, bx0 + bw, by0 + bh), 34, fill=(18, 24, 20, A(238)))
        od.rounded_rectangle((bx0, by0, bx0 + 14, by0 + bh), 7, fill=(240, 120, 30, A(255)))
        od.ellipse((bx0 + 40, by0 + 30, bx0 + 116, by0 + 106), fill=(240, 120, 30, A(255)))
        od.text((bx0 + 78, by0 + 69), str(j + 1), font=f_num, fill=(255, 255, 255, A(255)), anchor="mm")
        od.text((bx0 + text_x, by0 + 68), h, font=fh, fill=(255, 255, 255, A(255)), anchor="lm")
        od.text((bx0 + bw - 26, by0 + 24), f"{j + 1}/{len(feats)}", font=f_cnt, fill=(255, 196, 92, A(255)), anchor="ra")
        for k, ln in enumerate(lines):
            od.text((bx0 + text_x, by0 + 118 + 52 * k), ln, font=f_body, fill=(225, 230, 225, A(255)), anchor="la")
        return ov

    def cta(alpha):
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        ff = fit_text(tmp, a.cta, "Bold", 38, W - 180)
        y0 = H - 170
        od.rounded_rectangle((60, y0, W - 60, y0 + 110), 55, fill=(240, 120, 30, int(255 * alpha)))
        od.text((W / 2, y0 + 55), a.cta, font=ff, fill=(255, 255, 255, int(255 * alpha)), anchor="mm")
        return ov

    # 時間割
    t_intro, slide_in, hold, slide_out, t_cta = 1.0, 0.5, 4.2, 0.5, 2.5
    per = slide_in + hold
    t_end = t_intro + per * len(feats) + (slide_out if feats else 0)
    n = int((t_end + t_cta) * FPS)

    tmpdir = os.path.join(os.path.dirname(os.path.abspath(a.out)), "_reel_frames")
    shutil.rmtree(tmpdir, ignore_errors=True)
    os.makedirs(tmpdir)
    for i in range(n):
        t = i / FPS
        fr = still.convert("RGBA")
        if feats and t_intro <= t < t_end:
            lt = t - t_intro
            j = min(len(feats) - 1, int(lt / per))
            u = lt - j * per
            if u < slide_in:
                k = ease(u / slide_in)
                if j > 0:
                    fr = Image.alpha_composite(fr, card(j - 1, -k * W, 1 - k))
                fr = Image.alpha_composite(fr, card(j, (1 - k) * W, k))
            elif j == len(feats) - 1 and u > per:
                k = ease((u - per) / slide_out)
                fr = Image.alpha_composite(fr, card(j, -k * W, 1 - k))
            else:
                fr = Image.alpha_composite(fr, card(j, 0, 1.0))
        elif t >= t_end:
            fr = Image.alpha_composite(fr, cta(ease((t - t_end) / 0.4)))
        fr.convert("RGB").save(os.path.join(tmpdir, f"{i:04d}.jpg"), quality=92)

    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(tmpdir, "%04d.jpg"),
           "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
           "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-crf", "21",
           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", a.out]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmpdir, ignore_errors=True)
    print("動画を作りました:", a.out, f"{t_end + t_cta:.1f}秒")


if __name__ == "__main__":
    main()
