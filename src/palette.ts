/**
 * All colors as `#RRGGBB`. Use `rgb()` when writing RGBA framebuffers.
 */
export const palette = {
  /** Full-page background (Phaser host, document body). */
  background: "#002956",
  /** River skyline city lights. */
  riverCityLight: "#79f700",
  /** River water reflections. */
  riverReflection: "#000e88",
  /** Sparse star dots (top layer). */
  star: "#ffffff",
  /** City skyline silhouettes (middle layer). */
  cityBuilding: "#000000",
  /** Brightly-lit windows on city-center towers. */
  windowLit: "#00e4ff",
  /** Half-lit / reflected windows on city-center towers. */
  windowDim: "#0070af",
  /** "Blackout" or always-dim windows: suburban buildings + some city-center towers. */
  windowDimmest: "#00264c",
} as const;

export type Palette = typeof palette;

export type Rgb = { readonly r: number; readonly g: number; readonly b: number };

/** Parse `#RRGGBB` (leading `#` optional) for canvas / CRT buffers. */
export function rgb(hex: string): Rgb {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`rgb(): expected #RRGGBB, got "${hex}"`);
  }
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}
