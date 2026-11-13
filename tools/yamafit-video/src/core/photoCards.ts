// 実物写真のカード：いつ・どの写真を・どこに出すかを決める（時刻 t だけで決まる純粋な計算）。
//
// 3Dは仮モデル（または商品別モデル）で、実物そのものではない。
// 実物の見た目は写真で見せ、「実物写真」と明記する。写真を3Dモデルに貼ることはしない。
import { CATEGORIES, partDef } from './categories/pack.ts';
import { SCENES } from './constants.ts';
import { clamp01, smoothstep } from './easing.ts';
import type { Project } from './schema.ts';
import type { TimelinePlan } from './timeline.ts';

export type PhotoView = Project['images'][number]['view'];

export interface PhotoCard {
  /** project.images の何番目か */
  image: number;
  view: PhotoView;
  /** 画面の左下・右下のどちらに出すか */
  side: 'left' | 'right';
  /** 濃さ（0〜1） */
  alpha: number;
}

export const PHOTO_VIEW_LABEL: Record<PhotoView, string> = { front: '正面', back: '背面', side: '側面', detail: '細部' };

const FADE = 0.4;
const LEAD = 0.25; // シーンが切り替わってからカードが替わるまでの間

/** start で現れ始め、fadeOutStart で消え始める */
function windowAlpha(t: number, start: number, fadeOutStart: number): number {
  return smoothstep((t - start) / FADE) * (1 - smoothstep((t - fadeOutStart) / FADE));
}

/** そのパーツが背面側にあるか（背面側なら背面の写真を見せる） */
function isBackSide(project: Project, partId: string | undefined): boolean {
  const category = CATEGORIES[project.category];
  const def = partId && category ? partDef(category, partId) : undefined;
  if (!def) return false;
  const yaw = ((def.viewYawDeg % 360) + 360) % 360;
  return yaw > 90 && yaw < 270;
}

/** 時刻 t に表示する実物写真のカード（濃さが0のものは含めない） */
export function photoCardsAt(project: Project, plan: TimelinePlan, t: number): PhotoCard[] {
  if (!project.direction.showPhotos || project.images.length === 0) return [];
  const frontIndex = Math.max(project.images.findIndex((i) => i.view === 'front'), 0);
  const backIndex = project.images.findIndex((i) => i.view === 'back');
  const [overview, featuresScene, , reassemble] = SCENES;

  // 左下のカード：全体像では正面、特徴の紹介ではそのパーツがある側の写真。切り替えは重ねてつなぐ。
  const left = new Map<number, number>();
  const addLeft = (image: number, alpha: number) => left.set(image, (left.get(image) ?? 0) + alpha);
  const firstFeature = plan.features[0];
  addLeft(frontIndex, windowAlpha(t, 0.6, firstFeature ? firstFeature.start + LEAD : overview.end - FADE));
  plan.features.forEach((f, i) => {
    const next = plan.features[i + 1];
    const image = isBackSide(project, f.focusPartId) && backIndex >= 0 ? backIndex : frontIndex;
    addLeft(image, windowAlpha(t, f.start + LEAD, next ? next.start + LEAD : featuresScene.end - FADE - 0.05));
  });

  // 再組み立てのあとの1回転：正面と背面を左右に並べる
  const turn = windowAlpha(t, plan.reassembleStart + plan.reassembleDur - 0.2, reassemble.end - FADE - 0.1);
  addLeft(frontIndex, turn);

  const cards: PhotoCard[] = [];
  for (const [image, alpha] of left) {
    if (alpha > 0) cards.push({ image, view: project.images[image]!.view, side: 'left', alpha: clamp01(alpha) });
  }
  if (backIndex >= 0 && backIndex !== frontIndex && turn > 0) {
    cards.push({ image: backIndex, view: project.images[backIndex]!.view, side: 'right', alpha: clamp01(turn) });
  }
  return cards;
}
