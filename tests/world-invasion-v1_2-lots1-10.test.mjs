import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StateManager } from '../src/core/StateManager.js';
import { WorldProjection } from '../src/world/WorldProjection.js';
import { CountryProjection } from '../src/world/CountryProjection.js';
import { MapCameraEngine } from '../src/camera/MapCameraEngine.js';
import { SemanticZoomEngine } from '../src/map/SemanticZoomEngine.js';
import { SpatialIndex } from '../src/map/SpatialIndex.js';
import { ClusterManager } from '../src/map/ClusterManager.js';
import { LabelManager } from '../src/map/LabelManager.js';
import { VisualPriorityManager } from '../src/map/VisualPriorityManager.js';
import { LayerManagerV1 } from '../src/game/infrastructure/LayerManagerV1.js';
import { RouteEngineV1 } from '../src/game/infrastructure/RouteEngineV1.js';
import { TrafficPlanner } from '../src/traffic/TrafficPlanner.js';
import { VehicleSpawner } from '../src/traffic/VehicleSpawner.js';
import { VehicleMovement } from '../src/traffic/VehicleMovement.js';
import { TrafficLogisticsEngine } from '../src/traffic/TrafficLogisticsEngine.js';
import { FocusModeEngine } from '../src/interaction/FocusModeEngine.js';
import { SelectionContext } from '../src/interaction/SelectionContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const bus = () => ({ emit(){}, on(){return()=>{};} });
const featureFR={properties:{iso2:'FR',bounds:[-5.5,41,9.8,51.5],focusBounds:[-5.5,41,9.8,51.5]}};

function buildRouteEngine(){
  const infraPayload=JSON.parse(fs.readFileSync(path.join(root,'src/data/infrastructure-v1.json'),'utf8'));
  const routePayload=JSON.parse(fs.readFileSync(path.join(root,'src/data/routes-v1.json'),'utf8'));
  const nodeMap=new Map(infraPayload.nodes.map(n=>[n.id,n]));
  const graph={get:(id)=>nodeMap.get(id)||null};
  const engine=new RouteEngineV1({infrastructureGraph:graph});
  engine.routes=routePayload.routes.map(r=>engine.normalizeRoute(r));
  engine.byId=new Map(engine.routes.map(r=>[r.id,r]));
  engine.rebuildGraph();
  return {engine,nodeMap,infraPayload,routePayload};
}

function mapFixture(view='WORLD'){
  const state=new StateManager(bus());
  state.setView(view);
  if(view==='COUNTRY')state.setSelectedCountry('FR');
  const world=new WorldProjection();world.resize(1600,900);world.setSafeArea({left:250,right:350,top:80,bottom:80});
  const country=new CountryProjection();country.resize(1600,900);country.setSafeArea({left:250,right:350,top:80,bottom:80});country.setFeature(featureFR);
  const worldEngine={getCountry:(code)=>code==='FR'?featureFR:null};
  const camera=new MapCameraEngine({stateManager:state,projections:{world,country},worldEngine,bus:bus()});
  return {state,world,country,camera};
}

test('LOT 1 — MapCameraEngine: zoom au curseur, pan borné, reset et viewport',()=>{
  const {state,world,camera}=mapFixture('WORLD');
  const vp=world.viewport();const x=vp.x+vp.width*.72,y=vp.y+vp.height*.38;
  world.setCamera(state.get().world);const before=world.unproject(x,y,{allowOutside:true});
  camera.zoomAt(x,y,2);world.setCamera(state.get().world);const after=world.unproject(x,y,{allowOutside:true});
  assert.ok(Math.abs(before.lon-after.lon)<1e-6,'longitude sous le curseur stable');
  assert.ok(Math.abs(before.lat-after.lat)<1e-6,'latitude sous le curseur stable');
  assert.equal(state.get().world.zoom,2);
  camera.panPixels(100000,100000);const cam=state.get().world;
  assert.ok(Math.abs(cam.centerX)<=90.0001);assert.ok(Math.abs(cam.centerY)<=45.0001);
  assert.ok(camera.viewport().width>0);
  camera.reset();assert.deepEqual(state.get().world,{centerX:0,centerY:0,zoom:1});
});

