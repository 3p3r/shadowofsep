import { palette, type Rgb, rgb } from "../../palette";
import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";

const buildingRgb = rgb(palette.cityBuilding);
const windowLitRgb = rgb(palette.windowLit);
const windowDimRgb = rgb(palette.windowDim);
const windowDimmestRgb = rgb(palette.windowDimmest);

const H = Math.floor(VirtualCRT.HEIGHT / 3);
const W = VirtualCRT.WIDTH;

type BuildingKind = "tall" | "midRise" | "suburban";

/** Per-kind size envelopes (CRT pixels in the buildings layer, H = 80). */
const KIND_SPECS: Record<
  BuildingKind,
  { readonly minW: number; readonly maxW: number; readonly minH: number; readonly maxH: number }
> = {
  // Skyscrapers — only 2–4 per tile and never two adjacent.
  tall: { minW: 9, maxW: 16, minH: 40, maxH: Math.floor(H * 0.7) },
  // Mid-rise commercial — fills between landmarks and homes.
  midRise: { minW: 5, maxW: 11, minH: 14, maxH: 30 },
  // Suburban residential — capped at ~1/6th of the layer.
  suburban: { minW: 3, maxW: 8, minH: 3, maxH: Math.max(2, Math.floor(H / 6)) },
};

/** Middle-third layer: procedural city skyline silhouettes. */
export class BuildingsLayer extends Layer {
  readonly region: Region = { x: 0, y: H, width: W, height: H };
  readonly tiles: Uint8ClampedArray[];

  constructor(tileCount = 4, seedOffset = 0) {
    super();
    this.tiles = Array.from({ length: tileCount }, (_, i) => buildTile(i + seedOffset));
  }
}

interface TileCtx {
  readonly pixels: Uint8ClampedArray;
  readonly tileSeed: number;
  x: number;
  trailGap: number;
  buildingIdx: number;
}

function buildTile(tileSeed: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(W * H * 4);
  const ctx: TileCtx = { pixels, tileSeed, x: 0, trailGap: 0, buildingIdx: 0 };

  // Downtown: 2–4 skyscrapers, never adjacent. Each tall is followed by a
  // 1–2 building "break" of mid-rise/suburban so the skyscrapers always read
  // as separate landmarks.
  const tallCount = 2 + Math.floor(hash01(tileSeed, 11, 22) * 3); // 2..4
  for (let t = 0; t < tallCount && ctx.x < W; t++) {
    emitCluster(ctx, "tall", 1, t);
    if (t < tallCount - 1 && ctx.x < W) {
      const breakKind: BuildingKind = hash01(t, tileSeed, 555) < 0.5 ? "midRise" : "suburban";
      const breakCount = 1 + Math.floor(hash01(t, tileSeed, 666) * 2); // 1..2
      emitCluster(ctx, breakKind, breakCount, 100 + t);
    }
  }

  // Fill the rest with alternating mid-rise / suburban clusters so the skyline
  // gets visible variety past the downtown anchor.
  let nextKind: BuildingKind = hash01(tileSeed, 33, 44) < 0.5 ? "midRise" : "suburban";
  let cycle = 1;
  while (ctx.x < W) {
    const count =
      nextKind === "midRise"
        ? 3 + Math.floor(hash01(cycle, tileSeed, 55) * 4) // 3..6
        : 4 + Math.floor(hash01(cycle, tileSeed, 66) * 4); // 4..7
    emitCluster(ctx, nextKind, count, cycle);
    cycle++;
    nextKind = nextKind === "midRise" ? "suburban" : "midRise";
  }

  return pixels;
}

function emitCluster(ctx: TileCtx, kind: BuildingKind, count: number, ci: number): void {
  const spec = KIND_SPECS[kind];
  for (let i = 0; i < count; i++) {
    if (ctx.x >= W) return;

    const gapL = ctx.trailGap;

    let width = randIntInclusive(ci, ctx.buildingIdx, 91, spec.minW, spec.maxW);
    const height = Math.min(spec.maxH, randIntInclusive(ci, ctx.buildingIdx, 93, spec.minH, spec.maxH));

    if (ctx.x + width > W) width = W - ctx.x;
    if (width < 2) {
      ctx.x = W;
      return;
    }

    const isLastInCluster = i === count - 1;
    const gapR = isLastInCluster
      ? bigClusterGap(ci, ctx.buildingIdx, ctx.tileSeed)
      : intraClusterGap(ci, ctx.buildingIdx);

    const overhangL = gapL > 0 && hash01(ci, ctx.buildingIdx, 0x1f3a) >= 0.5;
    const overhangR = gapR > 0 && hash01(ci, ctx.buildingIdx, 0x2c19) >= 0.5;

    drawBuilding(ctx.pixels, ctx.x, width, height, overhangL, overhangR, kind, ci, ctx.buildingIdx, ctx.tileSeed);
    maybeDrawAntenna(ctx.pixels, ctx.x, width, height, ci, ctx.buildingIdx, ctx.tileSeed);

    ctx.x += width + gapR;
    ctx.trailGap = gapR;
    ctx.buildingIdx++;
  }
}

/** Integer in `[lo, hi]` inclusive, deterministically hashed from `(ci, bid, salt)`. */
function randIntInclusive(ci: number, bid: number, salt: number, lo: number, hi: number): number {
  return lo + Math.min(hi - lo, Math.floor(hash01(ci, bid, salt) * (hi - lo + 1)));
}

