import { paletteRgb } from "../../palette";
import { createSeededNoise2D } from "../seededNoise";
import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";

const starRgb = paletteRgb.star;

const HEIGHT = Math.floor(VirtualCRT.HEIGHT / 3);
const WIDTH = VirtualCRT.WIDTH;

/**
 * Top third: sparse 1-pixel stars from thresholded simplex noise (every 6th row from y=6).
 */
export class StarryNightLayer extends Layer {
  readonly region: Region = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
  readonly tiles: Uint8ClampedArray[];

  constructor(tileCount = 4, seedOffset = 0) {
    super();
    this.tiles = Array.from({ length: tileCount }, (_, i) => buildTile(i + seedOffset));
  }
}

function buildTile(seed: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const noise2D = createSeededNoise2D(seed);

  for (let y = 6; y < HEIGHT; y += 6) {
    for (let x = 0; x < WIDTH; x++) {
      if (noise2D(x * 7, y) > 0.9) {
        const i = (y * WIDTH + x) * 4;
        pixels[i] = starRgb.r;
        pixels[i + 1] = starRgb.g;
        pixels[i + 2] = starRgb.b;
        pixels[i + 3] = 255;
      }
    }
  }
  return pixels;
}
