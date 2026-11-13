// 写真の輪郭に合わせた近似モデル（model.kind = "profile-pack"）。
//
// 商品写真の輪郭と公式の寸法から決めた数値（project.json の model.shape）をもとに、
// パーツごとに分かれたザックの形を作る。どの商品にも使う仮モデル（placeholderPack）より
// 実物に近いが、あくまで近似で、縫い目・ロゴ・生地の質感などの細部は再現しない。
//
// 座標の決まり：上が +Y、正面（背負う人の背中と反対側）が +Z、背面の面が z=0、底が y=0。
// 部品の名前はパーツID（左右一対は .L / .R を付ける）。glb の規格と同じにしてある。
import * as THREE from 'three';
import type { PackShape, Project } from '../core/schema.ts';
import { measureModel } from './model.ts';
import type { ProductModel } from './model.ts';
import { fabric, mesh, mix, ribbon, v3 } from './packParts.ts';

const CM = 0.01;

/** 行き過ぎの起きない、なめらかな補間（単調3次補間）。輪郭の点の間をつなぐ */
export function monotoneInterpolator(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length;
  const h: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1]! - xs[i]!);
    delta.push((ys[i + 1]! - ys[i]!) / h[i]!);
  }
  const m: number[] = new Array<number>(n).fill(0);
  m[0] = delta[0]!;
  m[n - 1] = delta[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const a = delta[i - 1]!;
    const b = delta[i]!;
    if (a * b <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i]! + h[i - 1]!;
      const w2 = h[i]! + 2 * h[i - 1]!;
      m[i] = (w1 + w2) / (w1 / a + w2 / b);
    }
  }
  return (x: number) => {
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]!) i++;
    const t = (x - xs[i]!) / h[i]!;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * h[i]! * m[i + 1]!
    );
  };
}

/**
 * 本体の表面。高さ y（cm）と、まわりの角度 theta から、表面の点を返す。
 * theta は真上から見た角度で、0 が右（+X）、90度が正面（+Z）、270度が背面。
 * 断面は、正面側が丸く、背面側が平らに近い形。
 */
export class BodySurface {
  readonly bottomY: number;
  readonly topY: number;
  private readonly widthAt: (y: number) => number;
  private readonly depthAt: (y: number) => number;
  private readonly shape: PackShape;

  constructor(shape: PackShape) {
    this.shape = shape;
    const ys = shape.profile.map((p) => p.y);
    this.bottomY = ys[0]!;
    this.topY = ys[ys.length - 1]!;
    this.widthAt = monotoneInterpolator(ys, shape.profile.map((p) => p.halfWidth));
    this.depthAt = monotoneInterpolator(ys, shape.profile.map((p) => p.depth));
  }

  /** 表面の点（メートル） */
  point(yCm: number, theta: number): THREE.Vector3 {
    const y = Math.min(Math.max(yCm, this.bottomY), this.topY);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const front = s >= 0;
    const e = 2 / (front ? this.shape.frontRoundness : this.shape.backRoundness);
    const x = this.widthAt(y) * Math.sign(c) * Math.pow(Math.abs(c), e);
    const z = front ? this.depthAt(y) * Math.pow(s, e) : -this.shape.backBulgeCm * Math.pow(-s, e);
    return new THREE.Vector3(x * CM, y * CM, z * CM);
  }

  /** その高さでの、前後方向の中心（cm） */
  centerZ(yCm: number): number {
    return (this.depthAt(Math.min(Math.max(yCm, this.bottomY), this.topY)) - this.shape.backBulgeCm) / 2;
  }

  /** 表面の外向きの向き */
  normal(yCm: number, theta: number): THREE.Vector3 {
    const dT = 1e-3;
    const dY = 0.05;
    const y = Math.min(Math.max(yCm, this.bottomY + dY), this.topY - dY);
    const around = this.point(y, theta + dT).sub(this.point(y, theta - dT));
    const up = this.point(y + dY, theta).sub(this.point(y - dY, theta));
    const n = new THREE.Vector3().crossVectors(up, around).normalize();
    const p = this.point(y, theta);
    const outward = new THREE.Vector3(p.x, 0, p.z - this.centerZ(y) * CM);
    return n.dot(outward) < 0 ? n.negate() : n;
  }

