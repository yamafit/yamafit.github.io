// タイムライン：時刻 t（秒）から、カメラ・モデルの向き・各パーツの位置を求める。
//
// 決まりごと（再現性のため）
//  - すべて「project と t だけ」で決まる純粋な計算にする。前のフレームの結果を使わない。
//  - 現在時刻・経過時間・乱数は使わない。
//  - three.js やブラウザの機能に依存しない（Node のテストでも同じ値になる）。
import { CATEGORIES, partDef } from './categories/pack.ts';
import type { CategoryDef } from './categories/pack.ts';
import { boundsCenter, boxCorners, cameraPosition, fitDistance } from './camera.ts';
import { DURATION_SEC, HEIGHT, SCENES, WIDTH, sceneAt } from './constants.ts';
import type { SceneId } from './constants.ts';
import { clamp01, ease, rampedTime, sampleTrack, smoothstep } from './easing.ts';
import type { EasingKind, Key } from './easing.ts';
import type { Project } from './schema.ts';
import { DEG, add, normalize, rotateY, scale, sub, wrap180 } from './vec.ts';
import type { Vec3 } from './vec.ts';

/** モデルの中の1部品の大きさ（分解前。モデル座標・メートル） */
export interface NodeBox {
  name: string;
  center: Vec3;
  size: Vec3;
}

/** 3Dモデルから読み取った寸法。仮モデルでも glb でも同じ形にする */
export interface ModelInfo {
  heightM: number;
  /** 全体を囲む箱の中心 */
  center: Vec3;
  parts: Record<string, { nodes: NodeBox[] }>;
}

export interface PlanPart {
  id: string;
  label: string;
  role: string;
  highlight: boolean;
  /** 本体（分解しても動かない） */
  body: boolean;
  /** 分解しきったときの移動量（+X側の部品用。−X側は左右を反転して使う） */
  fullOffset: Vec3;
  nodes: NodeBox[];
  /** カメラが注目する点（分解前） */
  focus: Vec3;
  /** カメラが注目する点（分解後） */
  explodedFocus: Vec3;
  explodeStart: number;
  explodeDur: number;
  reassembleStart: number;
  reassembleDur: number;
}

export interface Highlight {
  partId: string;
  /** 強調が始まる時刻 */
  start: number;
  /** 強調が消え始める時刻 */
  fadeOutStart: number;
  /** 表示の持ち時間（秒） */
  slot: number;
}

export interface FeatureSegment {
  index: number;
  text: string;
  start: number;
  end: number;
  /** カメラが寄り終わる時刻 */
  arrive: number;
  focusPartId: string | undefined;
}

export interface TimelinePlan {
  heightM: number;
  fovDeg: number;
  parts: PlanPart[];
  features: FeatureSegment[];
  highlights: Highlight[];
  highlightFade: number;
  /** 分解中にモデル全体を持ち上げる量（m）。下向きに動くパーツが床にめり込まないようにする */
  liftMax: number;
  explodeStart: number;
  explodeDur: number;
  reassembleStart: number;
  reassembleDur: number;
  /** 分解後の全体の中心（モデル座標） */
  explodedCenter: Vec3;
  yaw: { startDeg: number; introSpeed: number; driftRate: number; moveKeys: Key[] };
  distKeys: Key[];
  elevKeys: Key[];
  targetKeys: [Key[], Key[], Key[]];
  /** 利用者に知らせる注意（時間に収まらない など） */
  warnings: string[];
}

export interface PartState {
  id: string;
  /** 分解前の位置からの移動量（m、モデル座標、+X側の部品用） */
  offset: Vec3;
  /** 強調の度合い（0〜1） */
  emphasis: number;
  /** 薄くする度合い（0〜1）。他のパーツが強調されている間に上がる */
  dim: number;
}

export interface FrameState {
  t: number;
  scene: SceneId;
  /** モデルの向き（ラジアン。Y軸まわり） */
  yawRad: number;
  /** モデル全体を持ち上げる量（m） */
  liftM: number;
  camera: { position: Vec3; target: Vec3; fovDeg: number };
  parts: PartState[];
}

const SCENE = Object.fromEntries(SCENES.map((s) => [s.id, s])) as Record<SceneId, (typeof SCENES)[number]>;

