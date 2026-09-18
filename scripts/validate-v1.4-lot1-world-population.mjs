import fs from 'node:fs';
const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url)));
const countries = read('src/data/countries.json');
const profilesData = read('src/game/data/country-physical-profiles.json');
const infra = read('src/data/infrastructure-v1.json');
const coverage = read('src/game/data/world-population-coverage-report.json');
const errors = [];
if (profilesData.countryCount !== countries.length) errors.push(`profile count ${profilesData.countryCount} != ${countries.length}`);
if (coverage.countryCount !== countries.length) errors.push(`coverage count ${coverage.countryCount} != ${countries.length}`);
for (const key of ['landlockedWithPort','islandsWithoutGateway','factoriesWithoutLogistics','minesWithoutOutbound','majorCitiesWithoutBasicSupply']) {
  if ((coverage[key] || []).length) errors.push(`${key}: ${(coverage[key] || []).join(',')}`);
}
const ids = new Set();
for (const n of infra.nodes) {
  if (ids.has(n.id)) errors.push(`duplicate node ${n.id}`); ids.add(n.id);
  if (!Number.isFinite(n.position?.lat) || !Number.isFinite(n.position?.lon)) errors.push(`bad position ${n.id}`);
  if (String(n.id).startsWith('wp-') && n.dataMode === 'REAL') errors.push(`generated node claims REAL ${n.id}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`VALIDATION_V1_4_LOT1=OK countries=${countries.length} infrastructureNodes=${infra.nodes.length} generated=${coverage.generatedNodes}`);
