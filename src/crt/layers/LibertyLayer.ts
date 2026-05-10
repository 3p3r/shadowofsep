import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";
import { LIBERTY_HEIGHT, LIBERTY_RGBA, LIBERTY_WIDTH } from "./libertyPixels";

const RIVER_H = Math.floor(VirtualCRT.HEIGHT / 3);
const RIVER_TOP_Y = VirtualCRT.HEIGHT - RIVER_H;
const BASE_BOTTOM_Y = RIVER_TOP_Y + 23;
const TOP_Y = BASE_BOTTOM_Y - LIBERTY_HEIGHT + 1;
const RIGHT_MARGIN = 16;
const LEFT_X = VirtualCRT.WIDTH - LIBERTY_WIDTH - RIGHT_MARGIN;

export class LibertyLayer extends Layer {
  readonly region: Region = { x: LEFT_X, y: TOP_Y, width: LIBERTY_WIDTH, height: LIBERTY_HEIGHT };
  readonly tiles: readonly Uint8ClampedArray[] = [];

  offsetX = 0;

  override renderTo(crt: VirtualCRT): void {
    crt.drawAlphaSlice(
      LIBERTY_RGBA,
      LIBERTY_WIDTH,
      LIBERTY_HEIGHT,
      0,
      0,
      LEFT_X + this.offsetX,
      TOP_Y,
      LIBERTY_WIDTH,
      LIBERTY_HEIGHT,
    );
  }
}