// 演出の固定値（利用者が触らない細かい数値）
const INTRO_DECEL_SEC = 1.0; // 冒頭の回転が止まるまでの時間
const DRIFT_DEG_PER_SEC = 3; // 特徴・分解シーンのゆっくりした回転
const INTRO_PUSH_IN = 1.12; // 冒頭は少し遠くから近づく
const SUMMARY_PULL_BACK = 1.06; // 最後は少し引く
const SUMMARY_TURN_DEG = 8;
const HIGHLIGHT_LEAD_SEC = 0.15; // 分解の直後・再組み立ての直前に空ける時間
const HIGHLIGHT_TARGET_BIAS = 0.22; // 強調中のパーツへカメラを寄せる割合
const HIGHLIGHT_ZOOM = 0.05; // 強調中に近づく割合
const FIT_MARGIN = { marginX: 0.86, marginY: 0.7 }; // 分解した全体を収める範囲（上下は文字のために空ける）
const CLOSE_MARGIN = { marginX: 0.9, marginY: 0.74 }; // 接近したときにパーツを収める範囲
const FLOOR_CLEARANCE_M = 0.04;
/** 役割テキストがこれより短い時間しか出ないときは注意を出す（秒） */
export const MIN_ROLE_TEXT_SEC = 1.2;

/** −X側にある部品は、左右の動きだけ反転させる（左右一対のパーツ用） */
export function nodeOffset(offset: Vec3, nodeCenterX: number): Vec3 {
  if (offset[0] !== 0 && nodeCenterX < -1e-6) return [-offset[0], offset[1], offset[2]];
  return offset;
}

function allCorners(nodes: readonly NodeBox[], offset: Vec3): Vec3[] {
  return nodes.flatMap((n) => boxCorners(add(n.center, nodeOffset(offset, n.center[0])), n.size));
}

/** カメラが注目する点。左右一対で左右に開くパーツは +X 側の部品を見る */
function focusPoint(nodes: readonly NodeBox[], offset: Vec3, applied: Vec3): Vec3 {
  if (offset[0] !== 0) {
    const plusSide = [...nodes].sort((a, b) => b.center[0] - a.center[0])[0];
    if (plusSide) return add(plusSide.center, nodeOffset(applied, plusSide.center[0]));
  }
  return boundsCenter(allCorners(nodes, applied));
}

/** 特徴にパーツの指定がないときの見せ方（順番に使う） */
const GENERIC_VIEWS = [
  { yawDeg: 20, elevationDeg: 12, targetHeight: 0.62 },
  { yawDeg: 160, elevationDeg: 8, targetHeight: 0.5 },
  { yawDeg: -60, elevationDeg: 8, targetHeight: 0.35 },
] as const;

