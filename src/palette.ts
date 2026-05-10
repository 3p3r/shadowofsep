export const palette = {
  background: "#002956",
  riverCityLight: "#79f700",
  riverReflection: "#000e88",
  star: "#ffffff",
  cityBuilding: "#000000",
  windowLit: "#00e4ff",
  windowDim: "#0070af",
  windowDimmest: "#00264c",
  /** Subtle splash under tubes (matches river tones, not bright foam). */
  splashFoam: "#003878",
} as const;

export type Palette = typeof palette;

export type Rgb = { readonly r: number; readonly g: number; readonly b: number };

/** Parse `#RRGGBB` for sprite tables and palette entries. */
export function hexToRgb(hex: string): Rgb {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`hexToRgb(): expected #RRGGBB, got "${hex}"`);
  }
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function rgb(hex: string): Rgb {
  return hexToRgb(hex);
}

export const paletteRgb = {
  background: rgb(palette.background),
  riverCityLight: rgb(palette.riverCityLight),
  riverReflection: rgb(palette.riverReflection),
  star: rgb(palette.star),
  cityBuilding: rgb(palette.cityBuilding),
  windowLit: rgb(palette.windowLit),
  windowDim: rgb(palette.windowDim),
  windowDimmest: rgb(palette.windowDimmest),
  splashFoam: rgb(palette.splashFoam),
} as const;
