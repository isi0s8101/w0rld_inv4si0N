import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("world.geojson expose des pays ISO uniques", async () => {
  const world = await load("../src/data/world.geojson");
  assert.equal(world.type, "FeatureCollection");
  assert.ok(world.features.length >= 170);
  const codes = world.features.map(f => f.properties.iso2);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.includes("FR"));
  assert.ok(codes.includes("DE"));
});

test("nodes, cities et routes sont cohérents", async () => {
  const [nodes, cities, routes] = await Promise.all([
    load("../src/data/nodes.json"), load("../src/data/cities.json"), load("../src/data/routes.json")
  ]);
  const cityIds = new Set(cities.map(c => c.id));
  const nodeIds = new Set(nodes.map(n => n.id));
  assert.equal(nodeIds.size, nodes.length);
  for (const node of nodes) {
    assert.ok(cityIds.has(node.cityId), `ville manquante ${node.cityId}`);
    assert.ok([0,1,2].includes(node.minLod));
  }
  for (const route of routes) {
    assert.ok(nodeIds.has(route.from), `source route inconnue ${route.from}`);
    assert.ok(nodeIds.has(route.to), `destination route inconnue ${route.to}`);
  }
});


test("régions macro possèdent ids, centres et bounds", async () => {
  const regions = await load("../src/data/regions.json");
  assert.ok(regions.length >= 8);
  assert.equal(new Set(regions.map(r=>r.id)).size, regions.length);
  for (const r of regions) { assert.equal(r.center.length, 2); assert.equal(r.bounds.length, 4); }
});