/** project とモデルの寸法から、30秒分の動きの設計図を作る */
export function buildTimeline(project: Project, model: ModelInfo): TimelinePlan {
  const category: CategoryDef | undefined = CATEGORIES[project.category];
  if (!category) throw new Error(`カテゴリー「${project.category}」には対応していません`);
  const dir = project.direction;
  const H = model.heightM;
  const warnings: string[] = [];

  // --- 描くパーツ：登録され、確認済みで、モデルに部品があるものだけ ---
  const entries = project.parts
    .filter((p) => p.confirmed)
    .flatMap((p) => {
      const def = partDef(category, p.id);
      const nodes = model.parts[p.id]?.nodes ?? [];
      if (!def) return [];
      if (nodes.length === 0) {
        warnings.push(`パーツ「${p.label}」に対応する部品が3Dモデルにありません。このパーツは表示されません。`);
        return [];
      }
      return [{ part: p, def, nodes, order: p.order ?? def.order }];
    })
    .sort((a, b) => Number(b.def.body ?? false) - Number(a.def.body ?? false) || a.order - b.order);

  const movers = entries.filter((e) => !e.def.body);
  const m = movers.length;

  const explodeStart = SCENE.explode.start;
  const explodeDur = dir.explode.durationSec;
  const stagger = m > 1 ? Math.min(dir.explode.staggerSec, (explodeDur - 0.4) / (m - 1)) : 0;
  const perExplode = explodeDur - (m - 1) * stagger;

  const reassembleStart = SCENE.reassemble.start;
  const reassembleDur = dir.explode.reassembleSec;
  const staggerR = m > 1 ? Math.min(dir.explode.staggerSec, (reassembleDur - 0.5) / (m - 1)) : 0;
  const perReassemble = reassembleDur - (m - 1) * staggerR;

  const parts: PlanPart[] = entries.map((e) => {
    const body = e.def.body === true;
    const k = movers.indexOf(e);
    const direction = e.part.explode?.dir ?? e.def.explodeDir;
    const distanceM = (e.part.explode?.distanceCm ?? dir.explode.distanceCm * e.def.explodeScale) / 100;
    const fullOffset: Vec3 = body ? [0, 0, 0] : scale(normalize(direction), distanceM);
    return {
      id: e.part.id,
      label: e.part.label,
      role: e.part.role,
      highlight: e.part.highlight,
      body,
      fullOffset,
      nodes: e.nodes,
      focus: focusPoint(e.nodes, fullOffset, [0, 0, 0]),
      explodedFocus: focusPoint(e.nodes, fullOffset, fullOffset),
      explodeStart: explodeStart + Math.max(k, 0) * stagger,
      explodeDur: perExplode,
      reassembleStart: reassembleStart + Math.max(m - 1 - k, 0) * staggerR,
      reassembleDur: perReassemble,
    };
  });

  // --- 分解後の全体の大きさ ---
  const explodedPoints = parts.flatMap((p) => allCorners(p.nodes, p.fullOffset));
  const explodedCenter = explodedPoints.length > 0 ? boundsCenter(explodedPoints) : ([0, H / 2, 0] as Vec3);
  const minY = explodedPoints.reduce((lo, p) => Math.min(lo, p[1]), Infinity);
  const liftMax = Number.isFinite(minY) ? Math.max(0, FLOOR_CLEARANCE_M - minY) : 0;

  // --- 強調（分解シーンでパーツを1つずつ紹介する） ---
  const highlightStart = explodeStart + explodeDur + HIGHLIGHT_LEAD_SEC;
  const highlightEnd = SCENE.explode.end - HIGHLIGHT_LEAD_SEC;
  const highlighted = parts.filter((p) => p.highlight);
  const autoSlot = highlighted.length > 0 ? (highlightEnd - highlightStart) / highlighted.length : 0;
  let slot = autoSlot;
  if (dir.explode.roleTextSec !== null && highlighted.length > 0) {
    if (dir.explode.roleTextSec > autoSlot + 1e-9) {
      warnings.push(
        `役割テキストの表示時間（${dir.explode.roleTextSec}秒）は、紹介するパーツが${highlighted.length}個では収まりません。自動（${autoSlot.toFixed(1)}秒）で表示します。`,
      );
    } else {
      slot = dir.explode.roleTextSec;
    }
  }
  if (highlighted.length > 0 && slot < MIN_ROLE_TEXT_SEC - 1e-9) {
    warnings.push(
      `紹介するパーツが${highlighted.length}個あり、1パーツあたり${slot.toFixed(1)}秒しか表示できません。説明が短くなります。紹介するパーツを減らすことをおすすめします。`,
    );
  }
  const highlightFade = Math.min(0.3, slot / 3);
  const highlights: Highlight[] = highlighted.map((p, j) => {
    const start = highlightStart + j * slot;
    const isLast = j === highlighted.length - 1;
    return { partId: p.id, start, slot, fadeOutStart: isLast ? start + slot - highlightFade : start + slot };
  });

  // --- 特徴の紹介（5〜12秒を件数で等分する） ---
  const featureCount = project.product.features.length;
  const featureSpan = (SCENE.features.end - SCENE.features.start) / featureCount;
  const moveDur = Math.min(1.5, featureSpan * 0.45);
  const features: FeatureSegment[] = project.product.features.map((f, i) => {
    const start = SCENE.features.start + i * featureSpan;
    return { index: i, text: f.text, start, end: start + featureSpan, arrive: start + moveDur, focusPartId: f.focusPartId };
  });

  // --- モデルの向き ---
  const camEase: EasingKind = dir.camera.easing;
  const yawStart = category.introYawDeg;
  const introSpeed = dir.rotation.introSpeedDegPerSec;
  const spinEnd = introSpeed * rampedTime(SCENE.overview.end, 0, SCENE.overview.end, 0, INTRO_DECEL_SEC);
  const drift = (t: number) => DRIFT_DEG_PER_SEC * rampedTime(t, SCENE.features.start, SCENE.explode.end, 0.5, 0.5);
  const moveKeys: Key[] = [{ t: SCENE.features.start, v: 0 }];
  let move = 0;
  /** 時刻 at に向き wantDeg を向くよう、いちばん近い回り方で動かす */
  const turnTo = (wantDeg: number, at: number) => {
    move += wrap180(wantDeg - (yawStart + spinEnd + move + drift(at)));
  };

  // --- カメラ ---
  const wideD = dir.camera.wideDistance * H;
  const closeD = dir.camera.closeDistance * H;
  const elevWide = Math.atan((dir.camera.heightRatio - 0.5) / dir.camera.wideDistance) / DEG;
  const center: Vec3 = [0, H / 2, 0];
  const distKeys: Key[] = [
    { t: 0, v: wideD * INTRO_PUSH_IN },
    { t: 4.5, v: wideD, ease: camEase },
    { t: SCENE.overview.end, v: wideD },
  ];
  const elevKeys: Key[] = [
    { t: 0, v: elevWide },
    { t: SCENE.overview.end, v: elevWide },
  ];
  const targetKeys: [Key[], Key[], Key[]] = [0, 1, 2].map((i) => [
    { t: 0, v: center[i]! },
    { t: SCENE.overview.end, v: center[i]! },
  ]) as [Key[], Key[], Key[]];
  const pushPose = (arrive: number, holdUntil: number, dist: number, elev: number, target: Vec3, e: EasingKind) => {
    distKeys.push({ t: arrive, v: dist, ease: e }, { t: holdUntil, v: dist });
    elevKeys.push({ t: arrive, v: elev, ease: e }, { t: holdUntil, v: elev });
    targetKeys.forEach((keys, i) => keys.push({ t: arrive, v: target[i]!, ease: e }, { t: holdUntil, v: target[i]! }));
  };

  // 特徴ごとに、関係するパーツへ寄る。
  // 近づきすぎて何のパーツか分からなくならないよう、パーツ全体が画面に収まる距離より近くには寄らない。
  const bodyPart = parts.find((p) => p.body);
  for (const f of features) {
    const part = f.focusPartId ? parts.find((p) => p.id === f.focusPartId) : undefined;
    const def = part ? partDef(category, part.id) : undefined;
    const generic = GENERIC_VIEWS[f.index % GENERIC_VIEWS.length]!;
    const viewYaw = def ? def.viewYawDeg : generic.yawDeg;
    const viewElev = def ? def.viewElevationDeg : generic.elevationDeg;
    const target: Vec3 = part ? part.focus : [0, generic.targetHeight * H, 0];
    const shown = part ?? bodyPart;
    let dist = closeD;
    if (shown) {
      const yawRad = viewYaw * DEG;
      const pts = allCorners(shown.nodes, [0, 0, 0]).map((p) => rotateY(p, yawRad));
      dist = Math.max(dist, fitDistance(pts, rotateY(target, yawRad), viewElev, { fovDeg: dir.camera.fovDeg, aspect: WIDTH / HEIGHT, ...CLOSE_MARGIN }));
    }
    turnTo(viewYaw, (f.arrive + f.end) / 2);
    moveKeys.push({ t: f.arrive, v: move, ease: camEase }, { t: f.end, v: move });
    pushPose(f.arrive, f.end, Math.min(dist, wideD), viewElev, target, camEase);
  }

  // 分解：全体が収まる距離まで引く
  const explodeArrive = explodeStart + explodeDur;
  turnTo(category.explodeViewYawDeg, (highlightStart + highlightEnd) / 2);
  moveKeys.push({ t: explodeArrive, v: move, ease: camEase }, { t: SCENE.explode.end, v: move });
  const explodeMove = move;
  let explodedD = wideD;
  for (let i = 0; i <= 4; i++) {
    const at = explodeArrive + ((SCENE.explode.end - explodeArrive) * i) / 4;
    const yawRad = (yawStart + spinEnd + explodeMove + drift(at)) * DEG;
    const pts = explodedPoints.map((p) => rotateY(p, yawRad));
    const need = fitDistance(pts, rotateY(explodedCenter, yawRad), category.explodeViewElevationDeg, {
      fovDeg: dir.camera.fovDeg,
      aspect: WIDTH / HEIGHT,
      ...FIT_MARGIN,
    });
    explodedD = Math.max(explodedD, need);
  }
  pushPose(explodeArrive, SCENE.explode.end, explodedD, category.explodeViewElevationDeg, explodedCenter, camEase);

  // 再組み立て：冒頭と同じ向き・距離に戻し、そのあと1回転する
  const reassembleArrive = reassembleStart + reassembleDur;
  const turnStart = SCENE.reassemble.end - dir.rotation.fullTurnSec;
  turnTo(yawStart, reassembleArrive);
  moveKeys.push({ t: reassembleArrive, v: move, ease: camEase }, { t: Math.max(turnStart, reassembleArrive), v: move });
  move += 360;
  moveKeys.push({ t: SCENE.reassemble.end, v: move, ease: 'easeInOutSine' });
  pushPose(reassembleArrive, SCENE.reassemble.end, wideD, elevWide, center, camEase);

  // まとめ：少し引きながら、ゆっくり止まる
  move += SUMMARY_TURN_DEG;
  moveKeys.push({ t: DURATION_SEC, v: move, ease: 'easeInOutSine' });
  pushPose(DURATION_SEC, DURATION_SEC, wideD * SUMMARY_PULL_BACK, elevWide, center, 'easeInOutSine');

  return {
    heightM: H,
    fovDeg: dir.camera.fovDeg,
    parts,
    features,
    highlights,
    highlightFade,
    liftMax,
    explodeStart,
    explodeDur,
    reassembleStart,
    reassembleDur,
    explodedCenter,
    yaw: { startDeg: yawStart, introSpeed, driftRate: DRIFT_DEG_PER_SEC, moveKeys },
    distKeys,
    elevKeys,
    targetKeys,
    warnings,
  };
}

