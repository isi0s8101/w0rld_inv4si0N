import { BASE_METRICS, METRICS, RESOURCE_TYPES, clamp } from "./constants.js";

function metric(current, recoveryRate, sensitivity = 1, dataClass = "GAMEPLAY") {
  const baseline = clamp(current);
  return { current: baseline, baseline, trend: 0, pressure: 0, recoveryRate, sensitivity, lastCauses: [], dataClass };
}

function resource({ demand, selfSufficiency, random, stockDays }) {
  const productionCapacity = Math.max(4, demand * selfSufficiency * random.range(1.05, 1.22));
  const stockCapacity = Math.max(demand * stockDays, demand * 5);
  return {
    productionCapacity,
    production: demand * selfSufficiency,
    consumption: demand,
    stockCapacity,
    stock: stockCapacity * random.range(0.42, 0.72),
    imports: 0,
    exports: 0,
    shortage: 0,
    utilization: 0,
    priceIndex: 100,
    demandBase: demand,
    selfSufficiency,
    dataClass: "GAMEPLAY"
  };
}


function strategicResource({ production, consumption, stock, priceIndex = 100, dependency = 0, dataClass = "GAMEPLAY" }) {
  return {
    production: Math.max(0, production),
    consumption: Math.max(0, consumption),
    imports: Math.max(0, consumption - production),
    exports: Math.max(0, production - consumption),
    stockCapacity: Math.max(1, stock * 1.65),
    stock: Math.max(0, stock),
    price: Math.max(1, priceIndex),
    dependency: Math.max(0, Math.min(1, dependency)),
    dataClass
  };
}

function normalizedPopulation(populationCount) {
  const lo = Math.log10(100_000), hi = Math.log10(1_500_000_000);
  const value = Math.log10(Math.max(100_000, populationCount));
  return clamp(((value - lo) / (hi - lo)) * 100);
}

function sourceClass(entry) {
  const dataClass = entry?.dataClass || "REAL";
  return String(dataClass).startsWith("REAL") ? "REAL" : dataClass === "SPECIAL" ? "SPECIAL" : "ESTIMATED";
}

