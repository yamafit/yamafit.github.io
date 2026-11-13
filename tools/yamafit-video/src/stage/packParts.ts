// ザックのモデルを作るための共通の部品（材質、帯、角の丸い断面）
import * as THREE from 'three';

/** 布の質感の材質（パーツごとに別の材質にして、個別に薄くできるようにする） */
export function fabric(color: string, roughness = 0.88): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness: 0 });
}

export function mix(a: string, b: string, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 角の丸い長方形（帯の断面） */
export function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * 道筋に沿った帯。断面の「幅」の向きを widthAxis にそろえる
 * （three.js 標準の押し出しは向きがねじれることがあるため、自前で作る）。
 * width に関数を渡すと、道筋の途中で幅を変えられる（u は 0〜1）。
 */
export function ribbon(
  points: THREE.Vector3[],
  width: number | ((u: number) => number),
  thickness: number,
  widthAxis: THREE.Vector3,
  steps = 48,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const widthAt = typeof width === 'number' ? () => width : width;
  const baseWidth = widthAt(0);
  const shape = roundedRect(baseWidth, thickness, Math.min(baseWidth, thickness) * 0.45).getPoints(4);
  const ring = shape.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, tangent);
    // 幅の向き：指定の軸から、進行方向の成分を取り除く
    side.copy(widthAxis).addScaledVector(tangent, -widthAxis.dot(tangent)).normalize();
    normal.crossVectors(tangent, side).normalize();
    const k = widthAt(u) / baseWidth;
    for (const q of shape) {
      const qx = q.x * k;
      positions.push(p.x + side.x * qx + normal.x * q.y, p.y + side.y * qx + normal.y * q.y, p.z + side.z * qx + normal.z * q.y);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const b = i * ring + ((j + 1) % ring);
      const c = (i + 1) * ring + j;
      const d = (i + 1) * ring + ((j + 1) % ring);
      indices.push(a, c, b, b, c, d);
    }
  }
  // 両端をふさぐ
  for (const [base, flip] of [
    [0, false],
    [steps * ring, true],
  ] as const) {
    for (let j = 1; j < ring - 1; j++) {
      if (flip) indices.push(base, base + j + 1, base + j);
      else indices.push(base, base + j, base + j + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
