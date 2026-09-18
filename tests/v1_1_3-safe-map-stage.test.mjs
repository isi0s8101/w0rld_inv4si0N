import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WorldProjection } from "../src/world/WorldProjection.js";
import { CountryProjection } from "../src/world/CountryProjection.js";

test("World réserve une zone latérale gauche pour le Navigator", () => {
  const projection = new WorldProjection();
  projection.resize(1650, 900);
  projection.setSafeArea({ left: 390, right: 30, top: 24, bottom: 24 });
  assert.ok(projection.layout.x >= 390, `map x=${projection.layout.x}`);
  assert.ok(projection.layout.x + projection.layout.width <= 1620.01);
});

test("Country se centre dans la zone libre à droite du Navigator", () => {
  const projection = new CountryProjection();
  projection.resize(1650, 900);
  projection.setSafeArea({ left: 390, right: 30, top: 24, bottom: 24 });
  projection.setFeature({ properties: { bounds: [-5, 41, 10, 52] } });
  const center = projection.project(46.5, 2.5);
  const expectedCenterX = 390 + (1650 - 390 - 30) / 2;
  assert.ok(Math.abs(center.x - expectedCenterX) < 0.001);
});

test("App calcule la safe area depuis la taille réelle du panneau", async () => {
  const app = await readFile(new URL("../src/core/App.js", import.meta.url), "utf8");
  const visual = await readFile(new URL("../src/visual/VisualEngine.js", import.meta.url), "utf8");
  assert.match(app, /mainSafeArea\(\)/);
  assert.match(app, /panelRect\.right/);
  assert.match(app, /panelRect\.bottom/);
  assert.match(app, /setMainSafeArea\(this\.mainSafeArea\(\)\)/);
  assert.match(visual, /setMainSafeArea\(insets/);
  assert.match(visual, /projections\.world\.setSafeArea/);
  assert.match(visual, /projections\.country\.setSafeArea/);
});
