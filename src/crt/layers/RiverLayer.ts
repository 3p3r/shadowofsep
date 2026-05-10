import type { NoiseFunction2D } from "simplex-noise";
import { palette, rgb } from "../../palette";

const riverCityLight = rgb(palette.riverCityLight);
const riverReflection = rgb(palette.riverReflection);

import { createSeededNoise2D } from "../seededNoise";
import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";

const H = Math.floor(VirtualCRT.HEIGHT / 3);
const W = VirtualCRT.WIDTH;

/** xor salts so each noise stream differs between rows / tiles */
const SALT_YELLOW_ROW = 0x52f9_a18e;
const SALT_BLUE_ROW = 0x8c31_d4a7;
const SALT_DISSIPATION = 0x3e9b_216d;

const CENTER = W / 2;
/** Half-width of the dense central band (the "middle 25%"). */
const CENTER_HALF = Math.round(W * 0.125);
/**
 * Width of the no-lights band at each tile edge. Sized so the two outer
 * (sparse 1-px) bands together span ~45% of the tile.
 */
const DEAD_W = Math.round(W * 0.1);
const LIGHTS_X0 = DEAD_W;
const LIGHTS_X1 = W - DEAD_W;
/** Width of the outer band that actually contains (sparse) lights. */
const OUTER_SPAN = W / 2 - DEAD_W - CENTER_HALF;

/** Row y → noise threshold for blue reflection spots (fading downward). */
const BLUE_ROWS: readonly [row: number, threshold: number][] = [
  [5, 0.34],
  [7, 0.44],
  [11, 0.52],
  [14, 0.6],
];

/**
 * Bottom third: black water, row 0 yellow horizon lights (+ optional blue pixels in gaps),
 * row 3 flipped (blue lights, yellow accents), rows 5/7/11/14 blue dissipation. Lights
 * are dense in the central band and become sparse 1-px lights with growing gaps in the
 * outer band of each tile, with a small dead band right at the edges.
 */
export class RiverLayer extends Layer {
  readonly region: Region = { x: 0, y: H * 2, width: W, height: H };
  readonly tiles: Uint8ClampedArray[];

  constructor(tileCount = 4, seedOffset = 0) {
    super();
    this.tiles = Array.from({ length: tileCount }, (_, i) => buildTile(i + seedOffset));
  }
}

function buildTile(seed: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i + 3] = 255;
  }

  const nYellow = createSeededNoise2D(seed ^ SALT_YELLOW_ROW);
  skyline(pixels, 0, nYellow, seed ^ SALT_YELLOW_ROW, true);

  const nBlueLine = createSeededNoise2D(seed ^ SALT_BLUE_ROW);
  skyline(pixels, 3, nBlueLine, seed ^ SALT_BLUE_ROW, false);

  const nDiss = createSeededNoise2D(seed ^ SALT_DISSIPATION);
  for (const [row, threshold] of BLUE_ROWS) {
    blueDissipationRow(pixels, row, nDiss, threshold);
  }

  return pixels;
}

function put(pixels: Uint8ClampedArray, x: number, y: number, color: { r: number; g: number; b: number }): void {
  const i = (y * W + x) * 4;
  pixels[i] = color.r;
  pixels[i + 1] = color.g;
  pixels[i + 2] = color.b;
  pixels[i + 3] = 255;
}

function unit(noise2D: NoiseFunction2D, x: number, y: number): number {
  return (noise2D(x, y) + 1) * 0.5;
}

/**
 * Skyline:
 *   - middle 25% (`|x - CENTER| <= CENTER_HALF`): primary lights are 1–2 px
 *     wide, separated by 1–2 px gaps — full city skyline.
 *   - outer band (towards the tile edges): primary lights are always 1 px and
 *     gaps grow from 1 px (right next to the center band) up to 4 px (next to
 *     the dead band).
 *   - outermost ~5% of each side: dead band, no lights at all.
 */
function skyline(
  pixels: Uint8ClampedArray,
  rowY: number,
  noise2D: NoiseFunction2D,
  salt: number,
  yellowPrimary: boolean,
): void {
  const primary = yellowPrimary ? riverCityLight : riverReflection;
  const accent = yellowPrimary ? riverReflection : riverCityLight;
  const accentOdds = yellowPrimary ? 0.58 : 0.38;

  let x = LIGHTS_X0 + Math.floor(unit(noise2D, salt * 0.07 + rowY * 0.13, salt * 0.11 + rowY * 0.09) * 4);
  let i = 0;

  while (x < LIGHTS_X1) {
    const nx = salt * 0.31 + i * 1.37;
    const ny = rowY * 3.17 + i * 0.19;

    const dist = Math.abs(x - CENTER);
    const inCenter = dist <= CENTER_HALF;

    const wide = inCenter && unit(noise2D, nx + 11.2, ny + 4.8) > 0.44;
    const w = wide ? 2 : 1;
    for (let k = 0; k < w && x + k < LIGHTS_X1; k++) {
      put(pixels, x + k, rowY, primary);
    }
    x += w;
    if (x >= LIGHTS_X1) break;

    let gap: number;
    if (inCenter) {
      // 1 or 2 (max 2-px spacing inside the dense band).
      gap = 1 + Math.floor(unit(noise2D, nx + 28.4, ny + 1.3) * 2);
    } else {
      // Linearly grow 1 → 4 from the center boundary out to the dead band,
      // so single-pixel lights sit 1 px apart right next to the center and
      // spread out to 4 px near the edge.
      const progress = Math.min(1, (dist - CENTER_HALF) / OUTER_SPAN);
      const jitter = unit(noise2D, nx + 28.4, ny + 1.3) - 0.5;
      gap = Math.max(1, Math.min(4, Math.round(1 + progress * 3 + jitter * 0.6)));
    }

    if (unit(noise2D, nx + 51.7, ny + 9.1) < accentOdds) {
      const pos = Math.floor(unit(noise2D, nx + 72.3, ny + 3.7) * gap);
      const ax = x + Math.min(pos, gap - 1);
      if (ax < LIGHTS_X1) {
        put(pixels, ax, rowY, accent);
      }
    }

    x += gap;
    i++;
  }
}

function blueDissipationRow(
  pixels: Uint8ClampedArray,
  rowY: number,
  noise2D: NoiseFunction2D,
  threshold: number,
): void {
  for (let x = LIGHTS_X0; x < LIGHTS_X1; x++) {
    const n1 = noise2D(x * 6.2 + rowY * 0.37, rowY * 4.1);
    const n2 = noise2D(x * 14.1 + rowY * 0.22, rowY * 1.9 + 31.7);
    if (n1 > threshold || n2 > threshold + 0.18) {
      put(pixels, x, rowY, riverReflection);
    }
  }
}
