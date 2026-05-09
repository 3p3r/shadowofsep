import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";

const HEIGHT = Math.floor(VirtualCRT.HEIGHT / 3);
const WIDTH = VirtualCRT.WIDTH;

/**
 * Middle-third layer: city skyline silhouettes.
 *
 * TODO: implement procedural building generation. For now each tile is fully
 * transparent so the layer is a visual no-op while still occupying its slot
 * in the layer stack and participating in scroll updates.
 */
export class BuildingsLayer extends Layer {
  readonly region: Region = { x: 0, y: HEIGHT, width: WIDTH, height: HEIGHT };
  readonly tiles: Uint8ClampedArray[];

  constructor(tileCount = 4) {
    super();
    this.tiles = Array.from({ length: tileCount }, () => new Uint8ClampedArray(WIDTH * HEIGHT * 4));
  }
}
