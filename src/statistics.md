/**
 * Uses Welford's online algorithm to calculate the sample mean and variance
 * without storing every observation in memory.
 */

export interface StatisticsSnapshot {
  count: number;
  mean: number;
  sampleVariance: number;
  sampleStandardDeviation: number;
  standardError: number;

  /**
   * Approximate 95% confidence interval for the sample mean.
   *
   * Uses the normal critical value 1.96.
   */
  confidence95: {
    lower: number;
    upper: number;
  };
}

export class OnlineStatistics {
  private countValue = 0;

  private meanValue = 0;

  private m2Value = 0;

  /**
   * Add one observation.
   */
  push(value: number): void {
    if (!Number.isFinite(value)) {
      throw new Error(
        "statistics observation must be finite",
      );
    }

    this.countValue += 1;

    const delta =
      value - this.meanValue;

    this.meanValue +=
      delta / this.countValue;

    const delta2 =
      value - this.meanValue;

    this.m2Value +=
      delta * delta2;
  }

  /**
   * Number of observations processed.
   */
  get count(): number {
    return this.countValue;
  }

  /**
   * Current sample mean.
   */
  get mean(): number {
    return this.meanValue;
  }

  /**
   * Unbiased sample variance.
   *
   * Undefined for fewer than two observations, represented here as NaN.
   */
  get sampleVariance(): number {
    if (this.countValue < 2) {
      return Number.NaN;
    }

    return (
      this.m2Value /
      (this.countValue - 1)
    );
  }

  /**
   * Sample standard deviation.
   */
  get sampleStandardDeviation(): number {
    const variance =
      this.sampleVariance;

    if (!Number.isFinite(variance)) {
      return Number.NaN;
    }

    return Math.sqrt(
      Math.max(variance, 0),
    );
  }

  /**
   * Standard error of the sample mean.
   */
  get standardError(): number {
    if (this.countValue < 2) {
      return Number.NaN;
    }

    return (
      this.sampleStandardDeviation /
      Math.sqrt(this.countValue)
    );
  }

  /**
   * Approximate normal 95% confidence interval.
   */
  confidenceInterval95(): {
    lower: number;
    upper: number;
  } {
    const standardError =
      this.standardError;

    if (!Number.isFinite(standardError)) {
      return {
        lower: Number.NaN,
        upper: Number.NaN,
      };
    }

    const margin =
      1.96 * standardError;

    return {
      lower:
        this.meanValue - margin,

      upper:
        this.meanValue + margin,
    };
  }

  /**
   * Immutable summary of the current statistics.
   */
  snapshot(): StatisticsSnapshot {
    const confidence95 =
      this.confidenceInterval95();

    return {
      count: this.countValue,
      mean: this.meanValue,
      sampleVariance:
        this.sampleVariance,
      sampleStandardDeviation:
        this.sampleStandardDeviation,
      standardError:
        this.standardError,
      confidence95,
    };
  }
}

/**
 * Relative difference between two values.
 *
 * Returned as a fraction:
 *
 * 0.01 = 1%
 */
export function relativeDifference(
  actual: number,
  reference: number,
): number {
  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(reference)
  ) {
    throw new Error(
      "relative difference inputs must be finite",
    );
  }

  const difference =
    Math.abs(actual - reference);

  if (reference === 0) {
    return difference === 0
      ? 0
      : Number.POSITIVE_INFINITY;
  }

  return (
    difference /
    Math.abs(reference)
  );
}

/**
 * Difference measured in units of the reference standard error.
 */
export function zDifference(
  actual: number,
  reference: number,
  standardError: number,
): number | null {
  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(reference)
  ) {
    throw new Error(
      "z-difference values must be finite",
    );
  }

  if (
    !Number.isFinite(standardError) ||
    standardError <= 0
  ) {
    return null;
  }

  return (
    (actual - reference) /
    standardError
  );
}
