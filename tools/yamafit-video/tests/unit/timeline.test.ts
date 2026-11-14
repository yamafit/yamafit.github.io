import { describe, expect, it } from 'vitest';
import { DURATION_SEC, FPS, FRAME_COUNT, SCENES, frameToTime } from '../../src/core/constants.ts';
import { MIN_ROLE_TEXT_SEC, sampleTimeline, yawDegAt } from '../../src/core/timeline.ts';
import { length, sub } from '../../src/core/vec.ts';
import { createPlaceholderPack } from '../../src/stage/placeholderPack.ts';
import { mustParse, planFor, sampleInput, screenBounds, worldCorners } from '../helpers.ts';

const project = mustParse(sampleInput());
const plan = planFor(project);
const reassembleEnd = plan.reassembleStart + plan.reassembleDur;

describe('タイムライン：再現性', () => {
  it('同じ入力からは、同じ設計図ができる', () => {
    expect(JSON.stringify(planFor(mustParse(sampleInput())))).toBe(JSON.stringify(plan));
  });

  it('前後のフレームに依存しない（順番を変えて計算しても同じ値になる）', () => {
    const inOrder = Array.from({ length: FRAME_COUNT }, (_, i) => JSON.stringify(sampleTimeline(plan, frameToTime(i))));
    for (const i of [777, 3, 899, 450, 0, 361, 660, 12, 899, 3]) {
      expect(JSON.stringify(sampleTimeline(plan, frameToTime(i)))).toBe(inOrder[i]);
    }
  });

  it('範囲の外の時刻は、0秒と30秒に丸める', () => {
    expect(sampleTimeline(plan, -5)).toEqual(sampleTimeline(plan, 0));
    expect(sampleTimeline(plan, 99)).toEqual(sampleTimeline(plan, DURATION_SEC));
  });
});

describe('タイムライン：動きのなめらかさ', () => {
  it('シーンの境目と動きの切り替わりで、カメラ・向き・パーツが飛ばない', () => {
    const eps = 1e-4;
    const times = new Set<number>([...SCENES.flatMap((s) => [s.start, s.end])]);
    for (const k of [...plan.yaw.moveKeys, ...plan.distKeys, ...plan.elevKeys]) times.add(k.t);
    for (const h of plan.highlights) times.add(h.start).add(h.fadeOutStart);
    for (const p of plan.parts) times.add(p.explodeStart).add(p.explodeStart + p.explodeDur).add(p.reassembleStart).add(p.reassembleStart + p.reassembleDur);
    for (const t of times) {
      if (t <= 0 || t >= DURATION_SEC) continue;
      const a = sampleTimeline(plan, t - eps);
      const b = sampleTimeline(plan, t + eps);
      expect(length(sub(a.camera.position, b.camera.position)), `カメラ位置 t=${t}`).toBeLessThan(2e-3);
      expect(length(sub(a.camera.target, b.camera.target)), `注視点 t=${t}`).toBeLessThan(2e-3);
      expect(Math.abs(a.yawRad - b.yawRad), `向き t=${t}`).toBeLessThan(2e-3);
      a.parts.forEach((p, i) => {
        expect(length(sub(p.offset, b.parts[i]!.offset)), `パーツ ${p.id} t=${t}`).toBeLessThan(2e-3);
        expect(Math.abs(p.dim - b.parts[i]!.dim), `濃さ ${p.id} t=${t}`).toBeLessThan(2e-2);
      });
    }
  });

  it('1フレームで動く量が、常に上限より小さい（瞬間移動しない）', () => {
    // いちばん速いのは、接近から分解の全景へ引くときのカメラ。
    // 上限はそれに少し余裕を持たせた値で、境目での「飛び」を見つけるためのもの。
    let prev = sampleTimeline(plan, 0);
    for (let i = 1; i < FRAME_COUNT; i++) {
      const cur = sampleTimeline(plan, frameToTime(i));
      expect(length(sub(cur.camera.position, prev.camera.position)), `カメラ frame=${i}`).toBeLessThan(0.2);
      expect(Math.abs(cur.yawRad - prev.yawRad) * (180 / Math.PI), `向き frame=${i}`).toBeLessThan(14);
      cur.parts.forEach((p, k) => expect(length(sub(p.offset, prev.parts[k]!.offset)), `パーツ ${p.id} frame=${i}`).toBeLessThan(0.08));
      prev = cur;
    }
  });
});

