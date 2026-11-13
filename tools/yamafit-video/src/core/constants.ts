// 出力の固定値（仕様で決まっているため、利用者は変更できない）
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const DURATION_SEC = 30;
export const FRAME_COUNT = FPS * DURATION_SEC; // 900

/** フレーム番号（0始まり）を時刻（秒）に直す */
export function frameToTime(frame: number): number {
  return frame / FPS;
}

/** シーンの区切り（秒）。映像の長さは変えない */
export const SCENES = [
  { id: 'overview', label: '全体像', start: 0, end: 5 },
  { id: 'features', label: '特徴の紹介', start: 5, end: 12 },
  { id: 'explode', label: '分解', start: 12, end: 22 },
  { id: 'reassemble', label: '再組み立て', start: 22, end: 27 },
  { id: 'summary', label: 'まとめ', start: 27, end: 30 },
] as const;

export type SceneId = (typeof SCENES)[number]['id'];

export function sceneAt(t: number): SceneId {
  for (const s of SCENES) {
    if (t < s.end) return s.id;
  }
  return 'summary';
}

/** 文字を置かない領域（px）。各SNSの画面に隠れないための目安 */
export const SAFE_AREA = { top: 240, bottom: 400, left: 60, right: 140 } as const;
