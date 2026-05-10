import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";
import { BOULDER_H, BOULDER_W, buildBoulder, buildRock, ROCK_H, ROCK_W } from "./rockTextures";

const RIVER_H = Math.floor(VirtualCRT.HEIGHT / 3);
const RIVER_TOP_Y = VirtualCRT.HEIGHT - RIVER_H;
/** Match `LibertyLayer`'s pedestal-bottom row so the rocks sit flush under it. */
const BASE_BOTTOM_Y = RIVER_TOP_Y + 23;

interface Placement {
  readonly tex: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
  readonly x: number;
  readonly y: number;
}

const BOULDERS_LEFT_X = 196;
const ROW_Y = BASE_BOTTOM_Y + 1;
const ROCK_COUNT = 4;
/** Seed for the per-rock ±1 px vertical jitter. Frozen so the silhouette is stable. */
const ROCK_JITTER_SEED = 0xa1c3_b007;

const PLACEMENTS: readonly Placement[] = (() => {
  const placements: Placement[] = [
    { tex: buildBoulder(1), w: BOULDER_W, h: BOULDER_H, x: BOULDERS_LEFT_X, y: ROW_Y },
    { tex: buildBoulder(2), w: BOULDER_W, h: BOULDER_H, x: BOULDERS_LEFT_X + BOULDER_W, y: ROW_Y },
    { tex: buildBoulder(3), w: BOULDER_W, h: BOULDER_H, x: BOULDERS_LEFT_X + BOULDER_W * 2, y: ROW_Y },
  ];

  let state = ROCK_JITTER_SEED >>> 0;
  const nextBit = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state & 1;
  };

  const baseY = ROW_Y + 2;
  for (let i = 0; i < ROCK_COUNT; i++) {
    placements.push({
      tex: buildRock(i + 1),
      w: ROCK_W,
      h: ROCK_H,
      x: BOULDERS_LEFT_X - ROCK_W * (ROCK_COUNT - i),
      y: baseY + (nextBit() === 1 ? 1 : -1),
    });
  }

  return placements;
})();

/**
 * Foreground rocks clustered around the bottom of the Statue of Liberty's
 * pedestal. Same shape as `LibertyLayer`: fixed position, no scrolling, no
 * tiles, custom `renderTo`. Hosted on its own CRT so it can be composited
 * between the river and the Statue.
 */
export class LibertyRocksLayer extends Layer {
  readonly region: Region = {
    x: 0,
    y: BASE_BOTTOM_Y,
    width: VirtualCRT.WIDTH,
    height: VirtualCRT.HEIGHT - BASE_BOTTOM_Y,
  };
  readonly tiles: readonly Uint8ClampedArray[] = [];

  override renderTo(crt: VirtualCRT): void {
    for (const p of PLACEMENTS) {
      blitWithAlpha(crt, p.tex, p.w, p.h, p.x, p.y);
    }
  }
}

/** Per-pixel blit that skips fully-transparent source cells, so overlapping rocks compose. */
function blitWithAlpha(
  crt: VirtualCRT,
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstX: number,
  dstY: number,
): void {
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const i = (y * srcW + x) * 4;
      if (src[i + 3] === 0) continue;
      crt.setPixel(dstX + x, dstY + y, src[i], src[i + 1], src[i + 2]);
    }
  }
}
