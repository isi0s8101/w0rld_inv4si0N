import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SeededRandom } from "../src/game/SeededRandom.js";
import { GameClock } from "../src/game/GameClock.js";
import { WorldEngine } from "../src/world/WorldEngine.js";
import { WorldSimulation } from "../src/game/simulation/WorldSimulation.js";
import { METRICS, RESOURCE_TYPES } from "../src/game/simulation/constants.js";

async function load(path) { return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")); }

async function makeWorldEngine() {
  const [world, countries, regions, cities, meta] = await Promise.all([
    load("../src/data/world.geojson"),
    load("../src/data/countries.json"),
    load("../src/data/regions.json"),
    load("../src/data/cities.json"),
    load("../src/data/country-meta.json")
  ]);
  const engine = new WorldEngine();
  engine.geojson = world;
  engine.features = world.features;
  engine.countries = countries;
  engine.regions = regions;
  engine.cities = cities;
  engine.countryMeta = meta;
  engine.byCode = new Map(world.features.map((feature) => [feature.properties.iso2, feature]));
  engine.regionById = new Map(regions.map((region) => [region.id, region]));
  engine.metaByCode = new Map(meta.map((entry) => [entry.iso2, entry]));
  return engine;
}

test("SeededRandom et GameClock rendent la simulation reproductible et pilotable", () => {
  const a = new SeededRandom(101), b = new SeededRandom(101), c = new SeededRandom(102);
  const seqA = Array.from({ length: 8 }, () => a.next());
  const seqB = Array.from({ length: 8 }, () => b.next());
  const seqC = Array.from({ length: 8 }, () => c.next());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  const clock = new GameClock({ speed: 5, daysPerSecond: 1 });
  assert.equal(clock.consume(0.4), 2);
  clock.advance(2);
  assert.equal(clock.date(), "2048-01-03");
  assert.equal(clock.setSpeed(10), true);
  assert.equal(clock.setSpeed(3), false);
});

test("la simulation initialise 175 pays avec métriques stratégiques et ressources bornées", async () => {
  const worldEngine = await makeWorldEngine();
  const sim = new WorldSimulation({ seed: 1849237, worldEngine }).init();
  assert.equal(sim.states.size, 175);
  for (const state of sim.states.values()) {
    assert.equal(state.scenarioData, true);
    for (const name of METRICS) {
      const metric = state.metrics[name];
      assert.ok(metric, `${state.code}:${name}`);
      assert.ok(metric.current >= 0 && metric.current <= 100);
      assert.ok(Number.isFinite(metric.baseline));
      assert.ok(Number.isFinite(metric.trend));
      assert.ok(Number.isFinite(metric.pressure));
      assert.ok(Number.isFinite(metric.recoveryRate));
    }
    for (const type of RESOURCE_TYPES) {
      const resource = state.resources[type];
      assert.ok(resource.productionCapacity > 0);
      assert.ok(resource.consumption > 0);
      assert.ok(resource.stock >= 0 && resource.stock <= resource.stockCapacity);
    }
  }
  assert.equal(sim.validate(), true);
});

test("RelationGraph crée un réseau mondial orienté avec transport terrestre, aérien, maritime et data", async () => {
  const worldEngine = await makeWorldEngine();
  const sim = new WorldSimulation({ seed: 77, worldEngine }).init();
  const edges = sim.relations.all();
  assert.ok(edges.length > 700);
  assert.ok(edges.every((edge) => edge.from !== edge.to && edge.scenarioData));
  assert.ok(edges.some((edge) => edge.modes.includes("LAND")));
  assert.ok(edges.some((edge) => edge.modes.includes("SEA")));
  assert.ok(edges.some((edge) => edge.modes.includes("AIR")));
  assert.ok(edges.some((edge) => edge.modes.includes("DATA_TERRESTRIAL")));
  assert.ok(edges.some((edge) => edge.modes.includes("DATA_SUBMARINE")));
  assert.ok(edges.some((edge) => edge.modes.includes("DATA_SPACE")));
  const edge = edges[0];
  for (const field of ["trade", "energyDependency", "diplomaticRelation", "alliance", "technologyDependency", "transport", "trust"]) {
    assert.ok(edge[field] >= 0 && edge[field] <= 100, field);
  }
});

test("production, consommation, stocks et flux fonctionnent sans créer de stock hors capacité", async () => {
  const worldEngine = await makeWorldEngine();
  const sim = new WorldSimulation({ seed: 456, worldEngine }).init();
  sim.step(30);
  assert.equal(sim.validate(), true);
  assert.ok(sim.getFlows().length > 0);
  assert.ok(sim.getFlows().some((flow) => ["FOOD", "ENERGY", "GOODS", "DATA"].includes(flow.type)));
  const summary = sim.globalSummary();
  assert.equal(summary.day, 30);
  assert.ok(Number.isFinite(summary.economy));
  for (const state of sim.states.values()) {
    for (const resource of Object.values(state.resources)) {
      assert.ok(resource.stock >= 0);
      assert.ok(resource.stock <= resource.stockCapacity + 1e-8);
      assert.ok(resource.shortage >= 0 && resource.shortage <= 1);
      assert.ok(resource.priceIndex >= 70 && resource.priceIndex <= 190);
    }
  }
});

test("même seed + même durée produit le même monde, seed différent diverge", async () => {
  const worldEngine = await makeWorldEngine();
  const a = new WorldSimulation({ seed: 9001, worldEngine }).init();
  const b = new WorldSimulation({ seed: 9001, worldEngine }).init();
  const c = new WorldSimulation({ seed: 9002, worldEngine }).init();
  a.step(180); b.step(180); c.step(180);
  const digest = (sim) => [...sim.states.values()].slice(0, 20).map((state) => [
    state.code,
    Number(state.metrics.economy.current.toFixed(6)),
    Number(state.metrics.stability.current.toFixed(6)),
    Number(state.resources.energy.stock.toFixed(6))
  ]);
  assert.deepEqual(digest(a), digest(b));
  assert.notDeepEqual(digest(a), digest(c));
});

test("simulation longue 10 ans reste numériquement stable et bornée", async () => {
  const worldEngine = await makeWorldEngine();
  const sim = new WorldSimulation({ seed: 314159, worldEngine }).init();
  sim.step(3650);
  assert.equal(sim.validate(), true);
  const summary = sim.globalSummary();
  assert.ok(summary.economy > 5 && summary.economy < 98);
  assert.ok(summary.stability > 5 && summary.stability < 98);
  assert.ok(summary.resilience > 5 && summary.resilience < 98);
  assert.ok([...sim.states.values()].every((state) => state.history.length <= 120));
});

test("API et UI de simulation sont intégrées sans remplacer le moteur géographique", async () => {
  const [app, main, focus, css] = await Promise.all([
    readFile(new URL("../src/core/App.js", import.meta.url), "utf8"),
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../src/ui/FocusPanel.js", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8")
  ]);
  assert.match(app, /new GameEngine/);
  assert.match(app, /simulationPanel/);
  assert.match(main, /window\.WorldInvasion/);
  assert.match(focus, /DATA · REAL \/ EST \/ DERIVED/);
  assert.match(focus, /RESISTANCE · SIM/);
  assert.match(css, /\.world-sim-toolbar/);
});