export function createCountryState(country, meta, random, { realWorldRecord = null, realWorldMetadata = null, derived = null, mode = "REAL_WORLD", provenance = null } = {}) {
  const realPopulation = realWorldRecord?.population?.value;
  const populationCount = Number.isFinite(realPopulation)
    ? realPopulation
    : Number.isFinite(meta?.population)
      ? meta.population
      : Math.round(random.range(350_000, 55_000_000));
  const areaKm2 = Number.isFinite(meta?.areaKm2) ? meta.areaKm2 : Math.round(random.range(12_000, 900_000));
  const popScale = derived?.populationScale ?? Math.min(100, normalizedPopulation(populationCount));
  const density = Math.min(1, populationCount / Math.max(1, areaKm2) / 450);
  const seededDevelopment = random.range(0.34, 0.82);
  const derivedEconomy = derived?.economicCapacity;
  const development = Number.isFinite(derivedEconomy) ? Math.max(0.18, Math.min(0.94, derivedEconomy / 100)) : seededDevelopment;
  const connectedness = random.range(0.32, 0.88);

  const values = {
    population: clamp(popScale),
    stability: clamp(54 + development * 25 + random.range(-12, 10)),
    cohesion: clamp(50 + random.range(-12, 18)),
    economy: clamp(Number.isFinite(derivedEconomy) ? derivedEconomy : 38 + development * 48 + random.range(-8, 8)),
    energy: clamp(48 + random.range(-12, 30)),
    food: clamp(55 + random.range(-10, 26)),
    infrastructure: clamp(36 + development * 52 + random.range(-7, 7)),
    technology: clamp(30 + development * 58 + random.range(-8, 8)),
    science: clamp(28 + development * 58 + random.range(-10, 10)),
    militaryReadiness: clamp(34 + development * 42 + random.range(-12, 12)),
    resilience: clamp(45 + development * 28 + connectedness * 12 + random.range(-8, 8)),
    diplomaticInfluence: clamp(25 + connectedness * 47 + popScale * 0.14 + development * 10 + random.range(-9, 9)),
    awareness: clamp(6 + random.range(0, 10))
  };

  const metrics = {};
  for (const name of BASE_METRICS) {
    const recovery = name === "awareness" ? random.range(0.004, 0.010) : random.range(0.008, 0.028);
    const dataClass = name === "population" && Number.isFinite(realPopulation)
      ? (sourceClass(realWorldRecord?.population) === "REAL" ? "DERIVED_FROM_REAL" : sourceClass(realWorldRecord?.population) === "SPECIAL" ? "DERIVED_SPECIAL" : "DERIVED_FROM_ESTIMATED")
      : name === "economy" && Number.isFinite(derivedEconomy)
        ? (derived?.dataClass || "DERIVED")
        : "GAMEPLAY";
    metrics[name] = metric(values[name], recovery, random.range(0.82, 1.18), dataClass);
  }
  metrics.resistancePotential = metric(0, 0, 1, "GAMEPLAY_DERIVED");

  const demandFactor = 7 + (popScale / 100) * 18 + development * 12 + density * 5;
  const resources = {
    food: resource({ demand: demandFactor * 0.82, selfSufficiency: random.range(0.72, 1.32), random, stockDays: random.range(24, 70) }),
    energy: resource({ demand: demandFactor * (0.72 + development * 0.55), selfSufficiency: random.range(0.62, 1.42), random, stockDays: random.range(18, 58) }),
    goods: resource({ demand: demandFactor * (0.65 + development * 0.72), selfSufficiency: random.range(0.58, 1.46), random, stockDays: random.range(15, 45) }),
    data: resource({ demand: demandFactor * (0.34 + development * 0.95), selfSufficiency: random.range(0.68, 1.38), random, stockDays: random.range(7, 24) })
  };

  const realGrowth = realWorldRecord?.populationGrowthAnnualPct?.value;
  const realMigration = realWorldRecord?.netMigration?.value;
  const demography = {
    annualGrowthPct: Number.isFinite(realGrowth) ? realGrowth : random.range(-0.45, 2.1),
    annualNetMigration: Number.isFinite(realMigration) ? realMigration : 0,
    growthDataClass: Number.isFinite(realGrowth) ? (realWorldRecord?.populationGrowthAnnualPct?.dataClass || "REAL") : "SCENARIO_FALLBACK",
    migrationDataClass: Number.isFinite(realMigration) ? (realWorldRecord?.netMigration?.dataClass || "REAL") : "SCENARIO_FALLBACK"
  };

  const strategicScale = Math.max(0.25, development) * (0.45 + popScale / 180);
  const strategicResources = {
    oil: strategicResource({ production: random.range(0.2, 3.6) * strategicScale, consumption: random.range(0.8, 3.4) * strategicScale, stock: random.range(20, 90) * strategicScale, dependency: random.range(0.15, 0.82) }),
    gas: strategicResource({ production: random.range(0.2, 3.4) * strategicScale, consumption: random.range(0.7, 3.0) * strategicScale, stock: random.range(18, 75) * strategicScale, dependency: random.range(0.12, 0.78) }),
    coal: strategicResource({ production: random.range(0.1, 2.5) * strategicScale, consumption: random.range(0.2, 2.0) * strategicScale, stock: random.range(15, 60) * strategicScale, dependency: random.range(0.08, 0.64) }),
    uranium: strategicResource({ production: random.range(0.02, 0.8) * strategicScale, consumption: random.range(0.05, 0.7) * strategicScale, stock: random.range(8, 35) * strategicScale, dependency: random.range(0.08, 0.70) }),
    electricity: strategicResource({ production: resources.energy.production, consumption: resources.energy.consumption, stock: resources.energy.stock, dependency: Math.max(0, 1-resources.energy.selfSufficiency) }),
    steel: strategicResource({ production: random.range(0.3, 2.8) * strategicScale, consumption: random.range(0.4, 2.7) * strategicScale, stock: random.range(12, 55) * strategicScale, dependency: random.range(0.12, 0.68) }),
    copper: strategicResource({ production: random.range(0.15, 2.1) * strategicScale, consumption: random.range(0.25, 2.2) * strategicScale, stock: random.range(10, 50) * strategicScale, dependency: random.range(0.12, 0.72) }),
    lithium: strategicResource({ production: random.range(0.02, 1.1) * strategicScale, consumption: random.range(0.08, 1.25) * strategicScale, stock: random.range(6, 32) * strategicScale, dependency: random.range(0.18, 0.86) }),
    food: strategicResource({ production: resources.food.production, consumption: resources.food.consumption, stock: resources.food.stock, dependency: Math.max(0, 1-resources.food.selfSufficiency) }),
    water: strategicResource({ production: random.range(1.8, 4.2) * strategicScale, consumption: random.range(1.7, 3.8) * strategicScale, stock: random.range(30, 120) * strategicScale, dependency: random.range(0.02, 0.35) })
  };

  const state = {
    code: country.iso2,
    name: country.name,
    continent: country.continent,
    center: country.center,
    populationCount,
    areaKm2,
    mode,
    dataMode: provenance?.mode || (realWorldRecord ? "REAL_WORLD" : realWorldMetadata ? "REAL_WORLD_PARTIAL" : "SCENARIO_FALLBACK"),
    strategicSimulation: true,
    scenarioData: true,
    realWorld: realWorldRecord ? structuredClone(realWorldRecord) : null,
    realWorldMetadata: realWorldMetadata ? structuredClone(realWorldMetadata) : null,
    derivedIndicators: derived ? structuredClone(derived) : null,
    provenance: provenance ? structuredClone(provenance) : { mode: "SCENARIO_FALLBACK", coverage: 0, fields: {} },
    demography,
    metrics,
    resources,
    strategicResources,
    populationDelta: 0,
    modifiers: [],
    history: [],
    lastDiagnostics: {}
  };
  updateResistancePotential(state);
  return state;
}

