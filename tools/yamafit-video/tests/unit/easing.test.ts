import { describe, expect, it } from 'vitest';
import { EASING_KINDS, ease, rampedTime, sampleTrack } from '../../src/core/easing.ts';

describe('緩急', () => {
  it('どの種類も 0 で 0、1 で 1 になる（端がぴったり合う）', () => {
    for (const kind of EASING_KINDS) {
      expect(ease(kind, 0)).toBe(0);
      expect(ease(kind, 1)).toBe(1);
      expect(ease(kind, -3)).toBe(0);
      expect(ease(kind, 7)).toBe(1);
    }
  });

  it('どの種類も、進むにつれて値が戻らない', () => {
    for (const kind of EASING_KINDS) {
      let prev = 0;
      for (let i = 0; i <= 200; i++) {
        const v = ease(kind, i / 200);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it('rampedTime：加速なし・減速1秒で5秒動くと、4.5秒ぶん進む', () => {
    expect(rampedTime(5, 0, 5, 0, 1)).toBeCloseTo(4.5, 12);
    expect(rampedTime(2, 0, 5, 0, 1)).toBeCloseTo(2, 12);
    expect(rampedTime(99, 0, 5, 0, 1)).toBeCloseTo(4.5, 12);
    expect(rampedTime(-1, 0, 5, 0, 1)).toBe(0);
  });

  it('sampleTrack：範囲の外は端の値、途中はなめらかにつなぐ', () => {
    const keys = [
      { t: 1, v: 10 },
      { t: 3, v: 20, ease: 'linear' as const },
      { t: 4, v: 20 },
    ];
    expect(sampleTrack(keys, 0)).toBe(10);
    expect(sampleTrack(keys, 2)).toBe(15);
    expect(sampleTrack(keys, 3.5)).toBe(20);
    expect(sampleTrack(keys, 9)).toBe(20);
  });
});
