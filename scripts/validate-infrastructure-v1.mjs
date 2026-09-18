import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const infra = read('src/data/infrastructure-v1.json');
const routes = read('src/data/routes-v1.json');
const mobile = read('src/data/mobile-entities-v1.json');
const icons = read('src/data/infrastructure-icon-catalog.json');
const errors = [];
const ids = new Set();
const requiredTypes = ['PORT','AIRPORT','POWER_PLANT','POWER_GRID','REFINERY','INDUSTRY','LOGISTICS_HUB','DATACENTER','IXP','CABLE_LANDING','RADAR','AIRBASE','NAVAL_BASE','ARSENAL','PIPELINE_NODE','MINE','DAM','BRIDGE','CHOKEPOINT','CAPITAL','SPACEPORT','CITY','MILITARY_BASE','GROUND_STATION','RAIL_HUB','HOSPITAL','ROAD_HUB','ENERGY_STORAGE','COMMAND_CENTER'];
const statuses = new Set(['OPERATIONAL','DEGRADED','DISRUPTED','CRITICAL','OFFLINE','DESTROYED']);
for (const n of infra.nodes || []) {
  if (!n.id || ids.has(n.id)) errors.push(`node id invalide/dupliqué: ${n.id}`); ids.add(n.id);
  if (!Number.isFinite(n.position?.lat) || !Number.isFinite(n.position?.lon)) errors.push(`position invalide: ${n.id}`);
  if (!statuses.has(n.status)) errors.push(`status invalide: ${n.id}/${n.status}`);
  if (!(n.type in icons) && !['HOSPITAL','ROAD_HUB','ENERGY_STORAGE','COMMAND_CENTER'].includes(n.type)) errors.push(`icône absente: ${n.id}/${n.type}`);
  for (const dep of n.dependencies || []) if (!infra.nodes.some((x) => x.id === dep)) errors.push(`dependency inconnue: ${n.id}->${dep}`);
}
for (const type of requiredTypes) if (!(infra.nodes || []).some((n) => n.type === type)) errors.push(`type requis absent: ${type}`);
const routeIds = new Set();
const routeTypes = new Set();
for (const r of routes.routes || []) {
  if (!r.id || routeIds.has(r.id)) errors.push(`route id invalide/dupliqué: ${r.id}`); routeIds.add(r.id); routeTypes.add(r.type);
  if (!ids.has(r.from) || !ids.has(r.to)) errors.push(`route endpoint inconnu: ${r.id}`);
  if (!Array.isArray(r.waypoints)) errors.push(`waypoints invalides: ${r.id}`);
}
for (const type of ['SEA_ROUTE','AIR_ROUTE','ROAD_ROUTE','RAIL_ROUTE','PIPELINE_ROUTE','DIGITAL_ROUTE','ORBITAL_ROUTE']) if (!routeTypes.has(type)) errors.push(`graphe de route absent: ${type}`);
for (const e of mobile.entities || []) if (!routeIds.has(e.route)) errors.push(`mobile route inconnue: ${e.id}->${e.route}`);
for (const [type, rel] of Object.entries(icons)) {
  const disk = path.join(root, rel.replace(/^\.\//, ''));
  if (!fs.existsSync(disk)) errors.push(`fichier icône absent: ${type} -> ${rel}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`INFRASTRUCTURE_V1=OK nodes=${infra.nodes.length} routes=${routes.routes.length} mobile=${mobile.entities.length} icons=${Object.keys(icons).length}`);
