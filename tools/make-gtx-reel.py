#!/usr/bin/env python3
"""ゴアテックス12種類のリール（1080x1920・縦・約37秒）を、テロップと読み上げ音声つきで作る。

使い方:
  python3 tools/make-gtx-reel.py                      # 背景はこの道具が描く（雨・雪・風・夕日）
  python3 tools/make-gtx-reel.py --clips ~/gtx-clips  # 動画AIで作った9本を背景に使う

--clips のフォルダには scene1 〜 scene9 を入れる。動画（.mp4 / .mov）でも写真（.png / .jpg）でもよい。
写真はゆっくり寄ったり引いたりして動かす。無いシーンは描いた背景になる。
同じフォルダに gtx-end.png があれば最後のカードに使う（無ければ記事の早見表の画像）。
使う部分（何秒目から何秒間）は下の SCENES の clip に書いてある。

音声: Kokoro（kokoro-onnx）の日本語の声。--tts-dir に kokoro.onnx と voices.bin が必要。
  pip install kokoro-onnx misaki fugashi unidic-lite jaconv mojimoji pillow numpy
  モデル: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
--no-voice を付けると音声なし（テロップだけ）で作る。BGMは入れない（Instagramの音源を投稿画面で足す）。
"""
import argparse, glob, math, os, re, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
SR = 24000
WHITE, YELLOW, RED = (255, 255, 255), (255, 212, 0), (255, 90, 90)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FONT = None
for cand in ["/usr/share/fonts/opentype/noto/", "/usr/share/fonts/opentype/noto-cjk/", "/usr/share/fonts/noto-cjk/"]:
    if os.path.exists(cand + "NotoSansCJK-Black.ttc"):
        FONT = cand + "NotoSansCJK-Black.ttc"
        break

# テロップ: [y]…[/] は黄色、[r]…[/] は赤。1要素＝1行。
# voice: (読み上げる文, その文と同時に出すテロップの行番号。None なら何も出さない)
# clip: 元動画の (何秒目から, 何秒間)
SCENES = [
    dict(dur=2.2, bg="rain_blue", clip=(0, 2.2), size=92, y=0.30, fx="rain", move=(1.00, 1.09, 0.0, 0.3),
         telop=["その雨具、", "ゴアテックスの「[y]どれ[/]」？"],
         voice=[("その雨具、ゴアテックスの、どれ？", 0)], show=[0, 0]),
    dict(dur=3.4, bg="forest", clip=(0, 3.4), size=112, y=0.155, fx="rain", move=(1.08, 1.00, 0.0, -0.4),
         telop=["実は[y]12種類[/]ある", "高い＝正解、じゃない"], scale=[1, 0.62],
         voice=[("実は、12種類。", 0), ("高いほど良い、ではありません。", 1)]),
    dict(dur=3.6, bg="snow_ridge", clip=(0, 3.6), size=88, y=0.22, fx="snow", move=(1.00, 1.10, -0.3, 0.5),
         telop=["雪山・岩場 → [y]PRO[/]", "とにかく丈夫"],
         voice=[("雪山や岩場には、プロ。", 0), ("とにかく丈夫。", 1)]),
    dict(dur=3.8, bg="calm_green", clip=(0, 3.8), size=88, y=0.20, move=(1.10, 1.02, 0.2, 0.0),
         telop=["軽さ → [y]パックライト[/]", "小さくたためる"],
         voice=[("軽さなら、パックライト。", 0), ("小さくたためます。", 1)]),
    dict(dur=4.2, bg="wind", clip=(0, 4.2), size=88, y=0.63, move=(1.02, 1.10, 0.0, -0.6),
         telop=["[y]WINDSTOPPER[/]", "風は防ぐ", "[r]でも防水ではない[/]"],
         voice=[("ウインドストッパーは、風に強い。", 0), ("でも、防水ではありません。", 2)], show=[0, 0.9, None]),
    dict(dur=4.0, bg="puddle", clip=(1.5, 4.0), size=88, y=0.22, move=(1.00, 1.06, 0.0, 0.3),
         telop=["靴にも[y]4種類[/]", "蒸れにくさ・暖かさがちがう"],
         voice=[("靴にも、よん種類。", 0), ("蒸れにくさや、暖かさがちがいます。", 1)]),
    dict(dur=2.6, bg="snow_dark", clip=(0, 2.6), size=88, y=0.16, fx="snow", move=(1.09, 1.00, 0.3, 0.0),
         telop=["手袋もある", "これで[y]12種類[/]"],
         voice=[("手袋まで入れて、12種類。", 0)], show=[0, 0.7]),
    dict(dur=5.6, bg="hut", clip=(0, 5.6), size=76, y=0.215, move=(1.00, 1.09, 0.4, 0.2),
         telop=["迷ったら、この3つ", "日帰り → [y]パックライト[/]", "縦走 → [y]C-ニット[/]", "雪山 → [y]PRO[/]"],
         voice=[("迷ったら、この3つ。", 0), ("日帰りは、パックライト。", 1), ("縦走は、シーニット。", 2), ("雪山は、プロ。", 3)]),
    dict(dur=4.4, bg="sunset", clip=(0, 4.4), size=84, y=0.20, move=(1.10, 1.00, 0.0, -0.3),
         telop=["12種類の違いと", "おすすめは記事で", "[y]プロフィールのリンクから[/]"],
         voice=[("12種類の違いと、おすすめは、", 0), ("プロフィールのリンクから。", 2)], show=[0, 0.7, None]),
    dict(dur=3.2, bg="end", telop=[], voice=[("保存して、買う前に見返してね。", None)]),
]


