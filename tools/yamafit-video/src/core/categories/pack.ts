// 登山ザックの候補パーツ。
// 分解の向きは、縦長（9:16）の画面に収まるよう、上下方向を多めに使う並べ方にしてある。
//ここにあるのは「候補」で、
// 実際に描くのは商品データに登録され、確認済みのパーツだけ。
import type { Vec3 } from '../vec.ts';

export interface PartDef {
  /** パーツID。glb のノード名にも使う */
  id: string;
  /** 画面に出す名前の初期値 */
  label: string;
  /** 本体（分解しても動かない。必ず必要） */
  body?: boolean;
  /** 分解する向き（モデルの座標。上が+Y、正面が+Z） */
  explodeDir: Vec3;
  /** 分解距離の倍率（全体の分解距離に掛ける） */
  explodeScale: number;
  /** このパーツがよく見えるモデルの向き（度） */
  viewYawDeg: number;
  /** このパーツを見るときのカメラの見下ろし角（度） */
  viewElevationDeg: number;
  /** 分解の順番の初期値（小さいほど先に動く） */
  order: number;
}

export interface CategoryDef {
  id: string;
  label: string;
  parts: readonly PartDef[];
  /** 冒頭の向き（度）。正面ななめ */
  introYawDeg: number;
  /** 分解した状態を見せる向きと見下ろし角（度） */
  explodeViewYawDeg: number;
  explodeViewElevationDeg: number;
}

export const PACK: CategoryDef = {
  id: 'pack',
  label: '登山ザック',
  introYawDeg: -25,
  // 分解は背面の斜め横から見せる（背面側の部品が手前に並び、重なりにくい）
  explodeViewYawDeg: 138,
  explodeViewElevationDeg: 20,
  parts: [
    { id: 'main_compartment', label: 'メイン収納部', body: true, explodeDir: [0, 0, 0], explodeScale: 0, viewYawDeg: 25, viewElevationDeg: 5, order: 0 },
    { id: 'top_lid', label: '雨蓋', explodeDir: [0, 1, 0.1], explodeScale: 0.8, viewYawDeg: 25, viewElevationDeg: 28, order: 1 },
    { id: 'side_pocket', label: 'サイドポケット', explodeDir: [1, 0, 0], explodeScale: 0.45, viewYawDeg: -62, viewElevationDeg: 8, order: 2 },
    { id: 'back_panel', label: '背面パネル', explodeDir: [0, 0, -1], explodeScale: 0.4, viewYawDeg: 158, viewElevationDeg: 5, order: 3 },
    { id: 'hip_belt', label: 'ヒップベルト', explodeDir: [0, -0.45, -1], explodeScale: 0.7, viewYawDeg: 200, viewElevationDeg: 8, order: 4 },
    { id: 'shoulder_harness', label: 'ショルダーハーネス', explodeDir: [0, 0.2, -1], explodeScale: 0.88, viewYawDeg: 150, viewElevationDeg: 10, order: 5 },
    { id: 'chest_strap', label: 'チェストストラップ', explodeDir: [0, 0.75, -1], explodeScale: 1.1, viewYawDeg: 180, viewElevationDeg: 8, order: 6 },
  ],
};

/** カテゴリーの一覧。登山靴・ウェアは同じ形の定義を足して追加する（MVPでは未実装） */
export const CATEGORIES: Record<string, CategoryDef> = { pack: PACK };

export function partDef(category: CategoryDef, id: string): PartDef | undefined {
  return category.parts.find((p) => p.id === id);
}
