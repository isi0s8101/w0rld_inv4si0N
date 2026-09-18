import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const infra = JSON.parse(fs.readFileSync(new URL('../src/data/infrastructure-v1.json', import.meta.url)));
const profiles = JSON.parse(fs.readFileSync(new URL('../src/game/data/country-physical-profiles.json', import.meta.url)));
const network = JSON.parse(fs.readFileSync(new URL('../src/game/data/world-network-v1.json', import.meta.url)));
const report = JSON.parse(fs.readFileSync(new URL('../src/game/data/world-network-coverage-report.json', import.meta.url)));
const nodes = new Map(infra.nodes.map((n) => [n.id, n]));
const profileBy = new Map(profiles.profiles.map((p) => [p.countryId, p]));

test('LOT2 builds physical networks for every inhabited country', () => {
  assert.equal(profiles.profiles.length, 175);
  assert.equal(report.inhabitedCountries, 174);
  assert.equal(report.countriesWithRoutes, 174);
  assert.ok(network.routes.length > 4000);
  assert.ok(network.gateways.length > 800);
});

test('LOT2 exposes all required network graph types', () => {
  for (const type of ['ROAD_ROUTE','RAIL_ROUTE','POWER_ROUTE','PIPELINE_ROUTE','DIGITAL_ROUTE','AIR_ROUTE','SEA_ROUTE']) {
    assert.ok(network.routes.some((r) => r.type === type), `missing ${type}`);
  }
  for (const scope of ['DOMESTIC','INTERNATIONAL']) assert.ok(network.routes.some((r) => r.scope === scope));
});

test('international gateways cover sea, air, road, rail, pipeline and digital', () => {
  for (const type of ['SEA_GATEWAY','AIR_GATEWAY','ROAD_BORDER','RAIL_BORDER','PIPELINE_BORDER','DIGITAL_GATEWAY']) {
    assert.ok(network.gateways.some((g) => g.type === type), `missing ${type}`);
  }
});

test('landlocked countries have no national maritime gateway or port', () => {
  for (const p of profiles.profiles.filter((x) => x.geography?.landlocked)) {
    assert.equal(network.gateways.some((g) => g.country === p.countryId && g.type === 'SEA_GATEWAY'), false, `${p.countryId} sea gateway`);
    assert.equal(infra.nodes.some((n) => n.country === p.countryId && n.type === 'PORT'), false, `${p.countryId} port`);
  }
});

test('international land routes are between adjacent countries', () => {
  for (const r of network.routes.filter((x) => x.scope === 'INTERNATIONAL' && ['ROAD_ROUTE','RAIL_ROUTE'].includes(x.type))) {
    const countries=[...new Set(r.countries||[])];
    assert.equal(countries.length, 2, r.id);
    const [a,b]=countries;
    assert.ok(profileBy.get(a)?.geography?.borders?.includes(b) || profileBy.get(b)?.geography?.borders?.includes(a), `${r.id}: non-adjacent ${a}/${b}`);
  }
});

test('maritime routes only terminate on ports or chokepoints', () => {
  for (const r of network.routes.filter((x) => x.type === 'SEA_ROUTE')) {
    assert.ok(['PORT','CHOKEPOINT'].includes(nodes.get(r.from)?.type), `${r.id}: bad from`);
    assert.ok(['PORT','CHOKEPOINT'].includes(nodes.get(r.to)?.type), `${r.id}: bad to`);
  }
});

test('major maritime chokepoints are explicit nodes', () => {
  for (const id of ['eg-suez','pa-panama','om-hormuz','my-malacca','tr-bosporus','ye-bab-el-mandeb','es-gibraltar']) assert.ok(nodes.has(id), id);
});

test('all routes have valid endpoints and physical timing/capacity', () => {
  for (const r of network.routes) {
    assert.ok(nodes.has(r.from), r.id);
    assert.ok(nodes.has(r.to), r.id);
    assert.ok(r.distanceKm > 0, r.id);
    assert.ok(r.travelTimeHours > 0, r.id);
    assert.ok(r.maxCapacity > 0, r.id);
  }
});

test('coverage validator is clean', () => {
  assert.deepEqual(report.validation.errors, []);
  assert.deepEqual(report.validation.warnings, []);
});
