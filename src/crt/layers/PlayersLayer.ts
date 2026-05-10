import { paletteRgb } from "../../palette";
import { VirtualCRT } from "../VirtualCRT";
import { HAYATE_HEIGHT, HAYATE_RGBA, HAYATE_TUBE_EMIT_X, HAYATE_TUBE_EMIT_Y, HAYATE_WIDTH } from "./hayatePixels";
import { KAEDE_HEIGHT, KAEDE_RGBA, KAEDE_TUBE_EMIT_X, KAEDE_TUBE_EMIT_Y, KAEDE_WIDTH } from "./kaedePixels";
import { Layer, type Region } from "./Layer";

export type PlayerInput = { readonly dx: number; readonly dy: number };

const RIVER_H = Math.floor(VirtualCRT.HEIGHT / 3);
const RIVER_TOP_Y = VirtualCRT.HEIGHT - RIVER_H;
/** Only the bottom 50% of the river strip (upper half of the band is off-limits). */
const BAND_TOP_Y = RIVER_TOP_Y + Math.floor(RIVER_H * 0.5);
const BAND_BOTTOM_Y = VirtualCRT.HEIGHT;

const ACCEL = 340;
const MAX_SPEED = 52;
const FRICTION = 4.8;

const PARTICLE_POOL = 40;
const IDLE_SPAWN_CHANCE = 0.038;
const MOVE_SPAWN_CHANCE = 0.11;

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bobOffset: 0 | 1;
  nextBobAtMs: number;
  readonly rgba: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly emitX: number;
  readonly emitY: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function len(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** Normalize -1/0/1 axis input so diagonals are not faster. */
function normalizeInput(input: PlayerInput): PlayerInput {
  const dx = input.dx;
  const dy = input.dy;
  if (dx === 0 && dy === 0) {
    return { dx: 0, dy: 0 };
  }
  if (dx !== 0 && dy !== 0) {
    const inv = 1 / Math.SQRT2;
    return { dx: dx * inv, dy: dy * inv };
  }
  return { dx, dy };
}

export class PlayersLayer extends Layer {
  readonly region: Region = { x: 0, y: 0, width: VirtualCRT.WIDTH, height: VirtualCRT.HEIGHT };
  readonly tiles: readonly Uint8ClampedArray[] = [];

  private readonly hayate: PlayerState;
  private readonly kaede: PlayerState;
  private readonly particles: Particle[];

  constructor() {
    super();
    this.hayate = {
      x: 72,
      y: 178,
      vx: 0,
      vy: 0,
      bobOffset: 0,
      nextBobAtMs: 400,
      rgba: HAYATE_RGBA,
      width: HAYATE_WIDTH,
      height: HAYATE_HEIGHT,
      emitX: HAYATE_TUBE_EMIT_X,
      emitY: HAYATE_TUBE_EMIT_Y,
    };
    this.kaede = {
      x: 148,
      y: 178,
      vx: 0,
      vy: 0,
      bobOffset: 0,
      nextBobAtMs: 700,
      rgba: KAEDE_RGBA,
      width: KAEDE_WIDTH,
      height: KAEDE_HEIGHT,
      emitX: KAEDE_TUBE_EMIT_X,
      emitY: KAEDE_TUBE_EMIT_Y,
    };
    this.particles = Array.from({ length: PARTICLE_POOL }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
    }));
  }

  /** Average horizontal velocity (CRT px/s) for camera follow. */
  getAverageVelocityX(): number {
    return (this.hayate.vx + this.kaede.vx) * 0.5;
  }

  tick(dt: number, hayateInput: PlayerInput, kaedeInput: PlayerInput, timeMs: number): void {
    const hNorm = normalizeInput(hayateInput);
    const kNorm = normalizeInput(kaedeInput);

    this.integratePlayer(this.hayate, hNorm, dt, timeMs);
    this.integratePlayer(this.kaede, kNorm, dt, timeMs);

    this.updateParticles(dt);
    this.spawnSplashes(this.hayate, hNorm, dt);
    this.spawnSplashes(this.kaede, kNorm, dt);
  }

  private integratePlayer(p: PlayerState, input: PlayerInput, dt: number, timeMs: number): void {
    const moving = Math.abs(input.dx) > 1e-6 || Math.abs(input.dy) > 1e-6;

    if (moving) {
      p.bobOffset = 0;
      const tdx = input.dx * MAX_SPEED;
      const tdy = input.dy * MAX_SPEED;
      p.vx += (tdx - p.vx) * Math.min(1, ACCEL * dt);
      p.vy += (tdy - p.vy) * Math.min(1, ACCEL * dt);
    } else {
      p.vx *= Math.exp(-FRICTION * dt);
      p.vy *= Math.exp(-FRICTION * dt);
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
      if (Math.abs(p.vy) < 0.05) p.vy = 0;

      if (timeMs >= p.nextBobAtMs) {
        p.bobOffset = p.bobOffset === 0 ? 1 : 0;
        p.nextBobAtMs = timeMs + 180 + Math.random() * 920;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const bob = p.bobOffset;
    const minTopY = Math.max(0, BAND_TOP_Y - p.emitY - bob - 1);
    const maxTopY = Math.min(VirtualCRT.HEIGHT - p.height, BAND_BOTTOM_Y - 1 - p.emitY - bob - 1);
    p.y = clamp(p.y, minTopY, maxTopY);
    p.x = clamp(p.x, 0, VirtualCRT.WIDTH - p.width);
  }

  private spawnSplashes(p: PlayerState, input: PlayerInput, dt: number): void {
    const moving = Math.abs(input.dx) > 1e-6 || Math.abs(input.dy) > 1e-6;
    const chance = moving ? MOVE_SPAWN_CHANCE : IDLE_SPAWN_CHANCE;
    if (Math.random() > chance * Math.min(1, dt * 45)) return;
    const bx = Math.floor(p.x) + p.emitX + (Math.random() < 0.5 ? -1 : 1);
    const by = Math.floor(p.y) + p.emitY + p.bobOffset + 1;

    let vx: number;
    let vy: number;
    let maxLife: number;

    if (moving) {
      const plen = len(p.vx, p.vy);
      if (plen > 0.01) {
        const nx = -p.vx / plen;
        const ny = -p.vy / plen;
        const sp = 22 + Math.random() * 38;
        vx = nx * sp + (Math.random() - 0.5) * 10;
        vy = ny * sp + (Math.random() - 0.5) * 10;
      } else {
        vx = (Math.random() - 0.5) * 12;
        vy = -12 - Math.random() * 22;
      }
      maxLife = 0.14 + Math.random() * 0.1;
    } else {
      vx = (Math.random() - 0.5) * 8;
      vy = 12 + Math.random() * 22;
      maxLife = 0.1 + Math.random() * 0.08;
    }

    this.emitParticle(bx, by, vx, vy, maxLife);
  }

  private emitParticle(x: number, y: number, vx: number, vy: number, maxLife: number): void {
    for (const part of this.particles) {
      if (part.active) continue;
      part.active = true;
      part.x = x;
      part.y = y;
      part.vx = vx;
      part.vy = vy;
      part.maxLife = maxLife;
      part.life = maxLife;
      return;
    }
  }

  private updateParticles(dt: number): void {
    for (const part of this.particles) {
      if (!part.active) continue;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vy += 18 * dt;
      part.life -= dt;
      if (part.life <= 0) {
        part.active = false;
      }
    }
  }

  override renderTo(crt: VirtualCRT): void {
    const foam = paletteRgb.splashFoam;
    const ref = paletteRgb.riverReflection;
    for (const part of this.particles) {
      if (!part.active) continue;
      const xi = Math.floor(part.x);
      const yi = Math.floor(part.y);
      const fade = part.maxLife > 0 ? part.life / part.maxLife : 0;
      if (fade <= 0) continue;
      const w = 0.22 + 0.5 * fade;
      crt.setPixel(
        xi,
        yi,
        Math.round(foam.r * w + ref.r * (1 - w)),
        Math.round(foam.g * w + ref.g * (1 - w)),
        Math.round(foam.b * w + ref.b * (1 - w)),
      );
    }

    this.blitPlayer(crt, this.hayate);
    this.blitPlayer(crt, this.kaede);
  }

  private blitPlayer(crt: VirtualCRT, p: PlayerState): void {
    crt.drawAlphaSlice(
      p.rgba,
      p.width,
      p.height,
      0,
      0,
      Math.floor(p.x),
      Math.floor(p.y) + p.bobOffset,
      p.width,
      p.height,
    );
  }
}
