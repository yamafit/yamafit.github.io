// 3Dの上に重ねる2Dの描画（文字・ロゴ・透かし）。HTMLの文字は使わず、すべてキャンバスに描く。
// いまあるのは透かしと実物写真のカード。商品名・特徴・パーツの説明・ロゴは Phase 2 で追加する。
import { HEIGHT, SAFE_AREA, WIDTH } from '../core/constants.ts';
import { PHOTO_VIEW_LABEL } from '../core/photoCards.ts';
import type { PhotoCard } from '../core/photoCards.ts';
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
  const note =
    project.model.kind === 'placeholder-pack'
      ? '仮の3Dモデルです（実物の形とは異なります）'
      : project.model.kind === 'profile-pack'
        ? '写真をもとにした近似モデルです（細部は実物と異なります）'
        : '確認用の書き出しです';
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

const CARD = { width: 264, imageHeight: 264, captionHeight: 48, pad: 12, gap: 20 } as const;

/**
 * 実物写真のカード。写真は加工せず、全体が収まるように縮めて載せ、「実物写真」と明記する。
 * 位置はセーフエリアの内側の左下・右下（文字を含めた最終的な配置は Phase 2 で決める）。
 */
function drawPhotoCards(ctx: CanvasRenderingContext2D, cards: readonly PhotoCard[], images: readonly (CanvasImageSource | null)[]): void {
  const cardHeight = CARD.imageHeight + CARD.captionHeight;
  const y = HEIGHT - SAFE_AREA.bottom - CARD.gap - cardHeight;
  for (const card of cards) {
    const image = images[card.image];
    if (!image) continue;
    const x = card.side === 'left' ? SAFE_AREA.left : WIDTH - SAFE_AREA.right - CARD.width;
    ctx.save();
    ctx.globalAlpha = card.alpha;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x, y, CARD.width, cardHeight, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 35, 28, 0.28)';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 1, y + 1, CARD.width - 2, cardHeight - 2, 15);
    ctx.stroke();

    // 写真：縦横比を保ったまま、枠に収まる大きさで中央に置く
    const { width: iw, height: ih } = image as { width: number; height: number };
    const boxW = CARD.width - CARD.pad * 2;
    const boxH = CARD.imageHeight - CARD.pad * 2;
    const k = Math.min(boxW / iw, boxH / ih);
    const dw = Math.round(iw * k);
    const dh = Math.round(ih * k);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, x + CARD.pad + Math.round((boxW - dw) / 2), y + CARD.pad + Math.round((boxH - dh) / 2), dw, dh);

    ctx.fillStyle = '#14231C';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 24px "${FONT_JP}"`;
    ctx.fillText(`実物写真（${PHOTO_VIEW_LABEL[card.view]}）`, x + CARD.width / 2, y + CARD.imageHeight + 30);
    ctx.restore();
  }
}

export interface OverlayInput {
  project: Project;
  photoCards: readonly PhotoCard[];
  /** project.images と同じ並びの、読み込み済みの写真（読み込めなかったものは null） */
  images: readonly (CanvasImageSource | null)[];
}

export function drawOverlay(ctx: CanvasRenderingContext2D, input: OverlayInput): void {
  drawPhotoCards(ctx, input.photoCards, input.images);
  if (input.project.output.watermark) drawWatermark(ctx, input.project);
}
