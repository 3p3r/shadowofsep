/**
 * Virtual CRT renderer.
 *
 * Simulates an old-school NES-era CRT framebuffer at 256x240. Game logic
 * renders into this object pixel-by-pixel; the resulting `canvas` is meant to
 * be sampled and stretched by the host (e.g. a Phaser sprite) to fill the
 * actual viewport. No CRT effects (scanlines, distortion, bloom) are applied
 * here on purpose - this is just a plain framebuffer.
 */
export class VirtualCRT {
  /** Native horizontal resolution of an NTSC NES frame. */
  static readonly WIDTH = 256;
  /** Native vertical resolution of an NTSC NES frame. */
  static readonly HEIGHT = 240;

  /** The backing canvas. Hand this to a renderer to display the CRT output. */
  readonly canvas: HTMLCanvasElement;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly imageData: ImageData;
  /** RGBA buffer view (Uint8ClampedArray, length WIDTH*HEIGHT*4). */
  private readonly buffer: Uint8ClampedArray;

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
    // Buffer starts as transparent black (Uint8ClampedArray default), so any
    // un-drawn pixel reveals whatever the host renders behind the CRT canvas.
  }

  /** Width of the framebuffer in pixels. */
  get width(): number {
    return VirtualCRT.WIDTH;
  }

  /** Height of the framebuffer in pixels. */
  get height(): number {
    return VirtualCRT.HEIGHT;
  }

  /** Direct access to the RGBA buffer, for callers that want to write a whole frame at once. */
  get pixels(): Uint8ClampedArray {
    return this.buffer;
  }

  /**
   * Fill the entire framebuffer with a color. Defaults to fully transparent
   * so the host's background (e.g. Phaser's palette color) shows through.
   * Pass `a = 255` for an opaque clear.
   */
  clear(r = 0, g = 0, b = 0, a = 0): void {
    const buf = this.buffer;
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }

  /** Write a single RGB pixel. Out-of-bounds writes are silently ignored. */
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

  /**
   * Blit a rectangular slice of an external RGBA texture into the framebuffer.
   *
   * Pixels are copied with no scaling or filtering. The destination is clipped
   * to the framebuffer bounds; the source is clipped to its own bounds.
   */
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
    // Clip destination against the framebuffer.
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
    if (dx0 + w > VirtualCRT.WIDTH) {
      w = VirtualCRT.WIDTH - dx0;
    }
    if (dy0 + h > VirtualCRT.HEIGHT) {
      h = VirtualCRT.HEIGHT - dy0;
    }

    // Clip source against its own bounds.
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
    if (sx0 + w > srcWidth) {
      w = srcWidth - sx0;
    }
    if (sy0 + h > srcHeight) {
      h = srcHeight - sy0;
    }

    if (w <= 0 || h <= 0) {
      return;
    }

    const dst = this.buffer;
    const dstStride = VirtualCRT.WIDTH * 4;
    const srcStride = srcWidth * 4;
    const rowBytes = w * 4;

    for (let row = 0; row < h; row++) {
      const sOff = (sy0 + row) * srcStride + sx0 * 4;
      const dOff = (dy0 + row) * dstStride + dx0 * 4;
      // Copy a contiguous run of RGBA bytes for this row.
      dst.set(src.subarray(sOff, sOff + rowBytes), dOff);
    }
  }

  /**
   * Commit the in-memory buffer to the backing canvas. Call this once per
   * frame after you're done drawing, before the host samples `canvas`.
   */
  present(): void {
    this.ctx.putImageData(this.imageData, 0, 0);
  }
}
