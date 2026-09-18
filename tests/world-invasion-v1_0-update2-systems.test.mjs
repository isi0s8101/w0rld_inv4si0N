import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { InfrastructureGraph } from '../src/game/infrastructure/InfrastructureGraph.js';
import { RouteEngineV1 } from '../src/game/infrastructure/RouteEngineV1.js';
import { InfrastructureRuntime, INFRA_FLOW_TYPES } from '../src/game/systems/InfrastructureRuntime.js';
import { LogisticsEngine } from '../src/game/systems/LogisticsEngine.js';
import { InfrastructureFlowEngine } from '../src/game/systems/InfrastructureFlowEngine.js';
import { InfrastructureDependencyEngine } from '../src/game/systems/InfrastructureDependencyEngine.js';
import { SimulationTimeEngine } from '../src/game/systems/SimulationTimeEngine.js';

const infraData=JSON.parse(fs.readFileSync(new URL('../src/data/infrastructure-v1.json',import.meta.url),'utf8'));
const routeData=JSON.parse(fs.readFileSync(new URL('../src/data/routes-v1.json',import.meta.url),'utf8'));
const icons=JSON.parse(fs.readFileSync(new URL('../src/data/infrastructure-icon-catalog.json',import.meta.url),'utf8'));
function physical(){
  const graph=new InfrastructureGraph();graph.iconCatalog=icons;graph.nodes=infraData.nodes.map(n=>graph.normalizeNode(n));graph.byId=new Map(graph.nodes.map(n=>[n.id,n]));graph.byCountry=new Map();for(const n of graph.nodes){const a=graph.byCountry.get(n.country)||[];a.push(n);graph.byCountry.set(n.country,a);}
  const routes=new RouteEngineV1({infrastructureGraph:graph});routes.routes=routeData.routes.map(r=>routes.normalizeRoute(r));routes.byId=new Map(routes.routes.map(r=>[r.id,r]));routes.rebuildGraph();routes.beginUsageCycle();
  const runtime=new InfrastructureRuntime({infrastructureGraph:graph}).init();const logistics=new LogisticsEngine({routeEngine:routes,infrastructureRuntime:runtime});const flows=new InfrastructureFlowEngine({infrastructureGraph:graph,runtime,logistics});const deps=new InfrastructureDependencyEngine({graph,runtime});return {graph,routes,runtime,logistics,flows,deps};
}

test('Update 2 expose les dix familles de flux physiques',()=>{assert.deepEqual(new Set(INFRA_FLOW_TYPES),new Set(['goods','oil','gas','electricity','rawMaterials','food','militarySupplies','fuel','people','data']));});

test('capacités réseau suivent usage, disponibilité et congestion',()=>{const {routes}=physical();const r=routes.get('road-paris-lyon');const cap=r.maxCapacity;assert.equal(r.currentUsage,0);const used=routes.reserveCapacity(r.id,cap*.4);assert.ok(used>0);assert.ok(r.currentUsage>0);assert.ok(r.availableCapacity<cap);assert.ok(r.congestionRuntime>=r.congestion);});

test('rerouting utilise une alternative quand un segment est fermé',()=>{const {routes}=physical();const before=routes.minimumCostPath('fr-cap-paris','fr-port-marseille',{allowedTypes:['ROAD_ROUTE','RAIL_ROUTE']});assert.ok(before?.routes.length>=2);for(const id of before.routes)routes.setStatus(id,'CLOSED');const after=routes.minimumCostPath('fr-cap-paris','fr-port-marseille',{allowedTypes:['ROAD_ROUTE','RAIL_ROUTE']});assert.ok(after);assert.notDeepEqual(after.routes,before.routes);assert.ok(routes.maximumFlow('fr-cap-paris','fr-port-marseille',{allowedTypes:['ROAD_ROUTE','RAIL_ROUTE']})>0);});

test('dommages et dépendances réduisent la capacité réellement utilisable',()=>{const {graph,runtime,deps}=physical();const dc=graph.list().find(n=>n.type==='DATACENTER');assert.ok(dc);const base=runtime.effectiveCapacity(dc.id);runtime.setDamage(dc.id,{physicalDamage:.55,cyberDisruption:.45});deps.update();const damaged=runtime.effectiveCapacity(dc.id);assert.ok(damaged<base);});

test('Flow Engine produit des flux physiques et un résumé logistique',()=>{const {flows,logistics,deps}=physical();deps.update();const rows=flows.stepHour(1);assert.ok(Array.isArray(rows));assert.ok(rows.length>0);const summary=flows.summary();assert.ok(summary.active>0);const log=logistics.summarize();assert.ok(log.capacity>0);assert.ok(log.available<=log.capacity);});

test('moteur temporel fonctionne par ticks horaires avec jalons jour/semaine/mois',()=>{const t=new SimulationTimeEngine({startDate:'2032-04-01T00:00:00Z'});t.advance(24);assert.equal(t.day,1);assert.equal(t.tick,24);assert.match(t.iso(),/^2032-04-02/);t.advance(24*6);assert.equal(t.week,1);});
