// 書き出しのE2Eテスト：実際にヘッドレスChromiumで描き、ffmpeg でMP4にして、ffprobe で確かめる。
// 時間を短くするため、ここでは数フレームだけ書き出す（30秒の完全版は npm run export で行う）。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportVideo, hashFrames } from '../../server/exportVideo.ts';
import { isFastStart, probe } from '../../server/ffmpeg.ts';
import { buildRenderPage, openRenderSession } from '../../server/renderSession.ts';
import type { LayoutBox } from '../../src/stage/overlay.ts';
import { SAMPLE_DIR, sampleInput } from '../helpers.ts';

const TIMEOUT = 240_000;
let work: string;

beforeAll(async () => {
  work = mkdtempSync(join(tmpdir(), 'yamafit-video-e2e-'));
  await buildRenderPage();
}, TIMEOUT);

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('書き出し', () => {
  it('MP4が書き出され、仕様どおりになっている', async () => {
    const outFile = join(work, 'short.mp4');
    const report = await exportVideo({ projectDir: SAMPLE_DIR, outFile, frames: { start: 0, end: 6 }, skipBuild: true, stills: { times: [0.1], dir: join(work, 'stills') } });

    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.frameHashes).toHaveLength(6);
    expect(report.warnings).toEqual([]);

    const p = probe(outFile);
    const video = p.streams.find((s) => s.codec_type === 'video')!;
    expect(video.width).toBe(1080);
    expect(video.height).toBe(1920);
    expect(video.codec_name).toBe('h264');
    expect(video.pix_fmt).toBe('yuv420p');
    expect(video.r_frame_rate).toBe('30/1');
    expect(video.color_space).toBe('bt709');
    expect(isFastStart(outFile)).toBe(true);

    // 静止画と記録ファイルも残る
    expect(report.stills).toHaveLength(1);
    expect(existsSync(report.stills[0]!)).toBe(true);
    const saved = JSON.parse(readFileSync(join(work, 'short.report.json'), 'utf8'));
    expect(saved.digest).toBe(report.digest);
  }, TIMEOUT);

  it('同じ入力からは同じフレームが出る。描く順番を変えても変わらない', async () => {
    // 全体像・接近・分解中の強調・再組み立て後、の4場面
    const frames = [0, 200, 480, 760];
    const first = await hashFrames(SAMPLE_DIR, frames);
    const second = await hashFrames(SAMPLE_DIR, [...frames].reverse());
    for (const i of frames) expect(second.get(i), `フレーム${i}`).toBe(first.get(i));
    // 違う場面は違う絵になっている（何も描けていない、ということがない）
    expect(new Set(first.values()).size).toBe(frames.length);
  }, TIMEOUT);

  it('実物写真のカードが描かれる。写真が見つからなくても書き出しは止まらず、注意が出る', async () => {
    // 写真つきのプロジェクトを作る（写真はテスト用の模様）
    const dir = join(work, 'with-photo');
    mkdirSync(join(dir, 'images'), { recursive: true });
    const made = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=300x400:rate=1', '-frames:v', '1', join(dir, 'images', 'front.png')]);
    expect(made.status).toBe(0);
    const input = sampleInput();
    input.images = [
      { file: 'images/front.png', view: 'front' },
      { file: 'images/missing.png', view: 'back' },
    ];
    writeFileSync(join(dir, 'project.json'), JSON.stringify(input));

    const report = await exportVideo({ projectDir: dir, outFile: join(work, 'photo.mp4'), frames: { start: 75, end: 77 }, skipBuild: true });
    expect(report.ok).toBe(true);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toContain('images/missing.png');

    // 写真なしの同じフレームとは違う絵になっている（カードが描かれている）
    const plain = await hashFrames(SAMPLE_DIR, [75]);
    expect(report.frameHashes[0]).not.toBe(plain.get(75));
  }, TIMEOUT);

  it('文字・写真・ロゴは、セーフエリアの中にあり、互いに重ならず、枠からはみ出さない', async () => {
    const SAFE = { left: 60, right: 1080 - 140, top: 240, bottom: 1920 - 400 };
    const overlaps = (a: LayoutBox, b: LayoutBox) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

    // いちばん長い文字数を入れたプロジェクト（商品名40文字、特徴28文字、役割24文字、まとめ42文字、紹介するパーツ7個、写真2枚）
    const dir = join(work, 'longest');
    mkdirSync(join(dir, 'images'), { recursive: true });
    for (const name of ['front.png', 'back.png']) {
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=300x400:rate=1', '-frames:v', '1', join(dir, 'images', name)]);
    }
    const input = sampleInput();
    input.product.name = 'とても長い商品名のサンプルザック フリーフロート ウルトラライト 30 SM/M';
    input.product.maker = 'とても長いメーカー名のサンプル株式会社（架空）';
    input.product.features = [
      { text: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふ', focusPartId: 'back_panel' },
      { text: 'GORE-TEX 3L、耐水圧20,000mm（架空）', focusPartId: 'top_lid' },
      { text: '短い特徴' },
    ];
    input.product.summary = 'まとめの文は最大で四十二文字まで入力できるので、三行に収まるかを確かめるための文です';
    for (const p of input.parts) {
      p.highlight = true;
      p.role = '役割の説明文は最大で二十四文字まで入力できます。';
    }
    input.images = [
      { file: 'images/front.png', view: 'front' },
      { file: 'images/back.png', view: 'back' },
    ];
    writeFileSync(join(dir, 'project.json'), JSON.stringify(input));

    for (const projectDir of [SAMPLE_DIR, dir]) {
      const session = await openRenderSession(projectDir);
      try {
        const seen = new Set<string>();
        // 0.5秒おきに、30秒ぶんの配置を調べる
        for (let frame = 0; frame < 900; frame += 15) {
          const boxes = await session.layout(frame);
          for (const box of boxes) {
            seen.add(box.kind);
            const where = `${box.kind}（フレーム${frame}）`;
            expect(box.overflow ?? false, `${where}の文字が枠に収まっていない`).toBe(false);
            expect(box.x, `${where}の左`).toBeGreaterThanOrEqual(SAFE.left);
            expect(box.x + box.width, `${where}の右`).toBeLessThanOrEqual(SAFE.right);
            expect(box.y, `${where}の上`).toBeGreaterThanOrEqual(SAFE.top);
            expect(box.y + box.height, `${where}の下`).toBeLessThanOrEqual(SAFE.bottom);
          }
          for (let a = 0; a < boxes.length; a++) {
            for (let b = a + 1; b < boxes.length; b++) {
              // 同じ場所で写真を切り替えている途中（正面→背面）は、重なっていてよい
              const swapping = boxes[a]!.kind === 'photo' && boxes[b]!.kind === 'photo' && boxes[a]!.x === boxes[b]!.x;
              if (swapping) continue;
              expect(overlaps(boxes[a]!, boxes[b]!), `${boxes[a]!.kind} と ${boxes[b]!.kind} が重なっている（フレーム${frame}）`).toBe(false);
            }
          }
        }
        const expected = ['feature', 'logo', 'name', 'part', 'summary', 'title'];
        if (projectDir === dir) expected.push('photo');
        expect([...seen].sort()).toEqual(expected.sort());
        expect(session.warnings).toEqual([]);
      } finally {
        await session.close();
      }
    }
  }, TIMEOUT);

  it('内容に誤りのあるプロジェクトは、分かる文で止まる', async () => {
    const dir = join(work, 'broken');
    const input = sampleInput();
    input.parts = input.parts.filter((p: { id: string }) => p.id === 'main_compartment');
    input.product.features = [{ text: '特徴' }];
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'project.json'), JSON.stringify(input));
    await expect(exportVideo({ projectDir: dir, outFile: join(work, 'broken.mp4'), skipBuild: true })).rejects.toThrow('パーツを2つ以上登録してください');
    expect(existsSync(join(work, 'broken.mp4'))).toBe(false);
  }, TIMEOUT);
});
