// 描画の本体。renderAt(t) を呼ぶと、時刻 t の1枚を out キャンバスに描く。
// プレビューも書き出しも、必ずこの関数を通す（見たままが書き出されるようにするため）。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { captionsAt } from '../core/captions.ts';
import { HEIGHT, WIDTH } from '../core/constants.ts';
import { photoCardsAt } from '../core/photoCards.ts';
import type { Project } from '../core/schema.ts';
import { buildTimeline, nodeOffset, sampleTimeline } from '../core/timeline.ts';
import type { FrameState, TimelinePlan } from '../core/timeline.ts';
import { loadFonts } from './fonts.ts';
import type { ProductModel } from './model.ts';
import { drawOverlay } from './overlay.ts';
import type { LayoutBox } from './overlay.ts';
import { createPlaceholderPack } from './placeholderPack.ts';
import { createProfilePack } from './profilePack.ts';

/** 背景の色（サイトの配色に合わせた3種類）。上・中・下の順 */
const BACKGROUNDS = {
  light: { stops: ['#E9EDE6', '#F4F5F1', '#DEE3DA'], dim: '#DADFD6' },
  green: { stops: ['#1D4A38', '#1F5A43', '#15362A'], dim: '#2A5B47' },
  dark: { stops: ['#1B2B23', '#14231C', '#0C1612'], dim: '#26362E' },
} as const;

// ロゴの画像：assets/logo/ に logo.svg / logo.png / logo.webp を置くと、文字のロゴの代わりに使う
const LOGO_FILES = import.meta.glob('../../assets/logo/logo.{svg,png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface StageOptions {
  /** セーフエリアの枠を描く（確認用） */
  guides?: boolean;
}

interface PartRuntime {
  id: string;
  nodes: { object: THREE.Object3D; home: THREE.Vector3; centerX: number }[];
  materials: { material: THREE.MeshStandardMaterial; base: THREE.Color }[];
}

