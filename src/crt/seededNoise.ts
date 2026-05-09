import { createNoise2D, type NoiseFunction2D } from "simplex-noise";

/**
 * Integer-seeded 2D simplex noise.
 *
 * `createNoise2D` from `simplex-noise` takes an optional `random()` in [0, 1)
 * only while constructing its permutation table; this bridges an integer seed
 * to that hook. All procedural variation in layers comes from sampling the
 * returned noise function.
 */
export function createSeededNoise2D(seed: number): NoiseFunction2D {
  let state = seed >>> 0;
  return createNoise2D(() => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  });
}