/** Intra-cluster gap: 0–2 px, biased toward 0 (most adjacent buildings touch). */
function intraClusterGap(ci: number, bid: number): number {
  const t = Math.min(5, Math.floor(hash01(ci, bid, 701) * 6));
  return [0, 0, 0, 1, 1, 2][t] ?? 0;
}

/** Inter-cluster gap: 0 (~60%), else uniform 1–12 px. */
function bigClusterGap(ci: number, bid: number, tileSeed: number): number {
  if (hash01(ci, bid, tileSeed ^ 0x6b4e_a102) < 0.6) return 0;
  const u = hash01(ci ^ 0x5a5a, bid ^ 0x7e7e, tileSeed ^ 0x1234);
  return 1 + Math.min(11, Math.floor(u * 12));
}

/** Uniform [0,1) hash of three integer keys. Cheaper and more uniform than 2D simplex. */
function hash01(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 0x27d4_eb2d) ^ Math.imul(b | 0, 0x9e37_79b1) ^ Math.imul(c | 0, 0x85eb_ca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb_352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846c_a68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0x1_0000_0000;
}

function putOpaque(pixels: Uint8ClampedArray, gx: number, gy: number, color: Rgb = buildingRgb): void {
  if (gx < 0 || gx >= W || gy < 0 || gy >= H) return;
  const i = (gy * W + gx) * 4;
  pixels[i] = color.r;
  pixels[i + 1] = color.g;
  pixels[i + 2] = color.b;
  pixels[i + 3] = 255;
}

type WindowMode = "uniformDim" | "mixed";

function pickWindowMode(kind: BuildingKind, ci: number, bid: number, tileSeed: number): WindowMode {
  if (kind === "suburban") return "uniformDim";
  // ~30% of city-center towers (tall + mid-rise) go fully dim ("blackout").
  return hash01(ci, bid, tileSeed ^ 0xdead_beef) < 0.3 ? "uniformDim" : "mixed";
}

function drawBuilding(
  pixels: Uint8ClampedArray,
  left: number,
  width: number,
  height: number,
  widenLeft: boolean,
  widenRight: boolean,
  kind: BuildingKind,
  ci: number,
  bid: number,
  tileSeed: number,
): void {
  const rowTop = H - height;
  const rowBottom = H - 1;
  const baseRows = Math.max(1, Math.floor(height / 4));
  const baseStartRow = rowBottom - baseRows + 1;

  // Silhouette + lower-1/4 base overhang.
  for (let py = rowTop; py <= rowBottom; py++) {
    for (let bx = left; bx < left + width; bx++) putOpaque(pixels, bx, py);
    if (widenLeft && py >= baseStartRow) putOpaque(pixels, left - 1, py);
    if (widenRight && py >= baseStartRow) putOpaque(pixels, left + width, py);
  }

  // Windows: every other row from rowTop+1 down to rowBottom-1, leaving a 1px
  // black border on every edge of the building.
  if (width < 3 || height < 3) return;

  const mode = pickWindowMode(kind, ci, bid, tileSeed);
  const innerLeft = left + 1;
  const innerRight = left + width - 2;
  const firstWinRow = rowTop + 1;
  const lastWinRow = rowBottom - 1;

  // Each row independently rolls: skip vs. paint, color, full-stripe vs. dotted,
  // density. So the same building reads as visibly varied row-to-row.
  for (let py = firstWinRow; py <= lastWinRow; py += 2) {
    // ~30% of would-be window rows stay black, dimming the overall window count.
    if (hash01(ci, bid, py * 0x2c1b + 0x6f1d) < 0.3) continue;

    const color =
      mode === "uniformDim"
        ? windowDimmestRgb
        : hash01(ci, bid, py * 0x9e37 + 0x5151) < 0.5
          ? windowLitRgb
          : windowDimRgb;

    // ~15% of surviving rows are full-width stripes (the dramatic skyscraper look).
    if (hash01(ci, bid, py * 0x4d09 + 0xa1f3) < 0.15) {
      for (let bx = innerLeft; bx <= innerRight; bx++) putOpaque(pixels, bx, py, color);
      continue;
    }

    // Otherwise per-pixel coin flip with a per-row density jitter.
    const density = 0.45 + hash01(ci, bid, py * 0x6c5d + 0x77b1) * 0.4; // 0.45..0.85
    for (let bx = innerLeft; bx <= innerRight; bx++) {
      if (hash01(ci, bid * 0x9e37 + bx, py * 0x119b + 0x33c1) < density) {
        putOpaque(pixels, bx, py, color);
      }
    }
  }
}

function maybeDrawAntenna(
  pixels: Uint8ClampedArray,
  left: number,
  width: number,
  height: number,
  ci: number,
  bid: number,
  tileSeed: number,
): void {
  if (width < 4) return;
  if (hash01(ci, bid, tileSeed ^ 0x881) >= 0.25) return;

  const offset = randIntInclusive(ci, bid, 601, 0, width - 4);
  const ax = left + 1 + offset;
  const antennaH = 1 + Math.min(3, Math.floor(hash01(ci, bid, 602) * 4));

  const roofY = H - height;
  if (roofY <= 0) return;
  for (let dy = 0; dy < antennaH; dy++) putOpaque(pixels, ax, roofY - 1 - dy);
}
