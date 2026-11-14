// 3Dの上に重ねる2Dの描画（文字・引き出し線・実物写真・ロゴ・透かし）。
// HTMLの文字は使わず、すべてキャンバスに描く（書き出した映像に確実に入れるため）。
import type { Caption } from '../core/captions.ts';
import { HEIGHT, WIDTH } from '../core/constants.ts';
import { PHOTO_VIEW_LABEL } from '../core/photoCards.ts';
import type { PhotoCard } from '../core/photoCards.ts';
import type { Project } from '../core/schema.ts';
import { fitText } from '../core/textLayout.ts';
import type { FittedText } from '../core/textLayout.ts';
import { FONT_JP, FONT_MONO } from './fonts.ts';

/** サイトの配色（css/style.css と同じ） */
const COLOR = {
  ink: '#14231C',
  inkSub: '#46544C',
  green: '#1F5A43',
  surface: '#FBFCFA',
  line: 'rgba(20, 35, 28, 0.16)',
} as const;

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** 描いたものの位置の記録（配置の確認とテストに使う） */
export interface LayoutBox {
  kind: 'title' | 'feature' | 'part' | 'name' | 'summary' | 'logo' | 'photo';
  x: number;
  y: number;
  width: number;
  height: number;
  /** 文字がどの大きさでも枠に収まらなかった */
  overflow?: boolean;
}

export interface OverlayInput {
  project: Project;
  captions: readonly Caption[];
  photoCards: readonly PhotoCard[];
  /** project.images と同じ並びの、読み込み済みの写真（読み込めなかったものは null） */
  images: readonly (CanvasImageSource | null)[];
  /** ロゴの画像（assets/logo/ にファイルがあるとき）。なければ文字のロゴを描く */
  logo: CanvasImageSource | null;
  /** セーフエリアの枠を描く（確認用） */
  guides: boolean;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const font = (weight: number, size: number, family = FONT_JP) => `${weight} ${size}px "${family}"`;

// 折り返しの結果は入力だけで決まるので、同じ入力なら使い回す（毎フレーム測り直さない）
const fitCache = new Map<string, FittedText>();
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, sizes: readonly number[], maxWidth: number, maxLines: number): FittedText {
  const key = `${weight}|${sizes.join(',')}|${maxWidth}|${maxLines}|${text}`;
  let result = fitCache.get(key);
  if (!result) {
    result = fitText(text, maxWidth, maxLines, sizes, (size) => (s) => {
      ctx.font = font(weight, size);
      return ctx.measureText(s).width;
    });
    fitCache.set(key, result);
  }
  return result;
}

const LINE_HEIGHT = 1.24;
const CARD = { padX: 30, padTop: 20, padBottom: 24, bar: 8, radius: 20, labelSize: 26, labelGap: 8 } as const;

interface TextBlock {
  text: FittedText;
  weight: number;
  color: string;
  /** この段の上に空ける間 */
  gapBefore: number;
}

/**
 * 文字のカード（白い下地＋左の緑の帯）。文字の量に合わせて幅と高さが決まる。
 * 戻り値はカードの位置（配置の記録用）。
 */
