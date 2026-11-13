import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** tools/yamafit-video のフォルダ */
export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const DIST_DIR = join(ROOT, 'dist');
export const OUT_DIR = join(ROOT, 'out');
