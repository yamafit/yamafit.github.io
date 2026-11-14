import { describe, expect, it } from 'vitest';
import { breakLines, breakUnits, fitText } from '../../src/core/textLayout.ts';
import type { Measure } from '../../src/core/textLayout.ts';

/** テスト用の幅の見積もり：全角1文字＝1、半角1文字＝0.55（文字の大きさを掛ける） */
const measureAt =
  (size: number): Measure =>
  (text) =>
    [...text].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2000 ? 0.55 : 1), 0) * size;
const measure = measureAt(1);

const NO_LINE_START = /^[、。，．・）」』】ーぁぃぅぇぉっゃゅょァィゥェォッャュョ]/;

describe('文字の折り返し', () => {
  it('1行に収まる文は、そのまま1行にする', () => {
    expect(breakLines('短い特徴', 14, 2, measure)).toEqual(['短い特徴']);
  });

  it('2行に分けるときは、単語の切れ目で、長さがそろうように分ける', () => {
    expect(breakLines('メインコンパートメントと両サイドのストレッチポケット', 14, 2, measure)).toEqual(['メインコンパートメントと', '両サイドのストレッチポケット']);
    expect(breakLines('パッド入りバックシステムとベルト、ショルダーストラップ', 14, 2, measure)).toEqual(['パッド入りバックシステムと', 'ベルト、ショルダーストラップ']);
  });

  it('文字を1つも落とさない（つなげると元の文に戻る）', () => {
    // 42文字の文は、1行14文字ぴったりでは単語の切れ目が合わないので、少し広い幅（＝少し小さい文字）で確かめる
    const cases: [string, number][] = [
      ['ショートハイクやシティーユースに最適', 14],
      ['まとめの文は最大で四十二文字まで入力できるので、三行に収まるかを確かめるための文です', 16],
      ['必要なアイテムが手の届くところに', 14],
    ];
    for (const [text, width] of cases) {
      const lines = breakLines(text, width, 3, measure)!;
      expect(lines.join('')).toBe(text);
      for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(width);
    }
  });

  it('行の先頭に「、」「。」や小さい文字・長音を置かない', () => {
    const texts = ['あいうえおかきくけこさしす、せそたちつてと。なにぬねの', 'スーパーウルトラライトパッカブルバックパックシリーズ', '軽い（かるい）「丈夫」な、ザックです。雨の日も、晴れの日も。'];
    for (const text of texts) {
      for (const width of [8, 10, 12, 14]) {
        const lines = breakLines(text, width, 6, measure);
        if (!lines) continue;
        for (const line of lines) expect(NO_LINE_START.test(line), `「${line}」（幅${width}）`).toBe(false);
        for (const line of lines) expect(/[（「『]$/.test(line), `「${line}」（幅${width}）`).toBe(false);
      }
    }
  });

  it('切ってよい単位に分けても、つなげると元の文に戻る', () => {
    const text = 'GORE-TEX 3L、耐水圧20,000mm（架空）';
    expect(breakUnits(text).join('')).toBe(text);
  });

  it('決めた行数に収まらなければ null を返す（勝手に切り捨てない）', () => {
    expect(breakLines('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふ', 10, 2, measure)).toBeNull();
  });

  it('切れ目のない長い語は、文字単位で折り返す', () => {
    const lines = breakLines('ああああああああああああああああああああ', 8, 3, measure)!;
    expect(lines.join('')).toBe('ああああああああああああああああああああ');
    expect(lines.length).toBe(3);
  });
});

describe('文字の大きさの調整', () => {
  it('大きい文字で収まらなければ、収まる大きさまで小さくする', () => {
    // 幅728px・2行まで。28文字は、60px では入らず（1行12文字まで）、52px なら入る（1行14文字）
    const fitted = fitText('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふ', 728, 2, [60, 52, 46], measureAt);
    expect(fitted.size).toBe(52);
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.overflow).toBe(false);
  });

  it('全角40文字の商品名は、40px なら2行に収まる（入力の上限いっぱい）', () => {
    const name = 'あ'.repeat(40);
    const fitted = fitText(name, 812, 2, [76, 68, 60, 52, 46, 40], measureAt);
    expect(fitted.size).toBe(40);
    expect(fitted.overflow).toBe(false);
  });

  it('どの大きさでも収まらないときは、はみ出しの印を付け、文字は落とさない', () => {
    const fitted = fitText('あ'.repeat(60), 400, 2, [40, 30], measureAt);
    expect(fitted.overflow).toBe(true);
    expect(fitted.lines.join('')).toBe('あ'.repeat(60));
  });
});
