import { paletteRgb, type Rgb } from "../../palette";
import { createSeededNoise2D } from "../seededNoise";
import { writeRgba } from "./pixels";

const dense = paletteRgb.windowLit;
const mid = paletteRgb.windowDim;
const outer = paletteRgb.windowDimmest;
const black = paletteRgb.cityBuilding;

export const BOULDER_W = 16;
export const BOULDER_H = 8;
export const ROCK_W = 8;
export const ROCK_H = 8;

/** Sentinel for "leave the cell transparent" while we build a row. */
const T = -1;
type Cell = -1 | 0 | 1 | 2 | 3;
const CITY_BLACK: Cell = 0;
const DENSE: Cell = 1;
const MID: Cell = 2;
const OUTER: Cell = 3;

const PALETTE: readonly Rgb[] = [black, dense, mid, outer];

function emptyRgba(w: number, h: number): Uint8ClampedArray {
  return new Uint8ClampedArray(w * h * 4);
}

function flushRow(pixels: Uint8ClampedArray, w: number, y: number, row: readonly Cell[]): void {
  for (let x = 0; x < w; x++) {
    const cell = row[x];
    if (cell === T) continue;
    writeRgba(pixels, w, x, y, PALETTE[cell]);
  }
}

/**
 * Build a 16×8 boulder texture, seeded so each boulder gets a unique but
 * deterministic look. Layout follows the spec:
 *   row 0: a 3-px bright "buffer" detached fleck at a random x
 *   row 1: full-width black silhouette top
 *   row 2: 8-px dense band with mid → outer → transparent dissipation either side
 *   rows 3-7: procedural body, with growing black holes lower down
 */
export function buildBoulder(seed: number): Uint8ClampedArray {
  const pixels = emptyRgba(BOULDER_W, BOULDER_H);
  const noise = createSeededNoise2D(seed ^ 0xb0_1d_e1_5e);

  const u = (a: number, b: number) => (noise(a, b) + 1) * 0.5;

  const row0Start = Math.min(BOULDER_W - 3, Math.floor(u(0.13, 0.91) * (BOULDER_W - 2)));
  const row0: Cell[] = new Array(BOULDER_W).fill(T);
  for (let k = 0; k < 3; k++) row0[row0Start + k] = DENSE;
  flushRow(pixels, BOULDER_W, 0, row0);

  const row1: Cell[] = new Array(BOULDER_W).fill(CITY_BLACK);
  flushRow(pixels, BOULDER_W, 1, row1);

  const cx = 4 + Math.floor(u(1.7, 2.3) * 5);
  const row2: Cell[] = new Array(BOULDER_W).fill(T);
  for (let x = cx; x < cx + 8; x++) row2[x] = DENSE;
  for (let step = 1; step <= 4; step++) {
    const cell: Cell = step <= 2 ? MID : OUTER;
    const lx = cx - step;
    const rx = cx + 8 + (step - 1);
    if (lx >= 0 && row2[lx] === T) {
      if (step <= 3 || u(3.1 + step, 4.4) > 0.4) row2[lx] = cell;
    }
    if (rx < BOULDER_W && row2[rx] === T) {
      if (step <= 3 || u(5.7 + step, 6.6) > 0.4) row2[rx] = cell;
    }
  }
  flushRow(pixels, BOULDER_W, 2, row2);

  for (let y = 3; y < BOULDER_H; y++) {
    const row = generateBoulderBodyRow(y, u);
    enforceMaxRunOf3(row, u, y);
    flushRow(pixels, BOULDER_W, y, row);
  }

  return pixels;
}

/**
 * Generate one body row of the boulder. Black hole probability rises with `y`,
 * and the colored cells lean dimmer further down. Run-length capping happens
 * in a second pass.
 */
function generateBoulderBodyRow(y: number, u: (a: number, b: number) => number): Cell[] {
  const row: Cell[] = new Array(BOULDER_W).fill(T);

  const maxBlackRun = y <= 3 ? 1 : y <= 5 ? 2 : 3;
  const blackProb = 0.1 + (y - 3) * 0.12;

  let blackRun = 0;
  for (let x = 0; x < BOULDER_W; x++) {
    const ny = y * 7.13;
    const nx = x * 1.91 + y * 0.37;

    const edgeFalloff = edgeWeight(x, y);
    if (edgeFalloff <= 0) {
      blackRun = 0;
      continue;
    }

    const blackRoll = u(nx + 11.1, ny + 17.7);
    const wantBlack = blackRoll < blackProb && blackRun < maxBlackRun;
    if (wantBlack) {
      row[x] = CITY_BLACK;
      blackRun++;
      continue;
    }
    blackRun = 0;

    const colorRoll = u(nx + 31.3, ny + 5.4);
    if (colorRoll > edgeFalloff) {
      continue;
    }

    if (y === 3 && colorRoll < edgeFalloff * 0.18) {
      row[x] = DENSE;
    } else if (colorRoll < edgeFalloff * 0.55) {
      row[x] = MID;
    } else {
      row[x] = OUTER;
    }
  }

  return row;
}

