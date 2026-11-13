// 仮のザック（検証用）。角を丸めた箱や帯を組み合わせただけの形で、
// 実物の形・ロゴ・縫い目・素材感は再現しない。
//
// 座標の決まり：上が +Y、正面（背負う人の背中と反対側）が +Z、原点は底面の中央。
// 部品の名前はパーツID（左右一対は .L / .R を付ける）。glb の規格と同じにしてある。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Project } from '../core/schema.ts';
import { measureModel } from './model.ts';
import { fabric, mesh, mix, ribbon, v3 } from './packParts.ts';
import type { ProductModel } from './model.ts';

/** 上に向かって細くなる丸い箱（背面側は平らなまま） */
function taperedBox(w: number, h: number, d: number, r: number, taperX: number, taperZ: number): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, 12, r);
  const pos = g.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const u = (y + h / 2) / h; // 0（底）〜1（上）
    const sx = 1 - taperX * u * u;
    const sz = 1 - taperZ * u * u;
    pos.setX(i, pos.getX(i) * sx);
    pos.setZ(i, -d / 2 + (pos.getZ(i) + d / 2) * sz);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

const v = v3;

export function createPlaceholderPack(project: Project): ProductModel {
  const colors = project.model.colors;
  const confirmed = new Set(project.parts.filter((p) => p.confirmed).map((p) => p.id));
  const root = new THREE.Group();
  root.name = 'model-root';
  const scaled = new THREE.Group();
  scaled.name = 'model-scale';
  root.add(scaled);
  const partNodes = new Map<string, THREE.Object3D[]>();

  /** 登録・確認済みのパーツだけを作る（未登録のパーツは形としても出さない） */
  const addPart = (id: string, build: () => THREE.Object3D[]) => {
    if (!confirmed.has(id)) return;
    const nodes = build();
    for (const n of nodes) scaled.add(n);
    partNodes.set(id, nodes);
  };

  const bodyW = 0.29;
  const bodyH = 0.47;
  const bodyD = 0.19;
  const backZ = -bodyD / 2;

  addPart('main_compartment', () => {
    const g = new THREE.Group();
    g.name = 'main_compartment';
    const body = mesh(taperedBox(bodyW, bodyH, bodyD, 0.055, 0.1, 0.16), fabric(colors.main), 'body');
    body.position.set(0, bodyH / 2, 0);
    g.add(body);
    return [g];
  });

  addPart('top_lid', () => {
    const g = new THREE.Group();
    g.name = 'top_lid';
    const lid = mesh(taperedBox(0.275, 0.115, 0.2, 0.05, 0.08, 0.1), fabric(colors.sub), 'lid');
    lid.position.set(0, bodyH + 0.115 / 2 - 0.012, -0.004);
    g.add(lid);
    return [g];
  });

  addPart('back_panel', () => {
    const g = new THREE.Group();
    g.name = 'back_panel';
    const panelColor = mix(colors.strap, '#8A9189', 0.35);
    const plate = mesh(new RoundedBoxGeometry(0.235, 0.4, 0.016, 3, 0.007), fabric(colors.strap, 0.95), 'plate');
    plate.position.set(0, 0.245, backZ - 0.008);
    g.add(plate);
    for (const sx of [-1, 1]) {
      const pad = mesh(new RoundedBoxGeometry(0.085, 0.27, 0.02, 3, 0.009), fabric(panelColor, 0.95), sx < 0 ? 'pad.L' : 'pad.R');
      pad.position.set(sx * 0.06, 0.29, backZ - 0.024);
      g.add(pad);
    }
    const lumbar = mesh(new RoundedBoxGeometry(0.2, 0.085, 0.022, 3, 0.01), fabric(panelColor, 0.95), 'lumbar');
    lumbar.position.set(0, 0.092, backZ - 0.025);
    g.add(lumbar);
    return [g];
  });

  /** ショルダーハーネスの道筋（sx は左右。-1 が左、+1 が右） */
  const harnessPath = (sx: number) => [
    v(sx * 0.06, 0.44, backZ - 0.016),
    v(sx * 0.064, 0.485, backZ - 0.055),
    v(sx * 0.076, 0.45, backZ - 0.098),
    v(sx * 0.098, 0.33, backZ - 0.105),
    v(sx * 0.124, 0.2, backZ - 0.075),
    v(sx * 0.138, 0.115, backZ - 0.022),
  ];

  addPart('shoulder_harness', () =>
    [-1, 1].map((sx) =>
      mesh(ribbon(harnessPath(sx), 0.056, 0.016, v(1, 0, 0)), fabric(colors.strap, 0.92), sx < 0 ? 'shoulder_harness.L' : 'shoulder_harness.R'),
    ),
  );

  addPart('hip_belt', () => {
    const y = 0.088;
    const path = [
      v(-0.1, y, backZ - 0.15),
      v(-0.158, y, backZ - 0.112),
      v(-0.172, y, backZ - 0.06),
      v(-0.135, y, backZ - 0.03),
      v(0, y, backZ - 0.027),
      v(0.135, y, backZ - 0.03),
      v(0.172, y, backZ - 0.06),
      v(0.158, y, backZ - 0.112),
      v(0.1, y, backZ - 0.15),
    ];
    return [mesh(ribbon(path, 0.078, 0.018, v(0, 1, 0), 72), fabric(colors.strap, 0.92), 'hip_belt')];
  });

  addPart('side_pocket', () =>
    [-1, 1].map((sx) => {
      const pocket = mesh(new RoundedBoxGeometry(0.032, 0.165, 0.125, 4, 0.014), fabric(colors.sub), sx < 0 ? 'side_pocket.L' : 'side_pocket.R');
      pocket.position.set(sx * (bodyW / 2 + 0.008), 0.115, 0.004);
      return pocket;
    }),
  );

  addPart('chest_strap', () => {
    const g = new THREE.Group();
    g.name = 'chest_strap';
    // 左右のハーネスの、胸の高さの位置を結ぶ
    const height = 0.36;
    const curve = new THREE.CatmullRomCurve3(harnessPath(1), false, 'centripetal');
    let at = curve.getPointAt(0.5);
    for (let i = 30; i <= 100; i++) {
      const p = curve.getPointAt(i / 100);
      if (Math.abs(p.y - height) < Math.abs(at.y - height)) at = p;
    }
    const z = at.z - 0.012;
    const strap = mesh(new RoundedBoxGeometry(at.x * 2, 0.02, 0.005, 2, 0.002), fabric(colors.strap, 0.9), 'strap');
    strap.position.set(0, at.y, z);
    const buckle = mesh(new RoundedBoxGeometry(0.034, 0.03, 0.01, 2, 0.004), fabric(mix(colors.strap, '#000000', 0.3), 0.6), 'buckle');
    buckle.position.set(0, at.y, z - 0.002);
    g.add(strap, buckle);
    return [g];
  });

  // いったん測ってから、全体の高さが商品の高さ（heightCm）になるように拡大縮小する。
  // 回転の軸は、全体を上から見た中心に置く（回したときに画面からはみ出しにくくするため）。
  const raw = measureModel(root, partNodes);
  const k = raw.heightM > 0 ? project.model.heightCm / 100 / raw.heightM : 1;
  scaled.scale.setScalar(k);
  scaled.position.set(-raw.center[0] * k, 0, -raw.center[2] * k);
  const info = measureModel(root, partNodes);
  return { root, partNodes, info, offsetScale: 1 / k };
}