  /** 本体の形（閉じた立体） */
  geometry(rings = 64, segments = 72): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= rings; i++) {
      // 上下の端を細かく、中ほどを粗く分ける（端の丸みをなめらかにするため）
      const y = this.bottomY + ((this.topY - this.bottomY) * (1 - Math.cos((Math.PI * i) / rings))) / 2;
      for (let j = 0; j < segments; j++) {
        const p = this.point(y, (2 * Math.PI * j) / segments);
        positions.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * segments + j;
        const b = i * segments + ((j + 1) % segments);
        const c = (i + 1) * segments + j;
        const d = (i + 1) * segments + ((j + 1) % segments);
        indices.push(a, c, b, b, c, d);
      }
    }
    // 底と上をふさぐ
    const bottomCenter = positions.length / 3;
    positions.push(0, this.bottomY * CM, this.centerZ(this.bottomY) * CM);
    const topCenter = bottomCenter + 1;
    positions.push(0, this.topY * CM, this.centerZ(this.topY) * CM);
    const topRing = rings * segments;
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      indices.push(bottomCenter, j, next);
      indices.push(topCenter, topRing + next, topRing + j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  /**
   * 本体の表面に沿った、薄い板（ポケットや背面パッド）。
   * theta0〜theta1 の範囲を、表面から inner〜outer（cm）だけ外に浮かせて作る。
   */
  shell(opts: {
    theta0: number;
    theta1: number;
    bottomY: (u: number) => number;
    topY: (u: number) => number;
    innerCm: number;
    outerCm: number;
    nu?: number;
    nv?: number;
  }): THREE.BufferGeometry {
    const nu = opts.nu ?? 28;
    const nv = opts.nv ?? 28;
    const outer: THREE.Vector3[][] = [];
    const inner: THREE.Vector3[][] = [];
    for (let iu = 0; iu <= nu; iu++) {
      const u = iu / nu;
      const theta = opts.theta0 + (opts.theta1 - opts.theta0) * u;
      const rowOuter: THREE.Vector3[] = [];
      const rowInner: THREE.Vector3[] = [];
      for (let iv = 0; iv <= nv; iv++) {
        const y = opts.bottomY(u) + (opts.topY(u) - opts.bottomY(u)) * (iv / nv);
        const base = this.point(y, theta);
        const n = this.normal(y, theta);
        rowOuter.push(base.clone().addScaledVector(n, opts.outerCm * CM));
        rowInner.push(base.clone().addScaledVector(n, opts.innerCm * CM));
      }
      outer.push(rowOuter);
      inner.push(rowInner);
    }
    const positions: number[] = [];
    const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
      // a-b / c-d の四角形を2つの三角形にする（頂点は共有しない＝縁がくっきり出る）
      for (const p of [a, c, b, b, c, d]) positions.push(p.x, p.y, p.z);
    };
    for (let iu = 0; iu < nu; iu++) {
      for (let iv = 0; iv < nv; iv++) {
        quad(outer[iu]![iv]!, outer[iu + 1]![iv]!, outer[iu]![iv + 1]!, outer[iu + 1]![iv + 1]!);
        quad(inner[iu + 1]![iv]!, inner[iu]![iv]!, inner[iu + 1]![iv + 1]!, inner[iu]![iv + 1]!);
      }
    }
    // まわりの縁（厚みの面）
    for (let iu = 0; iu < nu; iu++) {
      quad(outer[iu + 1]![0]!, outer[iu]![0]!, inner[iu + 1]![0]!, inner[iu]![0]!);
      quad(outer[iu]![nv]!, outer[iu + 1]![nv]!, inner[iu]![nv]!, inner[iu + 1]![nv]!);
    }
    for (let iv = 0; iv < nv; iv++) {
      quad(outer[0]![iv]!, outer[0]![iv + 1]!, inner[0]![iv]!, inner[0]![iv + 1]!);
      quad(outer[nu]![iv + 1]!, outer[nu]![iv]!, inner[nu]![iv + 1]!, inner[nu]![iv]!);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }
}

const toVec = (p: readonly [number, number, number], mirror = 1) => v3(p[0] * mirror * CM, p[1] * CM, p[2] * CM);

/** +X側の半分の道筋（最後の点が中央）を、左右対称の1本の道筋にする */
function symmetricPath(half: readonly (readonly [number, number, number])[]): THREE.Vector3[] {
  const left = half.slice(0, -1).map((p) => toVec(p, -1));
  const right = half.slice(0, -1).map((p) => toVec(p, 1)).reverse();
  return [...left, toVec(half[half.length - 1]!), ...right];
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w * CM, h * CM, d * CM);
}