test('LOT 1 — Territory: zoom/pan, focus, fitBounds et follow',()=>{
  const {state,country,camera}=mapFixture('COUNTRY');
  const vp=country.viewport();camera.zoomAt(vp.x+vp.width*.55,vp.y+vp.height*.5,2.5);
  assert.ok(state.get().country.zoom>2);
  camera.panPixels(-200,110);const p=country.setCamera(state.get().country);assert.ok(Number.isFinite(p.centerX)&&Number.isFinite(p.centerY));
  camera.focus({lat:43.3,lon:5.3},{zoom:4});assert.equal(state.get().country.zoom,4);
  camera.fitBounds([4.6,42.8,6.2,44.1]);assert.ok(state.get().country.zoom>=1);
  camera.setFollowTarget('x',()=>({lat:45,lon:4}));camera.update(.2);assert.ok(state.get().country.centerX!==null);camera.cancelFollow();
  camera.reset();assert.equal(state.get().country.zoom,1);
});

test('LOT 2 — Semantic zoom, LOD et SpatialIndex',()=>{
  const semantic=new SemanticZoomEngine();
  assert.equal(semantic.level('WORLD',1),1);assert.equal(semantic.level('WORLD',1.8),2);assert.equal(semantic.level('WORLD',3),3);assert.equal(semantic.level('WORLD',5),4);
  const nodes=[{id:'c',type:'CAPITAL',position:{lat:48,lon:2}},{id:'p',type:'PORT',position:{lat:43,lon:5}},{id:'h',type:'RAIL_HUB',position:{lat:45,lon:4}}];
  assert.deepEqual(semantic.filterNodes(nodes,{view:'WORLD',zoom:1}).map(n=>n.id),['c']);
  assert.ok(semantic.filterNodes(nodes,{view:'WORLD',zoom:5}).length===3);
  const idx=new SpatialIndex().rebuild(nodes);assert.equal(idx.count,3);assert.deepEqual(idx.query({minLon:1,minLat:47,maxLon:3,maxLat:49}).map(n=>n.id),['c']);
});

test('LOT 3 — clusters, priorité visuelle et labels sans collision',()=>{
  const projection={project:(lat,lon)=>({x:lon*10+500,y:500-lat*10,visible:true})};
  const nodes=[
    {id:'a',type:'PORT',category:'TRANSPORT',layer:'PORTS',position:{lat:1,lon:1}},
    {id:'b',type:'PORT',category:'TRANSPORT',layer:'PORTS',position:{lat:1.02,lon:1.02}},
    {id:'c',type:'POWER_PLANT',category:'ENERGY',layer:'ENERGY',position:{lat:8,lon:8}}
  ];
  const priority=new VisualPriorityManager();const cm=new ClusterManager();const result=cm.cluster(nodes,projection,{radius:50,priorityManager:priority});
  assert.equal(result.clusters.length,1);assert.equal(result.clusters[0].count,2);assert.equal(result.nodes.length,1);
  const lm=new LabelManager();const ctx={save(){},restore(){},set font(v){},measureText(t){return{width:t.length*7}}};
  const labels=lm.layout([{text:'CAPITAL',x:100,y:100,priority:100},{text:'PORT',x:100,y:100,priority:10}],{ctx,maxLabels:10});
  assert.equal(labels.length,2);assert.notDeepEqual(labels[0].box,labels[1].box);
});

