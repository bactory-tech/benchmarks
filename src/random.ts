/**
 * Deterministic pseudo-random number generation for reproducible benchmarks.
 *
 * This module is not intended for cryptographic use.
 */

/**
 * Mulberry32 PRNG.
 *
 * Small, fast and deterministic. A fixed seed always produces the same
 * sequence of uniform values.
 */
export class Mulberry32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Returns a uniform pseudo-random value in [0, 1).
   */
  next(): number {
    this.state =
      (this.state + 0x6d2b79f5) >>> 0;

    let x = this.state;

    x = Math.imul(
      x ^ (x >>> 15),
      x | 1,
    );

    x ^=
      x +
      Math.imul(
        x ^ (x >>> 7),
        x | 61,
      );

    return (
      ((x ^ (x >>> 14)) >>> 0) /
      4294967296
    );
  }
}

/**
 * Standard-normal generator using the Box-Muller transform.
 *
 * Produces N(0, 1) samples from deterministic uniform values supplied by
 * Mulberry32.
 */
export class NormalGenerator {
  private readonly rng: Mulberry32;

  private spare: number | null = null;

  constructor(seed: number) {
    this.rng = new Mulberry32(seed);
  }

  /**
   * Returns one standard-normal pseudo-random sample.
   */
  next(): number {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;

      return value;
    }

    let u1 = this.rng.next();
    const u2 = this.rng.next();

    /*
     * Box-Muller contains log(u1), therefore u1 must be strictly positive.
     */
    if (u1 <= 0) {
      u1 = Number.MIN_VALUE;
    }

    const radius =
      Math.sqrt(
        -2 * Math.log(u1),
      );

    const angle =
      2 * Math.PI * u2;

    const z0 =
      radius * Math.cos(angle);

    const z1 =
      radius * Math.sin(angle);

    /*
     * Box-Muller gives us two independent normals.
     * Cache the second one instead of throwing it away.
     */
    this.spare = z1;

    return z0;
  }
}

/**
 * Creates a scenario-specific seed while keeping the benchmark reproducible.
 */
export function deriveSeed(
  baseSeed: number,
  scenarioIndex: number,
): number {
  if (
    !Number.isInteger(baseSeed) ||
    !Number.isInteger(scenarioIndex)
  ) {
    throw new Error(
      "seed inputs must be integers",
    );
  }

  if (scenarioIndex < 0) {
    throw new Error(
      "scenario index must be non-negative",
    );
  }

  return (
    (baseSeed + scenarioIndex) >>> 0
  );
}
