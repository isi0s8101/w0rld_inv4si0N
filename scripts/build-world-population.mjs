import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const write = (p, v) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + '\n');

const countries = read('src/data/countries.json');
const meta = read('src/data/country-meta.json');
const world = read('src/data/world.geojson');
const real = read('src/game/data/real-world-baseline.json');
const infra = read('src/data/infrastructure-v1.json');

const metaBy = new Map(meta.map((c) => [c.iso2, c]));
const featureBy = new Map(world.features.map((f) => [f.properties.iso2, f]));

// Curated geography flags. These are structural geography facts, not gameplay values.
const LANDLOCKED = new Set('AD AF AM AT AZ BF BI BO BT BW BY CF CH CZ ET HU KG KZ LA LS LI LU MD MK ML MN MW NE NP RW RS SK SZ TD TJ TM UG UZ VA ZM ZW'.split(' '));
const ISLAND = new Set('AG BS BB BH BN CV KM CY DM FJ GD IS ID IE JM JP KI MG MV MT MH MU FM NR NZ PW PG PH KN LC VC WS SC SG SB LK ST TL TO TT TV GB VU'.split(' '));
const ENERGY_EXPORTERS = new Set('AE SA QA KW OM BH RU NO DZ LY NG AO AZ KZ TM IQ IR VE GQ GA'.split(' '));
const RESOURCE_EXPORTERS = new Set('AU BR CA CL CD PE ZA BW ZM GN LR MR ML NE GH ID PG MN KZ BO'.split(' '));
const MANUFACTURING = new Set('CN DE JP KR US MX CZ PL SK HU VN TH MY TR IT FR ES IN BD'.split(' '));
const REGIONAL_TRANSIT = new Set('SG NL BE AE TR EG PA MA PL KZ KE ZA MY TH HU AT CH RS'.split(' '));
const SERVICE_HUB = new Set('SG LU CH IE GB NL AE QA HK MT CY MU'.split(' '));

