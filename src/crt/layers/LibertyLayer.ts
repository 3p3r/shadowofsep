import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";
import { LIBERTY_HEIGHT, LIBERTY_PALETTE, LIBERTY_PIXELS, LIBERTY_WIDTH } from "./libertyPixels";

const RIVER_H = Math.floor(VirtualCRT.HEIGHT / 3);
/** Top of the river layer = where the city-lights row lives (y = 160). */
const RIVER_TOP_Y = VirtualCRT.HEIGHT - RIVER_H;
/** Bottom row of the statue's base sits 22 px below the city-lights row (y = 182). */
const BASE_BOTTOM_Y = RIVER_TOP_Y + 23;
const TOP_Y = BASE_BOTTOM_Y - LIBERTY_HEIGHT + 1;
/** Anchored to the right side of the screen with a small margin (matches reference scene). */
const RIGHT_MARGIN = 16;
const LEFT_X = VirtualCRT.WIDTH - LIBERTY_WIDTH - RIGHT_MARGIN;

/**
 * Foreground landmark: a fixed-position Statue of Liberty, anchored on the
 * right side of the screen with the bottom of its base near the bottom edge
 * of the river layer.
 *
 * Modeled on `ShootingStarLayer`: no tiles, no scroll, custom `renderTo`. The
 * host should render this layer's CRT *above* the river so transparent pixels
 * reveal the water (and the buildings, for the upper rows that cross the
 * river/buildings boundary).
 */
export class LibertyLayer extends Layer {
  readonly region: Region = { x: LEFT_X, y: TOP_Y, width: LIBERTY_WIDTH, height: LIBERTY_HEIGHT };
  readonly tiles: readonly Uint8ClampedArray[] = [];

  /** Integer CRT-pixel horizontal shift applied at render time (negative = slide left). */
  offsetX = 0;

  override renderTo(crt: VirtualCRT): void {
    const baseX = LEFT_X + this.offsetX;
    for (let row = 0; row < LIBERTY_HEIGHT; row++) {
      const rowPixels = LIBERTY_PIXELS[row];
      const dy = TOP_Y + row;
      for (let col = 0; col < LIBERTY_WIDTH; col++) {
        const idx = rowPixels[col];
        if (idx < 0) continue;
        const c = LIBERTY_PALETTE[idx];
        crt.setPixel(baseX + col, dy, c.r, c.g, c.b);
      }
    }
  }
}