function drawTextCard(
  ctx: CanvasRenderingContext2D,
  safe: SafeArea,
  caption: { alpha: number; rise: number },
  label: string | null,
  blocks: TextBlock[],
): { x: number; y: number; width: number; height: number } {
  // 幅：いちばん長い行に合わせる
  let contentWidth = 0;
  if (label !== null) {
    ctx.font = font(700, CARD.labelSize);
    contentWidth = ctx.measureText(label).width;
  }
  let contentHeight = label !== null ? CARD.labelSize * LINE_HEIGHT : 0;
  for (const b of blocks) {
    ctx.font = font(b.weight, b.text.size);
    for (const line of b.text.lines) contentWidth = Math.max(contentWidth, ctx.measureText(line).width);
    contentHeight += b.gapBefore + b.text.lines.length * b.text.size * LINE_HEIGHT;
  }
  const width = Math.ceil(contentWidth + CARD.bar + CARD.padX * 2);
  const height = Math.ceil(contentHeight + CARD.padTop + CARD.padBottom);
  const x = safe.left;
  const y = safe.top + 10;

  ctx.save();
  ctx.globalAlpha = caption.alpha;
  ctx.translate(0, Math.round((1 - caption.rise) * 18));
  ctx.fillStyle = COLOR.surface;
  roundRect(ctx, x, y, width, height, CARD.radius);
  ctx.fill();
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, width - 2, height - 2, CARD.radius - 1);
  ctx.stroke();
  // 左の緑の帯（カードの角丸からはみ出さないように切り抜く）
  ctx.save();
  roundRect(ctx, x, y, width, height, CARD.radius);
  ctx.clip();
  ctx.fillStyle = COLOR.green;
  ctx.fillRect(x, y, CARD.bar, height);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const textX = x + CARD.bar + CARD.padX;
  let cursor = y + CARD.padTop;
  if (label !== null) {
    ctx.font = font(700, CARD.labelSize);
    ctx.fillStyle = COLOR.green;
    ctx.fillText(label, textX, cursor + CARD.labelSize * 0.98);
    cursor += CARD.labelSize * LINE_HEIGHT;
  }
  for (const b of blocks) {
    cursor += b.gapBefore;
    ctx.font = font(b.weight, b.text.size);
    ctx.fillStyle = b.color;
    for (const line of b.text.lines) {
      ctx.fillText(line, textX, cursor + b.text.size * 0.98);
      cursor += b.text.size * LINE_HEIGHT;
    }
  }
  ctx.restore();
  return { x, y, width, height };
}

/** 引き出し線：カードの下の縁から、紹介しているパーツまで */
function drawLeader(ctx: CanvasRenderingContext2D, card: { x: number; y: number; width: number; height: number }, anchor: { x: number; y: number }, alpha: number): void {
  const fromX = Math.min(Math.max(anchor.x, card.x + 48), card.x + card.width - 48);
  const fromY = card.y + card.height;
  if (anchor.y <= fromY + 12) return; // パーツがカードの裏にあるときは線を引かない
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  for (const [color, width] of [
    ['#FFFFFF', 8],
    [COLOR.green, 4],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(anchor.x, anchor.y);
    ctx.stroke();
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.green;
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * ロゴ。assets/logo/ に画像があればそれを、なければサイトのヘッダーと同じ文字のロゴ
 * （「ヤマフィット」＋「YAMAFIT」）を、白いカードに載せて下に置く。
 */
function drawLogo(ctx: CanvasRenderingContext2D, safe: SafeArea, caption: { alpha: number; rise: number }, logo: CanvasImageSource | null): LayoutBox {
  const padX = 36;
  const padY = 22;
  const name = 'ヤマフィット';
  const latin = 'YAMAFIT';
  const nameSize = 60;
  const latinSize = 24;
  const gap = 18;
  let innerW: number;
  let innerH: number;
  let image: { source: CanvasImageSource; w: number; h: number } | null = null;
  if (logo) {
    const { width: iw, height: ih } = logo as { width: number; height: number };
    const k = Math.min(440 / iw, 110 / ih);
    image = { source: logo, w: Math.round(iw * k), h: Math.round(ih * k) };
    innerW = image.w;
    innerH = image.h;
  } else {
    ctx.save();
    ctx.font = font(900, nameSize);
    const nameW = ctx.measureText(name).width;
    ctx.font = font(500, latinSize, FONT_MONO);
    ctx.letterSpacing = '3px';
    const latinW = ctx.measureText(latin).width;
    ctx.restore();
    innerW = Math.ceil(nameW + gap + latinW);
    innerH = Math.ceil(nameSize * 1.1);
  }
  const width = innerW + padX * 2;
  const height = innerH + padY * 2;
  const x = Math.round((WIDTH - width) / 2);
  const y = HEIGHT - safe.bottom - 12 - height;

  ctx.save();
  ctx.globalAlpha = caption.alpha;
  ctx.translate(0, Math.round((1 - caption.rise) * 18));
  ctx.fillStyle = COLOR.surface;
  roundRect(ctx, x, y, width, height, 22);
  ctx.fill();
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, width - 2, height - 2, 21);
  ctx.stroke();
  if (image) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image.source, x + padX, y + padY, image.w, image.h);
  } else {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const baseline = y + padY + nameSize * 0.92;
    ctx.font = font(900, nameSize);
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(name, x + padX, baseline);
    const nameW = ctx.measureText(name).width;
    ctx.font = font(500, latinSize, FONT_MONO);
    ctx.letterSpacing = '3px';
    ctx.fillStyle = COLOR.inkSub;
    ctx.fillText(latin, x + padX + nameW + gap, baseline - 4);
  }
  ctx.restore();
  return { kind: 'logo', x, y, width, height };
}

