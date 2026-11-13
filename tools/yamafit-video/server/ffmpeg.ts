// ffmpeg / ffprobe の呼び出しと、書き出したMP4の検証
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { FPS, HEIGHT, WIDTH } from '../src/core/constants.ts';

export const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

/** ffmpeg が使えるか確かめ、バージョンの1行目を返す。使えなければ分かる文でエラーにする */
export function ffmpegVersion(): string {
  const r = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new Error('ffmpeg が見つかりません。ffmpeg を入れるか、環境変数 FFMPEG_PATH に場所を指定してください。');
  }
  return r.stdout.split('\n')[0] ?? '';
}

/** PNGを順に受け取り、H.264のMP4にする ffmpeg を起動する（映像のみ） */
export function startVideoEncoder(outFile: string): ChildProcessWithoutNullStreams {
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    // sRGBのPNGを、BT.709・テレビレンジのYUVに正しく変換する（色がずれないようにする）
    '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-maxrate', '12M', '-bufsize', '24M',
    '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), '-g', String(FPS * 2),
    '-an', '-movflags', '+faststart',
    outFile,
  ];
  return spawn(FFMPEG, args, { stdio: ['pipe', 'pipe', 'pipe'] });
}

export interface ProbeResult {
  format: { duration?: string; size?: string; format_name?: string };
  streams: {
    codec_type: string;
    codec_name?: string;
    profile?: string;
    width?: number;
    height?: number;
    pix_fmt?: string;
    r_frame_rate?: string;
    nb_frames?: string;
    color_space?: string;
    sample_rate?: string;
    channels?: number;
  }[];
}

export function probe(file: string): ProbeResult {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(`ffprobe で確認できませんでした：${r.stderr || r.error?.message || ''}`);
  return JSON.parse(r.stdout) as ProbeResult;
}

/** MP4の先頭に再生情報（moov）があるか＝faststart になっているかを調べる */
export function isFastStart(file: string): boolean {
  const size = statSync(file).size;
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(16);
    let pos = 0;
    while (pos + 8 <= size) {
      readSync(fd, head, 0, 16, pos);
      let boxSize = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      if (boxSize === 1) boxSize = Number(head.readBigUInt64BE(8));
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      if (boxSize < 8) return false;
      pos += boxSize;
    }
    return false;
  } finally {
    closeSync(fd);
  }
}

export interface Check {
  name: string;
  ok: boolean;
  expected: string;
  actual: string;
}

/** 書き出したMP4が仕様どおりかを確かめる。expectedFrames は書き出したフレーム数 */
export function verifyVideo(file: string, expectedFrames: number, opts: { requireAudio: boolean }): Check[] {
  const p = probe(file);
  const video = p.streams.find((s) => s.codec_type === 'video');
  const audio = p.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(p.format.duration ?? NaN);
  const expectedSec = expectedFrames / FPS;
  const checks: Check[] = [
    { name: '解像度', ok: video?.width === WIDTH && video?.height === HEIGHT, expected: `${WIDTH}×${HEIGHT}`, actual: `${video?.width}×${video?.height}` },
    { name: '映像コーデック', ok: video?.codec_name === 'h264', expected: 'h264', actual: String(video?.codec_name) },
    { name: '画素形式', ok: video?.pix_fmt === 'yuv420p', expected: 'yuv420p', actual: String(video?.pix_fmt) },
    { name: 'フレームレート', ok: video?.r_frame_rate === `${FPS}/1`, expected: `${FPS}/1`, actual: String(video?.r_frame_rate) },
    { name: 'フレーム数', ok: Number(video?.nb_frames) === expectedFrames, expected: String(expectedFrames), actual: String(video?.nb_frames) },
    { name: '尺', ok: Math.abs(duration - expectedSec) <= 0.1, expected: `${expectedSec.toFixed(1)}秒±0.1秒`, actual: `${duration.toFixed(3)}秒` },
    { name: 'faststart', ok: isFastStart(file), expected: 'あり', actual: isFastStart(file) ? 'あり' : 'なし' },
  ];
  if (opts.requireAudio) {
    checks.push({ name: '音声コーデック', ok: audio?.codec_name === 'aac', expected: 'aac', actual: String(audio?.codec_name) });
  }
  return checks;
}
