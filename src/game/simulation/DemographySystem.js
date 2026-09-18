import { clamp } from "./constants.js";

function populationScore(population) {
  const lo = Math.log10(100_000), hi = Math.log10(1_500_000_000);
  return clamp(((Math.log10(Math.max(100_000, population)) - lo) / (hi - lo)) * 100);
}

export class DemographySystem {
  updateDay(state) {
    const annualRate = Math.max(-5, Math.min(8, Number(state.demography?.annualGrowthPct) || 0)) / 100;
    const migration = Number(state.demography?.annualNetMigration) || 0;
    const naturalDelta = state.populationCount * (Math.pow(1 + annualRate, 1 / 365) - 1);
    const migrationDelta = migration / 365;
    const delta = naturalDelta + migrationDelta;
    state.populationCount = Math.max(1_000, state.populationCount + delta);
    state.populationDelta += delta;
    const target = populationScore(state.populationCount);
    const metric = state.metrics.population;
    metric.baseline = target;
    metric.pressure += (target - metric.current) * 0.002;
    return delta;
  }
}
