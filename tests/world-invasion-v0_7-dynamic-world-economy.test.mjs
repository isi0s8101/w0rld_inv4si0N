import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WorldEngine } from "../src/world/WorldEngine.js";
import { RealWorldDataStore } from "../src/game/realworld/RealWorldDataStore.js";
import { FlowDataStore } from "../src/game/flows/FlowDataStore.js";
import { WorldSimulation } from "../src/game/simulation/WorldSimulation.js";

const load=(path)=>readFile(new URL(path,import.meta.url),"utf8").then(JSON.parse);
async function makeWorldEngine(){
  const [world,countries,regions,cities,meta]=await Promise.all([load("../src/data/world.geojson"),load("../src/data/countries.json"),load("../src/data/regions.json"),load("../src/data/cities.json"),load("../src/data/country-meta.json")]);
  const e=new WorldEngine();Object.assign(e,{geojson:world,features:world.features,countries,regions,cities,countryMeta:meta});
  e.byCode=new Map(world.features.map(f=>[f.properties.iso2,f]));e.regionById=new Map(regions.map(r=>[r.id,r]));e.metaByCode=new Map(meta.map(m=>[m.iso2,m]));return e;
}
async function makeSimulation(seed=707){
  const [rw,flow,worldEngine]=await Promise.all([load("../src/game/data/real-world-start-snapshot.json"),load("../src/game/data/flow-world-start-snapshot.json"),makeWorldEngine()]);
  return new WorldSimulation({seed,worldEngine,realWorldDataStore:new RealWorldDataStore().loadStartSnapshot(rw),flowDataStore:new FlowDataStore().load(flow),mode:"REAL_WORLD"}).init();
}

test("V0.7 initialise quatre marchés mondiaux dynamiques",async()=>{
  const sim=await makeSimulation();const markets=sim.getMarket();
  assert.deepEqual(Object.keys(markets).sort(),["data","energy","food","goods"]);
  for(const m of Object.values(markets)){assert.ok(Number.isFinite(m.priceIndex));assert.ok(m.priceIndex>0);assert.ok(Number.isFinite(m.supply));assert.ok(Number.isFinite(m.demand));}
});

test("le prix mondial réagit à une pénurie agrégée sans sortir des bornes",async()=>{
  const sim=await makeSimulation(708);const before=sim.getMarket("energy").priceIndex;
  for(const state of sim.states.values()){state.resources.energy.production=state.resources.energy.consumption*0.25;state.resources.energy.shortage=0.8;}
  sim.market.update(sim.states,1);const after=sim.getMarket("energy").priceIndex;
  assert.ok(after>before);assert.ok(after>=58&&after<=260);
});

test("contrat long terme crée une expédition puis une livraison différée",async()=>{
  const sim=await makeSimulation(709);const buyer=sim.getCountry("FR"),seller=sim.getCountry("DE");
  buyer.policy.budget.treasury=100;seller.resources.energy.stock=seller.resources.energy.stockCapacity*0.9;
  const c=sim.contracts.sign({buyer:"FR",seller:"DE",resource:"energy",dailyAmount:0.12,day:1,marketPriceIndex:100});assert.ok(c);
  sim.flows.network.resetDay();const dispatch=sim.contracts.step(sim.states,sim.flows,sim.market,2);assert.ok(sim.contracts.shipments.length>0);assert.ok((dispatch.transfers.get("DE")?.energy?.exports||0)>0);
  const shipment=sim.contracts.shipments[0];let delivered=null;
  for(let day=3;day<=shipment.arrivalDay;day++){sim.flows.network.resetDay();delivered=sim.contracts.step(sim.states,sim.flows,sim.market,day);}
  assert.equal(shipment.status,"DELIVERED");assert.ok((delivered.transfers.get("FR")?.energy?.imports||0)>0);assert.ok(c.delivered>0);
});

test("projet d'infrastructure est financé dans le temps et produit un effet structurel",async()=>{
  const sim=await makeSimulation(710);const fr=sim.getCountry("FR");fr.policy.budget.treasury=100;
  const before=fr.metrics.energy.baseline;const p=sim.projects.start(fr,"ENERGY",1,{totalCost:0.1,durationDays:30});assert.ok(p);
  sim.projects.update(sim.states,sim.flows,31);assert.equal(p.status,"COMPLETED");assert.ok(fr.metrics.energy.baseline>before);assert.ok(fr.resources.energy.productionCapacity>0);
});

test("stratégie nationale est réévaluée sur horizon trimestriel",async()=>{
  const sim=await makeSimulation(711);const fr=sim.getCountry("FR");fr.metrics.resilience.current=20;fr.resources.food.shortage=0.7;
  const rows=sim.strategy.review(sim.states,sim.market,90);const r=rows.find(x=>x.country==="FR");assert.ok(r);assert.ok(["SECURITY","RESILIENCE","GROWTH","TECHNOLOGY","BALANCED"].includes(fr.policy.strategy));assert.ok(sim.ledger.list({kind:"STRATEGY_REVIEW",country:"FR"}).length>0);
});

test("IA V0.7 peut sécuriser un approvisionnement par contrat",async()=>{
  const sim=await makeSimulation(712);const fr=sim.getCountry("FR");fr.resources.energy.shortage=0.95;fr.resources.energy.stock=fr.resources.energy.stockCapacity*0.08;fr.resources.energy.priceIndex=185;fr.policy.lastReviewDay=0;
  const planned=sim.policyAI.plan(sim.states,{relations:sim.relations,flowEngine:sim.flows,contractSystem:sim.contracts,projectSystem:sim.projects,marketSystem:sim.market,day:30}).filter(d=>d.country==="FR");
  assert.ok(planned.some(d=>d.type==="SIGN_CONTRACT"));
});

test("résumé global expose marchés, contrats, projets et expéditions",async()=>{
  const sim=await makeSimulation(713);const s=sim.globalSummary();assert.ok(s.markets?.energy);assert.equal(typeof s.activeContracts,"number");assert.equal(typeof s.activeProjects,"number");assert.equal(typeof s.inTransitShipments,"number");
});

test("snapshot V0.7 conserve économie dynamique et projets longs",async()=>{
  const sim=await makeSimulation(714);const snap=sim.snapshot();assert.equal(snap.version,3);assert.ok(snap.markets?.markets?.food);assert.ok(Array.isArray(snap.contracts?.contracts));assert.ok(Array.isArray(snap.projects?.projects));
});

test("API V0.7 expose marchés, contrats et infrastructures",async()=>{
  const api=await readFile(new URL("../src/game/GameAPI.js",import.meta.url),"utf8");for(const symbol of ["getMarket","getContracts","getProjects"])assert.match(api,new RegExp(symbol));
});

test("Focus Panel V0.7 expose marché, contrats et projets sans masquer la provenance",async()=>{
  const ui=await readFile(new URL("../src/ui/FocusPanel.js",import.meta.url),"utf8");
  assert.match(ui,/ENERGY MARKET/);assert.match(ui,/FOOD MARKET/);assert.match(ui,/CONTRACTS · SIM/);assert.match(ui,/PROJECTS · SIM/);assert.match(ui,/REAL \/ EST \/ DERIVED/);
});