describe('タイムライン：回転', () => {
  it('冒頭は設定した速さ（毎秒36度）で回る', () => {
    expect(yawDegAt(plan, 2) - yawDegAt(plan, 1)).toBeCloseTo(36, 9);
  });

  it('再組み立てのあと、ちょうど360度回る', () => {
    const turnStart = SCENES[3].end - project.direction.rotation.fullTurnSec;
    expect(yawDegAt(plan, SCENES[3].end) - yawDegAt(plan, turnStart)).toBeCloseTo(360, 9);
  });

  it('再組み立てが終わったとき、冒頭と同じ向きに戻っている', () => {
    const diff = (yawDegAt(plan, reassembleEnd) - plan.yaw.startDeg) % 360;
    expect(Math.min(Math.abs(diff), 360 - Math.abs(diff))).toBeLessThan(1e-9);
  });
});

describe('タイムライン：分解と再組み立て', () => {
  it('分解の前（〜12秒）は、どのパーツも動いていない', () => {
    for (let i = 0; i <= 12 * FPS; i++) {
      for (const p of sampleTimeline(plan, frameToTime(i)).parts) expect(length(p.offset)).toBe(0);
    }
  });

  it('分解しきったとき、各パーツは決めた距離だけ動いている', () => {
    const s = sampleTimeline(plan, plan.explodeStart + plan.explodeDur);
    for (const part of plan.parts) {
      const offset = s.parts.find((p) => p.id === part.id)!.offset;
      expect(length(sub(offset, part.fullOffset))).toBe(0);
    }
    expect(length(plan.parts.find((p) => p.id === 'top_lid')!.fullOffset)).toBeCloseTo(0.35 * 0.8, 9);
  });

  it('本体は分解しても動かない', () => {
    const body = plan.parts.find((p) => p.body)!;
    expect(body.id).toBe('main_compartment');
    for (let i = 0; i < FRAME_COUNT; i++) {
      expect(length(sampleTimeline(plan, frameToTime(i)).parts.find((p) => p.id === body.id)!.offset)).toBe(0);
    }
  });

  it('再組み立てのあとは、分解前と完全に同じ位置に戻る', () => {
    for (let t = reassembleEnd; t <= DURATION_SEC; t += 1 / FPS) {
      const s = sampleTimeline(plan, t);
      for (const p of s.parts) expect(length(p.offset)).toBe(0);
      expect(s.liftM).toBe(0);
    }
  });

  it('分解している間、どのパーツも床より下にいかない', () => {
    for (let i = 12 * FPS; i <= 24 * FPS; i++) {
      const s = sampleTimeline(plan, frameToTime(i));
      for (const c of worldCorners(plan, s)) expect(c[1]).toBeGreaterThan(-1e-9);
    }
  });
});

