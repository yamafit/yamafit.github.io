import { describe, expect, it } from 'vitest';
import { formatDate, outputFileName, sanitizeModelNumber } from '../../src/core/filename.ts';

describe('書き出しファイル名', () => {
  const date = new Date(2026, 10, 13); // 2026年11月13日

  it('yamafit_{型番}_{YYYYMMDD}.mp4 の形になる', () => {
    expect(outputFileName('GR-145664', date)).toBe('yamafit_GR-145664_20261113.mp4');
    expect(formatDate(new Date(2027, 0, 5))).toBe('20270105');
  });

  it('ファイル名に使えない文字は - に置き換える', () => {
    expect(sanitizeModelNumber('ズール 30 / SM')).toBe('30-SM');
    expect(sanitizeModelNumber('ＡＢＣ－１２３')).toBe('ABC-123');
    expect(sanitizeModelNumber('a/b\\c:d')).toBe('a-b-c-d');
    expect(sanitizeModelNumber('雨蓋')).toBe('item');
  });

  it('同じ名前がすでにあれば _2、_3 を付ける', () => {
    const existing = new Set(['yamafit_X_20261113.mp4', 'yamafit_X_20261113_2.mp4']);
    expect(outputFileName('X', date, (n) => existing.has(n))).toBe('yamafit_X_20261113_3.mp4');
  });
});
