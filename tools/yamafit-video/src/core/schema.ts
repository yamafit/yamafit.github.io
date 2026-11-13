// project.json の型と検証。管理画面・書き出し・クラウドのジョブで同じ定義を使う。
import { z } from 'zod';
import { CATEGORIES } from './categories/pack.ts';
import { EASING_KINDS } from './easing.ts';

export const SCHEMA_VERSION = 1;

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, '色は #RRGGBB の形で指定してください');
const vec3 = z.tuple([z.number(), z.number(), z.number()]);

/** 演出パラメータ。初期値と範囲は docs/PLAN.md の12章と同じ */
export const directionSchema = z.object({
  camera: z
    .object({
      /** 全体を映す距離（商品の高さの何倍か） */
      wideDistance: z.number().min(1.8).max(4.0).default(3.1),
      /** 接近したときの距離 */
      closeDistance: z.number().min(0.7).max(2.0).default(1.3),
      /** 画角（度・縦方向） */
      fovDeg: z.number().min(20).max(45).default(30),
      /** カメラの高さ（商品の高さに対する比） */
      heightRatio: z.number().min(0.2).max(1.0).default(0.55),
      /** 動きの緩急 */
      easing: z.enum(EASING_KINDS).default('easeInOutCubic'),
    })
    .prefault({}),
  rotation: z
    .object({
      /** 冒頭の回転速度（度/秒） */
      introSpeedDegPerSec: z.number().min(0).max(90).default(36),
      /** 再組み立て後の1回転にかける時間（秒） */
      fullTurnSec: z.number().min(2.0).max(3.5).default(3.5),
    })
    .prefault({}),
  explode: z
    .object({
      /** 分解距離（cm） */
      distanceCm: z.number().min(10).max(80).default(35),
      /** 分解にかける時間（秒） */
      durationSec: z.number().min(0.6).max(2.5).default(1.2),
      /** パーツが動き出す間隔（秒） */
      staggerSec: z.number().min(0).max(0.4).default(0.12),
      /** 役割テキストの表示時間（秒）。null は自動 */
      roleTextSec: z.number().min(1.2).max(5.0).nullable().default(null),
      /** 再組み立てにかける時間（秒） */
      reassembleSec: z.number().min(0.8).max(2.5).default(1.5),
    })
    .prefault({}),
  text: z
    .object({
      productNameSec: z.number().min(2.0).max(4.6).default(4.0),
      featureSec: z.number().min(1.5).max(3.3).default(3.0),
      fadeSec: z.number().min(0.2).max(0.8).default(0.4),
    })
    .prefault({}),
  light: z
    .object({
      brightness: z.number().min(0.5).max(1.8).default(1.0),
      shadow: z.number().min(0).max(0.5).default(0.25),
    })
    .prefault({}),
  background: z.enum(['light', 'green', 'dark']).default('light'),
  /** 実物の写真を動画の中にカードとして表示するか（images に写真があるときだけ表示される） */
  showPhotos: z.boolean().default(true),
});

const partSchema = z.object({
  /** パーツID（カテゴリーの候補から選ぶ） */
  id: z.string().min(1),
  /** 画面に出す名前 */
  label: z.string().min(1).max(12),
  /** 役割の説明。入力した文をそのまま使う */
  role: z.string().max(24).default(''),
  /** 実物にあると確認した印。false のパーツは描かない */
  confirmed: z.boolean(),
  /** 分解シーンで紹介するか */
  highlight: z.boolean().default(true),
  /** 分解の順番（省略時はカテゴリーの初期値） */
  order: z.number().int().min(0).optional(),
  /** glb内の部品名（省略時はパーツID） */
  nodes: z.array(z.string().min(1)).optional(),
  explode: z
    .object({
      dir: vec3.optional(),
      distanceCm: z.number().min(0).max(80).optional(),
    })
    .optional(),
});

