// 3Dの上に重ねる2Dの描画（文字・ロゴ・透かし）。HTMLの文字は使わず、すべてキャンバスに描く。
// Phase 1 では透かしだけ。商品名・特徴・パーツの説明・ロゴは Phase 2 で追加する。
import { SAFE_AREA, WIDTH } from '../core/constants.ts';
import type { Project } from '../core/schema.ts';
import { FONT_JP } from './fonts.ts';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 透かし「検証用・公開不可」。仮モデルの動画を誤って公開しないための表示 */
function drawWatermark(ctx: CanvasRenderingContext2D, project: Project): void {
  const title = '検証用・公開不可';
  const note = project.model.kind === 'placeholder-pack' ? '仮の3Dモデルです（実物の形とは異なります）' : '確認用の書き出しです';
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 40px "${FONT_JP}"`;
  const titleW = ctx.measureText(title).width;
  ctx.font = `700 24px "${FONT_JP}"`;
  const noteW = ctx.measureText(note).width;
  const padX = 28;
  const w = Math.max(titleW, noteW) + padX * 2;
  const h = 112;
  const x = Math.round((WIDTH - SAFE_AREA.left - SAFE_AREA.right - w) / 2 + SAFE_AREA.left);
  const y = SAFE_AREA.top - h - 24 > 40 ? SAFE_AREA.top - h - 24 : 40;
  ctx.fillStyle = 'rgba(20, 35, 28, 0.82)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(238, 243, 236, 0.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 10);
  ctx.stroke();
  ctx.fillStyle = '#EEF3EC';
  ctx.textAlign = 'center';
  ctx.font = `900 40px "${FONT_JP}"`;
  ctx.fillText(title, x + w / 2, y + 52);
  ctx.font = `700 24px "${FONT_JP}"`;
  ctx.fillStyle = '#B9CABF';
  ctx.fillText(note, x + w / 2, y + 90);
  ctx.restore();
}

export function drawOverlay(ctx: CanvasRenderingContext2D, project: Project): void {
  if (project.output.watermark) drawWatermark(ctx, project);
}
