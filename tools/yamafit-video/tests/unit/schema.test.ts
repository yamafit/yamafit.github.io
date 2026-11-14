import { describe, expect, it } from 'vitest';
import { parseProject } from '../../src/core/schema.ts';
import { mustParse, sampleInput } from '../helpers.ts';

function errorsOf(input: unknown): string[] {
  const r = parseProject(input);
  return r.ok ? [] : r.errors;
}

describe('project.json の検証', () => {
  it('サンプルは合格し、省略した演出パラメータには初期値が入る', () => {
    const p = mustParse(sampleInput());
    expect(p.direction.camera.wideDistance).toBe(3.8);
    expect(p.direction.safeArea).toEqual({ top: 240, bottom: 400, left: 60, right: 140 });
    expect(p.direction.showPhotos).toBe(true);
    expect(p.direction.camera.fovDeg).toBe(30);
    expect(p.direction.rotation.introSpeedDegPerSec).toBe(36);
    expect(p.direction.explode.distanceCm).toBe(35);
    expect(p.direction.explode.roleTextSec).toBeNull();
    expect(p.direction.background).toBe('light');
    expect(p.output.watermark).toBe(true);
  });

  it('商品名が空ならエラーになる', () => {
    const input = sampleInput();
    input.product.name = '';
    expect(errorsOf(input).join('\n')).toContain('商品名を入力してください');
  });

  it('特徴が0件ならエラーになる', () => {
    const input = sampleInput();
    input.product.features = [];
    expect(errorsOf(input).join('\n')).toContain('特徴を1件以上入力してください');
  });

  it('候補にないパーツは受け付けない（存在しないパーツを足せない）', () => {
    const input = sampleInput();
    input.parts.push({ id: 'rocket_booster', label: 'ロケット', role: '', confirmed: true });
    expect(errorsOf(input).join('\n')).toContain('パーツ候補にありません');
  });

  it('確認済みのパーツが2つ未満ならエラーになる', () => {
    const input = sampleInput();
    input.parts = input.parts.filter((p: { id: string }) => p.id === 'main_compartment');
    input.product.features = [{ text: '特徴' }];
    expect(errorsOf(input).join('\n')).toContain('パーツを2つ以上登録してください');
  });

  it('本体（メイン収納部）が未確認ならエラーになる', () => {
    const input = sampleInput();
    input.parts.find((p: { id: string }) => p.id === 'main_compartment').confirmed = false;
    expect(errorsOf(input).join('\n')).toContain('メイン収納部');
  });

  it('特徴が、登録・確認されていないパーツを指していたらエラーになる', () => {
    const input = sampleInput();
    input.parts.find((p: { id: string }) => p.id === 'back_panel').confirmed = false;
    expect(errorsOf(input).join('\n')).toContain('登録・確認されていません');
  });

  it('入力の誤りは、項目の名前つきの分かる日本語で知らせる', () => {
    const input = sampleInput();
    input.product.name = 'あ'.repeat(41);
    input.product.features[0].text = 'い'.repeat(29);
    input.parts[1].role = 'う'.repeat(25);
    input.product.sources = [{ url: 'not-a-url', checkedAt: '2026-11-14' }];
    input.model.heightCm = 'abc';
    input.direction = { camera: { fovDeg: 90 }, explode: { distanceCm: 5 } };
    expect(errorsOf(input)).toEqual([
      '商品名：40文字以内で入力してください',
      '特徴1：28文字以内で入力してください',
      '情報源1のURL：URLの形が正しくありません（https:// から始まるURLを入力してください）',
      '商品の高さ：数値を入力してください',
      'パーツ2の役割：24文字以内で入力してください',
      '演出の設定（camera.fovDeg）：45以下の数値にしてください',
      '演出の設定（explode.distanceCm）：10以上の数値にしてください',
    ]);
  });

  it('範囲の外の演出パラメータは受け付けない', () => {
    const input = sampleInput();
    input.direction = { camera: { fovDeg: 90 } };
    expect(errorsOf(input).length).toBeGreaterThan(0);
  });

  it('再組み立てと1回転の合計が5秒を超えたらエラーになる', () => {
    const input = sampleInput();
    input.direction = { explode: { reassembleSec: 2.5 }, rotation: { fullTurnSec: 3.5 } };
    expect(errorsOf(input).join('\n')).toContain('合計が5秒を超えています');
  });
});
