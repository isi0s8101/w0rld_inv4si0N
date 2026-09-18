import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WorldEngine } from "../src/world/WorldEngine.js";
import { RealWorldDataStore } from "../src/game/realworld/RealWorldDataStore.js";
import { IndicatorDeriver } from "../src/game/realworld/IndicatorDeriver.js";
import { WorldSimulation } from "../src/game/simulation/WorldSimulation.js";

async function load(path) { return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")); }

async function makeWorldEngine() {
  const [world, countries, regions, cities, meta] = await Promise.all([
    load("../src/data/world.geojson"), load("../src/data/countries.json"), load("../src/data/regions.json"), load("../src/data/cities.json"), load("../src/data/country-meta.json")
  ]);
  const engine = new WorldEngine();
  engine.geojson = world; engine.features = world.features; engine.countries = countries; engine.regions = regions; engine.cities = cities; engine.countryMeta = meta;
  engine.byCode = new Map(world.features.map((feature) => [feature.properties.iso2, feature]));
  engine.regionById = new Map(regions.map((region) => [region.id, region]));
  engine.metaByCode = new Map(meta.map((entry) => [entry.iso2, entry]));
  return engine;
}

async function realStore() {
  const dataset = await load("../src/game/data/real-world-baseline.json");
  return new RealWorldDataStore().load(dataset);
}

test("dataset REAL WORLD pilote conserve source, date, indicateur et confiance", async () => {
  const store = await realStore();
  assert.equal(store.validate(), true);
  assert.equal(store.coverage(175).completeBaselineCountries, 175);
  assert.equal(store.coverage(175).realWorldCountries, 5);
  const france = store.get("FR");
  assert.equal(france.population.value, 68551653);
  assert.equal(france.population.referenceYear, 2024);
  assert.equal(france.population.source, "worldBank");
  assert.equal(france.population.indicator, "SP.POP.TOTL");
  assert.ok(france.population.confidence >= 0.95);
});

test("indicateurs dérivés sont transparents, bornés et séparés des données réelles", async () => {
  const store = await realStore();
  const derived = new IndicatorDeriver().derive(store.get("US"));
  for (const key of ["populationScale", "economicMass", "prosperity", "economicCapacity", "growthMomentum", "demographicMomentum"]) {
    assert.ok(Number.isFinite(derived[key]), key);
    assert.ok(derived[key] >= 0 && derived[key] <= 100, key);
  }
  assert.equal(derived.class, "DERIVED");
  assert.equal(derived.formulaVersion, 2);
  assert.equal(derived.dataClass, "DERIVED_FROM_REAL");
});

test("REAL_WORLD utilise les données réelles disponibles et marque explicitement le fallback", async () => {
  const worldEngine = await makeWorldEngine();
  const store = await realStore();
  const sim = new WorldSimulation({ seed: 42, worldEngine, realWorldDataStore: store, mode: "REAL_WORLD" }).init();
  const france = sim.getCountry("FR");
  assert.equal(france.dataMode, "REAL_WORLD_MIXED");
  assert.equal(france.populationCount, 68551653);
  assert.equal(france.metrics.population.dataClass, "DERIVED_FROM_REAL");
  assert.equal(france.provenance.fields.population.dataClass, "REAL");
  assert.ok(france.provenance.classCounts.real >= 6);
  const india = sim.getCountry("IN");
  assert.equal(india.dataMode, "REAL_WORLD_ESTIMATED");
  assert.equal(india.provenance.fields.gdpCurrentUsd.dataClass, "ESTIMATED_MODEL");
  assert.ok(india.realWorld);
});

test("SCENARIO ignore le dataset réel même s'il est fourni", async () => {
  const worldEngine = await makeWorldEngine();
  const store = await realStore();
  const sim = new WorldSimulation({ seed: 42, worldEngine, realWorldDataStore: store, mode: "SCENARIO" }).init();
  assert.equal(sim.getCountry("FR").dataMode, "SCENARIO");
  assert.equal(sim.getCountry("FR").realWorld, null);
  assert.equal(sim.dataCoverage().realWorldCountries, 0);
});

test("démographie réelle pilote fait évoluer population sans casser le déterminisme", async () => {
  const worldEngine = await makeWorldEngine();
  const store = await realStore();
  const a = new WorldSimulation({ seed: 91, worldEngine, realWorldDataStore: store, mode: "REAL_WORLD" }).init();
  const b = new WorldSimulation({ seed: 91, worldEngine, realWorldDataStore: store, mode: "REAL_WORLD" }).init();
  const before = a.getCountry("FR").populationCount;
  a.step(365); b.step(365);
  assert.notEqual(a.getCountry("FR").populationCount, before);
  assert.equal(a.getCountry("FR").populationCount, b.getCountry("FR").populationCount);
  assert.equal(a.validate(), true);
});

test("API/UI exposent la couverture et distinguent REAL, DERIVED et SIM", async () => {
  const [api, focus, app] = await Promise.all([
    readFile(new URL("../src/game/GameAPI.js", import.meta.url), "utf8"),
    readFile(new URL("../src/ui/FocusPanel.js", import.meta.url), "utf8"),
    readFile(new URL("../src/core/App.js", import.meta.url), "utf8")
  ]);
  assert.match(api, /getDataCoverage/);
  assert.match(api, /getCountryProvenance/);
  assert.match(focus, /POP · \${tag\("population"\)}/);
  assert.match(focus, /ECONOMY ·/);
  assert.match(focus, /STABILITY · SIM/);
  assert.match(app, /RealWorldDataStore/);
  assert.match(app, /gameMode/);
});
