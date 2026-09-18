import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RealWorldDataStore } from "../src/game/realworld/RealWorldDataStore.js";
import { WorldBankImporter, WORLD_BANK_INDICATORS } from "../src/game/realworld/WorldBankImporter.js";
import { WorldEngine } from "../src/world/WorldEngine.js";
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

test("métadonnées objectives couvrent les 175 pays sans les présenter comme séries courantes", async () => {
  const [baseline, metadata, countries] = await Promise.all([
    load("../src/game/data/real-world-baseline.json"), load("../src/game/data/real-world-objective-metadata.json"), load("../src/data/countries.json")
  ]);
  const store = new RealWorldDataStore().load(baseline, metadata);
  const coverage = store.coverage(countries.length);
  assert.equal(coverage.objectiveMetadataCountries, 175);
  assert.equal(coverage.timeSeriesCountries, 175);
  assert.equal(coverage.completeBaselineCountries, 175);
  assert.equal(store.getMetadata("FR").dataClass, "REAL_METADATA_UNDATED");
  assert.equal(store.getProvenance("IN").mode, "REAL_WORLD_ESTIMATED");
  assert.equal(store.getProvenance("FR").mode, "REAL_WORLD_MIXED");
});

test("WorldBankImporter filtre les agrégats, mappe les indicateurs et conserve l'année", async () => {
  const fixture = await load("./fixtures/world-bank-sample.json");
  const importer = new WorldBankImporter({ fetchImpl: async () => ({ ok: true, json: async () => fixture }) });
  const parsed = importer.parse(fixture, ["FR", "DE"]);
  assert.equal(parsed.sourceLastUpdated, "2026-07-13");
  assert.equal(parsed.countries.FR.population.value, 68700000);
  assert.equal(parsed.countries.FR.population.referenceYear, 2025);
  assert.equal(parsed.countries.FR.gdpCurrentUsd.indicator, WORLD_BANK_INDICATORS.gdpCurrentUsd);
  assert.equal(parsed.countries.FR.electricityAccessPct.value, 100);
  assert.equal(parsed.countries.ZH, undefined);
});

test("sync World Bank est batché et produit un dataset schema v2", async () => {
  const fixture = await load("./fixtures/world-bank-sample.json");
  const urls = [];
  const importer = new WorldBankImporter({ batchSize: 1, fetchImpl: async (url) => { urls.push(url); return { ok: true, json: async () => fixture }; } });
  const synced = await importer.sync(["FR", "DE"]);
  const dataset = importer.buildDataset({ ...synced, retrievedAt: "2026-09-13", targetCount: 2 });
  assert.equal(urls.length, 2);
  assert.equal(dataset.schemaVersion, 2);
  assert.equal(dataset.sync.targetCountries, 2);
  assert.equal(dataset.sources.worldBank.sourceLastUpdated, "2026-07-13");
});

test("simulation REAL_WORLD_ESTIMATED reste explicite et déterministe", async () => {
  const [baseline, metadata] = await Promise.all([load("../src/game/data/real-world-baseline.json"), load("../src/game/data/real-world-objective-metadata.json")]);
  const store = new RealWorldDataStore().load(baseline, metadata);
  const worldEngine = await makeWorldEngine();
  const a = new WorldSimulation({ seed: 44, worldEngine, realWorldDataStore: store, mode: "REAL_WORLD" }).init();
  const b = new WorldSimulation({ seed: 44, worldEngine, realWorldDataStore: store, mode: "REAL_WORLD" }).init();
  const india = a.getCountry("IN");
  assert.equal(india.dataMode, "REAL_WORLD_ESTIMATED");
  assert.ok(india.realWorld);
  assert.equal(india.realWorldMetadata.dataClass, "REAL_METADATA_UNDATED");
  a.step(90); b.step(90);
  assert.equal(a.getCountry("IN").metrics.economy.current, b.getCountry("IN").metrics.economy.current);
  assert.equal(a.validate(), true);
});
