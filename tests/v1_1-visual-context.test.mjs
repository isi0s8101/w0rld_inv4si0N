import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WorldEngine } from "../src/world/WorldEngine.js";

async function load(path) { return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")); }

test("matière continentale V1.1 expose primary/secondary/dust avec rythmes individuels", async () => {
  const [world, countries, cities] = await Promise.all([
    load("../src/data/world.geojson"), load("../src/data/countries.json"), load("../src/data/cities.json")
  ]);
  const engine = new WorldEngine();
  engine.geojson = world; engine.features = world.features; engine.countries = countries; engine.cities = cities;
  engine.byCode = new Map(world.features.map((feature) => [feature.properties.iso2, feature]));
  const points = engine.terrainPoints(3200);
  const layers = new Set(points.map((point) => point.layer));
  assert.deepEqual([...layers].sort(), ["dust", "primary", "secondary"]);
  assert.ok(points.every((point) => Number.isFinite(point.phase) && Number.isFinite(point.speed) && Number.isFinite(point.baseAlpha) && Number.isFinite(point.reveal)));
  assert.ok(points.some((point) => point.edge > 0.7), "renfort côtier attendu");
  assert.ok(points.some((point) => point.urban > 0.5), "renfort urbain attendu");
});

test("métadonnées de focus couvrent la carte sans valeurs inventées", async () => {
  const [meta, countries] = await Promise.all([load("../src/data/country-meta.json"), load("../src/data/countries.json")]);
  assert.equal(meta.length, countries.length);
  assert.equal(new Set(meta.map((entry) => entry.iso2)).size, countries.length);
  assert.ok(meta.filter((entry) => entry.capital).length >= 165);
  assert.ok(meta.filter((entry) => Number.isFinite(entry.areaKm2)).length >= 165);
  assert.ok(meta.filter((entry) => Array.isArray(entry.ianaTimezones) && entry.ianaTimezones.length).length >= 170);
  const france = meta.find((entry) => entry.iso2 === "FR");
  assert.equal(france?.capital, "Paris");
  assert.ok(france?.source?.includes("local snapshot"));
});

test("grille géographique fragmentée est commune et réagit aux scans", async () => {
  const source = await readFile(new URL("../src/visual/GridRenderer.js", import.meta.url), "utf8");
  assert.match(source, /kind:\s*"lat"/);
  assert.match(source, /kind:\s*"lon"/);
  assert.match(source, /SCAN_STARTED/);
  assert.match(source, /scanBoost/);
  assert.match(source, /mode === "country"/);
});

test("sélection enrichie combine lumière intérieure, coastline et révélation de matière", async () => {
  const [visual, particle, coast] = await Promise.all([
    readFile(new URL("../src/visual/VisualEngine.js", import.meta.url), "utf8"),
    readFile(new URL("../src/visual/ParticleRenderer.js", import.meta.url), "utf8"),
    readFile(new URL("../src/visual/CoastlineRenderer.js", import.meta.url), "utf8")
  ]);
  assert.match(visual, /CountryFillRenderer/);
  assert.match(visual, /countryFill\.render/);
  assert.match(particle, /selectionReveal/);
  assert.match(particle, /neighbors/);
  assert.match(coast, /coastStrong/);
  assert.match(coast, /shadowBlur/);
});

test("Navigator + Focus Panel est agrandi, encadré et alimenté par le moteur", async () => {
  const [app, css, panel] = await Promise.all([
    readFile(new URL("../src/core/App.js", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../src/ui/FocusPanel.js", import.meta.url), "utf8")
  ]);
  assert.match(app, /NAVIGATOR/);
  assert.match(app, /FocusPanel/);
  assert.match(css, /\.cyber-mini-nav\s*\{[\s\S]*width:\s*326px/);
  assert.match(css, /\.cyber-mini-frame/);
  assert.match(panel, /getCountryMeta/);
  assert.match(panel, /getActive/);
  assert.match(panel, /POP\. SNAPSHOT/);
  assert.match(panel, /ENGINE/);
});
