// 画面に出す文字：いつ・何を・どのくらいの濃さで出すかを決める（時刻 t だけで決まる純粋な計算）。
//
// 文字の内容は、商品データに入力された文をそのまま使う。ここで文を作ったり、言い換えたりはしない。
// システムが足すのは「特徴 1/2」「パーツ 1/4」「まとめ」という見出しだけ。
import { projectToPixels } from './camera.ts';
import { DURATION_SEC, SCENES } from './constants.ts';
import { clamp01, smoothstep } from './easing.ts';
import type { Project } from './schema.ts';
import type { FrameState, TimelinePlan } from './timeline.ts';
import { add, rotateY } from './vec.ts';

interface Shown {
  /** 濃さ（0〜1） */
  alpha: number;
  /** 現れる動きの進み具合（0〜1。1 で定位置） */
  rise: number;
}

export type Caption =
  | ({ kind: 'title'; maker: string; name: string } & Shown)
  | ({ kind: 'feature'; index: number; total: number; text: string } & Shown)
  | ({ kind: 'part'; partId: string; index: number; total: number; label: string; role: string; anchor: { x: number; y: number } } & Shown)
  | ({ kind: 'name'; maker: string; name: string } & Shown)
  | ({ kind: 'summary'; text: string } & Shown)
  | ({ kind: 'logo' } & Shown);

/** 文字が現れてから定位置に落ち着くまで・消えるまでの時間以外の、細かい間 */
const TITLE_START = 0.4;
const FEATURE_LEAD = 0.35; // シーンが切り替わってから特徴の文が出るまで
const SUMMARY_LEAD = 0.15;
const LOGO_LEAD = 0.6;

function shown(t: number, start: number, fadeOutStart: number, fade: number): Shown {
  const rise = smoothstep((t - start) / fade);
  return { rise, alpha: rise * (1 - smoothstep((t - fadeOutStart) / fade)) };
}

/** まとめの文。入力がなければ、特徴の1件目をそのまま使う */
export function summaryText(project: Project): string {
  return project.product.summary !== '' ? project.product.summary : project.product.features[0]!.text;
}

/** 時刻 state.t に表示する文字（濃さが0のものは含めない） */
export function captionsAt(project: Project, plan: TimelinePlan, state: FrameState): Caption[] {
  const t = state.t;
  const text = project.direction.text;
  const fade = text.fadeSec;
  const { maker, name } = project.product;
  const [overview, , , reassemble, summary] = SCENES;
  const out: Caption[] = [];
  const push = (c: Caption) => {
    if (c.alpha > 0) out.push(c);
  };

  // 全体像：メーカー名と商品名
  push({ kind: 'title', maker, name, ...shown(t, TITLE_START, Math.min(TITLE_START + text.productNameSec, overview.end - fade - 0.05), fade) });

  // 特徴の紹介：入力した文をそのまま
  for (const f of plan.features) {
    const start = f.start + FEATURE_LEAD;
    push({
      kind: 'feature',
      index: f.index,
      total: plan.features.length,
      text: f.text,
      ...shown(t, start, Math.min(start + text.featureSec, f.end - fade - 0.02), fade),
    });
  }

  // 分解：紹介中のパーツの名前と役割。前のパーツの文字が消えてから、次のパーツの文字を出す
  plan.highlights.forEach((h, index) => {
    const part = plan.parts.find((p) => p.id === h.partId);
    const partState = state.parts.find((p) => p.id === h.partId);
    if (!part || !partState) return;
    const alpha = clamp01((partState.emphasis - 0.5) * 2);
    if (alpha <= 0) return;
    // 紹介の間、パーツは分解しきった位置にある
    const world = add(rotateY(part.explodedFocus, state.yawRad), [0, state.liftM, 0]);
    const px = projectToPixels(state.camera, world);
    out.push({ kind: 'part', partId: part.id, index, total: plan.highlights.length, label: part.label, role: part.role, anchor: { x: px.x, y: px.y }, alpha, rise: alpha });
  });

  // 再組み立てのあと：商品名を小さく
  push({ kind: 'name', maker, name, ...shown(t, plan.reassembleStart + plan.reassembleDur - 0.1, reassemble.end - fade - 0.1, fade) });

  // まとめ：最後のフレームまで出したままにする
  push({ kind: 'summary', text: summaryText(project), ...shown(t, summary.start + SUMMARY_LEAD, DURATION_SEC + 1, fade) });
  push({ kind: 'logo', ...shown(t, summary.start + LOGO_LEAD, DURATION_SEC + 1, fade) });
  return out;
}
