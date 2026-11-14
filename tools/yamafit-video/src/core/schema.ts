// project.json の型と検証。管理画面・書き出し・クラウドのジョブで同じ定義を使う。
import { z } from 'zod';
import { CATEGORIES } from './categories/pack.ts';
import { EASING_KINDS } from './easing.ts';

// 入力の誤りは日本語の文で知らせる
z.config(z.locales.ja());

export const SCHEMA_VERSION = 1;

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, '色は #RRGGBB の形で指定してください');
const vec3 = z.tuple([z.number(), z.number(), z.number()]);

/** 演出パラメータ。初期値と範囲は docs/PLAN.md の12章と同じ */
export const directionSchema = z.object({
  camera: z
    .object({
      /**
       * 全体を映す距離（商品の高さの何倍か）。
       * 上の文字にかからず、回転中もはみ出さない距離より近くにはならない（自動で必要な距離まで引く）。
       */
      wideDistance: z.number().min(1.8).max(6.0).default(3.8),
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
  /** 文字を置かない余白（px）。各SNSのボタンや説明文に隠れないための目安 */
  safeArea: z
    .object({
      top: z.number().min(0).max(600).default(240),
      bottom: z.number().min(0).max(700).default(400),
      left: z.number().min(0).max(300).default(60),
      right: z.number().min(0).max(300).default(140),
    })
    .prefault({}),
});

/** 道筋（+X側。左右一対のものは自動で左右に反転して作る）。単位はcm。上が+Y、正面が+Z、背面の面が z=0 */
const pathSchema = z.array(vec3).min(2);

/**
 * 写真の輪郭に合わせた近似モデル（model.kind = "profile-pack"）の形。単位はすべてcm。
 * 数値は、商品写真の輪郭と公式の寸法から決める。写真から読み取れない所は推定になる。
 */
export const shapeSchema = z.object({
  /** 本体の輪郭。下から上へ。y は底からの高さ、halfWidth は幅の半分、depth は背面から前面までの奥行き */
  profile: z
    .array(z.object({ y: z.number().min(0), halfWidth: z.number().positive(), depth: z.number().positive() }))
    .min(4)
    .refine((a) => a.every((p, i) => i === 0 || p.y > a[i - 1]!.y), '輪郭は下から上へ、高さの順に並べてください'),
  /** 断面の丸み（2 でだ円、大きいほど四角に近い） */
  frontRoundness: z.number().min(2).max(8).default(2.4),
  backRoundness: z.number().min(2).max(8).default(5),
  /** 背面のふくらみ */
  backBulgeCm: z.number().min(0).max(5).default(0.6),
  /** 持ち手（本体の一部として作る） */
  handle: z.object({ path: pathSchema, widthCm: z.number().positive(), thicknessCm: z.number().positive() }).optional(),
  backPanel: z
    .object({ bottomY: z.number(), topY: z.number(), widthRatio: z.number().min(0.3).max(1).default(0.9), thicknessCm: z.number().positive().default(0.9) })
    .optional(),
  harness: z
    .object({
      /** 肩に当たる幅の広い部分 */
      pad: z.object({ path: pathSchema, widthTopCm: z.number().positive(), widthBottomCm: z.number().positive(), thicknessCm: z.number().positive() }),
      /** その下の細いベルト（長さ調整の部分） */
      webbing: z.object({ path: pathSchema, widthCm: z.number().positive(), thicknessCm: z.number().positive() }).optional(),
    })
    .optional(),
  chestStrap: z
    .object({ y: z.number(), halfSpanCm: z.number().positive(), z: z.number(), widthCm: z.number().positive().default(1.8), buckleXCm: z.number().default(0) })
    .optional(),
  belt: z.object({ path: pathSchema, widthCm: z.number().positive(), thicknessCm: z.number().positive(), buckle: z.boolean().default(true) }).optional(),
  sidePocket: z
    .object({
      bottomY: z.number(),
      /** 上の縁の高さ（背面側と正面側。斜めにできる） */
      topYBack: z.number(),
      topYFront: z.number(),
      /** 横から見た範囲（度）。0 が真横、プラスが正面側、マイナスが背面側 */
      fromAngleDeg: z.number().min(-60).max(60).default(-12),
      toAngleDeg: z.number().min(-60).max(80).default(30),
      thicknessCm: z.number().positive().default(0.45),
    })
    .optional(),
});
export type PackShape = z.infer<typeof shapeSchema>;

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
      /** placeholder-pack：どの商品にも使う仮の形／profile-pack：写真の輪郭に合わせた近似モデル／glb：商品別の3Dモデル */
      kind: z.enum(['placeholder-pack', 'profile-pack', 'glb']),
      file: z.string().nullable().default(null),
      heightCm: z.number().min(20).max(120).default(60),
      colors: z
        .object({
          main: hexColor.default('#2F6B4F'),
          sub: hexColor.default('#24523D'),
          strap: hexColor.default('#22262A'),
        })
        .prefault({}),
      /** profile-pack のときの形 */
      shape: shapeSchema.optional(),
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
    if (p.model.kind === 'profile-pack') {
      if (!p.model.shape) {
        ctx.addIssue({ code: 'custom', path: ['model', 'shape'], message: '近似モデル（profile-pack）には、形のデータ（shape）が必要です' });
      } else {
        const top = p.model.shape.profile[p.model.shape.profile.length - 1]!.y;
        if (Math.abs(top - p.model.heightCm) > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['model', 'shape', 'profile'],
            message: `輪郭の高さ（${top}cm）が、商品の高さ（${p.model.heightCm}cm）と合っていません`,
          });
        }
      }
    }
    if (p.model.kind === 'glb' && !p.model.file) {
      ctx.addIssue({ code: 'custom', path: ['model', 'file'], message: '3Dモデルのファイル（glb）を指定してください' });
    }
  });