test('LOT 4 — SelectionContext conserve caméra, sélection, vue et historique',()=>{
  const {state,camera}=mapFixture('WORLD');const layers=new LayerManagerV1();
  const selection=new SelectionContext({stateManager:state,layerManager:layers,mapCamera:camera,bus:bus()});
  selection.push('initial');state.patch({world:{centerX:12,centerY:4,zoom:3}},'test');selection.select('INFRASTRUCTURE','fr-port-marseille');
  assert.equal(state.get().selectedInfrastructure,'fr-port-marseille');assert.ok(selection.history.length>=3);
  state.setSelectedCountry('FR');state.setView('COUNTRY');selection.push('country');
  state.setView('WORLD');state.setSelectedCountry(null);selection.restore(selection.history.at(-1));
  assert.equal(state.get().view,'COUNTRY');assert.equal(state.get().selectedCountry,'FR');
  assert.equal(selection.back(),true);assert.equal(selection.forward(),true);
});

test('LOT 5 — Layer Manager presets et Auto Layers',()=>{
  const layers=new LayerManagerV1();layers.applyPreset('LOGISTICS');
  for(const l of ['PORTS','MARITIME','AVIATION','RAIL','ROAD','TRAFFIC'])assert.equal(layers.isEnabled(l),true);
  layers.setOnly([]);layers.enableAutoFor('SHIP');assert.equal(layers.isEnabled('MARITIME'),true);assert.equal(layers.isEnabled('CHOKEPOINTS'),true);
  layers.setOnly([]);layers.enableAutoFor('TRAIN');assert.equal(layers.isEnabled('RAIL'),true);assert.equal(layers.isEnabled('CARGO'),true);
});

test('LOTS 6–8 — trafic physique: planner, densité agrégée, 4 véhicules et waypoints',()=>{
  const {engine}=buildRouteEngine();const planner=new TrafficPlanner({routeEngine:engine});const spawner=new VehicleSpawner();
  assert.deepEqual([.1,.3,.5,.7,.9].map(r=>spawner.density(r)),[1,2,3,4,5]);
  assert.deepEqual(['SEA_ROUTE','AIR_ROUTE','RAIL_ROUTE','ROAD_ROUTE'].map(t=>spawner.descriptor(t).type),['SHIP','PLANE','TRAIN','TRUCK']);
  const flows=[
    {id:'f-sea',type:'oil',amount:60,from:'fr-port-marseille',to:'eg-suez',routes:['sea-mrs-suez']},
    {id:'f-air',type:'people',amount:30,from:'fr-air-cdg',to:'ae-air-dubai',routes:['air-cdg-dubai']},
    {id:'f-rail',type:'goods',amount:40,from:'fr-cap-paris',to:'fr-rail-lyon',routes:['rail-paris-lyon']},
    {id:'f-road',type:'food',amount:20,from:'fr-cap-paris',to:'fr-logistics-lyon',routes:['road-paris-lyon']}
  ];
  const plans=planner.plan(flows);assert.equal(plans.length,4);
  const result=spawner.reconcile(plans,{entities:[],byId:new Map()});const types=new Set(result.entities.map(e=>e.type));
  for(const t of ['SHIP','PLANE','TRAIN','TRUCK'])assert.ok(types.has(t));
  const sea=engine.get('sea-mrs-suez');assert.ok(sea.points.length>=4);assert.equal(sea.points[0].kind,'ORIGIN');assert.ok(sea.points.some(p=>p.kind&&p.kind!=='ORIGIN'&&p.kind!=='DESTINATION'));
});

test('LOT 6 — TrafficLogisticsEngine est alimenté par les flux de simulation, pas par du décor',()=>{
  const {engine}=buildRouteEngine();
  const mockSimulation={
    getSimulationTime:()=>({hour:12,day:2}),
    getInfrastructureFlows:()=>[
      {id:'sim-sea',type:'oil',amount:90,from:'fr-port-marseille',to:'eg-suez',routes:['sea-mrs-suez']},
      {id:'sim-rail',type:'goods',amount:70,from:'fr-cap-paris',to:'fr-port-marseille',routes:['rail-paris-lyon','rail-lyon-mrs']}
    ]
  };
  const traffic=new TrafficLogisticsEngine({routeEngine:engine,simulation:mockSimulation});traffic.syncFromSimulation(true);
  assert.ok(traffic.entities.length>=2);assert.ok(traffic.entities.every(e=>e.dataClass==='SIM_AGGREGATED_TRAFFIC'));
  const summary=traffic.summary();assert.equal(summary.accountingMode,'MIRROR');assert.ok(summary.byType.SHIP>=1);assert.ok(summary.byType.TRAIN>=1);
});