function clamp(v, lo=0, hi=1){ return Math.max(lo, Math.min(hi, v)); }
function round(v, n=3){ const p=10**n; return Math.round(v*p)/p; }
function fnv1a(str){ let h=2166136261; for(const ch of str){ h ^= ch.charCodeAt(0); h = Math.imul(h,16777619); } return h>>>0; }
function rng(seed){ let s=seed>>>0; return () => { s += 0x6D2B79F5; let t=s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function valueOf(code, key, fallback=null){ const x=real.countries?.[code]?.[key]; return Number.isFinite(x?.value) ? x.value : fallback; }
function prov(code, key, fallbackSource, fallbackConfidence=0.55){ const x=real.countries?.[code]?.[key]; if(x && Number.isFinite(x.value)) return { type: String(x.dataClass || 'REAL').startsWith('REAL')?'REAL':String(x.dataClass||'ESTIMATED').startsWith('ESTIMATED')?'ESTIMATED':'DERIVED', source:x.source||'real-world-baseline', referenceDate:String(x.referenceYear||real.retrievedAt||''), retrievedAt:real.retrievedAt||null, confidence:typeof x.confidence==='number'?x.confidence:0.8, methodology:x.method||null };
  return { type:'ESTIMATED', source:fallbackSource, referenceDate:null, retrievedAt:null, confidence:fallbackConfidence, methodology:'world-population-v1-fallback' };
}

function flattenRings(geom){
  if(!geom) return [];
  if(geom.type==='Polygon') return geom.coordinates.map(r=>r);
  if(geom.type==='MultiPolygon') return geom.coordinates.flatMap(p=>p.map(r=>r));
  return [];
}
function pointInRing([x,y], ring){ let inside=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++) { const [xi,yi]=ring[i], [xj,yj]=ring[j]; const hit=((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi); if(hit) inside=!inside; } return inside; }
function pointInFeature(pt, feature){
  const g=feature?.geometry; if(!g) return false;
  if(g.type==='Polygon'){ if(!pointInRing(pt,g.coordinates[0])) return false; return !g.coordinates.slice(1).some(r=>pointInRing(pt,r)); }
  if(g.type==='MultiPolygon') return g.coordinates.some(poly => pointInRing(pt,poly[0]) && !poly.slice(1).some(r=>pointInRing(pt,r)));
  return false;
}
function randomPoint(code, salt, preferBoundary=false){
  const c=countries.find(x=>x.iso2===code); const f=featureBy.get(code); const rr=rng(fnv1a(code+':'+salt));
  const b=(c?.focusBounds||c?.bounds||[-10,-10,10,10]).slice();
  if(preferBoundary && f){
    const rings=flattenRings(f.geometry).filter(r=>r.length>3); if(rings.length){ const ring=rings[Math.floor(rr()*rings.length)]; const p=ring[Math.floor(rr()*Math.max(1,ring.length-1))]; if(p) return {lat:round(p[1],5),lon:round(p[0],5)}; }
  }
  for(let i=0;i<140;i++){
    const lon=b[0]+rr()*(b[2]-b[0]); const lat=b[1]+rr()*(b[3]-b[1]);
    if(!f || pointInFeature([lon,lat],f)) return {lat:round(lat,5),lon:round(lon,5)};
  }
  const p=c?.focusCenter||c?.center||[0,0]; return {lat:round(p[1],5),lon:round(p[0],5)};
}

function estimateUrbanization(gdpPc, density, continent){
  const base = 0.34 + 0.11*Math.log10(Math.max(1,gdpPc)/1200) + 0.035*Math.log10(Math.max(1,density));
  const regional = continent==='North America'?0.08:continent==='Europe'?0.06:continent==='Oceania'?0.04:continent==='Africa'?-0.06:0;
  return clamp(base+regional,0.22,0.95);
}
function archetypes(code, landlocked, island, gdpPc, industrial, agriculture, trade){
  const a=[];
  if(landlocked) a.push('LANDLOCKED');
  if(island) a.push('ISLAND');
  if(!landlocked && !island && trade>55) a.push('COASTAL_INDUSTRIAL');
  if(RESOURCE_EXPORTERS.has(code)) a.push('RESOURCE_EXPORTER');
  if(ENERGY_EXPORTERS.has(code)) a.push('ENERGY_EXPORTER');
  if(MANUFACTURING.has(code) || industrial>0.25) a.push('MANUFACTURING_HUB');
  if(agriculture>0.18) a.push('AGRICULTURAL');
  if(REGIONAL_TRANSIT.has(code)) a.push('REGIONAL_TRANSIT');
  if(gdpPc<4500) a.push('LOW_INFRASTRUCTURE');
  if(SERVICE_HUB.has(code)) a.push('SERVICE_ECONOMY');
  if(!a.length) a.push('MIXED_ECONOMY');
  return [...new Set(a)];
}

function makeProfile(c){
  const m=metaBy.get(c.iso2)||{}; const code=c.iso2;
  const population=valueOf(code,'population',m.population||1_000_000);
  const area=Math.max(1, Number(m.areaKm2)||1);
  const density=population/area;
  const gdp=valueOf(code,'gdpCurrentUsd',population*9000);
  const gdpPc=valueOf(code,'gdpPerCapitaUsd',gdp/population);
  const trade=valueOf(code,'tradePctGdp',55);
  const electricity=valueOf(code,'electricityAccessPct',75);
  const landlocked=LANDLOCKED.has(code);
  const island=ISLAND.has(code);
  const urbanization=estimateUrbanization(gdpPc,density,c.continent);
  const prosperity=clamp((Math.log10(Math.max(500,gdpPc))-2.7)/2.2);
  const industrial=clamp(0.12 + (MANUFACTURING.has(code)?0.15:0) + 0.09*(1-Math.abs(prosperity-0.6)),0.08,0.38);
  const agriculture=clamp(0.29*(1-prosperity) + (RESOURCE_EXPORTERS.has(code)?0.02:0.04),0.01,0.38);
  const services=clamp(1-industrial-agriculture,0.35,0.88);
  const infraBase=clamp(0.25 + 0.5*prosperity + 0.2*(electricity/100));
  const road=clamp(infraBase + Math.min(0.12,Math.log10(Math.max(1,density))/30));
  const rail=clamp(0.08 + 0.6*infraBase + (MANUFACTURING.has(code)?0.16:0) - (island?0.16:0));
  const aviation=clamp(0.15 + 0.45*prosperity + 0.18*urbanization + (island?0.12:0));
  const maritime=landlocked?0:clamp(0.15 + 0.33*(trade/100) + (island?0.18:0) + (REGIONAL_TRANSIT.has(code)?0.16:0));
  const digital=clamp(0.15+0.58*prosperity+0.2*(electricity/100));
  const military=clamp(0.18 + 0.16*Math.log10(Math.max(1,population))/9 + 0.12*Math.log10(Math.max(1,gdp))/13);
  const arch=archetypes(code,landlocked,island,gdpPc,industrial,agriculture,trade);
  return {
    countryId: code, iso3:c.iso3, name:c.name, continent:c.continent, region:m.region||c.continent, subregion:m.subregion||null,
    geography:{ areaKm2:area, coastlineAccess:!landlocked, landlocked, island, terrainDifficulty: round(clamp(0.32 + (landlocked?0.08:0) + (island?0.05:0)),2), borders:[] },
    demographics:{ population:Math.round(population), densityPerKm2:round(density,2), urbanization:round(urbanization,3), capital:m.capital||`${c.name} Capital` },
    economy:{ gdpCurrentUsd:Math.round(gdp), gdpPerCapitaUsd:round(gdpPc,1), industrialShare:round(industrial,3), agricultureShare:round(agriculture,3), servicesShare:round(services,3), tradeIntensity:round(clamp(trade/120),3) },
    transport:{ roadDevelopment:round(road,3), railDevelopment:round(rail,3), aviationConnectivity:round(aviation,3), maritimeConnectivity:round(maritime,3) },
    energy:{ access:round(electricity/100,3), exportOrientation:ENERGY_EXPORTERS.has(code)?'HIGH':'NORMAL' },
    resources:{ exportOrientation:RESOURCE_EXPORTERS.has(code)?'HIGH':'NORMAL' },
    digital:{ connectivity:round(digital,3) },
    military:{ infrastructureIndex:round(military,3) },
    archetypes:arch,
    provenance:{
      population:prov(code,'population','country-meta'), gdp:prov(code,'gdpCurrentUsd','model-fallback'), gdpPerCapita:prov(code,'gdpPerCapitaUsd','model-fallback'), trade:prov(code,'tradePctGdp','model-fallback'), electricity:prov(code,'electricityAccessPct','model-fallback'),
      geography:{ type:'REAL', source:'world.geojson + curated-landlocked-island-v1', referenceDate:'2026-09-14', retrievedAt:'2026-09-14', confidence:0.9, methodology:'country geometry plus curated structural flags' },
      derived:{ type:'DERIVED', source:'world-population-v1', referenceDate:'2026-09-14', retrievedAt:'2026-09-14', confidence:0.62, methodology:'transparent profile heuristics from population/GDP/trade/electricity/geography' }
    }
  };
}

const profiles=countries.map(makeProfile);
for (const p of profiles) { if (p.countryId === 'AQ') { p.demographics.population = 0; p.demographics.densityPerKm2 = 0; p.demographics.urbanization = 0; p.demographics.capital = null; p.economy.gdpCurrentUsd = 0; p.economy.gdpPerCapitaUsd = 0; p.economy.industrialShare = 0; p.economy.agricultureShare = 0; p.economy.servicesShare = 0; p.economy.tradeIntensity = 0; p.transport.roadDevelopment = 0.02; p.transport.railDevelopment = 0; p.transport.aviationConnectivity = 0.05; p.transport.maritimeConnectivity = 0.05; p.archetypes = ['UNINHABITED_TERRITORY']; p.inhabited = false; } else { p.inhabited = true; } }
const profileBy=new Map(profiles.map(p=>[p.countryId,p]));

// Derive approximate neighbor relations using bounding-box overlap + shared geometry vertices.
const vertexKeys=new Map();
for(const f of world.features){
  const code=f.properties.iso2; const keys=new Set();
  for(const ring of flattenRings(f.geometry)) for(const [lon,lat] of ring){ keys.add(`${Math.round(lon*20)/20},${Math.round(lat*20)/20}`); }
  vertexKeys.set(code,keys);
}
for(let i=0;i<countries.length;i++) for(let j=i+1;j<countries.length;j++){
  const a=countries[i],b=countries[j]; if(LANDLOCKED.has(a.iso2)&&ISLAND.has(b.iso2)) continue;
  const ab=a.focusBounds||a.bounds, bb=b.focusBounds||b.bounds;
  if(!ab||!bb||ab[2]<bb[0]-0.2||bb[2]<ab[0]-0.2||ab[3]<bb[1]-0.2||bb[3]<ab[1]-0.2) continue;
  const ak=vertexKeys.get(a.iso2), bk=vertexKeys.get(b.iso2); let shared=0; for(const k of ak){ if(bk.has(k) && ++shared>=2) break; }
  if(shared>=2){ profileBy.get(a.iso2).geography.borders.push(b.iso2); profileBy.get(b.iso2).geography.borders.push(a.iso2); }
}

const existing=(infra.nodes||[]).filter((n) => !String(n.id || '').startsWith('wp-')); // idempotent rebuild: preserve only validated legacy nodes
const existingByCountry=new Map();
for(const n of existing){ const c=String(n.country||'').toUpperCase(); if(!existingByCountry.has(c)) existingByCountry.set(c,[]); existingByCountry.get(c).push(n); }
const generated=[];
function node(code,key,name,type,category,profile,{layer='CITIES',minView='COUNTRY',importance='LOCAL',boundary=false,strategic=0.45,capacity=null,provenanceType='ESTIMATED'}={}){
  const rr=rng(fnv1a(`${code}:${key}:cap`));
  generated.push({
    id:`wp-${code.toLowerCase()}-${key}`, name, type, category, country:code,
    position:randomPoint(code,key,boundary), status:'OPERATIONAL',
    capacity:capacity ?? Math.round(35+rr()*50), health:100, strategicValue:round(strategic,2),
    connections:[], dependencies:[], layer, minView, importance,
    dataMode:provenanceType,
    provenance:{ type:provenanceType, source:'world-population-v1', referenceDate:'2026-09-14', retrievedAt:'2026-09-14', confidence:provenanceType==='REAL'?0.9:0.55, methodology:'deterministic country-profile infrastructure seeding; position is approximate unless preserved from baseline' }
  });
}

for(const p of profiles){
  const code=p.countryId, old=existingByCountry.get(code)||[];
  if (p.inhabited === false) { node(code,'research-1',`${p.name} Scientific Station`,'SCIENTIFIC_STATION','CIVIL',p,{layer:'CIVIL',minView:'WORLD',importance:'REGIONAL',strategic:0.35,capacity:20}); continue; }
  const has=(type)=>old.some(n=>n.type===type);
  const pop=p.demographics.population, urb=p.demographics.urbanization, econ=clamp((Math.log10(Math.max(1,p.economy.gdpCurrentUsd))-8)/6), infraScore=(p.transport.roadDevelopment+p.transport.railDevelopment+p.transport.aviationConnectivity)/3;
  if(!has('CAPITAL')) node(code,'capital',`${p.demographics.capital} / Government`,'CAPITAL','CIVIL',p,{layer:'CAPITALS',minView:'GLOBE',importance:'NATIONAL',strategic:0.88,capacity:90});
  const cityCount=Math.max(1,Math.min(7,Math.round(Math.log10(Math.max(100000,pop))-4.5 + urb*3.2)));
  for(let i=1;i<=cityCount;i++) node(code,`city-${i}`,`${p.name} Urban Hub ${i}`,'CITY','CIVIL',p,{layer:'CITIES',minView:i<=2?'WORLD':'COUNTRY',importance:i===1?'REGIONAL':'LOCAL',strategic:0.45+0.04*Math.max(0,3-i),capacity:Math.round(45+40*urb)});

  if(!has('AIRPORT')) node(code,'airport-1',`${p.name} Primary Airport`,'AIRPORT','TRANSPORT',p,{layer:'AVIATION',minView:'WORLD',importance:'NATIONAL',strategic:0.62,capacity:Math.round(40+50*p.transport.aviationConnectivity)});
  if(pop>25_000_000 && p.transport.aviationConnectivity>0.45) node(code,'airport-2',`${p.name} Regional Airport`,'AIRPORT','TRANSPORT',p,{layer:'AVIATION',minView:'COUNTRY',importance:'REGIONAL',strategic:0.48,capacity:Math.round(30+45*p.transport.aviationConnectivity)});
  if(!p.geography.landlocked && !has('PORT')) node(code,'port-1',`${p.name} Primary Maritime Gateway`,'PORT','TRANSPORT',p,{layer:'PORTS',minView:'WORLD',importance:'NATIONAL',boundary:true,strategic:0.66,capacity:Math.round(35+55*p.transport.maritimeConnectivity)});
  if(!p.geography.landlocked && p.transport.maritimeConnectivity>0.56 && pop>20_000_000) node(code,'port-2',`${p.name} Secondary Maritime Gateway`,'PORT','TRANSPORT',p,{layer:'PORTS',minView:'COUNTRY',importance:'REGIONAL',boundary:true,strategic:0.52,capacity:Math.round(30+45*p.transport.maritimeConnectivity)});

  if(!has('LOGISTICS_HUB')) node(code,'logistics-1',`${p.name} National Logistics Hub`,'LOGISTICS_HUB','LOGISTICS',p,{layer:'LOGISTICS',minView:'COUNTRY',importance:'NATIONAL',strategic:0.64,capacity:Math.round(45+45*infraScore)});
  if(p.transport.railDevelopment>0.25 && !has('RAIL_HUB')) node(code,'rail-1',`${p.name} Rail Hub`,'RAIL_HUB','TRANSPORT',p,{layer:'RAIL',minView:'COUNTRY',importance:'REGIONAL',strategic:0.52,capacity:Math.round(35+55*p.transport.railDevelopment)});
  node(code,'road-1',`${p.name} Road Hub`,'ROAD_HUB','TRANSPORT',p,{layer:'ROAD',minView:'COUNTRY',importance:'REGIONAL',strategic:0.44,capacity:Math.round(40+50*p.transport.roadDevelopment)});
  if(p.geography.borders.length) node(code,'border-1',`${p.name} Primary Border Gateway`,'BORDER_CROSSING','TRANSPORT',p,{layer:'BORDERS',minView:'COUNTRY',importance:'REGIONAL',boundary:true,strategic:0.5,capacity:Math.round(35+45*p.transport.roadDevelopment)});

  if(!has('POWER_PLANT')) node(code,'power-1',`${p.name} Power Generation Hub`,'POWER_PLANT','ENERGY',p,{layer:'ENERGY',minView:'COUNTRY',importance:'NATIONAL',strategic:0.73,capacity:Math.round(45+50*p.energy.access)});
  if(!has('POWER_GRID')) node(code,'grid-1',`${p.name} Grid Substation`,'POWER_GRID','ENERGY',p,{layer:'ENERGY',minView:'COUNTRY',importance:'REGIONAL',strategic:0.65,capacity:Math.round(45+50*p.energy.access)});
  if((p.archetypes.includes('ENERGY_EXPORTER')||econ>0.62) && !has('REFINERY')) node(code,'refinery-1',`${p.name} Refinery / Fuel Depot`,'REFINERY','ENERGY',p,{layer:'ENERGY',minView:'COUNTRY',importance:'REGIONAL',strategic:0.68,capacity:Math.round(40+45*econ)});
  if(p.archetypes.includes('ENERGY_EXPORTER') && !has('PIPELINE_NODE')) node(code,'pipeline-1',`${p.name} Pipeline Node`,'PIPELINE_NODE','ENERGY',p,{layer:'ENERGY',minView:'COUNTRY',importance:'REGIONAL',strategic:0.67,capacity:Math.round(45+45*econ)});

  if(!has('INDUSTRY')) node(code,'industry-1',`${p.name} Industrial Zone`,'INDUSTRY','ECONOMY',p,{layer:'INDUSTRY',minView:'COUNTRY',importance:'REGIONAL',strategic:0.58,capacity:Math.round(35+50*(p.economy.industrialShare/0.38))});
  if(p.archetypes.includes('RESOURCE_EXPORTER') && !has('MINE')) node(code,'mine-1',`${p.name} Extraction Zone`,'MINE','ECONOMY',p,{layer:'RESOURCES',minView:'COUNTRY',importance:'REGIONAL',strategic:0.56,capacity:Math.round(40+45*econ)});
  if(p.archetypes.includes('AGRICULTURAL')) node(code,'agri-1',`${p.name} Agricultural Hub`,'AGRICULTURAL_HUB','ECONOMY',p,{layer:'RESOURCES',minView:'COUNTRY',importance:'REGIONAL',strategic:0.46,capacity:Math.round(45+35*(p.economy.agricultureShare/0.38))});

  if(p.digital.connectivity>0.32 && !has('DATACENTER')) node(code,'dc-1',`${p.name} Data Center`,'DATACENTER','DIGITAL',p,{layer:'DIGITAL',minView:'COUNTRY',importance:'REGIONAL',strategic:0.58,capacity:Math.round(35+55*p.digital.connectivity)});
  if(p.digital.connectivity>0.52 && !has('IXP')) node(code,'ixp-1',`${p.name} Internet Exchange`,'IXP','DIGITAL',p,{layer:'DIGITAL',minView:'COUNTRY',importance:'REGIONAL',strategic:0.61,capacity:Math.round(40+50*p.digital.connectivity)});
  if(!p.geography.landlocked && p.digital.connectivity>0.48 && !has('CABLE_LANDING')) node(code,'cable-1',`${p.name} Cable Landing`,'CABLE_LANDING','DIGITAL',p,{layer:'DIGITAL',minView:'COUNTRY',importance:'REGIONAL',boundary:true,strategic:0.6,capacity:Math.round(35+50*p.digital.connectivity)});

  node(code,'health-1',`${p.name} Critical Health Hub`,'HEALTH','CIVIL',p,{layer:'CIVIL',minView:'COUNTRY',importance:'REGIONAL',strategic:0.48,capacity:Math.round(40+45*p.energy.access)});
  if(p.military.infrastructureIndex>0.28 && !has('MILITARY_BASE')) node(code,'mil-base-1',`${p.name} Military Base`,'MILITARY_BASE','MILITARY',p,{layer:'MILITARY',minView:'COUNTRY',importance:'NATIONAL',strategic:0.64,capacity:Math.round(35+45*p.military.infrastructureIndex)});
  if(!p.geography.landlocked && p.military.infrastructureIndex>0.48 && !has('NAVAL_BASE')) node(code,'naval-1',`${p.name} Naval Base`,'NAVAL_BASE','MILITARY',p,{layer:'MILITARY',minView:'COUNTRY',importance:'REGIONAL',boundary:true,strategic:0.67,capacity:Math.round(35+45*p.military.infrastructureIndex)});
  if(p.military.infrastructureIndex>0.42 && !has('AIRBASE')) node(code,'airbase-1',`${p.name} Air Base`,'AIRBASE','MILITARY',p,{layer:'MILITARY',minView:'COUNTRY',importance:'REGIONAL',strategic:0.65,capacity:Math.round(35+45*p.military.infrastructureIndex)});
}

// Preserve validated V1.x nodes and append only deterministic LOT 1 population nodes.
const ids=new Set(existing.map(n=>n.id));
const appended=generated.filter(n=>!ids.has(n.id));
infra.schemaVersion='1.4-lot1';
infra.dataset='World Invasion V1.4 LOT 1 — World Population';
infra.dataPolicy='Validated legacy nodes are preserved. LOT 1 generated nodes are deterministic ESTIMATED infrastructure seeded from country profiles and approximate in position/capacity; they are not authoritative real-world operational data.';
infra.nodes=[...existing.map((n)=>({...n,country:String(n.country||'').toUpperCase()})),...appended];
write('src/data/infrastructure-v1.json',infra);

const dataset={ schemaVersion:'1.0', dataset:'World Invasion V1.4 LOT 1 Country Physical Profiles', generatedAt:'2026-09-14', countryCount:profiles.length, methodology:'Real baseline + country metadata + deterministic derived/estimated structural model. No generated object is labelled REAL.', profiles };
write('src/game/data/country-physical-profiles.json',dataset);

const report={ countryCount:profiles.length, inhabitedEntityCount:profiles.filter(p=>p.inhabited!==false).length, uninhabitedEntities:profiles.filter(p=>p.inhabited===false).map(p=>p.countryId), generatedNodes:appended.length, totalInfrastructureNodes:infra.nodes.length, countriesWithCapital:0, countriesWithAirport:0, countriesWithLogistics:0, landlockedWithPort:[], islandsWithoutGateway:[], factoriesWithoutLogistics:[], minesWithoutOutbound:[], majorCitiesWithoutBasicSupply:[], profileClassCounts:{REAL:0,ESTIMATED:0,DERIVED:0,SIMULATED:0}, archetypes:{} };
const allByCountry=new Map(); for(const n of infra.nodes){ const a=allByCountry.get(n.country)||[]; a.push(n); allByCountry.set(n.country,a); }
for(const p of profiles){ const a=allByCountry.get(p.countryId)||[]; const types=new Set(a.map(n=>n.type)); if(p.inhabited===false) continue; if(types.has('CAPITAL')) report.countriesWithCapital++; if(types.has('AIRPORT')) report.countriesWithAirport++; if(types.has('LOGISTICS_HUB')) report.countriesWithLogistics++;
  if(p.geography.landlocked && types.has('PORT')) report.landlockedWithPort.push(p.countryId);
  if(p.geography.island && !types.has('PORT') && !types.has('AIRPORT')) report.islandsWithoutGateway.push(p.countryId);
  if(types.has('INDUSTRY') && !types.has('LOGISTICS_HUB') && !types.has('ROAD_HUB') && !types.has('RAIL_HUB')) report.factoriesWithoutLogistics.push(p.countryId);
  if(types.has('MINE') && !types.has('LOGISTICS_HUB') && !types.has('ROAD_HUB') && !types.has('RAIL_HUB')) report.minesWithoutOutbound.push(p.countryId);
  if(types.has('CITY') && (!types.has('POWER_PLANT') || !types.has('LOGISTICS_HUB'))) report.majorCitiesWithoutBasicSupply.push(p.countryId);
  for(const ar of p.archetypes) report.archetypes[ar]=(report.archetypes[ar]||0)+1;
}
write('src/game/data/world-population-coverage-report.json',report);
console.log(JSON.stringify(report,null,2));