/** モデルの向き（度） */
export function yawDegAt(plan: TimelinePlan, t: number): number {
  const spin = plan.yaw.introSpeed * rampedTime(t, 0, SCENES[0].end, 0, INTRO_DECEL_SEC);
  const drift = plan.yaw.driftRate * rampedTime(t, SCENE.features.start, SCENE.explode.end, 0.5, 0.5);
  return plan.yaw.startDeg + spin + drift + sampleTrack(plan.yaw.moveKeys, t);
}

/** 強調の度合い（0〜1）。次のパーツへは重なりながら切り替わる */
function emphasisAt(plan: TimelinePlan, h: Highlight, t: number): number {
  const fade = plan.highlightFade;
  if (fade <= 0) return t >= h.start && t < h.fadeOutStart ? 1 : 0;
  return smoothstep((t - h.start) / fade) * (1 - smoothstep((t - h.fadeOutStart) / fade));
}

/** 時刻 t（秒）の状態を求める。t は 0〜30 に丸める */
export function sampleTimeline(plan: TimelinePlan, time: number): FrameState {
  const t = Math.min(Math.max(time, 0), DURATION_SEC);
  const yawRad = yawDegAt(plan, t) * DEG;

  // 分解と再組み立て
  const emphasisById = new Map<string, number>();
  let emphasisSum = 0;
  let focusShift: Vec3 = [0, 0, 0];
  for (const h of plan.highlights) {
    const e = emphasisAt(plan, h, t);
    if (e <= 0) continue;
    emphasisById.set(h.partId, e);
    emphasisSum += e;
    const part = plan.parts.find((p) => p.id === h.partId);
    if (part) focusShift = add(focusShift, scale(sub(part.explodedFocus, plan.explodedCenter), e));
  }
  const dimAll = clamp01(emphasisSum);

  const parts: PartState[] = plan.parts.map((p) => {
    // 分解も再組み立ても、ゆっくり動き出してゆっくり止まる（ふわりと浮かび上がる動き）
    const out = ease('easeInOutCubic', (t - p.explodeStart) / p.explodeDur);
    const back = ease('easeInOutCubic', (t - p.reassembleStart) / p.reassembleDur);
    const emphasis = emphasisById.get(p.id) ?? 0;
    return { id: p.id, offset: scale(p.fullOffset, out - back), emphasis, dim: clamp01(dimAll - emphasis) };
  });

  const liftM =
    plan.liftMax *
    (smoothstep((t - plan.explodeStart) / plan.explodeDur) - smoothstep((t - plan.reassembleStart) / plan.reassembleDur));

  // カメラ（注視点はモデルと一緒に回る・持ち上がる）
  const targetLocal = add(
    [sampleTrack(plan.targetKeys[0], t), sampleTrack(plan.targetKeys[1], t), sampleTrack(plan.targetKeys[2], t)],
    scale(focusShift, HIGHLIGHT_TARGET_BIAS),
  );
  const target = add(rotateY(targetLocal, yawRad), [0, liftM, 0]);
  const distance = sampleTrack(plan.distKeys, t) * (1 - HIGHLIGHT_ZOOM * dimAll);
  const elevation = sampleTrack(plan.elevKeys, t);

  return {
    t,
    scene: sceneAt(t),
    yawRad,
    liftM,
    camera: { position: cameraPosition(target, distance, elevation), target, fovDeg: plan.fovDeg },
    parts,
  };
}
