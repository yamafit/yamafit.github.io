// カメラの位置と「画面に収まる距離」の計算（three.js に依存しない）
import { DEG, add, dot, rotateY, scale, sub } from './vec.ts';
import type { Vec3 } from './vec.ts';

/** 注視点から見たカメラの方向（見下ろし角 el 度。カメラは +Z 側に置く） */
export function cameraDirection(elevationDeg: number): Vec3 {
  const el = elevationDeg * DEG;
  return [0, Math.sin(el), Math.cos(el)];
}

export function cameraPosition(target: Vec3, distance: number, elevationDeg: number): Vec3 {
  return add(target, scale(cameraDirection(elevationDeg), distance));
}

export interface FitOptions {
  /** 縦方向の画角（度） */
  fovDeg: number;
  /** 画面の横÷縦 */
  aspect: number;
  /** 画面の横幅のうち使ってよい割合 */
  marginX: number;
  /** 画面の高さのうち使ってよい割合 */
  marginY: number;
}

/**
 * すべての点が画面に収まる最小のカメラ距離を求める。
 * points はモデルを回した後の座標（ワールド座標）。
 */
export function fitDistance(points: readonly Vec3[], target: Vec3, elevationDeg: number, opt: FitOptions): number {
  const el = elevationDeg * DEG;
  const toCamera: Vec3 = [0, Math.sin(el), Math.cos(el)];
  const right: Vec3 = [1, 0, 0];
  const up: Vec3 = [0, Math.cos(el), -Math.sin(el)];
  const tanV = Math.tan((opt.fovDeg * DEG) / 2);
  const tanH = tanV * opt.aspect;
  let need = 0;
  for (const p of points) {
    const rel = sub(p, target);
    const x = Math.abs(dot(rel, right));
    const y = Math.abs(dot(rel, up));
    const z = dot(rel, toCamera); // カメラに近いほど大きい
    need = Math.max(need, x / (tanH * opt.marginX) + z, y / (tanV * opt.marginY) + z);
  }
  return need;
}

/** 箱の8つの角 */
export function boxCorners(center: Vec3, size: Vec3): Vec3[] {
  const out: Vec3[] = [];
  for (const sx of [-0.5, 0.5]) {
    for (const sy of [-0.5, 0.5]) {
      for (const sz of [-0.5, 0.5]) {
        out.push([center[0] + size[0] * sx, center[1] + size[1] * sy, center[2] + size[2] * sz]);
      }
    }
  }
  return out;
}

/** 点の集まりを囲む箱の中心 */
export function boundsCenter(points: readonly Vec3[]): Vec3 {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      if (p[i]! < min[i]!) min[i] = p[i]!;
      if (p[i]! > max[i]!) max[i] = p[i]!;
    }
  }
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

export function rotatePointsY(points: readonly Vec3[], yawDeg: number): Vec3[] {
  const rad = yawDeg * DEG;
  return points.map((p) => rotateY(p, rad));
}