# ───────── 音声 ─────────
def make_voice(tts_dir, voice, base_speed):
    """シーンごとの音声と、各文の始まる秒（シーン内）を返す。シーンの長さに入らなければ少し早口にする。"""
    from kokoro_onnx import Kokoro
    from misaki import ja
    g2p = ja.JAG2P()
    k = Kokoro(os.path.join(tts_dir, "kokoro.onnx"), os.path.join(tts_dir, "voices.bin"))
    gap = np.zeros(int(SR * 0.10), np.float32)

    def trim(a):
        idx = np.where(np.abs(a) > 0.01)[0]
        if not len(idx):
            return a
        return a[max(0, idx[0] - 240): idx[-1] + 1200]

    out = []
    for n, sc in enumerate(SCENES):
        limit = sc["dur"] - 0.12
        speed = base_speed
        while True:
            parts, starts, pos = [], [], 0.06
            for text, _ in sc["voice"]:
                r = g2p(text)
                ph = r[0] if isinstance(r, tuple) else r
                a, sr = k.create(ph, voice=voice, speed=speed, is_phonemes=True)
                assert sr == SR
                a = trim(a.astype(np.float32))
                starts.append(pos)
                parts += [a, gap]
                pos += (len(a) + len(gap)) / SR
            total = pos - len(gap) / SR
            if total <= limit or speed >= 1.22:
                break
            speed = min(1.24, round(speed * max(1.03, total / limit), 3))
        audio = np.concatenate([np.zeros(int(SR * 0.06), np.float32)] + parts[:-1])
        print(f"  シーン{n + 1}: 音声 {total:.2f}秒 / {sc['dur']}秒（速さ {speed}）" + ("  ※少し次のシーンにかかります" if total > limit else ""))
        out.append((audio, starts))
    return out


# ───────── テロップ ─────────
def parse(line):
    segs, color = [], WHITE
    for tok in re.split(r"(\[y\]|\[r\]|\[/\])", line):
        if tok == "[y]":
            color = YELLOW
        elif tok == "[r]":
            color = RED
        elif tok == "[/]":
            color = WHITE
        elif tok:
            segs.append((tok, color))
    return segs


