// テスト用の共通部品
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseProject } from '../src/core/schema.ts';
import type { Project } from '../src/core/schema.ts';
import { buildTimeline, nodeOffset } from '../src/core/timeline.ts';
import type { FrameState, ModelInfo, TimelinePlan } from '../src/core/timeline.ts';
import { add, rotateY } from '../src/core/vec.ts';
import type { Vec3 } from '../src/core/vec.ts';
import { boxCorners, projectToPixels } from '../src/core/camera.ts';
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

/** 点が画面のどこ（px）に映るか。画面の中なら x は 0〜1080、y は 0〜1920 */
export function screenPoint(state: FrameState, point: Vec3): { x: number; y: number; depth: number } {
  return projectToPixels(state.camera, point);
}

/** その時刻に、商品（すべての部品）が画面の中で占める範囲（px） */
export function screenBounds(plan: TimelinePlan, state: FrameState): { left: number; right: number; top: number; bottom: number; minDepth: number } {
  const b = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, minDepth: Infinity };
  for (const c of worldCorners(plan, state)) {
    const p = projectToPixels(state.camera, c);
    b.left = Math.min(b.left, p.x);
    b.right = Math.max(b.right, p.x);
    b.top = Math.min(b.top, p.y);
    b.bottom = Math.max(b.bottom, p.y);
    b.minDepth = Math.min(b.minDepth, p.depth);
  }
  return b;
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
