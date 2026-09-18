import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RealWorldDataStore } from "../src/game/realworld/RealWorldDataStore.js";

const load = (path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);

test("snapshot de départ REAL_WORLD est figé localement pour 175 pays", async () => {
  const snapshot = await load("../src/game/data/real-world-start-snapshot.json");
  assert.equal(snapshot.mode, "REAL_WORLD_START_SNAPSHOT");
  assert.equal(snapshot.offlineReady, true);
  assert.equal(snapshot.coverage.hardcodedCountries, 175);
  assert.equal(Object.keys(snapshot.metadata.countries).length, 175);
  assert.ok(snapshot.coverage.populationSnapshotCountries >= 169);
  assert.ok(snapshot.coverage.timeSeriesCountries >= 5);
});

test("RealWorldDataStore charge le snapshot sans transformer les métadonnées en séries", async () => {
  const snapshot = await load("../src/game/data/real-world-start-snapshot.json");
  const store = new RealWorldDataStore();
  store.loadStartSnapshot(snapshot);
  assert.equal(store.getStartSnapshotInfo().offlineReady, true);
  assert.equal(store.getSimulationStartDate(), "2025-01-01");
  assert.equal(store.metadataByCode.size, 175);
  assert.equal(store.byCode.size, 175);
  assert.equal(store.getProvenance("FR").mode, "REAL_WORLD_MIXED");
  assert.equal(store.getProvenance("GB").mode, "REAL_WORLD_ESTIMATED");
});

test("le runtime REAL_WORLD ne dépend pas d'une URL World Bank distante", async () => {
  const source = await readFile(new URL("../src/game/realworld/RealWorldDataStore.js", import.meta.url), "utf8");
  assert.match(source, /real-world-start-snapshot\.json/);
  assert.doesNotMatch(source, /api\.worldbank\.org/);
});
