import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { captionsAt, summaryText } from '../../src/core/captions.ts';
import type { Caption } from '../../src/core/captions.ts';
import { FRAME_COUNT, frameToTime } from '../../src/core/constants.ts';
import { buildTimeline, sampleTimeline } from '../../src/core/timeline.ts';
import { createProfilePack } from '../../src/stage/profilePack.ts';
import { mustParse, planFor, sampleInput } from '../helpers.ts';

const project = mustParse(sampleInput());
const plan = planFor(project);
const at = (t: number) => captionsAt(project, plan, sampleTimeline(plan, t));
const kinds = (t: number) => at(t).map((c) => c.kind);
const find = <K extends Caption['kind']>(t: number, kind: K) => at(t).find((c) => c.kind === kind) as Extract<Caption, { kind: K }> | undefined;

describe('画面に出す文字：いつ・何を出すか', () => {
  it('全体像（0〜5秒）：メーカー名と商品名を、入力どおりに出す', () => {
    expect(at(0)).toEqual([]);
    const title = find(2.5, 'title')!;
    expect(title.maker).toBe('サンプル（架空）');
    expect(title.name).toBe('サンプルザック 30');
    expect(title.alpha).toBe(1);
    expect(kinds(5)).not.toContain('title');
  });

  it('特徴の紹介（5〜12秒）：特徴の文を、入力どおりに1件ずつ出す', () => {
    const first = find(7, 'feature')!;
    expect(first.text).toBe('サンプルの特徴1（背面パネル）');
    expect([first.index, first.total]).toEqual([0, 2]);
    expect(first.alpha).toBe(1);
    const second = find(10.5, 'feature')!;
    expect(second.text).toBe('サンプルの特徴2（雨蓋）');
    expect([second.index, second.total]).toEqual([1, 2]);
    // 2件の特徴の文が同時に見えることはない
    for (let i = 0; i < FRAME_COUNT; i++) {
      expect(at(frameToTime(i)).filter((c) => c.kind === 'feature' && c.alpha > 0.5).length).toBeLessThanOrEqual(1);
    }
  });

  it('分解（12〜22秒）：紹介中のパーツの名前と役割を、入力どおりに出す', () => {
    plan.highlights.forEach((h, index) => {
      const part = find(h.start + h.slot / 2, 'part')!;
      const input = project.parts.find((p) => p.id === h.partId)!;
      expect(part.partId).toBe(h.partId);
      expect(part.label).toBe(input.label);
      expect(part.role).toBe(input.role);
      expect([part.index, part.total]).toEqual([index, plan.highlights.length]);
      expect(part.alpha).toBe(1);
    });
  });

  it('パーツの説明は、前のものが消えてから次を出す（2つが重ならない）', () => {
    for (let i = 0; i < FRAME_COUNT; i++) {
      expect(at(frameToTime(i)).filter((c) => c.kind === 'part').length).toBeLessThanOrEqual(1);
    }
  });

  it('引き出し線の先は、画面の中の、紹介しているパーツの位置にある', () => {
    for (const h of plan.highlights) {
      const state = sampleTimeline(plan, h.start + h.slot / 2);
      const caption = captionsAt(project, plan, state).find((c) => c.kind === 'part') as Extract<Caption, { kind: 'part' }>;
      expect(caption.anchor.x).toBeGreaterThan(60);
      expect(caption.anchor.x).toBeLessThan(1020);
      // 説明のカード（上）より下、セーフエリアの下端より上
      expect(caption.anchor.y).toBeGreaterThan(500);
      expect(caption.anchor.y).toBeLessThan(1560);
    }
  });

  it('再組み立てのあと（〜27秒）：商品名を小さく出す', () => {
    expect(kinds(21)).not.toContain('name');
    const name = find(25, 'name')!;
    expect(name.name).toBe('サンプルザック 30');
    expect(name.alpha).toBe(1);
    expect(kinds(27)).not.toContain('name');
  });

  it('まとめ（27〜30秒）：まとめの文とロゴを出し、最後のフレームまで消さない', () => {
    expect(kinds(26.9)).not.toContain('summary');
    const last = at(frameToTime(FRAME_COUNT - 1));
    expect(last.map((c) => c.kind).sort()).toEqual(['logo', 'summary']);
    for (const c of last) expect(c.alpha).toBe(1);
    expect(find(29.9, 'summary')!.text).toBe('動作確認用の架空の商品です');
  });

  it('まとめの文が未入力なら、特徴の1件目をそのまま使う（文を作らない）', () => {
    const input = sampleInput();
    input.product.summary = '';
    expect(summaryText(mustParse(input))).toBe('サンプルの特徴1（背面パネル）');
  });

  it('役割が未入力のパーツは、役割を空のまま出す（文を作って補わない）', () => {
    const trailblazer = mustParse(JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'projects', 'salomon-trailblazer-10', 'project.json'), 'utf8')));
    const p = buildTimeline(trailblazer, createProfilePack(trailblazer).info);
    const belt = p.highlights.find((h) => h.partId === 'hip_belt')!;
    const caption = captionsAt(trailblazer, p, sampleTimeline(p, belt.start + belt.slot / 2)).find((c) => c.kind === 'part') as Extract<Caption, { kind: 'part' }>;
    expect(caption.label).toBe('ベルト');
    expect(caption.role).toBe('');
  });

  it('30秒を通して、入力した文以外の文は出さない', () => {
    const allowed = new Set<string>([
      project.product.maker,
      project.product.name,
      summaryText(project),
      ...project.product.features.map((f) => f.text),
      ...project.parts.flatMap((p) => [p.label, p.role]),
    ]);
    for (let i = 0; i < FRAME_COUNT; i++) {
      for (const c of at(frameToTime(i))) {
        const texts = c.kind === 'title' || c.kind === 'name' ? [c.maker, c.name] : c.kind === 'feature' || c.kind === 'summary' ? [c.text] : c.kind === 'part' ? [c.label, c.role] : [];
        for (const text of texts) expect(allowed.has(text), `「${text}」`).toBe(true);
      }
    }
  });
});
