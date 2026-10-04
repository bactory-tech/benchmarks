import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import scenarioData from "./scenarios.json";

import {
  priceAsianCallDeterministic,
} from "../src/deterministic.js";

import {
  priceAsianCallMonteCarlo,
  type AsianOption,
  type MarketState,
} from "../src/monteCarlo.js";

import {
  deriveSeed,
} from "../src/random.js";

import {
  relativeDifference,
  zDifference,
} from "../src/statistics.js";

interface Scenario {
  id: string;
  description: string;
  market: MarketState;
  option: AsianOption;
}

interface ScenarioFile {
  baseSeed: number;
  defaultPaths: number;
  scenarios: Scenario[];
}

interface BenchmarkResult {
  id: string;
  description: string;

  inputs: {
    market: MarketState;
    option: AsianOption;
    paths: number;
    seed: number;
  };

  deterministic: {
    price: number;
    firstMoment: number;
    secondMoment: number;
    effectiveLogVariance: number | null;
  };

  monteCarlo: {
    price: number;
    standardError: number;
    confidence95: {
      lower: number;
      upper: number;
    };
    sampleStandardDeviation: number;
  };

  comparison: {
    absoluteDifference: number;
    relativeDifference: number;
    zDifference: number | null;
  };

  runtime: {
    monteCarloMilliseconds: number;
  };
}

interface BenchmarkOutput {
  methodology: {
    model: string;
    payoff: string;
    observationSchedule: string;
    monteCarloTransition: string;
    deterministicMethod: string;
  };

  configuration: {
    baseSeed: number;
    defaultPaths: number;
  };

  results: BenchmarkResult[];
}

function validateScenarioFile(
  data: ScenarioFile,
): void {
  if (
    !Number.isInteger(data.baseSeed)
  ) {
    throw new Error(
      "baseSeed must be an integer",
    );
  }

  if (
    !Number.isInteger(data.defaultPaths) ||
    data.defaultPaths < 2
  ) {
    throw new Error(
      "defaultPaths must be an integer >= 2",
    );
  }

  if (
    !Array.isArray(data.scenarios) ||
    data.scenarios.length === 0
  ) {
    throw new Error(
      "at least one scenario is required",
    );
  }

  const ids =
    new Set<string>();

  for (const scenario of data.scenarios) {
    if (!scenario.id) {
      throw new Error(
        "scenario id is required",
      );
    }

    if (ids.has(scenario.id)) {
      throw new Error(
        `duplicate scenario id: ${scenario.id}`,
      );
    }

    ids.add(scenario.id);
  }
}

function formatNumber(
  value: number | null,
): string {
  if (value === null) {
    return "n/a";
  }

  if (!Number.isFinite(value)) {
    return String(value);
  }

  return value.toFixed(8);
}

async function main(): Promise<void> {
  const scenarios =
    scenarioData as ScenarioFile;

  validateScenarioFile(
    scenarios,
  );

  const results:
    BenchmarkResult[] = [];

  console.log(
    "n0paths arithmetic Asian benchmark",
  );

  console.log(
    `paths per scenario: ${scenarios.defaultPaths.toLocaleString()}`,
  );

  console.log("");

  for (
    let index = 0;
    index < scenarios.scenarios.length;
    index += 1
  ) {
    const scenario =
      scenarios.scenarios[index];

    if (scenario === undefined) {
      throw new Error(
        `missing scenario at index ${index}`,
      );
    }

    const seed =
      deriveSeed(
        scenarios.baseSeed,
        index,
      );

    const deterministic =
      priceAsianCallDeterministic(
        scenario.market,
        scenario.option,
      );

    const monteCarlo =
      priceAsianCallMonteCarlo(
        scenario.market,
        scenario.option,
        {
          paths:
            scenarios.defaultPaths,
          seed,
        },
      );

    const absoluteDifference =
      Math.abs(
        deterministic.price -
        monteCarlo.price,
      );

    const relative =
      relativeDifference(
        deterministic.price,
        monteCarlo.price,
      );

    const z =
      zDifference(
        deterministic.price,
        monteCarlo.price,
        monteCarlo.standardError,
      );

    results.push({
      id:
        scenario.id,

      description:
        scenario.description,

      inputs: {
        market:
          scenario.market,

        option:
          scenario.option,

        paths:
          scenarios.defaultPaths,

        seed,
      },

      deterministic: {
        price:
          deterministic.price,

        firstMoment:
          deterministic.moments
            .firstMoment,

        secondMoment:
          deterministic.moments
            .secondMoment,

        effectiveLogVariance:
          deterministic.fit
            ?.logVariance ??
          null,
      },

      monteCarlo: {
        price:
          monteCarlo.price,

        standardError:
          monteCarlo.standardError,

        confidence95:
          monteCarlo.confidence95,

        sampleStandardDeviation:
          monteCarlo
            .sampleStandardDeviation,
      },

      comparison: {
        absoluteDifference,
        relativeDifference:
          relative,
        zDifference:
          z,
      },

      runtime: {
        monteCarloMilliseconds:
          monteCarlo
            .elapsedMilliseconds,
      },
    });

    console.log(
      scenario.id,
    );

    console.log(
      `  deterministic : ${formatNumber(
        deterministic.price,
      )}`,
    );

    console.log(
      `  monte carlo   : ${formatNumber(
        monteCarlo.price,
      )}`,
    );

    console.log(
      `  standard error: ${formatNumber(
        monteCarlo.standardError,
      )}`,
    );

    console.log(
      `  abs difference: ${formatNumber(
        absoluteDifference,
      )}`,
    );

    console.log(
      `  z difference  : ${formatNumber(
        z,
      )}`,
    );

    console.log(
      `  runtime       : ${monteCarlo.elapsedMilliseconds.toFixed(
        2,
      )} ms`,
    );

    console.log("");
  }

  const output:
    BenchmarkOutput = {
      methodology: {
        model:
          "Risk-neutral geometric Brownian motion",

        payoff:
          "Discounted max(arithmeticAverage - strike, 0)",

        observationSchedule:
          "t_i = iT/n for i = 1,...,n; t=0 excluded",

        monteCarloTransition:
          "Exact GBM transition between monitoring dates",

        deterministicMethod:
          "Exact first two arithmetic-average moments followed by lognormal moment matching",
      },

      configuration: {
        baseSeed:
          scenarios.baseSeed,

        defaultPaths:
          scenarios.defaultPaths,
      },

      results,
    };

  const currentFile =
    fileURLToPath(
      import.meta.url,
    );

  const outputPath =
    new URL(
      "./results.json",
      import.meta.url,
    );

  await mkdir(
    dirname(
      fileURLToPath(
        outputPath,
      ),
    ),
    {
      recursive: true,
    },
  );

  await writeFile(
    outputPath,
    `${JSON.stringify(
      output,
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `wrote results.json from ${currentFile}`,
  );
}

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