export class Stage {
  readonly plan: TimelinePlan;
  /** 描画に使われたGPU（またはソフトウェア描画）の名前。書き出しの記録に残す */
  readonly glRenderer: string;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.05, 60);
  private readonly background: HTMLCanvasElement;
  private readonly dimColor: THREE.Color;
  private readonly parts: PartRuntime[] = [];
  private readonly project: Project;
  private readonly model: ProductModel;
  private readonly images: (ImageBitmap | null)[];
  private readonly logo: ImageBitmap | HTMLImageElement | null;
  private readonly guides: boolean;
  /** 直前に描いたフレームの、文字や写真の位置（配置の確認とテストに使う） */
  lastLayout: LayoutBox[] = [];

  private constructor(
    out: HTMLCanvasElement,
    project: Project,
    model: ProductModel,
    images: (ImageBitmap | null)[],
    logo: ImageBitmap | HTMLImageElement | null,
    imageWarnings: string[],
    options: StageOptions,
  ) {
    this.project = project;
    this.model = model;
    this.images = images;
    this.logo = logo;
    this.guides = options.guides === true;
    out.width = WIDTH;
    out.height = HEIGHT;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('2Dキャンバスを用意できませんでした');
    this.ctx = ctx;

    const glCanvas = document.createElement('canvas');
    glCanvas.width = WIDTH;
    glCanvas.height = HEIGHT;
    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(WIDTH, HEIGHT, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 商品の色を変えにくいトーンマッピング（Khronos PBR Neutral）
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.glRenderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';

    const bg = BACKGROUNDS[project.direction.background];
    this.dimColor = new THREE.Color(bg.dim);
    this.background = this.makeBackground(bg.stops);

    this.setupLights();
    this.scene.add(model.root);
    for (const [id, objects] of model.partNodes) {
      const runtime: PartRuntime = { id, nodes: [], materials: [] };
      const seen = new Set<THREE.Material>();
      for (const object of objects) {
        const box = new THREE.Box3().setFromObject(object);
        runtime.nodes.push({ object, home: object.position.clone(), centerX: box.getCenter(new THREE.Vector3()).x });
        object.traverse((child) => {
          const material = (child as THREE.Mesh).material;
          if (material instanceof THREE.MeshStandardMaterial && !seen.has(material)) {
            seen.add(material);
            runtime.materials.push({ material, base: material.color.clone() });
          }
        });
      }
      this.parts.push(runtime);
    }
    this.plan = buildTimeline(project, model.info);
    this.plan.warnings.push(...imageWarnings);
  }

  /**
   * フォント・モデル・写真を読み込み終えてから Stage を返す。
   * assetBase は、プロジェクトのフォルダを指すURL（写真の場所の基準）。
   */
  static async create(out: HTMLCanvasElement, project: Project, assetBase: string, options: StageOptions = {}): Promise<Stage> {
    await loadFonts();
    if (project.model.kind === 'glb') {
      throw new Error('商品別の3Dモデル（glb）の読み込みは、まだ実装されていません');
    }
    const model = project.model.kind === 'profile-pack' ? createProfilePack(project) : createPlaceholderPack(project);
    // 写真は、読み込めなくても書き出しを止めない（カードを出さず、注意として知らせる）
    const warnings: string[] = [];
    const images = await Promise.all(
      project.images.map(async (entry) => {
        if (!project.direction.showPhotos) return null;
        try {
          const res = await fetch(new URL(entry.file, assetBase));
          if (!res.ok) throw new Error(String(res.status));
          return await createImageBitmap(await res.blob());
        } catch {
          warnings.push(`写真「${entry.file}」を読み込めませんでした。この写真のカードは表示されません。`);
          return null;
        }
      }),
    );
    // ロゴ：画像があれば読み込む（SVGは <img> として読み込む）
    let logo: ImageBitmap | HTMLImageElement | null = null;
    const logoUrl = Object.values(LOGO_FILES)[0];
    if (logoUrl) {
      try {
        const img = new Image();
        img.src = logoUrl;
        await img.decode();
        logo = img;
      } catch {
        warnings.push('ロゴの画像を読み込めませんでした。文字のロゴを表示します。');
      }
    }
    return new Stage(out, project, model, images, logo, warnings, options);
  }

  /** スタジオ風の3灯（キー・フィル・リム）と、やわらかい映り込み用の環境 */
  private setupLights(): void {
    const b = this.project.direction.light.brightness;
    const H = this.model.info.heightM;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55 * b;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xfff4e8, 2.6 * b);
    key.position.set(1.6 * H * 2, 2.6 * H * 2, 2.2 * H * 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const reach = Math.max(1.6, H * 3);
    key.shadow.camera.left = -reach;
    key.shadow.camera.right = reach;
    key.shadow.camera.top = reach;
    key.shadow.camera.bottom = -reach;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 5;
    const fill = new THREE.DirectionalLight(0xd9e6ff, 0.7 * b);
    fill.position.set(-3, 1.4, 2);
    const rim = new THREE.DirectionalLight(0xffffff, 1.5 * b);
    rim.position.set(-1.2, 2.6, -3.2);
    this.scene.add(key, fill, rim);

    // 床：影だけを受ける透明な面
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: this.project.direction.light.shadow }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  /** 撮影スタジオ風の背景（単色のグラデーション）。1回だけ作って使い回す */
  private makeBackground(stops: readonly [string, string, string]): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = WIDTH;
    c.height = HEIGHT;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.55, stops[1]);
    g.addColorStop(1, stops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return c;
  }

  private apply(state: FrameState): void {
    const { root, offsetScale } = this.model;
    root.rotation.y = state.yawRad;
    root.position.y = state.liftM;
    for (const part of this.parts) {
      const s = state.parts.find((p) => p.id === part.id);
      const offset = s ? s.offset : ([0, 0, 0] as const);
      for (const n of part.nodes) {
        const o = nodeOffset(offset, n.centerX);
        n.object.position.set(n.home.x + o[0] * offsetScale, n.home.y + o[1] * offsetScale, n.home.z + o[2] * offsetScale);
      }
      // 紹介中でないパーツは背景に近い色にして、紹介中のパーツを目立たせる
      const dim = s ? s.dim : 0;
      for (const m of part.materials) m.material.color.copy(m.base).lerp(this.dimColor, 0.66 * dim);
    }
    this.camera.fov = state.camera.fovDeg;
    this.camera.position.set(...state.camera.position);
    this.camera.lookAt(...state.camera.target);
    // 画面の中で3D全体を上下にずらす（遠近感は変えずに、文字の場所を空ける）
    this.camera.setViewOffset(WIDTH, HEIGHT, 0, -state.camera.shiftYPx, WIDTH, HEIGHT);
    this.camera.updateProjectionMatrix();
  }

  /** 時刻 t（秒）の1枚を描く。前後のフレームには依存しない */
  renderAt(t: number): FrameState {
    const state = sampleTimeline(this.plan, t);
    this.apply(state);
    this.renderer.render(this.scene, this.camera);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.background, 0, 0);
    ctx.drawImage(this.renderer.domElement, 0, 0);
    this.lastLayout = drawOverlay(ctx, {
      project: this.project,
      captions: captionsAt(this.project, this.plan, state),
      photoCards: photoCardsAt(this.project, this.plan, state.t),
      images: this.images,
      logo: this.logo,
      guides: this.guides,
    });
    return state;
  }
}
