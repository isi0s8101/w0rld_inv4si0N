import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const infraPath = path.join(root, 'src/data/infrastructure-v1.json');
const profilePath = path.join(root, 'src/game/data/country-physical-profiles.json');
const outPath = path.join(root, 'src/game/data/world-network-v1.json');
const reportPath = path.join(root, 'src/game/data/world-network-coverage-report.json');

const infra = JSON.parse(fs.readFileSync(infraPath, 'utf8'));
const profilesPayload = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const profiles = profilesPayload.profiles || [];
const profileBy = new Map(profiles.map((p) => [p.countryId, p]));

// Structural corrections discovered by network validation. These are geography facts,
// not simulation choices. They fix two LOT 1 false coastal classifications.
for (const code of ['PY', 'SS']) {
  const p = profileBy.get(code);
  if (p) {
    p.geography.landlocked = true;
    p.geography.coastlineAccess = false;
    p.geography.island = false;
    p.provenance ||= {};
    p.provenance.geography = {
      type: 'REAL',
      source: 'LOT2 structural geography correction',
      referenceDate: '2026-09-14',
      retrievedAt: '2026-09-14',
      confidence: 0.99,
      methodology: 'curated landlocked-country correction'
    };
  }
}
infra.nodes = infra.nodes.filter((n) => !(n.type === 'PORT' && ['PY', 'SS'].includes(n.country) && String(n.id).startsWith('wp-')));

const chokepoints = [
  ['my-malacca', 'Strait of Malacca', 'MY', 2.5, 101.2],
  ['tr-bosporus', 'Bosporus Strait', 'TR', 41.12, 29.05],
  ['ye-bab-el-mandeb', 'Bab-el-Mandeb Strait', 'YE', 12.58, 43.33],
  ['es-gibraltar', 'Strait of Gibraltar', 'ES', 35.97, -5.61]
];
for (const [id, name, country, lat, lon] of chokepoints) {
  if (!infra.nodes.some((n) => n.id === id)) infra.nodes.push({
    id, name, type:'CHOKEPOINT', category:'TRANSPORT', country,
    position:{lat, lon}, status:'OPERATIONAL', capacity:88, health:100, strategicValue:0.96,
    connections:[], dependencies:[], layer:'MARITIME', minView:'GLOBE', importance:'GLOBAL',
    dataMode:'REAL', provenance:{type:'REAL', source:'curated major maritime chokepoints v1', referenceDate:'2026-09-14', retrievedAt:'2026-09-14', confidence:0.95}
  });
}

const nodes = infra.nodes;
const byCountry = new Map();
const byId = new Map(nodes.map((n) => [n.id, n]));
for (const n of nodes) { const list = byCountry.get(n.country) || []; list.push(n); byCountry.set(n.country, list); }

const rad = (v) => v * Math.PI / 180;
const haversine = (a,b) => {
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon), la1=rad(a.lat), la2=rad(b.lat);
  const h=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const distNodes = (a,b) => haversine(a.position,b.position);
const safe = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64);
const routes = [];
const routeKeys = new Set();
const addRoute = ({type, from, to, layer, scope='DOMESTIC', countries=null, routeClass='INFRASTRUCTURE', dataClass='ESTIMATED_NETWORK', capacity=60, risk=0.08, status='OPEN', waypoints=[]}) => {
  if (!from || !to || from.id === to.id) return null;
  const undirected=[from.id,to.id].sort().join('|')+'|'+type;
  if(routeKeys.has(undirected)) return null;
  routeKeys.add(undirected);
  const distanceKm=Math.max(1,Math.round(distNodes(from,to)));
  const speed = type==='AIR_ROUTE'?780:type==='SEA_ROUTE'?36:type==='RAIL_ROUTE'?75:type==='ROAD_ROUTE'?65:type==='PIPELINE_ROUTE'?22:type==='DIGITAL_ROUTE'?100000:type==='POWER_ROUTE'?100000:55;
  const id=`wn-${safe(type)}-${safe(from.id)}-${safe(to.id)}`;
  const r={id,type,from:from.id,to:to.id,layer,scope,countries:countries||[from.country,to.country].filter(Boolean),waypoints,distanceKm,travelTimeHours:Math.max(0.01,Number((distanceKm/speed).toFixed(2))),capacity:Math.round(capacity),maxCapacity:Math.round(capacity),currentUsage:0,congestion:0.08,risk,status,routeClass,dataClass,provenance:{type:'ESTIMATED',source:'world-network-builder-v1',referenceDate:'2026-09-14',retrievedAt:'2026-09-14',confidence:0.62,methodology:'connectivity heuristics constrained by country profile, adjacency and infrastructure types'}};
  routes.push(r); return r;
};
const first=(list,types)=>list.find(n=>types.includes(n.type));
const all=(list,types)=>list.filter(n=>types.includes(n.type));
const nearest=(src,cands,count=1,max=Infinity)=>cands.filter(n=>n.id!==src.id).map(n=>[n,distNodes(src,n)]).filter(x=>x[1]<=max).sort((a,b)=>a[1]-b[1]).slice(0,count).map(x=>x[0]);

