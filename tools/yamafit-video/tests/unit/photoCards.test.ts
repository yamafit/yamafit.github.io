import { describe, expect, it } from 'vitest';
import { photoCardsAt } from '../../src/core/photoCards.ts';
import { mustParse, planFor, sampleInput } from '../helpers.ts';

function withPhotos(extra: Record<string, unknown> = {}) {
  const input = sampleInput();
  input.images = [
    { file: 'images/front.webp', view: 'front' },
    { file: 'images/back.webp', view: 'back' },
  ];
  Object.assign(input, extra);
  const project = mustParse(input);
  return { project, plan: planFor(project) };
}

describe('実物写真のカード', () => {
  it('写真がなければ、カードは出ない', () => {
    const project = mustParse(sampleInput());
    const plan = planFor(project);
    for (let t = 0; t <= 30; t += 0.5) expect(photoCardsAt(project, plan, t)).toEqual([]);
  });

  it('表示しない設定なら、写真があってもカードは出ない', () => {
    const { project, plan } = withPhotos({ direction: { showPhotos: false } });
    for (let t = 0; t <= 30; t += 0.5) expect(photoCardsAt(project, plan, t)).toEqual([]);
  });

  it('全体像（0〜5秒）では、正面の写真を左下に出す', () => {
    const { project, plan } = withPhotos();
    expect(photoCardsAt(project, plan, 0)).toEqual([]);
    expect(photoCardsAt(project, plan, 2.5)).toEqual([{ image: 0, view: 'front', side: 'left', alpha: 1 }]);
  });

  it('特徴の紹介では、そのパーツがある側の写真を出す（背面パネル→背面、雨蓋→正面）', () => {
    const { project, plan } = withPhotos();
    // サンプルの特徴1は背面パネル、特徴2は雨蓋
    expect(photoCardsAt(project, plan, 7.5)).toEqual([{ image: 1, view: 'back', side: 'left', alpha: 1 }]);
    expect(photoCardsAt(project, plan, 10.5)).toEqual([{ image: 0, view: 'front', side: 'left', alpha: 1 }]);
  });

  it('写真の切り替えは重ねてつなぐ（途中で消えて空白にならない）', () => {
    const { project, plan } = withPhotos();
    for (let t = 1.2; t <= 11; t += 1 / 30) {
      const total = photoCardsAt(project, plan, t).reduce((sum, c) => sum + c.alpha, 0);
      expect(total, `t=${t.toFixed(2)}`).toBeGreaterThan(0.99);
      expect(total, `t=${t.toFixed(2)}`).toBeLessThan(1.01);
    }
  });

  it('分解とまとめのシーンでは出さない（説明の文字やロゴの場所を空ける）', () => {
    const { project, plan } = withPhotos();
    for (const t of [12.1, 14, 18, 21.9, 27.2, 28.5, 30]) expect(photoCardsAt(project, plan, t)).toEqual([]);
  });

  it('再組み立てのあとの1回転では、正面と背面を左右に並べる', () => {
    const { project, plan } = withPhotos();
    expect(photoCardsAt(project, plan, 25)).toEqual([
      { image: 0, view: 'front', side: 'left', alpha: 1 },
      { image: 1, view: 'back', side: 'right', alpha: 1 },
    ]);
  });

  it('背面の写真がなければ、正面の写真だけを使う', () => {
    const input = sampleInput();
    input.images = [{ file: 'images/front.webp', view: 'front' }];
    const project = mustParse(input);
    const plan = planFor(project);
    expect(photoCardsAt(project, plan, 7.5)).toEqual([{ image: 0, view: 'front', side: 'left', alpha: 1 }]);
    expect(photoCardsAt(project, plan, 25)).toEqual([{ image: 0, view: 'front', side: 'left', alpha: 1 }]);
  });
});
