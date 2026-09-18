import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WorldEngine } from "../src/world/WorldEngine.js";
import { RealWorldDataStore } from "../src/game/realworld/RealWorldDataStore.js";
import { FlowDataStore } from "../src/game/flows/FlowDataStore.js";
import { WorldSimulation } from "../src/game/simulation/WorldSimulation.js";

const load=(path)=>readFile(new URL(path,import.meta.url),"utf8").then(JSON.parse);
async function makeWorldEngine(){
  const [world,countries,regions,cities,meta]=await Promise.all([
    load("../src/data/world.geojson"),load("../src/data/countries.json"),load("../src/data/regions.json"),load("../src/data/cities.json"),load("../src/data/country-meta.json")
  ]);
  const e=new WorldEngine();Object.assign(e,{geojson:world,features:world.features,countries,regions,cities,countryMeta:meta});
  e.byCode=new Map(world.features.map(f=>[f.properties.iso2,f]));e.regionById=new Map(regions.map(r=>[r.id,r]));e.metaByCode=new Map(meta.map(m=>[m.iso2,m]));return e;
}

let shared=null;
async function makeGlobalSimulation(){
  if(shared)return shared;
  const [rw,flow,worldEngine]=await Promise.all([load("../src/game/data/real-world-start-snapshot.json"),load("../src/game/data/flow-world-start-snapshot.json"),makeWorldEngine()]);
  const realStore=new RealWorldDataStore().loadStartSnapshot(rw);const flowStore=new FlowDataStore().load(flow);
  shared=new WorldSimulation({seed:505,worldEngine,realWorldDataStore:realStore,flowDataStore:flowStore,mode:"REAL_WORLD"}).init();
  shared.step(1);return shared;
}

test("V0.5 embarque un réseau mondial offline couvrant les six familles",async()=>{
  const snapshot=await load("../src/game/data/flow-world-start-snapshot.json");
  assert.equal(snapshot.mode,"REAL_WORLD_FLOW_START_SNAPSHOT");
  assert.equal(snapshot.offlineReady,true);
  assert.equal(snapshot.coverage.countries,175);
  assert.ok(snapshot.coverage.hubs>=600);
  assert.ok(snapshot.coverage.corridors>=5000);
  const families=new Set(snapshot.corridors.map(c=>c.family));
  for(const f of ["AIR","SEA","LAND","DATA"])assert.ok(families.has(f),f);
  assert.ok(snapshot.tradeDemands.length>2500);
  assert.ok(snapshot.energyDemands.length>250);
  assert.ok(snapshot.dataDemands.length>800);
});

test("la matrice trade est équilibrée sur les exports annuels de la baseline",async()=>{
  const snapshot=await load("../src/game/data/flow-world-start-snapshot.json");
  const exportsTotal=snapshot.profiles.reduce((s,p)=>s+p.exportsAnnualUsd,0);
  const flowTotal=snapshot.tradeDemands.reduce((s,d)=>s+d.annualUsd,0);
  assert.ok(Math.abs(flowTotal-exportsTotal)/exportsTotal<0.0005);
  assert.ok(snapshot.tradeDemands.every(d=>d.from!==d.to&&d.dataClass==="ESTIMATED_GRAVITY_FROM_REAL_ANCHORS"));
});

test("les corridors conservent capacité, fiabilité, provenance et mode explicites",async()=>{
  const store=new FlowDataStore().load(await load("../src/game/data/flow-world-start-snapshot.json"));
  assert.equal(store.validate(),true);
  assert.ok(store.corridors.every(c=>c.capacity>0&&c.reliability>0&&c.reliability<=1&&c.dataClass&&c.provenance));
  for(const mode of ["AIR","SEA","LAND","DATA_TERRESTRIAL","DATA_SUBMARINE","DATA_SPACE"]){
    assert.ok(store.corridors.some(c=>c.mode===mode),mode);
  }
});

test("la simulation V0.5 produit TRADE + ENERGY + AIR + SEA + LAND + DATA",async()=>{
  const sim=await makeGlobalSimulation();
  const families=new Set(sim.getFlows().map(f=>f.family));
  for(const f of ["TRADE","ENERGY","AIR","SEA","LAND","DATA"])assert.ok(families.has(f),f);
  assert.ok(sim.getFlows().length>5000);
  assert.equal(sim.validate(),true);
  const net=sim.getFlowNetworkSummary();
  assert.ok(net.corridors>=5000);
  assert.ok(net.byFamily.AIR&&net.byFamily.SEA&&net.byFamily.LAND&&net.byFamily.DATA);
});

test("les couches stratégiques limitent le rendu sans supprimer la simulation",async()=>{
  const sim=await makeGlobalSimulation();
  const total=sim.getFlows().length;
  const globe=sim.getVisualFlows({view:"GLOBE"});
  const world=sim.getVisualFlows({view:"WORLD"});
  assert.ok(total>world.length);
  assert.ok(globe.length<=48);
  assert.ok(world.length<=110);
  sim.setFlowLayer("SEA");
  const sea=sim.getVisualFlows({view:"WORLD",layer:"SEA"});
  assert.ok(sea.length>0&&sea.length<=140);
  assert.ok(sea.every(f=>f.family==="SEA"));
  sim.setFlowLayer("GLOBAL");
});

test("filtre DATA distingue terrestre, sous-marin et spatial",async()=>{
  const sim=await makeGlobalSimulation();
  sim.setFlowLayer("DATA");
  for(const [mode,expected] of [["TERRESTRIAL","DATA_TERRESTRIAL"],["SUBMARINE","DATA_SUBMARINE"],["SPACE","DATA_SPACE"]]){
    sim.setDataFlowMode(mode);
    const flows=sim.getVisualFlows({view:"WORLD",layer:"DATA"});
    assert.ok(flows.length>0,mode);
    assert.ok(flows.every(f=>f.mode===expected),mode);
  }
  sim.setDataFlowMode("ALL");sim.setFlowLayer("GLOBAL");
});


test("un corridor peut être perturbé ou fermé sans corrompre le graphe",async()=>{
  const sim=await makeGlobalSimulation();
  const corridor=sim.flows.network.all().find(c=>c.family==="SEA");
  assert.ok(corridor);
  assert.equal(sim.setFlowCorridorState(corridor.id,{status:"CLOSED",disruption:1}),true);
  assert.equal(sim.flows.network.effectiveCapacity(corridor),0);
  const alternate=sim.flows.route(corridor.from,corridor.to,{mode:"SEA"});
  if(alternate)assert.ok(alternate.edges.every(e=>e.id!==corridor.id));
  assert.equal(sim.setFlowCorridorState(corridor.id,{status:"OPEN",disruption:0}),true);
});
test("UI et API V0.5 exposent filtres et rendu des flux",async()=>{
  const [app,api,renderer,panel,css]=await Promise.all([
    readFile(new URL("../src/core/App.js",import.meta.url),"utf8"),readFile(new URL("../src/game/GameAPI.js",import.meta.url),"utf8"),
    readFile(new URL("../src/visual/StrategicFlowRenderer.js",import.meta.url),"utf8"),readFile(new URL("../src/ui/FlowLayerPanel.js",import.meta.url),"utf8"),readFile(new URL("../style.css",import.meta.url),"utf8")
  ]);
  assert.match(app,/new FlowDataStore/);assert.match(app,/FlowLayerPanel/);assert.match(api,/getVisualFlows/);assert.match(api,/setFlowLayer/);
  assert.match(renderer,/family==="DATA"/);assert.match(panel,/FLOW LAYER/);assert.match(css,/\.world-flow-layers/);
});