// Domestic physical graphs.
for (const p of profiles.filter(p=>p.inhabited!==false)) {
  const list=byCountry.get(p.countryId)||[];
  const capital=first(list,['CAPITAL']); const road=first(list,['ROAD_HUB','LOGISTICS_HUB']); const logistics=first(list,['LOGISTICS_HUB']); const rail=first(list,['RAIL_HUB']);
  const cities=all(list,['CITY','CAPITAL']); const airports=all(list,['AIRPORT']); const ports=all(list,['PORT']); const grids=all(list,['POWER_GRID']); const plants=all(list,['POWER_PLANT','DAM']); const digital=all(list,['DATACENTER','IXP','CABLE_LANDING']); const prod=all(list,['INDUSTRY','MINE','AGRICULTURAL_HUB','REFINERY']);
  if(road && capital) addRoute({type:'ROAD_ROUTE',from:capital,to:road,layer:'ROADS',countries:[p.countryId],capacity:55+p.transport.roadDevelopment*40});
  for(const city of cities) if(road && city.id!==road.id) addRoute({type:'ROAD_ROUTE',from:city,to:road,layer:'ROADS',countries:[p.countryId],capacity:45+p.transport.roadDevelopment*45});
  for(const n of [...prod,...airports,...ports]) if(road) addRoute({type:'ROAD_ROUTE',from:n,to:road,layer:'ROADS',countries:[p.countryId],capacity:42+p.transport.roadDevelopment*43});
  if(rail && p.transport.railDevelopment>=0.2){
    for(const n of [capital,logistics,...prod.filter(x=>['INDUSTRY','MINE','REFINERY'].includes(x.type)),...ports].filter(Boolean)) addRoute({type:'RAIL_ROUTE',from:n,to:rail,layer:'RAIL',countries:[p.countryId],capacity:35+p.transport.railDevelopment*55});
  }
  if(airports.length>1) for(const a of airports.slice(1)) addRoute({type:'AIR_ROUTE',from:airports[0],to:a,layer:'AVIATION',countries:[p.countryId],capacity:30+p.transport.aviationConnectivity*45,risk:0.04});
  if(ports.length>1) for(const port of ports.slice(1)) addRoute({type:'SEA_ROUTE',from:ports[0],to:port,layer:'MARITIME',countries:[p.countryId],capacity:40+p.transport.maritimeConnectivity*50,risk:0.07});
  if(grids.length){ for(const plant of plants) addRoute({type:'POWER_ROUTE',from:plant,to:grids[0],layer:'ENERGY',countries:[p.countryId],capacity:70}); for(const city of cities.slice(0,4)) addRoute({type:'POWER_ROUTE',from:grids[0],to:city,layer:'ENERGY',countries:[p.countryId],capacity:65}); }
  if(digital.length>1){const hub=first(digital,['IXP','DATACENTER','CABLE_LANDING'])||digital[0]; for(const n of digital) if(n.id!==hub.id)addRoute({type:'DIGITAL_ROUTE',from:hub,to:n,layer:'DIGITAL',countries:[p.countryId],capacity:80,risk:0.03});}
  const pipe=all(list,['PIPELINE_NODE','REFINERY']); if(pipe.length>1)for(const n of pipe.slice(1))addRoute({type:'PIPELINE_ROUTE',from:pipe[0],to:n,layer:'PIPELINES',countries:[p.countryId],capacity:65,risk:0.06});
}

