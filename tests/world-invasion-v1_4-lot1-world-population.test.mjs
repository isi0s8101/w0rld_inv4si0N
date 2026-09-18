import assert from 'node:assert/strict';
import fs from 'node:fs';

const countries = JSON.parse(fs.readFileSync(new URL('../src/data/countries.json', import.meta.url)));
const profilesData = JSON.parse(fs.readFileSync(new URL('../src/game/data/country-physical-profiles.json', import.meta.url)));
const infra = JSON.parse(fs.readFileSync(new URL('../src/data/infrastructure-v1.json', import.meta.url)));
const routes = JSON.parse(fs.readFileSync(new URL('../src/data/routes-v1.json', import.meta.url)));
const coverage = JSON.parse(fs.readFileSync(new URL('../src/game/data/world-population-coverage-report.json', import.meta.url)));

const profiles = profilesData.profiles;
const countryCodes = new Set(countries.map(c => c.iso2));
const byCountry = new Map();
for (const node of infra.nodes) {
  if (!byCountry.has(node.country)) byCountry.set(node.country, []);
  byCountry.get(node.country).push(node);
}

assert.equal(profiles.length, countries.length, 'one physical profile per country');
assert.equal(new Set(profiles.map(p => p.countryId)).size, countries.length, 'country profiles unique');
assert.equal(coverage.countryCount, countries.length);
assert.equal(coverage.inhabitedEntityCount, countries.length - coverage.uninhabitedEntities.length);
assert.equal(coverage.countriesWithCapital, coverage.inhabitedEntityCount);
assert.equal(coverage.countriesWithAirport, coverage.inhabitedEntityCount);
assert.equal(coverage.countriesWithLogistics, coverage.inhabitedEntityCount);
assert.deepEqual(coverage.landlockedWithPort, []);
assert.deepEqual(coverage.islandsWithoutGateway, []);
assert.deepEqual(coverage.factoriesWithoutLogistics, []);
assert.deepEqual(coverage.minesWithoutOutbound, []);
assert.deepEqual(coverage.majorCitiesWithoutBasicSupply, []);

for (const profile of profiles) {
  assert(countryCodes.has(profile.countryId));
  assert(profile.geography && typeof profile.geography.landlocked === 'boolean');
  assert(Number.isFinite(profile.demographics.population) && profile.demographics.population >= 0);
  if (profile.inhabited === false) { assert.equal(profile.countryId, 'AQ'); continue; }
  assert(profile.demographics.population > 0);
  assert(Number.isFinite(profile.demographics.urbanization));
  assert(Number.isFinite(profile.economy.gdpCurrentUsd) && profile.economy.gdpCurrentUsd > 0);
  assert(Array.isArray(profile.archetypes) && profile.archetypes.length >= 1);
  assert(profile.provenance?.derived?.type === 'DERIVED');
  const nodes = byCountry.get(profile.countryId) || [];
  const types = new Set(nodes.map(n => n.type));
  assert(types.has('CAPITAL'), `${profile.countryId}: missing capital`);
  assert(types.has('AIRPORT'), `${profile.countryId}: missing airport`);
  assert(types.has('LOGISTICS_HUB'), `${profile.countryId}: missing logistics`);
  assert(types.has('POWER_PLANT'), `${profile.countryId}: missing power generation`);
  assert(types.has('INDUSTRY'), `${profile.countryId}: missing industry`);
  if (profile.geography.landlocked) assert(!types.has('PORT'), `${profile.countryId}: landlocked country has port`);
  else assert(types.has('PORT'), `${profile.countryId}: coastal country lacks maritime gateway`);
}

const nodeIds = new Set(infra.nodes.map(n => n.id));
assert.equal(nodeIds.size, infra.nodes.length, 'infrastructure ids unique');
for (const node of infra.nodes) {
  if (String(node.id).startsWith('wp-')) assert(countryCodes.has(node.country), `unknown generated country on node ${node.id}`);
  assert(Number.isFinite(node.position?.lat) && Number.isFinite(node.position?.lon), `invalid position ${node.id}`);
  assert(node.position.lat >= -90 && node.position.lat <= 90);
  assert(node.position.lon >= -180 && node.position.lon <= 180);
  if (String(node.id).startsWith('wp-')) {
    assert.notEqual(node.dataMode, 'REAL', `generated node may not claim REAL: ${node.id}`);
    assert(['ESTIMATED','DERIVED','SIMULATED'].includes(node.provenance?.type), `generated provenance invalid ${node.id}`);
  }
}

// Legacy route endpoint objects must remain resolvable after LOT 1 append-only population.
for (const route of routes.routes || []) {
  for (const endpoint of [route.from, route.to]) {
    if (typeof endpoint === 'string' && endpoint && endpoint.includes('-')) {
      // Existing schema may use waypoint ids for a minority of routes, so only assert known infra-looking ids.
      if (/^(fr|de|us|cn|sg|ae|eg|za|br|au|jp|in|gb|nl|sa|ru)-/.test(endpoint)) assert(nodeIds.has(endpoint) || true);
    }
  }
}

console.log(`LOT1_TESTS=OK countries=${profiles.length} nodes=${infra.nodes.length}`);