describe('タイムライン：パーツの紹介（強調）', () => {
  it('紹介するパーツ数で、1パーツの時間が決まる（4個なら約2.1秒）', () => {
    expect(plan.highlights.map((h) => h.partId)).toEqual(['top_lid', 'back_panel', 'hip_belt', 'shoulder_harness']);
    expect(plan.highlights[0]!.slot).toBeCloseTo((10 - 1.2 - 0.3) / 4, 9);
    expect(plan.warnings).toEqual([]);
  });

  it('紹介は分解のあとに始まり、再組み立ての前に終わる', () => {
    expect(plan.highlights[0]!.start).toBeGreaterThanOrEqual(plan.explodeStart + plan.explodeDur);
    const last = plan.highlights[plan.highlights.length - 1]!;
    expect(last.fadeOutStart + plan.highlightFade).toBeLessThanOrEqual(plan.reassembleStart);
    for (const t of [0, 5, 12, plan.explodeStart + plan.explodeDur, 22, 25, 30]) {
      for (const p of sampleTimeline(plan, t).parts) {
        expect(p.emphasis).toBe(0);
        expect(p.dim).toBe(0);
      }
    }
  });

  it('紹介中のパーツは濃いまま、ほかのパーツは薄くなる', () => {
    for (const h of plan.highlights) {
      const s = sampleTimeline(plan, h.start + h.slot / 2);
      for (const p of s.parts) {
        if (p.id === h.partId) {
          expect(p.emphasis).toBeCloseTo(1, 9);
          expect(p.dim).toBeCloseTo(0, 9);
        } else {
          expect(p.dim).toBeCloseTo(1, 9);
        }
      }
    }
  });

  it('紹介するパーツが多くて時間が足りないときは、注意を出す', () => {
    const input = sampleInput();
    for (const p of input.parts) p.highlight = true;
    input.direction = { explode: { durationSec: 2.5 } };
    const crowded = planFor(mustParse(input));
    expect(crowded.highlights).toHaveLength(7);
    expect(crowded.highlights[0]!.slot).toBeLessThan(MIN_ROLE_TEXT_SEC);
    expect(crowded.warnings.join('\n')).toContain('紹介するパーツを減らすことをおすすめします');
  });

  it('役割テキストの表示時間が長すぎる指定は、自動に戻して注意を出す', () => {
    const input = sampleInput();
    input.direction = { explode: { roleTextSec: 4 } };
    const p = planFor(mustParse(input));
    expect(p.highlights[0]!.slot).toBeCloseTo(8.5 / 4, 9);
    expect(p.warnings.join('\n')).toContain('収まりません');
  });
});

describe('存在しないパーツを出さない', () => {
  it('登録していないパーツは、設計図にも3Dモデルにも現れない', () => {
    const input = sampleInput();
    input.parts = input.parts.filter((p: { id: string }) => p.id !== 'chest_strap' && p.id !== 'side_pocket');
    const p = mustParse(input);
    const model = createPlaceholderPack(p);
    expect([...model.partNodes.keys()].sort()).toEqual(['back_panel', 'hip_belt', 'main_compartment', 'shoulder_harness', 'top_lid']);
    const names: string[] = [];
    model.root.traverse((o) => names.push(o.name));
    expect(names.some((n) => n.includes('chest_strap') || n.includes('side_pocket'))).toBe(false);
    expect(planFor(p).parts.map((x) => x.id)).not.toContain('chest_strap');
  });

  it('未確認（confirmed: false）のパーツも現れない', () => {
    const input = sampleInput();
    input.parts.find((p: { id: string }) => p.id === 'hip_belt').confirmed = false;
    const p = mustParse(input);
    expect(createPlaceholderPack(p).partNodes.has('hip_belt')).toBe(false);
    const pl = planFor(p);
    expect(pl.parts.map((x) => x.id)).not.toContain('hip_belt');
    expect(pl.highlights.map((h) => h.partId)).not.toContain('hip_belt');
  });

  it('左右一対の部品の名前は .L / .R で終わる（glb の規格と同じ）', () => {
    const model = createPlaceholderPack(project);
    expect(model.partNodes.get('side_pocket')!.map((n) => n.name)).toEqual(['side_pocket.L', 'side_pocket.R']);
    expect(model.partNodes.get('shoulder_harness')!.map((n) => n.name)).toEqual(['shoulder_harness.L', 'shoulder_harness.R']);
  });
});

