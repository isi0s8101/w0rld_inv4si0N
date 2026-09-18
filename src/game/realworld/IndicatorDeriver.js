import { clamp } from "../simulation/constants.js";

function logScale(value, min, max) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const lo = Math.log10(min), hi = Math.log10(max), v = Math.log10(value);
  return clamp(((v - lo) / (hi - lo)) * 100);
}
function group(entry) {
  const c = entry?.dataClass || "REAL";
  if (String(c).startsWith("REAL")) return "REAL";
  if (c === "SPECIAL") return "SPECIAL";
  return "ESTIMATED";
}
function combinedClass(record, keys) {
  const groups = new Set(keys.map((key) => group(record?.[key])).filter(Boolean));
  if (groups.size === 1 && groups.has("REAL")) return "DERIVED_FROM_REAL";
  if (groups.has("REAL")) return "DERIVED_FROM_MIXED";
  if (groups.has("SPECIAL")) return "DERIVED_SPECIAL";
  return "DERIVED_FROM_ESTIMATED";
}
function minConfidence(record, keys) {
  const vals = keys.map((key) => record?.[key]?.confidence).filter(Number.isFinite);
  return vals.length ? Math.min(...vals) : 0;
}

export class IndicatorDeriver {
  derive(record) {
    if (!record) return null;
    const population = record.population?.value;
    const gdp = record.gdpCurrentUsd?.value;
    const gdpPc = record.gdpPerCapitaUsd?.value;
    const growth = record.gdpGrowthAnnualPct?.value;
    const popGrowth = record.populationGrowthAnnualPct?.value;
    const trade = record.tradePctGdp?.value;
    const electricity = record.electricityAccessPct?.value;

    const populationScale = logScale(population, 100_000, 1_500_000_000);
    const economicMass = logScale(gdp, 1_000_000_000, 35_000_000_000_000);
    const prosperity = logScale(gdpPc, 500, 100_000);
    const economicCapacity = economicMass == null || prosperity == null ? null : clamp(economicMass * 0.58 + prosperity * 0.42);
    const growthMomentum = Number.isFinite(growth) ? clamp(50 + growth * 6, 15, 90) : null;
    const demographicMomentum = Number.isFinite(popGrowth) ? clamp(50 + popGrowth * 12, 10, 90) : null;
    const tradeOpenness = Number.isFinite(trade) ? clamp(trade / 1.6, 0, 100) : null;
    const infrastructureAccess = Number.isFinite(electricity) ? clamp(electricity) : null;
    const logisticsCapacity = economicCapacity == null || tradeOpenness == null ? null : clamp(economicCapacity * 0.58 + tradeOpenness * 0.27 + (infrastructureAccess ?? 50) * 0.15);

    const coreKeys = ["population", "gdpCurrentUsd", "gdpPerCapitaUsd"];
    return {
      populationScale,
      economicMass,
      prosperity,
      economicCapacity,
      growthMomentum,
      demographicMomentum,
      tradeOpenness,
      infrastructureAccess,
      logisticsCapacity,
      formulaVersion: 2,
      class: "DERIVED",
      dataClass: combinedClass(record, coreKeys),
      confidence: minConfidence(record, coreKeys)
    };
  }
}