def telop_sprites(sc):
    """行ごとの画像（黒ふち・影つき）と中心位置を作る。位置は画面の上から3分の1あたり。"""
    lines = [parse(l) for l in sc["telop"]]
    if not lines:
        return []
    tmp = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    size, maxw = sc["size"], 930
    while size > 40:
        f = ImageFont.truetype(FONT, size, index=0)
        ks = sc.get("scale") or [1] * len(lines)
        if max(tmp.textlength("".join(t for t, _ in l), font=f) * k for l, k in zip(lines, ks)) <= maxw:
            break
        size -= 2
    stroke = max(6, round(size * 0.10))
    lh = int(size * 1.42)
    y0 = int(H * sc.get("y", 0.31) - lh * len(lines) / 2)
    y0 = max(int(H * 0.105), y0)
    sprites = []
    for i, segs in enumerate(lines):
        tw = int(sum(tmp.textlength(t, font=f) for t, _ in segs))
        pad = stroke + 26
        im = Image.new("RGBA", (tw + pad * 2, lh + pad * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        x = pad
        for t, _ in segs:  # 先に黒ふちだけ全部描く（隣の文字の上にふちが乗らないように）
            d.text((x, pad + lh / 2), t, font=f, fill=(0, 0, 0, 255), anchor="lm", stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
            x += tmp.textlength(t, font=f)
        shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 150), (0, 8), im.getchannel("A"))
        shadow = shadow.filter(ImageFilter.GaussianBlur(10))
        im = Image.alpha_composite(shadow, im)
        d = ImageDraw.Draw(im)
        x = pad
        for t, c in segs:
            d.text((x, pad + lh / 2), t, font=f, fill=c + (255,), anchor="lm")
            x += tmp.textlength(t, font=f)
        k = (sc.get("scale") or [1] * len(lines))[i]
        if k != 1:
            im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
        sprites.append(dict(im=im, cx=W // 2 - 14, cy=y0 + int(lh * (0.5 + (k - 1) * 0.25)), t=0.0))
        y0 += int(lh * (k if k == 1 else k + 0.12))
    return sprites


def draw_sprite(frame, sp, t):
    """出るときに少し大きくなりながら現れる（0.18秒）"""
    u = (t - sp["t"]) / 0.18
    if u <= 0:
        return
    im = sp["im"]
    if u < 1:
        e = 1 - (1 - u) ** 3
        s = 0.82 + 0.18 * e + 0.06 * math.sin(math.pi * u)
        im = im.resize((max(2, int(im.width * s)), max(2, int(im.height * s))), Image.BILINEAR)
        im.putalpha(im.getchannel("A").point(lambda v: int(v * e)))
    frame.paste(im, (sp["cx"] - im.width // 2, sp["cy"] - im.height // 2), im)


# ───────── 描く背景（動画が無いとき） ─────────
BW, BH = 1188, 2112
PAL = {
    "rain_blue": dict(sky=((10, 28, 52), (38, 78, 120)), hills=[(30, 60, 96), (18, 42, 72), (8, 22, 40)], fx="rain"),
    "forest": dict(sky=((14, 34, 30), (58, 96, 80)), hills=[(34, 70, 56), (20, 48, 38), (8, 24, 20)], fx="rain", trees=True),
    "snow_ridge": dict(sky=((70, 110, 160), (200, 220, 236)), hills=[(170, 192, 214), (120, 150, 184), (236, 242, 248)], fx="snow"),
    "calm_green": dict(sky=((30, 70, 56), (150, 190, 150)), hills=[(70, 120, 92), (40, 86, 64), (18, 50, 38)], fx="bokeh"),
    "wind": dict(sky=((60, 68, 78), (150, 158, 166)), hills=[(104, 112, 122), (70, 78, 88), (36, 42, 50)], fx="wind"),
    "puddle": dict(sky=((40, 44, 50), (104, 96, 84)), hills=[(84, 76, 66), (60, 50, 40), (34, 28, 22)], fx="puddle"),
    "snow_dark": dict(sky=((12, 22, 34), (52, 78, 96)), hills=[(44, 64, 82), (26, 42, 58), (200, 214, 226)], fx="snow"),
    "hut": dict(sky=((12, 20, 44), (60, 62, 96)), hills=[(40, 46, 80), (24, 28, 56), (10, 12, 28)], fx="mist", glow=(255, 170, 80)),
    "sunset": dict(sky=((54, 36, 92), (255, 150, 70)), hills=[(150, 80, 90), (84, 44, 70), (20, 12, 28)], fx="clouds", sun=True),
}


def ridge(rng, base, amp):
    x = np.arange(0, BW + 1, 6)
    y = np.full(len(x), float(base))
    for k in range(1, 6):
        y += amp / k * np.sin(x * (0.0022 * k * rng.uniform(0.7, 1.4)) + rng.uniform(0, 6.28))
    return x, y


def noise_tex(rng, w, h, cell, blur):
    small = rng.random((h // cell + 2, w // cell + 2))
    im = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return im.filter(ImageFilter.GaussianBlur(blur))


class Painted:
    def __init__(self, name, seed):
        p = PAL[name]
        self.p, self.rng = p, np.random.default_rng(seed)
        rng = self.rng
        top, bot = np.array(p["sky"][0], float), np.array(p["sky"][1], float)
        g = np.linspace(0, 1, BH)[:, None, None] ** 0.9
        base = Image.fromarray(np.broadcast_to(top + (bot - top) * g, (BH, BW, 3)).astype(np.uint8))
        d = ImageDraw.Draw(base, "RGBA")
        if p.get("sun"):
            cx, cy = BW * 0.5, BH * 0.50
            for r in range(520, 60, -20):
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 220, 140, 10))
            d.ellipse((cx - 70, cy - 70, cx + 70, cy + 70), fill=(255, 244, 210, 255))
        self.front = None
        for i, col in enumerate(p["hills"]):
            x, y = ridge(rng, BH * (0.56 + 0.13 * i), 90 - 18 * i)
            if p.get("sun") and i == 2:  # 手前は山頂のシルエットと人影（雲海の手前に重ねる）
                y = BH * 0.80 + 0.0011 * (x - BW * 0.5) ** 2 + 6 * np.sin(x * 0.05)
                self.front = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
                d = ImageDraw.Draw(self.front)
            d.polygon(list(zip(x, y)) + [(BW, BH), (0, BH)], fill=col)
            if p.get("trees") and i >= 1:
                for tx in rng.uniform(0, BW, 16 if i == 1 else 9):
                    hgt, wd = (520, 60) if i == 1 else (1100, 130)
                    by = BH * (0.60 + 0.13 * i) + rng.uniform(-30, 60)
                    d.polygon([(tx, by - hgt), (tx - wd, by + 40), (tx + wd, by + 40)], fill=col)
                    d.rectangle((tx - wd * 0.12, by, tx + wd * 0.12, BH), fill=col)
        if p.get("sun"):
            px, py = BW * 0.5, BH * 0.80
            d.rounded_rectangle((px - 13, py - 78, px + 13, py + 4), 8, fill=p["hills"][2])
            d.ellipse((px - 12, py - 104, px + 12, py - 80), fill=p["hills"][2])
            d.rounded_rectangle((px - 24, py - 76, px - 8, py - 34), 6, fill=p["hills"][2])
        if p.get("glow"):
            gl = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
            ImageDraw.Draw(gl).ellipse((BW * 0.2, BH * 0.72, BW * 0.8, BH * 1.1), fill=p["glow"] + (120,))
            base.paste(gl.filter(ImageFilter.GaussianBlur(140)), (0, 0), gl.filter(ImageFilter.GaussianBlur(140)))
        if p["fx"] == "puddle":
            ImageDraw.Draw(base, "RGBA").rectangle((0, BH * 0.72, BW, BH), fill=(70, 84, 96, 120))
        # 上のほうを少し暗くしてテロップを読みやすく
        sh = np.zeros((BH, 1), np.float32)
        yy = np.linspace(0, 1, BH)
        sh[:, 0] = np.clip(1 - np.abs(yy - 0.30) / 0.30, 0, 1) * 70
        dark = Image.fromarray(sh.astype(np.uint8)).resize((BW, BH))
        base.paste((0, 0, 0), (0, 0), dark)
        self.base = base
        n = dict(rain=260, snow=170, wind=70, bokeh=26, puddle=200, mist=0, clouds=0)[p["fx"]]
        self.px, self.py = rng.uniform(0, W, n), rng.uniform(0, H, n)
        self.pv, self.ps = rng.uniform(0.6, 1.4, n), rng.uniform(0.5, 1.5, n)
        self.mist = noise_tex(rng, W * 2, H, 90, 40) if p["fx"] in ("wind", "clouds") else noise_tex(rng, W * 2, H, 260, 90)

    def frame(self, t, u):
        z = 1.0 + 0.09 * u
        cw, ch = W / z, H / z
        ox, oy = (BW - cw) / 2 + 20 * (u - 0.5), (BH - ch) / 2 - 16 * u
        box = (ox, oy, ox + cw, oy + ch)
        fr = self.base.resize((W, H), Image.BILINEAR, box=box)
        fx = self.p["fx"]
        d = ImageDraw.Draw(fr, "RGBA")
        if fx in ("mist", "clouds", "wind", "bokeh", "forest") or self.p.get("trees"):
            speed = dict(wind=520, clouds=40).get(fx, 60)
            off = int(t * speed) % W
            m = self.mist.crop((off, 0, off + W, H))
            if fx == "clouds":  # 雲海は下半分だけ
                band = Image.linear_gradient("L").resize((W, H)).point(lambda v: 0 if v < 150 else min(255, (v - 150) * 5))
                m = Image.composite(m, Image.new("L", (W, H), 0), band).point(lambda v: min(255, int(v * 1.5)))
                fr.paste((255, 206, 170), (0, 0), m)
                fr.paste(self.front.resize((W, H), Image.BILINEAR, box=box), (0, 0), self.front.resize((W, H), Image.BILINEAR, box=box))
            else:
                fr.paste((230, 236, 240), (0, 0), m.point(lambda v: int(max(0, v - 90) * (1.0 if fx == "wind" else 0.55))))
            d = ImageDraw.Draw(fr, "RGBA")
        if fx in ("rain", "puddle"):
            for x, y, v, s in zip(self.px, self.py, self.pv, self.ps):
                yy = (y + t * 2300 * v) % (H + 200) - 100
                xx = (x - (yy * 0.12)) % W
                ln = 46 * s * v
                d.line((xx, yy, xx - ln * 0.12, yy + ln), fill=(220, 232, 245, int(70 + 60 * s)), width=3)
        if fx == "puddle":
            for i in range(9):
                ph = (t * 0.9 + i * 0.37) % 1
                cx, cy = (i * 271 + 90) % W, H * 0.80 + (i * 97) % 300
                r = 20 + 150 * ph
                d.ellipse((cx - r, cy - r * 0.3, cx + r, cy + r * 0.3), outline=(230, 240, 250, int(170 * (1 - ph))), width=4)
        if fx == "snow":
            for x, y, v, s in zip(self.px, self.py, self.pv, self.ps):
                yy = (y + t * 330 * v) % (H + 40) - 20
                xx = (x + 40 * math.sin(t * 1.6 * v + y) + t * 90) % W
                r = 3 + 5 * s
                d.ellipse((xx - r, yy - r, xx + r, yy + r), fill=(255, 255, 255, int(120 + 80 * s)))
        if fx == "wind":
            for x, y, v, s in zip(self.px, self.py, self.pv, self.ps):
                xx = (x + t * 2600 * v) % (W + 600) - 300
                yy = y + 30 * math.sin(xx * 0.004 + y)
                d.line((xx, yy, xx + 240 * s, yy - 14), fill=(255, 255, 255, int(40 + 40 * s)), width=3)
        if fx == "bokeh":
            for x, y, v, s in zip(self.px, self.py, self.pv, self.ps):
                yy = (y - t * 40 * v) % H
                r = 26 + 40 * s
                d.ellipse((x - r, yy - r, x + r, yy + r), fill=(255, 250, 210, int(20 + 14 * s)))
        return fr


class Clip:
    """元動画から1枚ずつ読む（1080x1920に合わせて中央を切り出す）"""
    def __init__(self, path, start, dur):
        vf = f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
        self.p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-ss", str(start), "-t", str(dur + 0.2), "-i", path,
                                   "-an", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.last = None

    def frame(self, t, u):
        buf = self.p.stdout.read(W * H * 3)
        if len(buf) == W * H * 3:
            self.last = Image.frombytes("RGB", (W, H), buf)
        if self.last is None:
            raise SystemExit("動画を読めませんでした")
        return self.last.copy()


class Photo:
    """写真をゆっくり動かす（寄る・引く・少し流す）。雨や雪の写真には粒をうすく重ねる。"""
    def __init__(self, path, sc, seed):
        im = Image.open(path).convert("RGB")
        self.z0, self.z1, self.dx, self.dy = sc.get("move", (1.0, 1.08, 0, 0))
        zmax = max(self.z0, self.z1)
        s = max(W / im.width, H / im.height) * zmax
        self.im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        self.zmax, self.fx = zmax, sc.get("fx")
        rng = np.random.default_rng(seed)
        n = dict(rain=70, snow=60).get(self.fx, 0)
        self.px, self.py = rng.uniform(0, W, n), rng.uniform(0, H, n)
        self.pv, self.ps = rng.uniform(0.6, 1.4, n), rng.uniform(0.4, 1.4, n)

    def frame(self, t, u):
        e = u * u * (3 - 2 * u) * 0.5 + u * 0.5
        z = self.z0 + (self.z1 - self.z0) * e
        cw, ch = W * self.zmax / z, H * self.zmax / z
        fx_, fy_ = self.im.width - cw, self.im.height - ch
        ox = fx_ / 2 + fx_ / 2 * self.dx * (e - 0.5) * 2 if fx_ > 0 else 0
        oy = fy_ / 2 + fy_ / 2 * self.dy * (e - 0.5) * 2 if fy_ > 0 else 0
        slack = 0.012 * W  # 寄りきった時も少しだけ流れるように
        ox = min(max(ox + slack * self.dx * (e - 0.5), 0), self.im.width - cw)
        oy = min(max(oy + slack * self.dy * (e - 0.5), 0), self.im.height - ch)
        fr = self.im.resize((W, H), Image.BICUBIC, box=(ox, oy, ox + cw, oy + ch))
        if self.fx:
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(ov)
            for x, y, v, s in zip(self.px, self.py, self.pv, self.ps):
                if self.fx == "rain":
                    yy = (y + t * 2600 * v) % (H + 200) - 100
                    ln = 70 * s * v
                    d.line((x, yy, x - ln * 0.06, yy + ln), fill=(235, 242, 250, int(50 + 45 * s)), width=2 if s < 1 else 3)
                else:
                    yy = (y + t * 420 * v) % (H + 40) - 20
                    xx = (x + 50 * math.sin(t * 1.5 * v + y) + t * 260 * v) % W
                    r = 2 + 5 * s
                    d.ellipse((xx - r, yy - r, xx + r, yy + r), fill=(255, 255, 255, int(110 + 70 * s)))
            ov = ov.filter(ImageFilter.GaussianBlur(1.6))
            fr.paste(ov, (0, 0), ov)
        return fr


class Still:
    def __init__(self, path):
        im = Image.open(path).convert("RGB")
        s = max(W / im.width, H / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x, y = (im.width - W) // 2, (im.height - H) // 2
        self.im = im.crop((x, y, x + W, y + H))

    def frame(self, t, u):
        return self.im.copy()


def find_clip(folder, n):
    if not folder:
        return None
    for ext in ("mp4", "mov", "MP4", "MOV", "webm", "m4v", "png", "jpg", "jpeg", "PNG", "JPG"):
        for pat in (f"scene{n}.{ext}", f"{n}.{ext}", f"scene{n:02d}.{ext}"):
            p = os.path.join(folder, pat)
            if os.path.exists(p):
                return p
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", default="", help="scene1.mp4〜scene9.mp4 と gtx-end.png を入れたフォルダ")
    ap.add_argument("--end", default="", help="最後のカードの画像")
    ap.add_argument("--out", default=os.path.join(ROOT, "out", "gtx-reel.mp4"))
    ap.add_argument("--tts-dir", default=os.path.expanduser("~/.cache/yamafit-tts"))
    ap.add_argument("--voice", default="jf_alpha", help="jf_alpha / jf_gongitsune / jf_nezumi / jf_tebukuro / jm_kumo")
    ap.add_argument("--speed", type=float, default=1.12)
    ap.add_argument("--no-voice", action="store_true")
    a = ap.parse_args()
    if not FONT:
        sys.exit("日本語フォント（fonts-noto-cjk）がありません")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    clips = os.path.expanduser(a.clips)

    voices = None
    if not a.no_voice:
        print("音声を作っています…")
        voices = make_voice(a.tts_dir, a.voice, a.speed)

    end_img = a.end or next((p for p in [os.path.join(clips, "gtx-end.png")] if clips and os.path.exists(p)), "") \
        or os.path.join(ROOT, "img", "articles", "gore-tex-types.jpg")

    total = round(sum(s["dur"] for s in SCENES), 2)
    track = np.zeros(int(SR * total) + SR, np.float32)
    wav = os.path.splitext(a.out)[0] + ".voice.wav"
    enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
                            "-crf", "19", "-preset", "medium", a.out + ".video.mp4"], stdin=subprocess.PIPE)
    t0, prev, voice_end = 0.0, None, 0.0
    for n, sc in enumerate(SCENES):
        sprites = telop_sprites(sc)
        show = sc.get("show")
        if voices:
            audio, starts = voices[n]
            late = max(0.0, voice_end + 0.05 - t0)  # 前のシーンの声が残っていたら、その分だけ待つ
            starts = [st + late for st in starts]
            i0 = int(SR * (t0 + late))
            voice_end = t0 + late + len(audio) / SR
            track[i0:i0 + len(audio)] += audio[: len(track) - i0]
            if not show:
                for (_, line), st in zip(sc["voice"], starts):
                    if line is not None:
                        sprites[line]["t"] = max(0.0, st - 0.08) if line else 0.0
        if show:
            for sp, st in zip(sprites, show):
                sp["t"] = sprites[sprites.index(sp) - 1]["t"] + 0.5 if st is None else st
            if voices and show[-1] is None:  # 最後の行は、最後の文の声に合わせる
                sprites[-1]["t"] = starts[-1] - 0.08
        elif not voices:
            for i, sp in enumerate(sprites):
                sp["t"] = i * sc["dur"] / (len(sprites) + 1)
        path = find_clip(clips, n + 1)
        src = Still(end_img) if sc["bg"] == "end" else (Photo(path, sc, 7 + n) if path.lower().endswith(("png", "jpg", "jpeg")) else Clip(path, *sc["clip"])) if path else Painted(sc["bg"], 100 + n)
        print(f"シーン{n + 1}: {'最後のカード' if sc['bg'] == 'end' else os.path.basename(path) if path else '描いた背景'}")
        nf = int(round(sc["dur"] * FPS))
        for i in range(nf):
            t = i / FPS
            fr = src.frame(t, i / nf)
            if sc["bg"] == "end" and prev is not None and t < 0.3:
                fr = Image.blend(prev, fr, t / 0.3)
            elif i < 2 and n:  # シーンの変わり目に一瞬だけ白く光らせる
                fr = Image.blend(fr, Image.new("RGB", (W, H), (255, 255, 255)), 0.22 - 0.1 * i)
            for sp in sprites:
                draw_sprite(fr, sp, t)
            if sc["bg"] != "end" and i == nf - 1:
                prev = fr
            enc.stdin.write(fr.tobytes())
        t0 += sc["dur"]
    enc.stdin.close()
    enc.wait()

    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", a.out + ".video.mp4"]
    if voices:
        track = track[: int(SR * total)]
        with wave.open(wav, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes())
        cmd += ["-i", wav, "-af", "loudnorm=I=-15:TP=-1.5:LRA=7,aresample=44100", "-ac", "2"]
    else:
        cmd += ["-f", "lavfi", "-t", str(total), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]
    cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", a.out]
    subprocess.run(cmd, check=True)
    os.remove(a.out + ".video.mp4")
    if voices:
        os.remove(wav)
    print("動画を作りました:", a.out, f"{total}秒")


if __name__ == "__main__":
    main()