const PHOTO = { width: 264, imageHeight: 264, captionHeight: 48, pad: 12, gap: 20 } as const;

/**
 * 実物写真のカード。写真は加工せず、全体が収まるように縮めて載せ、「実物写真」と明記する。
 * 位置はセーフエリアの内側の左下・右下。
 */
function drawPhotoCards(ctx: CanvasRenderingContext2D, safe: SafeArea, cards: readonly PhotoCard[], images: readonly (CanvasImageSource | null)[]): LayoutBox[] {
  const boxes: LayoutBox[] = [];
  const cardHeight = PHOTO.imageHeight + PHOTO.captionHeight;
  const y = HEIGHT - safe.bottom - PHOTO.gap - cardHeight;
  for (const card of cards) {
    const image = images[card.image];
    if (!image) continue;
    const x = card.side === 'left' ? safe.left : WIDTH - safe.right - PHOTO.width;
    ctx.save();
    ctx.globalAlpha = card.alpha;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x, y, PHOTO.width, cardHeight, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 35, 28, 0.28)';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 1, y + 1, PHOTO.width - 2, cardHeight - 2, 15);
    ctx.stroke();

    // 写真：縦横比を保ったまま、枠に収まる大きさで中央に置く
    const { width: iw, height: ih } = image as { width: number; height: number };
    const boxW = PHOTO.width - PHOTO.pad * 2;
    const boxH = PHOTO.imageHeight - PHOTO.pad * 2;
    const k = Math.min(boxW / iw, boxH / ih);
    const dw = Math.round(iw * k);
    const dh = Math.round(ih * k);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, x + PHOTO.pad + Math.round((boxW - dw) / 2), y + PHOTO.pad + Math.round((boxH - dh) / 2), dw, dh);

    ctx.fillStyle = COLOR.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(700, 24);
    ctx.fillText(`実物写真（${PHOTO_VIEW_LABEL[card.view]}）`, x + PHOTO.width / 2, y + PHOTO.imageHeight + 30);
    ctx.restore();
    boxes.push({ kind: 'photo', x, y, width: PHOTO.width, height: cardHeight });
  }
  return boxes;
}

/** 透かし「検証用・公開不可」。仮のモデルの動画を誤って公開しないための表示 */
function drawWatermark(ctx: CanvasRenderingContext2D, project: Project, safe: SafeArea): void {
  const title = '検証用・公開不可';
  const note =
    project.model.kind === 'placeholder-pack'
      ? '仮の3Dモデルです（実物の形とは異なります）'
      : project.model.kind === 'profile-pack'
        ? '写真をもとにした近似モデルです（細部は実物と異なります）'
        : '確認用の書き出しです';
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(900, 40);
  const titleW = ctx.measureText(title).width;
  ctx.font = font(700, 24);
  const noteW = ctx.measureText(note).width;
  const padX = 28;
  const w = Math.max(titleW, noteW) + padX * 2;
  const h = 112;
  const x = Math.round((WIDTH - w) / 2);
  const y = Math.max(40, safe.top - h - 24);
  ctx.fillStyle = 'rgba(20, 35, 28, 0.82)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(238, 243, 236, 0.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 10);
  ctx.stroke();
  ctx.fillStyle = '#EEF3EC';
  ctx.textAlign = 'center';
  ctx.font = font(900, 40);
  ctx.fillText(title, x + w / 2, y + 52);
  ctx.font = font(700, 24);
  ctx.fillStyle = '#B9CABF';
  ctx.fillText(note, x + w / 2, y + 90);
  ctx.restore();
}

