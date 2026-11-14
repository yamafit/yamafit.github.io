// コマンドライン
//   node server/cli.ts export <プロジェクトのフォルダ> [--out ファイル] [--frames 0-900] [--stills 2.5,8,14] [--guides] [--skip-build]
//   node server/cli.ts verify <プロジェクトのフォルダ> [--frames 0-900] [--samples 12]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FRAME_COUNT } from '../src/core/constants.ts';
import { outputFileName } from '../src/core/filename.ts';
import { exportVideo, hashFrames } from './exportVideo.ts';
import { OUT_DIR } from './paths.ts';
import { buildRenderPage, loadProject } from './renderSession.ts';

function parseArgs(argv: string[]): { positional: string[]; flags: Map<string, string> } {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(a.slice(2), next);
        i++;
      } else flags.set(a.slice(2), 'true');
    } else positional.push(a);
  }
  return { positional, flags };
}

function parseRange(text: string | undefined): { start: number; end: number } {
  if (!text) return { start: 0, end: FRAME_COUNT };
  const m = /^(\d+)-(\d+)$/.exec(text);
  if (!m) throw new Error('--frames は「開始-終了」の形で指定してください（例：0-90）');
  return { start: Number(m[1]), end: Number(m[2]) };
}

/** 種（seed）で決まる並べ替え。毎回同じ順番になる */
function shuffled(items: number[], seed: number): number[] {
  const a = [...items];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function runExport(projectDir: string, flags: Map<string, string>): Promise<number> {
  const project = loadProject(projectDir);
  const outFile = flags.has('out')
    ? resolve(flags.get('out')!)
    : join(OUT_DIR, outputFileName(project.product.modelNumber, new Date(), (name) => existsSync(join(OUT_DIR, name))));
  const stillsText = flags.get('stills');
  let lastShown = 0;
  const report = await exportVideo({
    projectDir,
    outFile,
    frames: parseRange(flags.get('frames')),
    stills: stillsText ? { times: stillsText.split(',').map(Number), dir: outFile.replace(/\.mp4$/, '') + '_stills' } : undefined,
    skipBuild: flags.has('skip-build'),
    guides: flags.has('guides'),
    onProgress: (done, total) => {
      const now = Date.now();
      if (done === total || now - lastShown > 10_000) {
        lastShown = now;
        console.log(`  書き出し中… ${done}/${total} フレーム（${Math.round((done / total) * 100)}%）`);
      }
    },
  });
  console.log(`\n書き出し先：${report.outFile}`);
  console.log(`所要時間：${report.seconds.total.toFixed(1)}秒（1フレーム ${report.msPerFrame.toFixed(0)}ミリ秒）`);
  console.log(`描画：${report.environment.glRenderer}`);
  for (const w of report.warnings) console.log(`注意：${w}`);
  console.log('\n検証結果');
  for (const c of report.checks) console.log(`  ${c.ok ? '○' : '×'} ${c.name}：${c.actual}（基準：${c.expected}）`);
  console.log(`\nフレームのハッシュ（まとめ）：${report.digest}`);
  console.log(report.ok ? '\nすべての検証に合格しました。' : '\n検証に合格しなかった項目があります。');
  return report.ok ? 0 : 1;
}

async function runVerify(projectDir: string, flags: Map<string, string>): Promise<number> {
  loadProject(projectDir);
  const range = parseRange(flags.get('frames'));
  const all = Array.from({ length: range.end - range.start }, (_, k) => range.start + k);
  const sampleCount = Math.min(Number(flags.get('samples') ?? 12), all.length);
  if (!flags.has('skip-build')) await buildRenderPage();

  console.log(`1回目：${all.length}フレームを順番に描きます`);
  const first = await hashFrames(projectDir, all);
  console.log(`2回目：ブラウザを起動し直して、同じ${all.length}フレームを描きます`);
  const second = await hashFrames(projectDir, all);
  const mismatched = all.filter((i) => first.get(i) !== second.get(i));

  const picked = shuffled(all, 20261113).slice(0, sampleCount);
  console.log(`3回目：${picked.length}フレームだけを、ばらばらの順番で描きます（${picked.join(', ')}）`);
  const random = await hashFrames(projectDir, picked);
  const orderDependent = picked.filter((i) => first.get(i) !== random.get(i));

  const result = {
    frames: range,
    repeatable: { compared: all.length, mismatched },
    orderIndependent: { compared: picked.length, order: picked, mismatched: orderDependent },
    ok: mismatched.length === 0 && orderDependent.length === 0,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'verify-report.json'), JSON.stringify(result, null, 2));
  console.log('\n再現性の確認結果');
  console.log(`  ${mismatched.length === 0 ? '○' : '×'} 2回の書き出しで全${all.length}フレームが一致（不一致 ${mismatched.length}）`);
  console.log(`  ${orderDependent.length === 0 ? '○' : '×'} 順番を変えて描いても一致（${picked.length}フレーム中 不一致 ${orderDependent.length}）`);
  return result.ok ? 0 : 1;
}

async function main(): Promise<number> {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, dir] = positional;
  if ((command !== 'export' && command !== 'verify') || !dir) {
    console.log('使い方：\n  node server/cli.ts export <プロジェクトのフォルダ> [--out ファイル] [--frames 0-900] [--stills 2.5,8,14] [--guides] [--skip-build]\n  node server/cli.ts verify <プロジェクトのフォルダ> [--frames 0-900] [--samples 12]');
    return 2;
  }
  const projectDir = resolve(dir);
  return command === 'export' ? runExport(projectDir, flags) : runVerify(projectDir, flags);
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(`\nエラー：${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
