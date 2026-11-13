// 書き出しのE2Eテスト：実際にヘッドレスChromiumで描き、ffmpeg でMP4にして、ffprobe で確かめる。
// 時間を短くするため、ここでは数フレームだけ書き出す（30秒の完全版は npm run export で行う）。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportVideo, hashFrames } from '../../server/exportVideo.ts';
import { isFastStart, probe } from '../../server/ffmpeg.ts';
import { buildRenderPage } from '../../server/renderSession.ts';
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