/**
 * Probability that a body cell is filled at all. 1 in the middle of the
 * boulder, fading to 0 at the bottom corners so the silhouette tapers
 * naturally rather than being a flat 16×8 block.
 */
function edgeWeight(x: number, y: number): number {
  const cx = (BOULDER_W - 1) / 2;
  const dx = Math.abs(x - cx) / cx;
  const dy = (y - 2) / (BOULDER_H - 1 - 2);
  const taper = 1 - Math.max(0, dx - 0.55) * 1.6 * dy;
  return Math.max(0, Math.min(1, taper));
}

/**
 * Walk a row left-to-right and break any run of identical cells longer than 3,
 * including transparent runs that aren't bounded by a non-T neighbor (i.e. a
 * pure-T row is fine). For colored runs we swap the 4th cell to a different
 * adjacent color; for black runs we swap to T.
 */
function enforceMaxRunOf3(row: Cell[], u: (a: number, b: number) => number, y: number): void {
  let runStart = 0;
  for (let x = 1; x <= row.length; x++) {
    const same = x < row.length && row[x] === row[runStart];
    if (same) continue;
    const len = x - runStart;
    if (len > 3 && row[runStart] !== T) {
      for (let k = runStart + 3; k < x; k += 4) {
        const orig = row[k];
        if (orig === CITY_BLACK) {
          row[k] = T;
        } else if (orig === DENSE) {
          row[k] = MID;
        } else if (orig === MID) {
          row[k] = u(k * 0.7, y * 1.3) > 0.5 ? DENSE : OUTER;
        } else if (orig === OUTER) {
          row[k] = u(k * 1.1, y * 0.9) > 0.5 ? MID : T;
        }
      }
    }
    runStart = x;
  }
}

/**
 * Build an 8×8 rock texture. A bright "core" pixel lands somewhere in the
 * upper-right 4×4, plus 2-3 more dense neighbors. Every other cell dissipates
 * by Chebyshev distance to the nearest dense pixel.
 */
export function buildRock(seed: number): Uint8ClampedArray {
  const pixels = emptyRgba(ROCK_W, ROCK_H);
  const noise = createSeededNoise2D(seed ^ 0x5e_ed_70_c0);
  const u = (a: number, b: number) => (noise(a, b) + 1) * 0.5;

  const cx = 4 + Math.floor(u(0.31, 0.71) * 4);
  const cy = Math.floor(u(0.91, 1.21) * 4);

  const cores: Array<[number, number]> = [[cx, cy]];
  const extra = 2 + (u(1.71, 2.31) > 0.5 ? 1 : 0);
  const neighborOffsets: ReadonlyArray<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let added = 0;
  let attempt = 0;
  while (added < extra && attempt < 16) {
    const off = neighborOffsets[Math.floor(u(3.1 + attempt, 4.7) * 4) % 4];
    const seed2 = u(5.5 + attempt, 6.6 + attempt);
    const base = cores[Math.floor(seed2 * cores.length) % cores.length];
    const nx = base[0] + off[0];
    const ny = base[1] + off[1];
    attempt++;
    if (nx < 0 || nx >= ROCK_W || ny < 0 || ny >= ROCK_H) continue;
    if (cores.some(([x, y]) => x === nx && y === ny)) continue;
    cores.push([nx, ny]);
    added++;
  }

  for (let y = 0; y < ROCK_H; y++) {
    for (let x = 0; x < ROCK_W; x++) {
      let d = Infinity;
      for (const [dx, dy] of cores) {
        const dist = Math.max(Math.abs(x - dx), Math.abs(y - dy));
        if (dist < d) d = dist;
      }
      let cell: Cell = T;
      if (d === 0) {
        cell = DENSE;
      } else if (d === 1) {
        cell = u(x * 2.3 + 1.1, y * 2.7 + 4.4) < 0.3 ? CITY_BLACK : MID;
      } else if (d === 2) {
        cell = u(x * 1.9 + 8.3, y * 2.1 + 6.7) < 0.4 ? CITY_BLACK : OUTER;
      } else if (d === 3) {
        const r = u(x * 1.7 + 9.1, y * 1.3 + 7.4);
        if (r > 0.7) cell = CITY_BLACK;
        else if (r > 0.45) cell = OUTER;
      }
      if (cell !== T) writeRgba(pixels, ROCK_W, x, y, PALETTE[cell]);
    }
  }

  return pixels;
}
