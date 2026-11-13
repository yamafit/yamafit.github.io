// 書き出し専用ページ。管理画面は持たず、外（Playwright）から呼ばれて1枚ずつ描く。
import { FPS, FRAME_COUNT, frameToTime } from './core/constants.ts';
import { parseProject } from './core/schema.ts';
import { Stage } from './stage/Stage.ts';

interface RenderApi {
  ready: boolean;
  error: string | null;
  frameCount: number;
  fps: number;
  glRenderer: string;
  warnings: string[];
  /** フレーム番号 i を描く */
  renderFrame(i: number): void;
  /** フレーム番号 i を描き、PNGにして url へ送る */
  captureFrame(i: number, url: string): Promise<void>;
}

declare global {
  interface Window {
    __yf: RenderApi;
  }
}

const api: RenderApi = {
  ready: false,
  error: null,
  frameCount: FRAME_COUNT,
  fps: FPS,
  glRenderer: '',
  warnings: [],
  renderFrame() {
    throw new Error('まだ準備ができていません');
  },
  async captureFrame() {
    throw new Error('まだ準備ができていません');
  },
};
window.__yf = api;

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const url = params.get('project') ?? '/__project/project.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`プロジェクトを読み込めませんでした（${url}：${res.status}）`);
  const parsed = parseProject(await res.json());
  if (!parsed.ok) throw new Error(`プロジェクトの内容に誤りがあります：\n${parsed.errors.join('\n')}`);

  const out = document.getElementById('out') as HTMLCanvasElement;
  const stage = await Stage.create(out, parsed.project, new URL('.', new URL(url, location.href)).href);
  api.glRenderer = stage.glRenderer;
  api.warnings = stage.plan.warnings;
  api.renderFrame = (i) => {
    stage.renderAt(frameToTime(i));
  };
  api.captureFrame = async (i, postUrl) => {
    stage.renderAt(frameToTime(i));
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error(`フレーム${i}を画像にできませんでした`);
    const r = await fetch(postUrl, { method: 'POST', body: blob });
    if (!r.ok) throw new Error(`フレーム${i}を送れませんでした（${r.status}）`);
  };
  stage.renderAt(0);
  api.ready = true;
}

main().catch((e: unknown) => {
  api.error = e instanceof Error ? e.message : String(e);
});
