// テスト用の共通部品
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEIGHT, WIDTH } from '../src/core/constants.ts';
import { parseProject } from '../src/core/schema.ts';
import type { Project } from '../src/core/schema.ts';
import { buildTimeline, nodeOffset } from '../src/core/timeline.ts';
import type { FrameState, ModelInfo, TimelinePlan } from '../src/core/timeline.ts';
import { DEG, add, dot, normalize, rotateY, sub } from '../src/core/vec.ts';
import type { Vec3 } from '../src/core/vec.ts';
import { boxCorners } from '../src/core/camera.ts';
import { createPlaceholderPack } from '../src/stage/placeholderPack.ts';

export const SAMPLE_DIR = join(import.meta.dirname, '..', 'examples', 'sample-pack');

/** サンプルの project.json を、まだ検証していない生のデータとして読む */
export function sampleInput(): Record<string, any> {
  return JSON.parse(readFileSync(join(SAMPLE_DIR, 'project.json'), 'utf8'));
}

export function mustParse(input: unknown): Project {
  const r = parseProject(input);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.project;
}

/** 仮モデルの寸法（three.js の形状計算だけを使う。描画はしない） */
export function modelInfoFor(project: Project): ModelInfo {
  return createPlaceholderPack(project).info;
}

export function planFor(project: Project): TimelinePlan {
  return buildTimeline(project, modelInfoFor(project));
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** 点を画面の座標（−1〜1 が画面内）に直す。three.js のカメラと同じ計算 */
export function projectToScreen(state: FrameState, point: Vec3): { x: number; y: number; depth: number } {
  const forward = normalize(sub(state.camera.target, state.camera.position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const rel = sub(point, state.camera.position);
  const depth = dot(rel, forward);
  const tanV = Math.tan((state.camera.fovDeg * DEG) / 2);
  const tanH = tanV * (WIDTH / HEIGHT);
  return { x: dot(rel, right) / (depth * tanH), y: dot(rel, up) / (depth * tanV), depth };
}

/** その時刻の、すべての部品の角の位置（ワールド座標） */
export function worldCorners(plan: TimelinePlan, state: FrameState): Vec3[] {
  const out: Vec3[] = [];
  for (const part of plan.parts) {
    const offset = state.parts.find((p) => p.id === part.id)!.offset;
    for (const node of part.nodes) {
      for (const corner of boxCorners(add(node.center, nodeOffset(offset, node.center[0])), node.size)) {
        out.push(add(rotateY(corner, state.yawRad), [0, state.liftM, 0]));
      }
    }
  }
  return out;
}
