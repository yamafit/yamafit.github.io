// 同梱フォントの読み込み。Google Fonts には接続しない（環境によって結果が変わらないようにするため）。
import zenBold from '../../assets/fonts/ZenKakuGothicNew-Bold.ttf?url';
import zenBlack from '../../assets/fonts/ZenKakuGothicNew-Black.ttf?url';
import plexMono from '../../assets/fonts/IBMPlexMono-Medium.ttf?url';

export const FONT_JP = 'YF Zen Kaku Gothic New';
export const FONT_MONO = 'YF IBM Plex Mono';

/** すべてのフォントを読み込み終えてから戻る（1フレーム目を描く前に必ず呼ぶ） */
export async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace(FONT_JP, `url(${zenBold})`, { weight: '700' }),
    new FontFace(FONT_JP, `url(${zenBlack})`, { weight: '900' }),
    new FontFace(FONT_MONO, `url(${plexMono})`, { weight: '500' }),
  ];
  await Promise.all(
    faces.map(async (f) => {
      await f.load();
      document.fonts.add(f);
    }),
  );
  await document.fonts.ready;
}
