import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// 管理画面（Phase 4で追加）と書き出し専用ページを同じ設定でビルドする
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2023',
    rollupOptions: {
      input: {
        render: resolve(import.meta.dirname, 'render.html'),
      },
    },
  },
});
