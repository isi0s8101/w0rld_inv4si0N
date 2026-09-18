import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const infra = JSON.parse(fs.readFileSync(new URL('../src/data/infrastructure-v1.json', import.meta.url), 'utf8'));
const routes = JSON.parse(fs.readFileSync(new URL('../src/data/routes-v1.json', import.meta.url), 'utf8'));
const mobile = JSON.parse(fs.readFileSync(new URL('../src/data/mobile-entities-v1.json', import.meta.url), 'utf8'));

test('Update 1 possède un Infrastructure Graph exploitable', () => {
  assert.ok(infra.nodes.length >= 40);
  assert.equal(new Set(infra.nodes.map((n) => n.id)).size, infra.nodes.length);
  assert.ok(infra.nodes.some((n) => n.type === 'PORT' && n.minView === 'GLOBE'));
  assert.ok(infra.nodes.some((n) => n.type === 'CAPITAL'));
  assert.ok(infra.nodes.some((n) => n.type === 'GROUND_STATION'));
});

test('Route Engine V1 couvre les sept graphes prévus', () => {
  const types = new Set(routes.routes.map((r) => r.type));
  for (const type of ['SEA_ROUTE','AIR_ROUTE','ROAD_ROUTE','RAIL_ROUTE','PIPELINE_ROUTE','DIGITAL_ROUTE','ORBITAL_ROUTE']) assert.ok(types.has(type), type);
  assert.ok(routes.routes.every((r) => Array.isArray(r.waypoints)));
});

test('Les objets mobiles suivent tous une route déclarée', () => {
  const routeIds = new Set(routes.routes.map((r) => r.id));
  assert.deepEqual(new Set(mobile.entities.map((e) => e.type)), new Set(['SHIP','AIRCRAFT','TRUCK','DRONE','SUBMARINE']));
  assert.ok(mobile.entities.every((e) => routeIds.has(e.route)));
});
