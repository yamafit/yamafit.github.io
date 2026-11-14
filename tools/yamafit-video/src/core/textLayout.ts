// 文字の折り返し。日本語の禁則（行頭に「、」「。」を置かない など）を守り、
// 単語の途中ではなるべく切らず、行の長さがそろうように分ける。
// 文字の幅を測る関数は外から受け取る（ブラウザではキャンバス、テストでは見積もり）。

export type Measure = (text: string) => number;

/** 行の先頭に置かない文字（句読点、閉じかっこ、小さいかな、長音など） */
const NO_LINE_START = /^[、。，．,.・：；:;！？!?）」』】〉》〕｝\])}ゝゞ々ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ％%]/;
/** 行の最後に置かない文字（開きかっこ） */
const NO_LINE_END = /[（「『【〈《〔｛\[({]$/;

const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });

/** 切ってよい位置で区切った単位に分ける（つなげると元の文に戻る） */
export function breakUnits(text: string): string[] {
  const units: string[] = [];
  for (const { segment } of segmenter.segment(text)) {
    const prev = units[units.length - 1];
    const attach = prev !== undefined && (NO_LINE_START.test(segment) || NO_LINE_END.test(prev) || /^\s+$/.test(segment) || /^\s+$/.test(prev));
    if (attach) units[units.length - 1] = prev + segment;
    else units.push(segment);
  }
  return units;
}

/**
 * maxWidth に収まるように、maxLines 行以内で折り返す。収まらなければ null。
 * なるべく少ない行数にし、同じ行数なら、いちばん長い行が短くなる分け方を選ぶ。
 */
export function breakLines(text: string, maxWidth: number, maxLines: number, measure: Measure): string[] | null {
  const whole = text.trim();
  if (whole === '') return [];
  if (measure(whole) <= maxWidth) return [whole];
  if (maxLines <= 1) return null;

  // 1つの単位が行に入りきらないときは、その単位を1文字ずつに分ける
  const units = breakUnits(whole).flatMap((u) => (measure(u.trim()) > maxWidth ? [...u] : [u]));
  const n = units.length;
  const widthCache = new Map<number, number>();
  const lineOf = (from: number, to: number) => units.slice(from, to).join('').trim();
  const widthOf = (from: number, to: number) => {
    const key = from * 1000 + to;
    let w = widthCache.get(key);
    if (w === undefined) {
      w = measure(lineOf(from, to));
      widthCache.set(key, w);
    }
    return w;
  };

  for (let lines = 2; lines <= maxLines; lines++) {
    // best[k][i]：先頭から i 個の単位を k 行に分けたときの「いちばん長い行の幅」の最小値
    const best: number[][] = Array.from({ length: lines + 1 }, () => new Array<number>(n + 1).fill(Infinity));
    const cut: number[][] = Array.from({ length: lines + 1 }, () => new Array<number>(n + 1).fill(-1));
    best[0]![0] = 0;
    for (let k = 1; k <= lines; k++) {
      for (let i = k; i <= n; i++) {
        for (let j = k - 1; j < i; j++) {
          const w = widthOf(j, i);
          if (w > maxWidth) continue;
          const worst = Math.max(best[k - 1]![j]!, w);
          if (worst < best[k]![i]!) {
            best[k]![i] = worst;
            cut[k]![i] = j;
          }
        }
      }
    }
    if (best[lines]![n]! < Infinity) {
      const result: string[] = [];
      let i = n;
      for (let k = lines; k >= 1; k--) {
        const j = cut[k]![i]!;
        result.unshift(lineOf(j, i));
        i = j;
      }
      return result;
    }
  }
  return null;
}

export interface FittedText {
  size: number;
  lines: string[];
  /** どの大きさでも収まらなかった（文字が枠からはみ出している） */
  overflow: boolean;
}

/** 大きい文字から順に試し、収まるいちばん大きい文字の大きさを選ぶ */
export function fitText(text: string, maxWidth: number, maxLines: number, sizes: readonly number[], measureAt: (size: number) => Measure): FittedText {
  for (const size of sizes) {
    const lines = breakLines(text, maxWidth, maxLines, measureAt(size));
    if (lines) return { size, lines, overflow: false };
  }
  // 収まらない：いちばん小さい文字で、行数の上限を外して折り返す（文字は切り捨てない）
  const size = sizes[sizes.length - 1]!;
  const lines = breakLines(text, maxWidth, 99, measureAt(size)) ?? [text];
  return { size, lines, overflow: true };
}