export function updateResistancePotential(state) {
  const m = state.metrics;
  const value =
    m.militaryReadiness.current * 0.28 +
    m.resilience.current * 0.22 +
    m.cohesion.current * 0.18 +
    m.technology.current * 0.14 +
    m.infrastructure.current * 0.10 +
    m.awareness.current * 0.08;
  const metric = m.resistancePotential;
  const previous = metric.current;
  metric.current = clamp(value);
  metric.baseline = metric.current;
  metric.trend = metric.current - previous;
}

export function validateCountryState(state) {
  if (!state?.code || !["REAL_WORLD", "REAL_WORLD_MIXED", "REAL_WORLD_ESTIMATED", "REAL_WORLD_SPECIAL", "REAL_WORLD_PARTIAL", "SCENARIO_FALLBACK", "SCENARIO"].includes(state.dataMode)) return false;
  if (!Number.isFinite(state.populationCount) || state.populationCount < 0) return false;
  for (const metricName of METRICS) {
    const m = state.metrics?.[metricName];
    if (!m || !Number.isFinite(m.current) || m.current < 0 || m.current > 100) return false;
  }
  for (const type of RESOURCE_TYPES) {
    const r = state.resources?.[type];
    if (!r || !Number.isFinite(r.stock) || r.stock < -1e-8 || r.stock > r.stockCapacity + 1e-8) return false;
  }
  for (const type of ["oil","gas","coal","uranium","electricity","steel","copper","lithium","food","water"]) {
    const r=state.strategicResources?.[type];
    if(!r||![r.production,r.consumption,r.imports,r.exports,r.stock,r.price,r.dependency].every(Number.isFinite))return false;
    if(r.stock<0||r.stock>(r.stockCapacity||Infinity)+1e-8||r.dependency<0||r.dependency>1)return false;
  }
  return true;
}