export type Project = z.infer<typeof projectSchema>;
export type ProjectInput = z.input<typeof projectSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type ProjectPart = Project['parts'][number];

/** 項目の場所（例：product.features.0.text）を、画面に出せる名前（例：特徴1）に直す */
function fieldLabel(path: readonly PropertyKey[]): string {
  const key = path.map((p) => (typeof p === 'number' ? '#' : String(p))).join('.');
  const n = path.find((p) => typeof p === 'number');
  const no = typeof n === 'number' ? String(n + 1) : '';
  const labels: Record<string, string> = {
    'product.name': '商品名',
    'product.maker': 'メーカー',
    'product.modelNumber': '型番',
    'product.features': '特徴',
    'product.features.#.text': `特徴${no}`,
    'product.features.#.focusPartId': `特徴${no}のパーツ`,
    'product.summary': 'まとめ',
    'product.specs.#.label': `スペック${no}の項目名`,
    'product.specs.#.value': `スペック${no}の値`,
    'product.sources.#.url': `情報源${no}のURL`,
    parts: 'パーツ',
    'parts.#.id': `パーツ${no}`,
    'parts.#.label': `パーツ${no}の名前`,
    'parts.#.role': `パーツ${no}の役割`,
    'images.#.file': `画像${no}`,
    'model.heightCm': '商品の高さ',
    'model.shape': '形のデータ',
    'model.shape.profile': '形のデータ（輪郭）',
    direction: '演出の設定',
  };
  return labels[key] ?? (key.startsWith('direction.') ? `演出の設定（${path.slice(1).join('.')}）` : path.join('.'));
}

/** 入力の誤りを、初めての人にも分かる文にする（この定義で独自の文を付けたものは、そのまま使う） */
function friendlyMessage(issue: z.core.$ZodIssue): string {
  // 独自の文を付けていない場合だけ、決まり文句に置き換える
  if (!/^(大きすぎる値|小さすぎる値|無効な)/.test(issue.message)) return issue.message;
  switch (issue.code) {
    case 'too_big':
      if (issue.origin === 'string') return `${issue.maximum}文字以内で入力してください`;
      if (issue.origin === 'array') return `${issue.maximum}件までにしてください`;
      return `${issue.maximum}以下の数値にしてください`;
    case 'too_small':
      if (issue.origin === 'string') return Number(issue.minimum) <= 1 ? '入力してください' : `${issue.minimum}文字以上で入力してください`;
      if (issue.origin === 'array') return `${issue.minimum}件以上入力してください`;
      return `${issue.minimum}以上の数値にしてください`;
    case 'invalid_type':
      return issue.expected === 'number' ? '数値を入力してください' : '入力の形が正しくありません';
    case 'invalid_format':
      return issue.format === 'url' ? 'URLの形が正しくありません（https:// から始まるURLを入力してください）' : '入力の形が正しくありません';
    case 'invalid_value':
      return '選べる値の中から選んでください';
    default:
      return issue.message;
  }
}

/** 検証の結果。エラーは画面にそのまま出せる日本語の文にする */
export type ParseResult = { ok: true; project: Project } | { ok: false; errors: string[] };

export function parseProject(input: unknown): ParseResult {
  const r = projectSchema.safeParse(input);
  if (r.success) return { ok: true, project: r.data };
  const errors = r.error.issues.map((issue) => {
    const where = issue.path.length > 0 ? `${fieldLabel(issue.path)}：` : '';
    return `${where}${friendlyMessage(issue)}`;
  });
  return { ok: false, errors };
}