// International land links constrained to real country adjacency from profiles.
const seenBorderPairs=new Set();
for(const p of profiles){
  for(const neighbor of p.geography?.borders||[]){
    if(!profileBy.has(neighbor))continue;
    const pair=[p.countryId,neighbor].sort().join('-'); if(seenBorderPairs.has(pair))continue; seenBorderPairs.add(pair);
    const aList=byCountry.get(p.countryId)||[], bList=byCountry.get(neighbor)||[];
    const aBorder=first(aList,['BORDER_CROSSING','ROAD_HUB']), bBorder=first(bList,['BORDER_CROSSING','ROAD_HUB']);
    if(aBorder&&bBorder)addRoute({type:'ROAD_ROUTE',from:aBorder,to:bBorder,layer:'ROADS',scope:'INTERNATIONAL',countries:[p.countryId,neighbor],capacity:55,risk:0.1});
    const aRail=first(aList,['RAIL_HUB']), bRail=first(bList,['RAIL_HUB']);
    if(aRail&&bRail && p.transport.railDevelopment>=0.28 && profileBy.get(neighbor).transport.railDevelopment>=0.28)addRoute({type:'RAIL_ROUTE',from:aRail,to:bRail,layer:'RAIL',scope:'INTERNATIONAL',countries:[p.countryId,neighbor],capacity:48,risk:0.08});
    const aPipe=first(aList,['PIPELINE_NODE']), bPipe=first(bList,['PIPELINE_NODE']);
    if(aPipe&&bPipe)addRoute({type:'PIPELINE_ROUTE',from:aPipe,to:bPipe,layer:'PIPELINES',scope:'INTERNATIONAL',countries:[p.countryId,neighbor],capacity:68,risk:0.09});
  }
}

// International aviation: connect each primary airport to three nearest foreign airports.
const primaryAirports=[];
for(const p of profiles){const a=first(byCountry.get(p.countryId)||[],['AIRPORT']); if(a)primaryAirports.push(a);}
for(const a of primaryAirports){for(const b of nearest(a,primaryAirports.filter(x=>x.country!==a.country),3,8500))addRoute({type:'AIR_ROUTE',from:a,to:b,layer:'AVIATION',scope:'INTERNATIONAL',countries:[a.country,b.country],capacity:62,risk:0.05});}

// International maritime: coastal countries only; three nearest foreign ports + chokepoint corridors.
const maritimePorts=[];
for(const p of profiles){if(p.geography?.landlocked)continue; const port=first(byCountry.get(p.countryId)||[],['PORT']); if(port)maritimePorts.push(port);}
for(const a of maritimePorts){for(const b of nearest(a,maritimePorts.filter(x=>x.country!==a.country),3,9000))addRoute({type:'SEA_ROUTE',from:a,to:b,layer:'MARITIME',scope:'INTERNATIONAL',countries:[a.country,b.country],capacity:72,risk:0.09,waypoints:[{lat:(a.position.lat+b.position.lat)/2,lon:(a.position.lon+b.position.lon)/2,kind:'SEA_CORRIDOR',sequence:1}]});}
const cpNodes=nodes.filter(n=>n.type==='CHOKEPOINT');
for(const cp of cpNodes){for(const port of nearest(cp,maritimePorts,3,3000))addRoute({type:'SEA_ROUTE',from:port,to:cp,layer:'MARITIME',scope:port.country===cp.country?'CORRIDOR':'INTERNATIONAL',countries:[port.country,cp.country],capacity:84,risk:0.1,waypoints:[{lat:(port.position.lat+cp.position.lat)/2,lon:(port.position.lon+cp.position.lon)/2,kind:'CHOKEPOINT_APPROACH',sequence:1}]});}

// International digital connectivity between cable landing gateways.
const cableNodes=nodes.filter(n=>n.type==='CABLE_LANDING');
for(const a of cableNodes){for(const b of nearest(a,cableNodes.filter(x=>x.country!==a.country),2,10000))addRoute({type:'DIGITAL_ROUTE',from:a,to:b,layer:'DIGITAL',scope:'INTERNATIONAL',countries:[a.country,b.country],capacity:90,risk:0.04});}

