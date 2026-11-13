// 3Dモデルの共通の形。仮モデルでも商品別モデル（glb）でも同じ形で扱う。
import * as THREE from 'three';
import type { ModelInfo, NodeBox } from '../core/timeline.ts';

export interface ProductModel {
  /** 回転・持ち上げをかける一番外側のグループ */
  root: THREE.Group;
  /** パーツID → そのパーツの部品（左右一対なら2つ） */
  partNodes: Map<string, THREE.Object3D[]>;
  /** タイムライン計算に渡す寸法（メートル） */
  info: ModelInfo;
  /** メートルの移動量を、部品の座標の移動量に直す倍率 */
  offsetScale: number;
}

/** 部品の大きさを測る（モデルが原点・無回転の状態で呼ぶこと） */
export function measureModel(root: THREE.Group, partNodes: Map<string, THREE.Object3D[]>): ModelInfo {
  root.updateMatrixWorld(true);
  const whole = new THREE.Box3();
  const parts: ModelInfo['parts'] = {};
  for (const [id, nodes] of partNodes) {
    const boxes: NodeBox[] = nodes.map((node) => {
      const box = new THREE.Box3().setFromObject(node);
      whole.union(box);
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      return { name: node.name, center: [c.x, c.y, c.z], size: [s.x, s.y, s.z] };
    });
    parts[id] = { nodes: boxes };
  }
  const c = whole.isEmpty() ? new THREE.Vector3() : whole.getCenter(new THREE.Vector3());
  return { heightM: whole.isEmpty() ? 0 : whole.max.y, center: [c.x, c.y, c.z], parts };
}
