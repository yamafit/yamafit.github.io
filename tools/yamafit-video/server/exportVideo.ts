// 書き出し：900フレームを順に描き、ffmpeg でMP4にして、仕様どおりか検証する
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FPS, FRAME_COUNT, HEIGHT, WIDTH } from '../src/core/constants.ts';
import { ffmpegVersion, startVideoEncoder, verifyVideo } from './ffmpeg.ts';
import type { Check } from './ffmpeg.ts';
import { buildRenderPage, loadProject, openRenderSession } from './renderSession.ts';

export interface ExportOptions {
  projectDir: string;
  outFile: string;
  /** 書き出すフレームの範囲（省略時は全部）。end は含まない */
  frames?: { start: number; end: number };
  /** 静止画を保存する時刻（秒）と保存先 */
  stills?: { times: number[]; dir: string };
  /** すでにビルド済みならビルドを省く */
  skipBuild?: boolean;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface ExportReport {
  ok: boolean;
  projectId: string;
  outFile: string;
  frames: { start: number; end: number; count: number };
  video: { width: number; height: number; fps: number };
  seconds: { build: number; render: number; total: number };
  msPerFrame: number;
  environment: { node: string; platform: string; chromium: string; glRenderer: string; ffmpeg: string };
  checks: Check[];
  warnings: string[];
  /** 全フレームのハッシュ値をまとめた1つの値。同じ入力・同じ環境なら毎回同じになる */
  digest: string;
  /** フレームごとのハッシュ値（PNGのSHA-256） */
  frameHashes: string[];
  stills: string[];
}

export const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');

export async function exportVideo(opts: ExportOptions): Promise<ExportReport> {
  const t0 = Date.now();
  const project = loadProject(opts.projectDir);
  const ffmpeg = ffmpegVersion();
  const range = opts.frames ?? { start: 0, end: FRAME_COUNT };
  if (!(range.start >= 0 && range.end <= FRAME_COUNT && range.start < range.end)) {
    throw new Error(`フレームの範囲が正しくありません（0〜${FRAME_COUNT} の間で指定してください）`);
  }
  const count = range.end - range.start;

  if (!opts.skipBuild) await buildRenderPage();
  const tBuilt = Date.now();

  mkdirSync(dirname(opts.outFile), { recursive: true });
  const stillFrames = new Map<number, number>();
  if (opts.stills) {
    mkdirSync(opts.stills.dir, { recursive: true });
    for (const sec of opts.stills.times) stillFrames.set(Math.min(Math.round(sec * FPS), FRAME_COUNT - 1), sec);
  }

  const session = await openRenderSession(opts.projectDir);
  const encoder = startVideoEncoder(opts.outFile);
  let encoderError = '';
  encoder.stderr.on('data', (d: Buffer) => (encoderError += d.toString()));
  const encoderDone = new Promise<number | null>((resolve) => encoder.on('close', resolve));
  const frameHashes: string[] = [];
  const stills: string[] = [];
  try {
    for (let i = range.start; i < range.end; i++) {
      if (opts.signal?.aborted) throw new Error('書き出しをキャンセルしました');
      const png = await session.capture(i);
      frameHashes.push(sha256(png));
      const stillSec = stillFrames.get(i);
      if (stillSec !== undefined && opts.stills) {
        const file = join(opts.stills.dir, `frame-${String(i).padStart(4, '0')}_${stillSec.toFixed(1)}s.png`);
        writeFileSync(file, png);
        stills.push(file);
      }
      if (encoder.exitCode !== null) throw new Error(`ffmpeg が途中で止まりました：${encoderError}`);
      // ffmpeg が受け取りきるまで待つ（メモリにためこまない）
      await new Promise<void>((resolve, reject) => encoder.stdin.write(png, (e) => (e ? reject(e) : resolve())));
      opts.onProgress?.(i - range.start + 1, count);
    }
  } catch (e) {
    encoder.kill('SIGKILL');
    await session.close();
    throw e;
  }
  encoder.stdin.end();
  const code = await encoderDone;
  const info = { chromium: session.chromiumVersion, glRenderer: session.glRenderer, warnings: session.warnings };
  await session.close();
  if (code !== 0) throw new Error(`ffmpeg でのMP4化に失敗しました：${encoderError}`);

  const tDone = Date.now();
  const checks = verifyVideo(opts.outFile, count, { requireAudio: false });
  const report: ExportReport = {
    ok: checks.every((c) => c.ok),
    projectId: project.id,
    outFile: opts.outFile,
    frames: { ...range, count },
    video: { width: WIDTH, height: HEIGHT, fps: FPS },
    seconds: { build: (tBuilt - t0) / 1000, render: (tDone - tBuilt) / 1000, total: (tDone - t0) / 1000 },
    msPerFrame: (tDone - tBuilt) / count,
    environment: { node: process.version, platform: `${process.platform}-${process.arch}`, chromium: info.chromium, glRenderer: info.glRenderer, ffmpeg },
    checks,
    warnings: info.warnings,
    digest: sha256(frameHashes.join('\n')),
    frameHashes,
    stills,
  };
  writeFileSync(opts.outFile.replace(/\.mp4$/, '') + '.report.json', JSON.stringify(report, null, 2));
  return report;
}

/** 指定した順番でフレームを描き、ハッシュ値だけを集める（再現性の確認用。MP4は作らない） */
export async function hashFrames(projectDir: string, order: number[]): Promise<Map<number, string>> {
  const session = await openRenderSession(projectDir);
  const hashes = new Map<number, string>();
  try {
    for (const i of order) hashes.set(i, sha256(await session.capture(i)));
  } finally {
    await session.close();
  }
  return hashes;
}
