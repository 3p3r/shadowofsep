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

/** Row y → noise threshold for blue reflection spots (fading downward). */
const BLUE_ROWS: readonly [row: number, threshold: number][] = [
  [5, 0.34],
  [7, 0.44],
  [9, 0.52],
  [11, 0.6],
];

/**
 * Bottom third: black water, row 0 yellow horizon lights (+ optional blue pixels in gaps),
 * row 3 flipped (blue lights, yellow accents), rows 5/7/9/11 blue dissipation.
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

/** Primary dashes 1–2px; gap 1–3px black; optional single accent in gap. Noise keyed by light index. */
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

  let x = 1 + Math.floor(unit(noise2D, salt * 0.07 + rowY * 0.13, salt * 0.11 + rowY * 0.09) * 3);
  let i = 0;

  while (x < W) {
    const nx = salt * 0.31 + i * 1.37;
    const ny = rowY * 3.17 + i * 0.19;

    const wide = unit(noise2D, nx + 11.2, ny + 4.8) > 0.44;
    const w = wide ? 2 : 1;
    for (let k = 0; k < w && x + k < W; k++) {
      put(pixels, x + k, rowY, primary);
    }
    x += w;
    if (x >= W) {
      break;
    }

    const gap = 1 + Math.floor(unit(noise2D, nx + 28.4, ny + 1.3) * 3);
    const g = Math.min(gap, W - x);

    if (g >= 1 && unit(noise2D, nx + 51.7, ny + 9.1) < accentOdds) {
      const pos = Math.floor(unit(noise2D, nx + 72.3, ny + 3.7) * g);
      put(pixels, x + Math.min(pos, g - 1), rowY, accent);
    }

    x += g;
    i++;
  }
}

function blueDissipationRow(
  pixels: Uint8ClampedArray,
  rowY: number,
  noise2D: NoiseFunction2D,
  threshold: number,
): void {
  for (let x = 0; x < W; x++) {
    const n1 = noise2D(x * 6.2 + rowY * 0.37, rowY * 4.1);
    const n2 = noise2D(x * 14.1 + rowY * 0.22, rowY * 1.9 + 31.7);
    if (n1 > threshold || n2 > threshold + 0.18) {
      put(pixels, x, rowY, riverReflection);
    }
  }
}