export function createProfilePack(project: Project): ProductModel {
  const shape = project.model.shape;
  if (!shape) throw new Error('近似モデル（profile-pack）には、形のデータ（shape）が必要です');
  const colors = project.model.colors;
  const confirmed = new Set(project.parts.filter((p) => p.confirmed).map((p) => p.id));
  const surface = new BodySurface(shape);

  const root = new THREE.Group();
  root.name = 'model-root';
  const holder = new THREE.Group();
  holder.name = 'model-center';
  root.add(holder);
  const partNodes = new Map<string, THREE.Object3D[]>();

  /** 登録・確認済みで、形のデータがあるパーツだけを作る */
  const addPart = (id: string, build: () => THREE.Object3D[] | null) => {
    if (!confirmed.has(id)) return;
    const nodes = build();
    if (!nodes) return;
    for (const n of nodes) holder.add(n);
    partNodes.set(id, nodes);
  };

  const strapMaterial = () => fabric(colors.strap, 0.93);
  const buckleMaterial = () => fabric(mix(colors.strap, '#000000', 0.35), 0.5);
  const doubleSided = (m: THREE.MeshStandardMaterial) => {
    m.side = THREE.DoubleSide;
    return m;
  };

  addPart('main_compartment', () => {
    const g = new THREE.Group();
    g.name = 'main_compartment';
    g.add(mesh(surface.geometry(), fabric(colors.main, 0.8), 'body'));
    if (shape.handle) {
      const handle = ribbon(symmetricPath(shape.handle.path), shape.handle.widthCm * CM, shape.handle.thicknessCm * CM, v3(0, 0, 1), 32);
      g.add(mesh(handle, strapMaterial(), 'handle'));
    }
    return [g];
  });

  addPart('back_panel', () => {
    const def = shape.backPanel;
    if (!def) return null;
    // 背面の中央から左右へ、幅の widthRatio 倍まで
    const half = Math.asin(Math.pow(def.widthRatio, shape.backRoundness / 2));
    const panel = surface.shell({
      theta0: 1.5 * Math.PI - half,
      theta1: 1.5 * Math.PI + half,
      bottomY: () => def.bottomY,
      topY: () => def.topY,
      innerCm: 0.05,
      outerCm: def.thicknessCm,
      nu: 40,
    });
    return [mesh(panel, doubleSided(fabric(mix(colors.strap, '#8A9189', 0.07), 0.98)), 'back_panel')];
  });

  addPart('shoulder_harness', () => {
    const def = shape.harness;
    if (!def) return null;
    return [-1, 1].map((sx) => {
      const g = new THREE.Group();
      g.name = sx < 0 ? 'shoulder_harness.L' : 'shoulder_harness.R';
      const pad = def.pad;
      const width = (u: number) => (pad.widthTopCm + (pad.widthBottomCm - pad.widthTopCm) * u) * CM;
      g.add(mesh(ribbon(pad.path.map((p) => toVec(p, sx)), width, pad.thicknessCm * CM, v3(1, 0, 0), 56), strapMaterial(), 'pad'));
      if (def.webbing) {
        const web = def.webbing;
        g.add(mesh(ribbon(web.path.map((p) => toVec(p, sx)), web.widthCm * CM, web.thicknessCm * CM, v3(1, 0, 0), 24), fabric(mix(colors.strap, '#000000', 0.2), 0.8), 'webbing'));
        // 長さ調整の金具（幅の広い部分と細いベルトのつなぎ目）
        const joint = toVec(web.path[0]!, sx);
        const buckle = mesh(box(web.widthCm + 1.0, 3.0, 0.9), buckleMaterial(), 'adjuster');
        buckle.position.copy(joint);
        g.add(buckle);
      }
      return g;
    });
  });

  addPart('chest_strap', () => {
    const def = shape.chestStrap;
    if (!def) return null;
    const g = new THREE.Group();
    g.name = 'chest_strap';
    const strap = mesh(box(def.halfSpanCm * 2, def.widthCm, 0.25), fabric(mix(colors.strap, '#000000', 0.2), 0.8), 'strap');
    strap.position.set(0, def.y * CM, def.z * CM);
    const buckle = mesh(box(3.4, def.widthCm + 0.9, 0.9), buckleMaterial(), 'buckle');
    buckle.position.set(def.buckleXCm * CM, def.y * CM, (def.z - 0.15) * CM);
    g.add(strap, buckle);
    return [g];
  });

  addPart('hip_belt', () => {
    const def = shape.belt;
    if (!def) return null;
    const g = new THREE.Group();
    g.name = 'hip_belt';
    g.add(mesh(ribbon(symmetricPath(def.path), def.widthCm * CM, def.thicknessCm * CM, v3(0, 1, 0), 72), fabric(mix(colors.strap, '#000000', 0.2), 0.8), 'belt'));
    if (def.buckle) {
      const buckle = mesh(box(5.2, def.widthCm + 0.8, 1.2), buckleMaterial(), 'buckle');
      buckle.position.copy(toVec(def.path[def.path.length - 1]!));
      g.add(buckle);
    }
    return [g];
  });

  addPart('side_pocket', () => {
    const def = shape.sidePocket;
    if (!def) return null;
    const from = (def.fromAngleDeg * Math.PI) / 180;
    const to = (def.toAngleDeg * Math.PI) / 180;
    return [-1, 1].map((sx) => {
      // 右側は「背面側→正面側」、左側は左右を反転した範囲（正面側→背面側）
      const right = sx > 0;
      const pocket = surface.shell({
        theta0: right ? from : Math.PI - to,
        theta1: right ? to : Math.PI - from,
        bottomY: () => def.bottomY,
        topY: (u) => (right ? def.topYBack + (def.topYFront - def.topYBack) * u : def.topYFront + (def.topYBack - def.topYFront) * u),
        innerCm: 0.05,
        outerCm: def.thicknessCm,
      });
      return mesh(pocket, doubleSided(fabric(colors.sub, 0.96)), right ? 'side_pocket.R' : 'side_pocket.L');
    });
  });

  // 回転の軸を、上から見た全体の中心に置く。大きさは形のデータ（cm）のまま使う。
  const raw = measureModel(root, partNodes);
  holder.position.set(-raw.center[0], 0, -raw.center[2]);
  const info = measureModel(root, partNodes);
  return { root, partNodes, info, offsetScale: 1 };
}
