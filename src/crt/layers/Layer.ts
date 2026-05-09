import type { VirtualCRT } from "../VirtualCRT";

/** A rectangular sub-region of the CRT framebuffer, in CRT pixel coordinates. */
export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A horizontally-scrolling strip of tiles confined to a sub-region of the
 * CRT.
 *
 * Layers are the unit of composition: each one owns its region (e.g. top /
 * middle / bottom third), its tile set, and its own scroll speed (so layers
 * can later parallax independently). Subclasses just provide `region` and
 * `tiles`; the base class handles wraparound scrolling and blitting into the
 * CRT framebuffer.
 *
 * Each tile is an RGBA byte buffer sized `region.width * region.height * 4`.
 * The strip is the tile set repeated end-to-end and wrapped, so any
 * `scrollX` is valid.
 */
export abstract class Layer {
  abstract readonly region: Region;
  abstract readonly tiles: readonly Uint8ClampedArray[];

  /** Slide speed in CRT pixels per second. Negative values scroll the other way. */
  scrollSpeed = 0;

  /** Current scroll offset in CRT pixels. May grow without bound; we wrap on render. */
  scrollX = 0;

  update(dt: number): void {
    this.scrollX += this.scrollSpeed * dt;
  }

  /**
   * Sub-pixel remainder of `scrollX`, in [0, 1). Hosts can apply this as a
   * screen-space translation to keep motion smooth even though the CRT
   * framebuffer can only shift by whole pixels.
   */
  get fractionalScroll(): number {
    return this.scrollX - Math.floor(this.scrollX);
  }

  /** Blit the visible portion of the strip into this layer's region of the CRT. */
  renderTo(crt: VirtualCRT): void {
    const tileCount = this.tiles.length;
    if (tileCount === 0) {
      return;
    }
    const { x: rx, y: ry, width: rw, height: rh } = this.region;
    const totalWidth = tileCount * rw;
    const wrapped = ((this.scrollX % totalWidth) + totalWidth) % totalWidth;

    let tileIdx = Math.floor(wrapped / rw);
    let localX = Math.floor(wrapped) % rw;
    let dstX = rx;
    const endX = rx + rw;

    while (dstX < endX) {
      const tile = this.tiles[tileIdx % tileCount];
      const sliceWidth = Math.min(rw - localX, endX - dstX);
      crt.drawTextureSlice(tile, rw, rh, localX, 0, dstX, ry, sliceWidth, rh);
      dstX += sliceWidth;
      tileIdx++;
      localX = 0;
    }
  }
}
