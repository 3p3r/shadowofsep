import { palette, rgb } from "../../palette";
import { VirtualCRT } from "../VirtualCRT";
import { Layer, type Region } from "./Layer";

const starRgb = rgb(palette.star);
const fadeRgb = rgb(palette.background);

const W = VirtualCRT.WIDTH;
const H = VirtualCRT.HEIGHT;
/** y at which the star has fully faded into the sky color. */
const FADE_END_Y = Math.floor((H * 2) / 3);

/** Diagonal speed in CRT pixels/sec (along the 45-degree path). */
const SPEED = 140;
/** Per-axis speed: 45 degrees → vx = -SPEED/√2, vy = +SPEED/√2. */
const AXIS_SPEED = SPEED / Math.SQRT2;

const MIN_SPAWN_DELAY_S = 6;
const MAX_SPAWN_DELAY_S = 16;

interface ActiveStar {
  x: number;
  y: number;
}

/**
 * Full-screen overlay: occasionally spawns a single white pixel at the top-right
 * that travels at 45° toward the bottom-left and disappears off the bottom.
 *
 * Animation-driven, not tile-driven; the base class's tile/scroll machinery is
 * unused. The host is expected to render this layer's CRT *beneath* the river
 * layer, so the pixel naturally vanishes once it crosses into the river region.
 */
export class ShootingStarLayer extends Layer {
  readonly region: Region = { x: 0, y: 0, width: W, height: H };
  readonly tiles: readonly Uint8ClampedArray[] = [];

  private active: ActiveStar | null = null;
  private spawnTimer = randomSpawnDelay();

  override update(dt: number): void {
    if (this.active === null) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.active = spawn();
      }
      return;
    }

    this.active.x -= AXIS_SPEED * dt;
    this.active.y += AXIS_SPEED * dt;

    if (this.active.y >= H || this.active.x < -1) {
      this.active = null;
      this.spawnTimer = randomSpawnDelay();
    }
  }

  override renderTo(crt: VirtualCRT): void {
    if (this.active === null) return;
    const t = Math.max(0, Math.min(1, this.active.y / FADE_END_Y));
    const r = Math.round(starRgb.r + (fadeRgb.r - starRgb.r) * t);
    const g = Math.round(starRgb.g + (fadeRgb.g - starRgb.g) * t);
    const b = Math.round(starRgb.b + (fadeRgb.b - starRgb.b) * t);
    crt.setPixel(Math.floor(this.active.x), Math.floor(this.active.y), r, g, b);
  }
}

function randomSpawnDelay(): number {
  return MIN_SPAWN_DELAY_S + Math.random() * (MAX_SPAWN_DELAY_S - MIN_SPAWN_DELAY_S);
}

function spawn(): ActiveStar {
  // Start somewhere in the right ~30% of the screen, just above the top edge.
  const x0 = W * 0.7 + Math.random() * (W * 0.3 + 8);
  const y0 = -1 - Math.random() * 3;
  return { x: x0, y: y0 };
}
