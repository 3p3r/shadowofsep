import type { Rgb } from "../../palette";

export function writeRgba(buf: Uint8ClampedArray, w: number, x: number, y: number, c: Rgb): void {
  const i = (y * w + x) * 4;
  buf[i] = c.r;
  buf[i + 1] = c.g;
  buf[i + 2] = c.b;
  buf[i + 3] = 255;
}
