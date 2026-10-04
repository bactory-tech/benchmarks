import type {
  AsianOption,
  MarketState,

export interface AsianMoments {
  firstMoment: number;
  secondMoment: number;
}

export interface LognormalFit {
  logMean: number;
  logVariance: number;
  logStandardDeviation: number;
}

export interface DeterministicResult {
  price: number;
  undiscountedPayoff: number;
  discountFactor: number;
  moments: AsianMoments;
  fit: LognormalFit | null;
}

/**
 * Standard normal probability density function.
 */
export function normalPdf(
  x: number,
): number {
  return (
    Math.exp(-0.5 * x * x) /
    Math.sqrt(2 * Math.PI)
  );
}

/**
 * Standard normal cumulative distribution function.
 *
 * Abramowitz-Stegun style approximation.
 */
export function normalCdf(
  x: number,
): number {
  if (x <= -10) {
    return 0;
  }

  if (x >= 10) {
    return 1;
  }

  const absoluteX =
    Math.abs(x);

  const t =
    1 /
    (
      1 +
      0.2316419 * absoluteX
    );

  const polynomial =
    t *
    (
      0.319381530 +
      t *
        (
          -0.356563782 +
          t *
            (
              1.781477937 +
              t *
                (
                  -1.821255978 +
                  t *
                    1.330274429
                )
            )
        )
    );

  const approximation =
    1 -
    normalPdf(absoluteX) *
      polynomial;

  return x >= 0
    ? approximation
    : 1 - approximation;
}

/**
 * Validate deterministic pricing inputs.
 */
function validateInputs(
  market: MarketState,
  option: AsianOption,
): void {
  if (
    !Number.isFinite(market.spot) ||
    market.spot <= 0
  ) {
    throw new Error(
      "spot must be positive and finite",
    );
  }

  if (
    !Number.isFinite(market.volatility) ||
    market.volatility < 0
  ) {
    throw new Error(
      "volatility must be non-negative and finite",
    );
  }

  if (
    !Number.isFinite(market.riskFreeRate) ||
    !Number.isFinite(market.dividendYield)
  ) {
    throw new Error(
      "rates must be finite",
    );
  }

  if (
    !Number.isFinite(option.strike) ||
    option.strike <= 0
  ) {
    throw new Error(
      "strike must be positive and finite",
    );
  }

  if (
    !Number.isFinite(option.timeToExpiry) ||
    option.timeToExpiry <= 0
  ) {
    throw new Error(
      "time to expiry must be positive and finite",
    );
  }

  if (
    !Number.isInteger(option.observations) ||
    option.observations <= 0
  ) {
    throw new Error(
      "observations must be a positive integer",
    );
  }
}

/**
 * Exact first and second moments of the discretely monitored arithmetic
 * average under risk-neutral GBM.
 *
 * Observation dates:
 *
 * t_i = iT / n
 *
 * for i = 1, ..., n.
 */
export function arithmeticAsianMoments(
  market: MarketState,
  option: AsianOption,
): AsianMoments {
  validateInputs(
    market,
    option,
  );

  const {
    spot,
    volatility,
    riskFreeRate,
    dividendYield,
  } = market;

  const {
    timeToExpiry,
    observations,
  } = option;

  const carry =
    riskFreeRate -
    dividendYield;

  const variance =
    volatility *
    volatility;

  let firstMomentSum = 0;
  let secondMomentSum = 0;

  for (
    let i = 1;
    i <= observations;
    i += 1
  ) {
    const ti =
      (
        i *
        timeToExpiry
      ) /
      observations;

    firstMomentSum +=
      spot *
      Math.exp(
        carry * ti,
      );

    for (
      let j = 1;
      j <= observations;
      j += 1
    ) {
      const tj =
        (
          j *
          timeToExpiry
        ) /
        observations;

      secondMomentSum +=
        spot *
        spot *
        Math.exp(
          carry *
            (ti + tj) +
          variance *
            Math.min(ti, tj),
        );
    }
  }

  const firstMoment =
    firstMomentSum /
    observations;

  const secondMoment =
    secondMomentSum /
    (
      observations *
      observations
    );

  return {
    firstMoment,
    secondMoment,
  };
}

/**
 * Fit a lognormal distribution from the first two moments.
 */
export function fitLognormal(
  moments: AsianMoments,
): LognormalFit | null {
  const {
    firstMoment,
    secondMoment,
  } = moments;

  if (
    firstMoment <= 0 ||
    secondMoment <= 0
  ) {
    throw new Error(
      "moments must be positive",
    );
  }

  const ratio =
    secondMoment /
    (
      firstMoment *
      firstMoment
    );

  /*
   * Floating-point arithmetic can make a theoretically zero variance
   * appear infinitesimally negative.
   */
  const logVariance =
    Math.max(
      Math.log(ratio),
      0,
    );

  if (logVariance <= 1e-15) {
    return null;
  }

  const logMean =
    Math.log(firstMoment) -
    0.5 * logVariance;

  return {
    logMean,
    logVariance,
    logStandardDeviation:
      Math.sqrt(logVariance),
  };
}

/**
 * Deterministic moment-matched approximation for a discretely monitored
 * arithmetic Asian call.
 */
export function priceAsianCallDeterministic(
  market: MarketState,
  option: AsianOption,
): DeterministicResult {
  validateInputs(
    market,
    option,
  );

  const moments =
    arithmeticAsianMoments(
      market,
      option,
    );

  const discountFactor =
    Math.exp(
      -market.riskFreeRate *
      option.timeToExpiry,
    );

  const fit =
    fitLognormal(moments);

  /*
   * Degenerate distribution.
   *
   * This includes the zero-volatility case under the model.
   */
  if (fit === null) {
    const undiscountedPayoff =
      Math.max(
        moments.firstMoment -
          option.strike,
        0,
      );

    return {
      price:
        discountFactor *
        undiscountedPayoff,

      undiscountedPayoff,
      discountFactor,
      moments,
      fit: null,
    };
  }

  const d2 =
    (
      fit.logMean -
      Math.log(option.strike)
    ) /
    fit.logStandardDeviation;

  const d1 =
    d2 +
    fit.logStandardDeviation;

  const undiscountedPayoff =
    moments.firstMoment *
      normalCdf(d1) -
    option.strike *
      normalCdf(d2);

  return {
    price:
      discountFactor *
      undiscountedPayoff,

    undiscountedPayoff,
    discountFactor,
    moments,
    fit,
  };
}