export const projectSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'IDは半角の小文字・数字・ハイフンで指定してください'),
    category: z.enum(['pack']),
    product: z.object({
      name: z.string().min(1, '商品名を入力してください').max(40),
      maker: z.string().min(1, 'メーカーを入力してください').max(30),
      modelNumber: z.string().min(1, '型番を入力してください').max(40),
      features: z
        .array(
          z.object({
            text: z.string().min(1).max(28),
            /** カメラが近づくパーツ（省略可） */
            focusPartId: z.string().optional(),
          }),
        )
        .min(1, '特徴を1件以上入力してください')
        .max(3),
      specs: z.array(z.object({ label: z.string().min(1).max(12), value: z.string().min(1).max(24) })).default([]),
      summary: z.string().max(42).default(''),
      sources: z.array(z.object({ url: z.url(), checkedAt: z.string() })).default([]),
    }),
    images: z
      .array(z.object({ file: z.string().min(1), view: z.enum(['front', 'side', 'back', 'detail']).default('front') }))
      .max(5)
      .default([]),
    model: z.object({
      kind: z.enum(['placeholder-pack', 'glb']),
      file: z.string().nullable().default(null),
      heightCm: z.number().min(20).max(120).default(60),
      colors: z
        .object({
          main: hexColor.default('#2F6B4F'),
          sub: hexColor.default('#24523D'),
          strap: hexColor.default('#22262A'),
        })
        .prefault({}),
    }),
    parts: z.array(partSchema),
    direction: directionSchema.prefault({}),
    output: z.object({ watermark: z.boolean().default(true) }).prefault({}),
  })
  .superRefine((p, ctx) => {
    const category = CATEGORIES[p.category];
    if (!category) return;
    const known = new Set(category.parts.map((d) => d.id));
    const seen = new Set<string>();
    p.parts.forEach((part, i) => {
      if (!known.has(part.id)) {
        ctx.addIssue({ code: 'custom', path: ['parts', i, 'id'], message: `「${part.id}」は${category.label}のパーツ候補にありません` });
      }
      if (seen.has(part.id)) {
        ctx.addIssue({ code: 'custom', path: ['parts', i, 'id'], message: `パーツ「${part.id}」が重複しています` });
      }
      seen.add(part.id);
    });
    const confirmed = p.parts.filter((x) => x.confirmed);
    for (const body of category.parts.filter((d) => d.body)) {
      if (!confirmed.some((x) => x.id === body.id)) {
        ctx.addIssue({ code: 'custom', path: ['parts'], message: `本体の「${body.label}」を登録し、確認済みにしてください` });
      }
    }
    if (confirmed.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['parts'],
        message: '分解して紹介するパーツが登録されていません。「商品情報」でパーツを2つ以上登録してください。',
      });
    }
    if (!confirmed.some((x) => x.highlight)) {
      ctx.addIssue({ code: 'custom', path: ['parts'], message: '分解シーンで紹介するパーツを1つ以上選んでください' });
    }
    p.product.features.forEach((f, i) => {
      if (f.focusPartId !== undefined && !confirmed.some((x) => x.id === f.focusPartId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['product', 'features', i, 'focusPartId'],
          message: `特徴${i + 1}が指しているパーツ「${f.focusPartId}」は登録・確認されていません`,
        });
      }
    });
    const d = p.direction;
    if (d.explode.reassembleSec + d.rotation.fullTurnSec > 5.0 + 1e-9) {
      ctx.addIssue({
        code: 'custom',
        path: ['direction'],
        message: '「再組み立てにかける時間」と「1回転にかける時間」の合計が5秒を超えています。どちらかを短くしてください。',
      });
    }
    if (p.model.kind === 'glb' && !p.model.file) {
      ctx.addIssue({ code: 'custom', path: ['model', 'file'], message: '3Dモデルのファイル（glb）を指定してください' });
    }
  });

export type Project = z.infer<typeof projectSchema>;
export type ProjectInput = z.input<typeof projectSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type ProjectPart = Project['parts'][number];

/** 検証の結果。エラーは画面にそのまま出せる日本語の文にする */
export type ParseResult = { ok: true; project: Project } | { ok: false; errors: string[] };

export function parseProject(input: unknown): ParseResult {
  const r = projectSchema.safeParse(input);
  if (r.success) return { ok: true, project: r.data };
  const errors = r.error.issues.map((issue) => {
    const where = issue.path.length > 0 ? `${issue.path.join('.')}：` : '';
    return `${where}${issue.message}`;
  });
  return { ok: false, errors };
}
