import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RealWorldDataStore } from "../src/game/realworld/RealWorldDataStore.js";
import { WorldEngine } from "../src/world/WorldEngine.js";
import { WorldSimulation } from "../src/game/simulation/WorldSimulation.js";

const load = (path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);
const REQUIRED = ["population","populationGrowthAnnualPct","netMigration","gdpCurrentUsd","gdpPerCapitaUsd","gdpGrowthAnnualPct","tradePctGdp","importsPctGdp","exportsPctGdp","electricityAccessPct"];

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

test("V0.4 fournit les dix indicateurs de départ pour 175/175 pays", async () => {
  const [dataset, countries] = await Promise.all([load("../src/game/data/real-world-baseline.json"), load("../src/data/countries.json")]);
  assert.equal(dataset.schemaVersion, 3);
  assert.equal(Object.keys(dataset.countries).length, 175);
  for (const country of countries) {
    const record = dataset.countries[country.iso2];
    assert.ok(record, country.iso2);
    assert.deepEqual(Object.keys(record), REQUIRED, country.iso2);
    for (const field of REQUIRED) {
      const entry = record[field];
      assert.ok(Number.isFinite(entry.value), `${country.iso2}.${field}`);
      assert.ok(entry.source && entry.dataClass, `${country.iso2}.${field} provenance`);
      assert.ok(entry.confidence >= 0 && entry.confidence <= 1, `${country.iso2}.${field} confidence`);
    }
  }
});

test("les estimations ne sont jamais exposées comme REAL", async () => {
  const dataset = await load("../src/game/data/real-world-baseline.json");
  const india = dataset.countries.IN;
  assert.match(india.gdpCurrentUsd.dataClass, /^ESTIMATED/);
  assert.notEqual(india.gdpCurrentUsd.source, "worldBank");
  assert.equal(dataset.countries.FR.population.dataClass, "REAL");
  assert.equal(dataset.countries.FR.population.source, "worldBank");
});

test("couverture détaille champs réels et estimés", async () => {
  const snapshot = await load("../src/game/data/real-world-start-snapshot.json");
  const store = new RealWorldDataStore().loadStartSnapshot(snapshot);
  const coverage = store.coverage(175);
  assert.equal(coverage.completeBaselineCountries, 175);
  assert.equal(coverage.fieldCoverage.population.countries, 175);
  assert.equal(coverage.fieldCoverage.gdpCurrentUsd.countries, 175);
  assert.ok(coverage.fieldClassCounts.real > 0);
  assert.ok(coverage.fieldClassCounts.estimated > coverage.fieldClassCounts.real);
  assert.equal(store.getProvenance("FR").fields.population.dataClass, "REAL");
  assert.match(store.getProvenance("IN").fields.population.dataClass, /^ESTIMATED/);
});

test("métadonnées manquantes sont complétées et explicitement classifiées", async () => {
  const metadata = await load("../src/game/data/real-world-objective-metadata.json");
  for (const code of ["GB","MM","ME","XK","PS","AQ"]) {
    const entry = metadata.countries[code];
    assert.ok(Number.isFinite(entry.areaKm2), `${code}.area`);
    assert.ok(Number.isFinite(entry.populationSnapshot), `${code}.population`);
    assert.ok(entry.dataClass, `${code}.dataClass`);
  }
  assert.equal(metadata.countries.GB.capital, "London");
  assert.equal(metadata.countries.AQ.populationSnapshot, 0);
});

test("baseline estimée reste déterministe et stable sur dix ans", async () => {
  const snapshot = await load("../src/game/data/real-world-start-snapshot.json");
  const store = new RealWorldDataStore().loadStartSnapshot(snapshot);
  const world = await makeWorldEngine();
  const a = new WorldSimulation({ seed: 4096, worldEngine: world, realWorldDataStore: store, mode: "REAL_WORLD" }).init();
  const b = new WorldSimulation({ seed: 4096, worldEngine: world, realWorldDataStore: store, mode: "REAL_WORLD" }).init();
  assert.equal(a.getCountry("IN").populationCount, b.getCountry("IN").populationCount);
  a.step(3650); b.step(3650);
  assert.equal(a.getCountry("IN").populationCount, b.getCountry("IN").populationCount);
  assert.equal(a.getCountry("IN").metrics.economy.current, b.getCountry("IN").metrics.economy.current);
  assert.equal(a.validate(), true);
});