/** セーフエリアの枠（確認用。この枠の外は各SNSのボタンや説明文に隠れることがある） */
function drawGuides(ctx: CanvasRenderingContext2D, safe: SafeArea): void {
  ctx.save();
  ctx.fillStyle = 'rgba(214, 51, 132, 0.10)';
  ctx.fillRect(0, 0, WIDTH, safe.top);
  ctx.fillRect(0, HEIGHT - safe.bottom, WIDTH, safe.bottom);
  ctx.fillRect(0, safe.top, safe.left, HEIGHT - safe.top - safe.bottom);
  ctx.fillRect(WIDTH - safe.right, safe.top, safe.right, HEIGHT - safe.top - safe.bottom);
  ctx.strokeStyle = 'rgba(214, 51, 132, 0.9)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(safe.left, safe.top, WIDTH - safe.left - safe.right, HEIGHT - safe.top - safe.bottom);
  ctx.restore();
}

/** 重ねる要素をすべて描き、描いたものの位置を返す */
export function drawOverlay(ctx: CanvasRenderingContext2D, input: OverlayInput): LayoutBox[] {
  const safe = input.project.direction.safeArea;
  const maxText = WIDTH - safe.left - safe.right - CARD.bar - CARD.padX * 2;
  const boxes: LayoutBox[] = drawPhotoCards(ctx, safe, input.photoCards, input.images);

  for (const c of input.captions) {
    switch (c.kind) {
      case 'title': {
        // 商品名は40文字まで入力できる。全角40文字が2行に収まる大きさ（40px）まで小さくする
        const name = fit(ctx, c.name, 900, [76, 68, 60, 52, 46, 40], maxText, 2);
        const maker = fit(ctx, c.maker, 700, [32, 28], maxText, 1);
        const card = drawTextCard(ctx, safe, c, null, [
          { text: maker, weight: 700, color: COLOR.inkSub, gapBefore: 0 },
          { text: name, weight: 900, color: COLOR.ink, gapBefore: 2 },
        ]);
        boxes.push({ kind: 'title', ...card, overflow: name.overflow || maker.overflow });
        break;
      }
      case 'feature': {
        const text = fit(ctx, c.text, 700, [52, 46, 40, 36], maxText, 2);
        const card = drawTextCard(ctx, safe, c, `特徴 ${c.index + 1}/${c.total}`, [{ text, weight: 700, color: COLOR.ink, gapBefore: CARD.labelGap }]);
        boxes.push({ kind: 'feature', ...card, overflow: text.overflow });
        break;
      }
      case 'part': {
        const label = fit(ctx, c.label, 900, [56, 48, 42], maxText, 1);
        const blocks: TextBlock[] = [{ text: label, weight: 900, color: COLOR.ink, gapBefore: CARD.labelGap }];
        let overflow = label.overflow;
        // 役割の文が入力されていないパーツは、名前だけを出す（文を作って補うことはしない）
        if (c.role.trim() !== '') {
          const role = fit(ctx, c.role, 700, [40, 36, 32], maxText, 2);
          blocks.push({ text: role, weight: 700, color: COLOR.inkSub, gapBefore: 6 });
          overflow = overflow || role.overflow;
        }
        const card = drawTextCard(ctx, safe, c, `パーツ ${c.index + 1}/${c.total}`, blocks);
        drawLeader(ctx, card, c.anchor, c.alpha);
        boxes.push({ kind: 'part', ...card, overflow });
        break;
      }
      case 'name': {
        const name = fit(ctx, c.name, 900, [42, 36, 30], maxText, 2);
        const maker = fit(ctx, c.maker, 700, [26, 24], maxText, 1);
        const card = drawTextCard(ctx, safe, c, null, [
          { text: maker, weight: 700, color: COLOR.inkSub, gapBefore: 0 },
          { text: name, weight: 900, color: COLOR.ink, gapBefore: 0 },
        ]);
        boxes.push({ kind: 'name', ...card, overflow: name.overflow || maker.overflow });
        break;
      }
      case 'summary': {
        const text = fit(ctx, c.text, 900, [56, 50, 44, 38], maxText, 3);
        const card = drawTextCard(ctx, safe, c, 'まとめ', [{ text, weight: 900, color: COLOR.ink, gapBefore: CARD.labelGap }]);
        boxes.push({ kind: 'summary', ...card, overflow: text.overflow });
        break;
      }
      case 'logo':
        boxes.push(drawLogo(ctx, safe, c, input.logo));
        break;
    }
  }

  if (input.project.output.watermark) drawWatermark(ctx, input.project, safe);
  if (input.guides) drawGuides(ctx, safe);
  return boxes;
}
