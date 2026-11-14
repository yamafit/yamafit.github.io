// 書き出しページをヘッドレスChromiumで開き、フレームを1枚ずつ受け取る
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { build } from 'vite';
import { FRAME_COUNT } from '../src/core/constants.ts';
import { parseProject } from '../src/core/schema.ts';
import type { Project } from '../src/core/schema.ts';
import type { LayoutBox } from '../src/stage/overlay.ts';
import { DIST_DIR, ROOT } from './paths.ts';
import { startRenderServer } from './renderServer.ts';
import type { RenderServer } from './renderServer.ts';

/** プロジェクトを読み込み、内容を検証する。誤りがあれば分かる文でエラーにする */
export function loadProject(projectDir: string): Project {
  const file = join(projectDir, 'project.json');
  if (!existsSync(file)) throw new Error(`プロジェクトが見つかりません：${file}`);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`project.json を読み取れませんでした（JSONの書き方に誤りがあります）：${e instanceof Error ? e.message : e}`);
  }
  const parsed = parseProject(json);
  if (!parsed.ok) throw new Error(`プロジェクトの内容に誤りがあります：\n- ${parsed.errors.join('\n- ')}`);
  return parsed.project;
}

/** 書き出しページをビルドする（dist/ に出力） */
export async function buildRenderPage(): Promise<void> {
  await build({ root: ROOT, configFile: join(ROOT, 'vite.config.ts'), logLevel: 'warn' });
}

export interface RenderSession {
  chromiumVersion: string;
  glRenderer: string;
  warnings: string[];
  frameCount: number;
  /** フレーム番号 i を描かせ、PNGを受け取る */
  capture(index: number): Promise<Buffer>;
  /** フレーム番号 i を描かせ、文字や写真の位置を受け取る（配置の確認用） */
  layout(index: number): Promise<LayoutBox[]>;
  close(): Promise<void>;
}

export interface RenderSessionOptions {
  /** セーフエリアの枠を描く（確認用） */
  guides?: boolean;
}

export async function openRenderSession(projectDir: string, options: RenderSessionOptions = {}): Promise<RenderSession> {
  if (!existsSync(join(DIST_DIR, 'render.html'))) {
    throw new Error('書き出しページがビルドされていません。先に npm run build を実行してください。');
  }
  let pending: { index: number; resolve: (png: Buffer) => void } | null = null;
  const server: RenderServer = await startRenderServer({
    distDir: DIST_DIR,
    projectDir,
    onFrame: async (index, png) => {
      if (!pending || pending.index !== index) throw new Error(`想定外のフレーム（${index}）を受け取りました`);
      pending.resolve(png);
      pending = null;
    },
  });

  let browser: Browser | null = null;
  try {
    const args = ['--ignore-gpu-blocklist'];
    // YF_GL=software で、GPUがあってもソフトウェア描画に固定する（クラウドと同じ条件にしたいとき）
    if (process.env.YF_GL === 'software') args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    browser = await chromium.launch({ args, executablePath: process.env.YF_CHROMIUM_PATH || undefined });
    const page: Page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(120_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(`${server.origin}/render.html${options.guides ? '?guides=1' : ''}`);
    await page.waitForFunction(() => window.__yf && (window.__yf.ready || window.__yf.error !== null));
    const status = await page.evaluate(() => ({
      error: window.__yf.error,
      glRenderer: window.__yf.glRenderer,
      warnings: window.__yf.warnings,
      frameCount: window.__yf.frameCount,
    }));
    if (status.error) throw new Error(`書き出しページの準備に失敗しました：${status.error}`);
    if (status.frameCount !== FRAME_COUNT) throw new Error('フレーム数の設定が一致していません');

    const b = browser;
    return {
      chromiumVersion: b.version(),
      glRenderer: status.glRenderer,
      warnings: status.warnings,
      frameCount: status.frameCount,
      capture: async (index) => {
        const got = new Promise<Buffer>((resolve) => {
          pending = { index, resolve };
        });
        await page.evaluate(([i, url]) => window.__yf.captureFrame(i, url), [index, `${server.origin}/__frame?i=${index}`] as const);
        if (pageErrors.length > 0) throw new Error(`描画中にエラーが起きました：${pageErrors.join(' / ')}`);
        return got;
      },
      layout: (index) => page.evaluate((i) => window.__yf.layoutAt(i), index),
      close: async () => {
        await b.close();
        await server.close();
      },
    };
  } catch (e) {
    await browser?.close();
    await server.close();
    throw e;
  }
}
