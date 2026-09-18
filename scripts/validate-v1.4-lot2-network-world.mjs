import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const network=JSON.parse(fs.readFileSync(path.join(root,'src/game/data/world-network-v1.json'),'utf8'));
const report=JSON.parse(fs.readFileSync(path.join(root,'src/game/data/world-network-coverage-report.json'),'utf8'));
const infra=JSON.parse(fs.readFileSync(path.join(root,'src/data/infrastructure-v1.json'),'utf8'));
const profiles=JSON.parse(fs.readFileSync(path.join(root,'src/game/data/country-physical-profiles.json'),'utf8'));
const nodes=new Set(infra.nodes.map(n=>n.id));
const failures=[];
if(profiles.profiles.length!==175)failures.push(`country profiles=${profiles.profiles.length}`);
if(report.inhabitedCountries!==174)failures.push(`inhabited=${report.inhabitedCountries}`);
if(report.countriesWithRoutes!==174)failures.push(`countriesWithRoutes=${report.countriesWithRoutes}`);
if(network.routes.length<4000)failures.push(`routes=${network.routes.length}`);
if(network.gateways.length<800)failures.push(`gateways=${network.gateways.length}`);
if(report.validation.errors.length)failures.push(`network errors=${report.validation.errors.length}`);
if(report.validation.warnings.length)failures.push(`network warnings=${report.validation.warnings.length}`);
for(const r of network.routes){if(!nodes.has(r.from)||!nodes.has(r.to))failures.push(`missing endpoint ${r.id}`);}
for(const p of profiles.profiles.filter(p=>p.geography?.landlocked)){if(infra.nodes.some(n=>n.country===p.countryId&&n.type==='PORT'))failures.push(`landlocked port ${p.countryId}`);}
if(failures.length){console.error('VALIDATION_V1_4_LOT2=FAIL');for(const f of failures)console.error('-',f);process.exit(1);}
console.log('VALIDATION_V1_4_LOT2=OK');
console.log(JSON.stringify({countries:report.countries,inhabited:report.inhabitedCountries,nodes:report.nodes,routes:report.routes,gateways:report.gateways,routeTypeCounts:report.routeTypeCounts,scopeCounts:report.scopeCounts},null,2));