// Gateway catalog.
const gateways=[];
const pushGateway=(country,type,node,extra={})=>{if(!node)return;gateways.push({id:`gw-${safe(country)}-${safe(type)}-${safe(node.id)}`,country,type,nodeId:node.id,status:'OPEN',...extra,provenance:{type:node.dataMode==='REAL'?'REAL':'DERIVED',source:'world-network-builder-v1',referenceDate:'2026-09-14',retrievedAt:'2026-09-14',confidence:node.dataMode==='REAL'?0.9:0.62}});};
for(const p of profiles){
  const list=byCountry.get(p.countryId)||[];
  if(!p.geography?.landlocked)for(const n of all(list,['PORT']))pushGateway(p.countryId,'SEA_GATEWAY',n);
  for(const n of all(list,['AIRPORT']))pushGateway(p.countryId,'AIR_GATEWAY',n);
  const border=first(list,['BORDER_CROSSING']); if(border){pushGateway(p.countryId,'ROAD_BORDER',border,{neighbors:p.geography?.borders||[]}); const rail=first(list,['RAIL_HUB']); if(rail&&p.transport.railDevelopment>=0.28)pushGateway(p.countryId,'RAIL_BORDER',rail,{neighbors:p.geography?.borders||[]});}
  for(const n of all(list,['PIPELINE_NODE']))pushGateway(p.countryId,'PIPELINE_BORDER',n,{neighbors:p.geography?.borders||[]});
  for(const n of all(list,['CABLE_LANDING','IXP']))pushGateway(p.countryId,'DIGITAL_GATEWAY',n);
}

// Rebuild connections on infrastructure nodes from generated network routes.
for(const n of nodes)n.connections=[];
for(const r of routes){byId.get(r.from)?.connections?.push(r.id);byId.get(r.to)?.connections?.push(r.id);}
for(const n of nodes)n.connections=[...new Set(n.connections||[])];

const routeTypeCounts={}, scopeCounts={}; for(const r of routes){routeTypeCounts[r.type]=(routeTypeCounts[r.type]||0)+1;scopeCounts[r.scope]=(scopeCounts[r.scope]||0)+1;}
const gatewayTypeCounts={};for(const g of gateways)gatewayTypeCounts[g.type]=(gatewayTypeCounts[g.type]||0)+1;
const countriesWithRoutes=new Set(routes.flatMap(r=>r.countries||[]));
const errors=[],warnings=[];
for(const p of profiles.filter(p=>p.inhabited!==false)){
  const list=byCountry.get(p.countryId)||[];
  if(p.geography?.landlocked && list.some(n=>n.type==='PORT'))errors.push(`${p.countryId}: landlocked country has PORT`);
  if(p.geography?.island && !gateways.some(g=>g.country===p.countryId&&['SEA_GATEWAY','AIR_GATEWAY'].includes(g.type)))warnings.push(`${p.countryId}: island has no sea/air gateway`);
  if(!countriesWithRoutes.has(p.countryId))errors.push(`${p.countryId}: no network route`);
}
for(const r of routes){if(!byId.has(r.from)||!byId.has(r.to))errors.push(`${r.id}: missing endpoint`); if(r.scope==='INTERNATIONAL'&&(!r.countries||new Set(r.countries).size<2))warnings.push(`${r.id}: international route lacks two-country metadata`); if(r.type==='SEA_ROUTE'&&![ 'PORT','CHOKEPOINT'].includes(byId.get(r.from)?.type))errors.push(`${r.id}: invalid maritime origin`); if(r.type==='SEA_ROUTE'&&![ 'PORT','CHOKEPOINT'].includes(byId.get(r.to)?.type))errors.push(`${r.id}: invalid maritime destination`);}

const output={schemaVersion:'1.0',dataset:'WORLD_NETWORK_V1',generatedAt:'2026-09-14',methodology:{version:'world-network-builder-v1',dataClass:'ESTIMATED_NETWORK',principles:['domestic networks are built from LOT1 infrastructure nodes','international land routes require country adjacency','maritime gateways are forbidden for landlocked countries','air and sea links use bounded nearest-neighbour connectivity','major chokepoints are explicit graph nodes','this LOT builds physical connectivity only; diplomacy and strategic feasibility remain LOT5']},stats:{countries:profiles.length,nodes:nodes.length,routes:routes.length,gateways:gateways.length,routeTypeCounts,scopeCounts,gatewayTypeCounts,errors:errors.length,warnings:warnings.length},gateways,routes};
const report={generatedAt:'2026-09-14',countries:profiles.length,inhabitedCountries:profiles.filter(p=>p.inhabited!==false).length,nodes:nodes.length,routes:routes.length,gateways:gateways.length,routeTypeCounts,scopeCounts,gatewayTypeCounts,countriesWithRoutes:countriesWithRoutes.size,validation:{errors,warnings}};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(infraPath,JSON.stringify(infra,null,2)+'\n');
fs.writeFileSync(profilePath,JSON.stringify(profilesPayload,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
