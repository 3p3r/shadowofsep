import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";
import { BOULDER_H, BOULDER_W, buildBoulder, buildRock, ROCK_H, ROCK_W } from "./rockTextures";

const RIVER_H = Math.floor(VirtualCRT.HEIGHT / 3);
const RIVER_TOP_Y = VirtualCRT.HEIGHT - RIVER_H;
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

export class LibertyRocksLayer extends Layer {
  readonly region: Region = {
    x: 0,
    y: BASE_BOTTOM_Y,
    width: VirtualCRT.WIDTH,
    height: VirtualCRT.HEIGHT - BASE_BOTTOM_Y,
  };
  readonly tiles: readonly Uint8ClampedArray[] = [];

  offsetX = 0;

  override renderTo(crt: VirtualCRT): void {
    for (const p of PLACEMENTS) {
      crt.drawAlphaSlice(p.tex, p.w, p.h, 0, 0, p.x + this.offsetX, p.y, p.w, p.h);
    }
  }
}
