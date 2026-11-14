import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DURATION_SEC, FPS } from '../../src/core/constants.ts';
import { parseProject } from '../../src/core/schema.ts';
import { buildTimeline, sampleTimeline } from '../../src/core/timeline.ts';
import { BodySurface, createProfilePack, monotoneInterpolator } from '../../src/stage/profilePack.ts';
import { mustParse, screenBounds } from '../helpers.ts';

const TRAILBLAZER = join(import.meta.dirname, '..', '..', 'projects', 'salomon-trailblazer-10', 'project.json');
const input = () => JSON.parse(readFileSync(TRAILBLAZER, 'utf8'));
const project = mustParse(input());
const model = createProfilePack(project);

function sizeOf(object: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
}

describe('輪郭の補間', () => {
  it('与えた点を通り、点の間で行き過ぎない', () => {
    const f = monotoneInterpolator([0, 1, 2, 3], [0, 10, 10, 4]);
    expect(f(0)).toBe(0);
    expect(f(1)).toBeCloseTo(10, 12);
    expect(f(3)).toBe(4);
    for (let x = 1; x <= 2; x += 0.05) expect(f(x)).toBeCloseTo(10, 9); // 平らな区間はふくらまない
    for (let x = 0; x <= 3; x += 0.05) expect(f(x)).toBeLessThanOrEqual(10 + 1e-9);
    expect(f(-5)).toBe(0);
    expect(f(99)).toBe(4);
  });
});

describe('写真の輪郭に合わせた近似モデル（TRAILBLAZER 10）', () => {
  it('本体の大きさが、公式の寸法（47×24×18cm）になる', () => {
    const body = model.root.getObjectByName('body')!;
    const size = sizeOf(body);
    expect(size.y * 100).toBeCloseTo(47, 1);
    expect(size.x * 100).toBeCloseTo(24, 1);
    expect(size.z * 100).toBeCloseTo(18, 1);
  });

  it('形に欠けや異常な値がない（すべての部品の座標が有限の数）', () => {
    let meshes = 0;
    model.root.traverse((o) => {
      const geometry = (o as THREE.Mesh).geometry;
      if (!geometry) return;
      meshes++;
      const pos = geometry.attributes.position!;
      expect(pos.count).toBeGreaterThan(0);
      for (let i = 0; i < pos.array.length; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
    });
    expect(meshes).toBeGreaterThan(8);
  });

  it('登録・確認済みのパーツだけがある（雨蓋はない）', () => {
    expect([...model.partNodes.keys()].sort()).toEqual(['back_panel', 'chest_strap', 'hip_belt', 'main_compartment', 'shoulder_harness', 'side_pocket']);
    const names: string[] = [];
    model.root.traverse((o) => names.push(o.name));
    expect(names.some((n) => n.includes('top_lid') || n.includes('lid'))).toBe(false);
  });

  it('パーツの登録を外すと、その部品は作られない', () => {
    const data = input();
    data.parts = data.parts.filter((p: { id: string }) => p.id !== 'chest_strap' && p.id !== 'hip_belt');
    const m = createProfilePack(mustParse(data));
    expect(m.partNodes.has('chest_strap')).toBe(false);
    expect(m.partNodes.has('hip_belt')).toBe(false);
  });

  it('左右一対の部品は .L / .R の名前で、左右対称の位置にある', () => {
    for (const id of ['side_pocket', 'shoulder_harness']) {
      const [left, right] = model.info.parts[id]!.nodes;
      expect(left!.name).toBe(`${id}.L`);
      expect(right!.name).toBe(`${id}.R`);
      expect(left!.center[0]).toBeCloseTo(-right!.center[0], 6);
      expect(left!.center[1]).toBeCloseTo(right!.center[1], 6);
      expect(left!.size[0]).toBeCloseTo(right!.size[0], 6);
    }
  });

  it('サイドポケットと背面パネルは、本体の表面に沿っている（本体から浮いたり埋もれたりしない）', () => {
    const surface = new BodySurface(project.model.shape!);
    // 表面の点は、外向きに少し動かすと本体の外に出る
    for (const theta of [0, 0.4, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
      for (const y of [5, 20, 40]) {
        const p = surface.point(y, theta);
        const n = surface.normal(y, theta);
        const outward = new THREE.Vector3(p.x, 0, p.z - surface.centerZ(y) * 0.01);
        expect(n.dot(outward)).toBeGreaterThan(0);
        expect(n.length()).toBeCloseTo(1, 9);
      }
    }
    const body = new THREE.Box3().setFromObject(model.root.getObjectByName('body')!);
    const pocket = new THREE.Box3().setFromObject(model.root.getObjectByName('side_pocket.R')!);
    // ポケットの外側は、本体の幅より少しだけ外（厚み0.45cm以内）
    expect((pocket.max.x - body.max.x) * 100).toBeGreaterThan(0);
    expect((pocket.max.x - body.max.x) * 100).toBeLessThan(0.6);
  });

  it('30秒を通して、商品が画面に収まり、文字・写真・ロゴの場所にかからない', () => {
    const plan = buildTimeline(project, model.info);
    expect(plan.warnings).toEqual([]);
    const boundsOver = (from: number, to: number) => {
      const b = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      for (let t = from; t <= to + 1e-9; t += 1 / FPS) {
        const s = screenBounds(plan, sampleTimeline(plan, t));
        b.left = Math.min(b.left, s.left);
        b.right = Math.max(b.right, s.right);
        b.top = Math.min(b.top, s.top);
        b.bottom = Math.max(b.bottom, s.bottom);
      }
      return b;
    };
    const turnStart = plan.reassembleStart + plan.reassembleDur;
    // 全体像：上の商品名にかからない
    const overview = boundsOver(0, 5);
    expect(overview.left).toBeGreaterThanOrEqual(0);
    expect(overview.right).toBeLessThanOrEqual(1080);
    expect(overview.top).toBeGreaterThanOrEqual(480);
    expect(overview.bottom).toBeLessThanOrEqual(1540);
    // 分解：上の説明のカードにかからない
    const exploded = boundsOver(plan.explodeCameraArrive, 22);
    expect(exploded.left).toBeGreaterThanOrEqual(0);
    expect(exploded.right).toBeLessThanOrEqual(1080);
    expect(exploded.top).toBeGreaterThanOrEqual(500);
    expect(exploded.bottom).toBeLessThanOrEqual(1580);
    // 1回転：写真のカード（上端 1188px）にほとんどかからない位置まで、上に寄せて小さくしている
    const turn = boundsOver(turnStart, 27);
    expect(turn.top).toBeGreaterThanOrEqual(370);
    expect(turn.bottom).toBeLessThanOrEqual(1260);
    // まとめ（28秒〜最後）：まとめの文とロゴの間
    const last = boundsOver(28, DURATION_SEC);
    expect(last.top).toBeGreaterThanOrEqual(541);
    expect(last.bottom).toBeLessThanOrEqual(1398);
  });
});

describe('近似モデルの入力チェック', () => {
  it('形のデータがなければエラーになる', () => {
    const data = input();
    delete data.model.shape;
    const r = parseProject(data);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain('形のデータ（shape）が必要です');
  });

  it('輪郭の高さが商品の高さと合っていなければエラーになる', () => {
    const data = input();
    data.model.heightCm = 60;
    const r = parseProject(data);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain('商品の高さ（60cm）と合っていません');
  });

  it('輪郭の点が高さの順に並んでいなければエラーになる', () => {
    const data = input();
    data.model.shape.profile[3].y = 1;
    const r = parseProject(data);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain('高さの順に並べてください');
  });
});