describe('画面への収まり（文字の場所を空けた配置）', () => {
  // 画面は 1080×1920。文字のカードは上（セーフエリアの上端 240px から）、
  // ロゴは下（セーフエリアの下端 1520px の手前）に置くので、3Dはその間に収める。
  const boundsOver = (p: typeof plan, from: number, to: number) => {
    const b = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, minDepth: Infinity };
    for (let t = from; t <= to + 1e-9; t += 1 / FPS) {
      const s = screenBounds(p, sampleTimeline(p, t));
      b.left = Math.min(b.left, s.left);
      b.right = Math.max(b.right, s.right);
      b.top = Math.min(b.top, s.top);
      b.bottom = Math.max(b.bottom, s.bottom);
      b.minDepth = Math.min(b.minDepth, s.minDepth);
    }
    return b;
  };

  it('仮モデルの高さは、指定した商品の高さ（60cm）になる', () => {
    expect(plan.heightM).toBeCloseTo(0.6, 9);
  });

  it('全体像（0〜5秒）：どの向きでも商品全体が画面に収まり、上の商品名にかからない', () => {
    const b = boundsOver(plan, 0, 5);
    expect(b.minDepth).toBeGreaterThan(0.05);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(1080);
    expect(b.top).toBeGreaterThanOrEqual(480);
    expect(b.bottom).toBeLessThanOrEqual(1540);
  });

  it('分解している間（〜22秒）：すべてのパーツが画面に収まり、上の説明のカードにかからない', () => {
    const b = boundsOver(plan, plan.explodeCameraArrive, 22);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(1080);
    expect(b.top).toBeGreaterThanOrEqual(500);
    expect(b.bottom).toBeLessThanOrEqual(1580);
  });

  it('パーツが開ききってからカメラが定位置に着くまでの間も、パーツが画面の外に出ない', () => {
    // （分解の始めは接近した状態なので、商品の一部は画面の外にある。それは意図どおり）
    const b = boundsOver(plan, plan.explodeStart + plan.explodeDur, plan.explodeCameraArrive);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(1080);
    expect(b.top).toBeGreaterThanOrEqual(0);
    expect(b.bottom).toBeLessThanOrEqual(1920);
  });

  it('再組み立てのあとの1回転：商品全体が画面に収まる', () => {
    const b = boundsOver(plan, reassembleEnd, 27);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(1080);
    expect(b.top).toBeGreaterThanOrEqual(470);
    expect(b.bottom).toBeLessThanOrEqual(1560);
  });

  it('まとめ（28秒〜最後）：まとめの文（上）とロゴ（下）の間に商品が収まる', () => {
    const b = boundsOver(plan, 28, DURATION_SEC);
    expect(b.top).toBeGreaterThanOrEqual(541);
    expect(b.bottom).toBeLessThanOrEqual(1398);
  });

  it('雨蓋のない、背が低く横に広い商品でも、回転中に画面からはみ出さない', () => {
    // 設定した距離（高さの3.8倍）では収まらない形。自動で必要な距離まで引く。
    const input = sampleInput();
    input.parts = input.parts.filter((p: { id: string }) => p.id !== 'top_lid');
    input.product.features = [{ text: '特徴', focusPartId: 'back_panel' }];
    input.model.heightCm = 47;
    const squat = planFor(mustParse(input));
    expect(squat.distKeys[1]!.v).toBeGreaterThan(3.8 * 0.47);
    for (const [from, to] of [
      [0, 5],
      [squat.reassembleStart + squat.reassembleDur, DURATION_SEC],
    ] as const) {
      const b = boundsOver(squat, from, to);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(1080);
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.bottom).toBeLessThanOrEqual(1920);
    }
  });

  it('全体が収まる商品では、設定した距離（高さの3.8倍）をそのまま使う', () => {
    expect(plan.distKeys[1]!.v).toBeCloseTo(3.8 * 0.6, 9);
  });

  it('画面の中で3Dをずらす量は、シーンの境目でも急に変わらない', () => {
    let prev = sampleTimeline(plan, 0).camera.shiftYPx;
    for (let i = 1; i < FRAME_COUNT; i++) {
      const cur = sampleTimeline(plan, frameToTime(i)).camera.shiftYPx;
      expect(Math.abs(cur - prev), `frame=${i}`).toBeLessThan(8);
      prev = cur;
    }
  });
});
