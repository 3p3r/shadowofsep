import { createNoise2D, type NoiseFunction2D } from "simplex-noise";

/** Seeded `simplex-noise` 2D field (permutation table built from integer `seed`). */
export function createSeededNoise2D(seed: number): NoiseFunction2D {
  let state = seed >>> 0;
  return createNoise2D(() => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  });
}