test('LOT 9 — blocage de Suez déclenche un chemin maritime alternatif via le Cap',()=>{
  const {engine}=buildRouteEngine();engine.beginUsageCycle();
  const normal=engine.shortestPath('fr-port-marseille','sg-port',{allowedTypes:['SEA_ROUTE'],capacityAware:true});
  assert.ok(normal.routes.includes('sea-mrs-suez'));assert.ok(!normal.routes.includes('sea-mrs-cape-singapore'));
  engine.setStatus('sea-mrs-suez','BLOCKED');
  const reroute=engine.shortestPath('fr-port-marseille','sg-port',{allowedTypes:['SEA_ROUTE'],capacityAware:true});
  assert.deepEqual(reroute.routes,['sea-mrs-cape-singapore']);assert.ok(reroute.cost>normal.cost);
});

test('LOT 9 — véhicule passe en REROUTING puis utilise la route alternative',()=>{
  const {engine}=buildRouteEngine();const spawner=new VehicleSpawner();
  const movement=new VehicleMovement({routeEngine:engine,descriptorResolver:t=>spawner.descriptor(t)});
  const e={id:'ship-x',type:'SHIP',routeId:'sea-mrs-suez',routePlan:['sea-mrs-suez','sea-suez-hormuz','sea-hormuz-singapore'],routeIndex:0,origin:'fr-port-marseille',destination:'sg-port',progress:.4,speedKph:42,flowIds:['f'],state:'MOVING',status:'MOVING'};
  engine.setStatus('sea-mrs-suez','BLOCKED');movement.update([e],.016,{simulationSpeed:1});
  assert.equal(e.state,'REROUTING');assert.equal(e.routeId,'sea-mrs-cape-singapore');
});

test('LOT 10 — Focus Mode garde sélection/relations visibles et atténue le reste à 15%',()=>{
  const {engine,nodeMap}=buildRouteEngine();const state=new StateManager(bus());const graph={get:id=>nodeMap.get(id)||null};
  const traffic={entities:[{id:'v1',routeId:'sea-mrs-suez',routePlan:['sea-mrs-suez']}],get(id){return this.entities.find(v=>v.id===id)||null;}};
  const focus=new FocusModeEngine({stateManager:state,infrastructureGraph:graph,routeEngine:engine,trafficEngine:traffic,bus:bus()});
  const f=focus.set('INFRASTRUCTURE','fr-port-marseille');assert.ok(f.routeIds.includes('sea-mrs-suez'));assert.ok(f.vehicleIds.includes('v1'));
  assert.equal(focus.alpha('INFRASTRUCTURE','fr-port-marseille'),1);assert.equal(focus.alpha('INFRASTRUCTURE','de-dc-frankfurt'),.15);assert.equal(focus.alpha('VEHICLE','v1'),.9);
  focus.clear();assert.equal(state.get().focus.active,false);
});

test('UI/interaction — WORLD/TERRITORY exposent souris, tactile, presets et commandes de carte',()=>{
  const worldView=fs.readFileSync(path.join(root,'src/views/WorldView.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const token of ['wheel','pointerdown','pointermove','pointerup','dblclick','touchAction'])assert.ok(worldView.includes(token),`WorldView contient ${token}`);
  for(const token of ['data-wi-map="zoom-in"','data-wi-map="zoom-out"','data-wi-map="fit"','data-wi-map="focus"','data-wi-map="follow"','data-wi-map="reset"','data-wi-preset="TRAFFIC"','data-wi-auto-layers'])assert.ok(html.includes(token),`index contient ${token}`);
});
