/**
 * Virtual CRT: 256×240 framebuffer drawn into `canvas`; Phaser samples it with nearest filtering.
 */
type ClippedBlit = { dx0: number; dy0: number; sx0: number; sy0: number; w: number; h: number };

function clipBlit(
  fbW: number,
  fbH: number,
  srcW: number,
  srcH: number,
  srcX: number,
  srcY: number,
  dstX: number,
  dstY: number,
  width: number,
  height: number,
): ClippedBlit | null {
  let dx0 = dstX;
  let dy0 = dstY;
  let w = width;
  let h = height;
  let sx0 = srcX;
  let sy0 = srcY;

  if (dx0 < 0) {
    sx0 -= dx0;
    w += dx0;
    dx0 = 0;
  }
  if (dy0 < 0) {
    sy0 -= dy0;
    h += dy0;
    dy0 = 0;
  }
  if (dx0 + w > fbW) {
    w = fbW - dx0;
  }
  if (dy0 + h > fbH) {
    h = fbH - dy0;
  }

  if (sx0 < 0) {
    dx0 -= sx0;
    w += sx0;
    sx0 = 0;
  }
  if (sy0 < 0) {
    dy0 -= sy0;
    h += sy0;
    sy0 = 0;
  }
  if (sx0 + w > srcW) {
    w = srcW - sx0;
  }
  if (sy0 + h > srcH) {
    h = srcH - sy0;
  }

  if (w <= 0 || h <= 0) {
    return null;
  }
  return { dx0, dy0, sx0, sy0, w, h };
}

export class VirtualCRT {
  static readonly WIDTH = 256;
  static readonly HEIGHT = 240;

  readonly canvas: HTMLCanvasElement;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly imageData: ImageData;
  private readonly buffer: Uint8ClampedArray;
  private readonly buffer32: Uint32Array;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = VirtualCRT.WIDTH;
    this.canvas.height = VirtualCRT.HEIGHT;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("VirtualCRT: failed to acquire 2D rendering context");
    }
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.imageData = this.ctx.createImageData(VirtualCRT.WIDTH, VirtualCRT.HEIGHT);
    this.buffer = this.imageData.data;
    this.buffer32 = new Uint32Array(this.buffer.buffer, this.buffer.byteOffset, this.buffer.length / 4);
  }

  get pixels(): Uint8ClampedArray {
    return this.buffer;
  }

  clear(r = 0, g = 0, b = 0, a = 0): void {
    const packed = r | (g << 8) | (b << 16) | (a << 24);
    this.buffer32.fill(packed);
  }

  setPixel(x: number, y: number, r: number, g: number, b: number): void {
    if (x < 0 || x >= VirtualCRT.WIDTH || y < 0 || y >= VirtualCRT.HEIGHT) {
      return;
    }
    const i = (y * VirtualCRT.WIDTH + x) * 4;
    this.buffer[i] = r;
    this.buffer[i + 1] = g;
    this.buffer[i + 2] = b;
    this.buffer[i + 3] = 255;
  }

  drawTextureSlice(
    src: Uint8ClampedArray,
    srcWidth: number,
    srcHeight: number,
    srcX: number,
    srcY: number,
    dstX: number,
    dstY: number,
    width: number,
    height: number,
  ): void {
    const c = clipBlit(VirtualCRT.WIDTH, VirtualCRT.HEIGHT, srcWidth, srcHeight, srcX, srcY, dstX, dstY, width, height);
    if (!c) {
      return;
    }
    const { dx0, dy0, sx0, sy0, w, h } = c;
    const dst = this.buffer;
    const dstStride = VirtualCRT.WIDTH * 4;
    const srcStride = srcWidth * 4;
    const rowBytes = w * 4;

    for (let row = 0; row < h; row++) {
      const sOff = (sy0 + row) * srcStride + sx0 * 4;
      const dOff = (dy0 + row) * dstStride + dx0 * 4;
      dst.set(src.subarray(sOff, sOff + rowBytes), dOff);
    }
  }

  drawAlphaSlice(
    src: Uint8ClampedArray,
    srcWidth: number,
    srcHeight: number,
    srcX: number,
    srcY: number,
    dstX: number,
    dstY: number,
    width: number,
    height: number,
  ): void {
    const c = clipBlit(VirtualCRT.WIDTH, VirtualCRT.HEIGHT, srcWidth, srcHeight, srcX, srcY, dstX, dstY, width, height);
    if (!c) {
      return;
    }
    const { dx0, dy0, sx0, sy0, w, h } = c;
    const dst = this.buffer;
    const dstStride = VirtualCRT.WIDTH * 4;
    const srcStride = srcWidth * 4;

    for (let row = 0; row < h; row++) {
      const sRow = (sy0 + row) * srcStride + sx0 * 4;
      const dRow = (dy0 + row) * dstStride + dx0 * 4;
      for (let col = 0; col < w; col++) {
        const s = sRow + col * 4;
        if (src[s + 3] === 0) {
          continue;
        }
        const d = dRow + col * 4;
        dst[d] = src[s];
        dst[d + 1] = src[s + 1];
        dst[d + 2] = src[s + 2];
        dst[d + 3] = src[s + 3];
      }
    }
  }

  present(): void {
    this.ctx.putImageData(this.imageData, 0, 0);
  }
}
