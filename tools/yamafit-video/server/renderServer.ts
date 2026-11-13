// 書き出し中だけ動く小さなサーバー（このコンピューターの中からしか接続できない）。
//  - ビルド済みの書き出しページ（dist/）を配る
//  - プロジェクトのフォルダを /__project/ で配る
//  - 描いたフレーム（PNG）を /__frame で受け取る
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

export interface RenderServer {
  origin: string;
  close(): Promise<void>;
}

export interface RenderServerOptions {
  distDir: string;
  projectDir: string;
  /** フレームを受け取ったときに呼ぶ。終わるまでページ側は次のフレームに進まない */
  onFrame(index: number, png: Buffer): Promise<void>;
}

/** base の外に出るパスを拒否して、安全なファイルパスにする */
function safeJoin(base: string, rel: string): string | null {
  const full = resolve(join(base, normalize(decodeURIComponent(rel))));
  const root = resolve(base);
  return full === root || full.startsWith(root + sep) ? full : null;
}

export async function startRenderServer(opts: RenderServerOptions): Promise<RenderServer> {
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/__frame') {
      const index = Number(url.searchParams.get('i'));
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        opts.onFrame(index, Buffer.concat(chunks)).then(
          () => res.writeHead(200).end('ok'),
          (e: unknown) => res.writeHead(500).end(e instanceof Error ? e.message : String(e)),
        );
      });
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    const file = url.pathname.startsWith('/__project/')
      ? safeJoin(opts.projectDir, url.pathname.slice('/__project/'.length))
      : safeJoin(opts.distDir, url.pathname === '/' ? 'render.html' : url.pathname.slice(1));
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}
