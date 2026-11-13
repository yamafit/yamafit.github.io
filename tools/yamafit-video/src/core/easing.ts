// 緩急（イージング）の関数。すべて 0〜1 を受け取り 0〜1 を返す。

export const EASING_KINDS = ['linear', 'easeInOutSine', 'easeInOutCubic', 'easeOutCubic'] as const;
export type EasingKind = (typeof EASING_KINDS)[number];

export function clamp01(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

export function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

/** 端で速度が0になる、なめらかな立ち上がり（3u²−2u³） */
export function smoothstep(u: number): number {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
}

export function ease(kind: EasingKind, u: number): number {
  const x = clamp01(u);
  switch (kind) {
    case 'linear':
      return x;
    case 'easeInOutSine':
      // 端の値を厳密に 0 と 1 にする（cos の丸め誤差を残さない）
      if (x === 0) return 0;
      if (x === 1) return 1;
      return 0.5 - 0.5 * Math.cos(Math.PI * x);
    case 'easeInOutCubic':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'easeOutCubic':
      return 1 - Math.pow(1 - x, 3);
  }
}

/**
 * 「一定の速さで進み、最初と最後だけ加速・減速する」動きの進んだ量。
 * 速度が rampIn 秒で 0→1、rampOut 秒で 1→0 になる台形を積分したもの。
 * 戻り値の単位は秒（速度1で進んだ時間に相当）。
 */
export function rampedTime(t: number, t0: number, t1: number, rampIn: number, rampOut: number): number {
  const total = t1 - t0;
  if (total <= 0) return 0;
  const a = Math.min(Math.max(rampIn, 0), total / 2);
  const b = Math.min(Math.max(rampOut, 0), total / 2);
  const x = Math.min(Math.max(t - t0, 0), total);
  let s = 0;
  // 加速区間
  if (a > 0) {
    const xa = Math.min(x, a);
    s += (xa * xa) / (2 * a);
  }
  // 等速区間
  const cruiseEnd = total - b;
  if (x > a) s += Math.min(x, cruiseEnd) - a;
  // 減速区間
  if (b > 0 && x > cruiseEnd) {
    const xb = x - cruiseEnd;
    s += xb - (xb * xb) / (2 * b);
  }
  return s;
}

/** キーフレームの列。ease は「この点に到着する区間」の緩急 */
export interface Key {
  t: number;
  v: number;
  ease?: EasingKind;
}

/** キーフレームの列から時刻 t の値を求める（範囲外は端の値） */
export function sampleTrack(keys: readonly Key[], t: number): number {
  const first = keys[0];
  if (first === undefined) return 0;
  if (t <= first.t) return first.v;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t < k.t) {
      const p = keys[i - 1]!;
      const span = k.t - p.t;
      if (span <= 0) return k.v;
      return lerp(p.v, k.v, ease(k.ease ?? 'linear', (t - p.t) / span));
    }
  }
  return keys[keys.length - 1]!.v;
}
