import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WorldEngine } from "../src/world/WorldEngine.js";
import { RealWorldDataStore } from "../src/game/realworld/RealWorldDataStore.js";
import { FlowDataStore } from "../src/game/flows/FlowDataStore.js";
import { WorldSimulation } from "../src/game/simulation/WorldSimulation.js";
import { PropagationQueue } from "../src/game/events/PropagationQueue.js";

const load=(path)=>readFile(new URL(path,import.meta.url),"utf8").then(JSON.parse);
async function makeWorldEngine(){
  const [world,countries,regions,cities,meta]=await Promise.all([
    load("../src/data/world.geojson"),load("../src/data/countries.json"),load("../src/data/regions.json"),load("../src/data/cities.json"),load("../src/data/country-meta.json")
  ]);
  const e=new WorldEngine();Object.assign(e,{geojson:world,features:world.features,countries,regions,cities,countryMeta:meta});
  e.byCode=new Map(world.features.map(f=>[f.properties.iso2,f]));e.regionById=new Map(regions.map(r=>[r.id,r]));e.metaByCode=new Map(meta.map(m=>[m.iso2,m]));return e;
}
async function makeSimulation(seed=606){
  const [rw,flow,worldEngine]=await Promise.all([load("../src/game/data/real-world-start-snapshot.json"),load("../src/game/data/flow-world-start-snapshot.json"),makeWorldEngine()]);
  return new WorldSimulation({seed,worldEngine,realWorldDataStore:new RealWorldDataStore().loadStartSnapshot(rw),flowDataStore:new FlowDataStore().load(flow),mode:"REAL_WORLD"}).init();
}

test("V0.6 initialise budget, réserves et stratégie pour les 175 pays",async()=>{
  const sim=await makeSimulation();
  assert.equal(sim.states.size,175);
  for(const state of sim.states.values()){
    assert.ok(state.policy?.budget?.treasury>=0);
    assert.ok(state.policy.budget.monthlyRevenue>0);
    assert.ok(state.policy.reserveTargetRatio.energy>0 && state.policy.reserveTargetRatio.energy<1);
    assert.deepEqual(Object.keys(state.policy.supplierPreferences).sort(),["data","energy","food","goods"]);
  }
});

test("IA pays produit des décisions explicables et bornées par budget",async()=>{
  const sim=await makeSimulation(607);
  const fr=sim.getCountry("FR");
  fr.resources.energy.shortage=0.92;fr.resources.energy.stock=fr.resources.energy.stockCapacity*0.12;fr.policy.lastReviewDay=0;
  const planned=sim.policyAI.plan(sim.states,{relations:sim.relations,flowEngine:sim.flows,day:30}).filter(d=>d.country==="FR");
  assert.ok(planned.length>=2);
  assert.ok(planned.some(d=>d.type==="DIVERSIFY_SUPPLIERS"||d.type==="BUILD_RESERVE"));
  assert.ok(planned.every(d=>d.reason&&d.cost>=0));
  const before=fr.policy.budget.treasury;
  const applied=sim.policySystem.applyAll(planned,{states:sim.states,flowEngine:sim.flows,day:30});
  assert.ok(applied.some(r=>r.applied));
  assert.ok(fr.policy.budget.treasury<=before);
  assert.ok(sim.getCountryDecisions("FR").length>0);
});

test("diversification fournisseurs modifie les préférences de routage",async()=>{
  const sim=await makeSimulation(608);const target=sim.getCountry("FR");
  target.resources.energy.shortage=0.9;target.resources.energy.stock=target.resources.energy.stockCapacity*0.1;
  const alternatives=sim.flows.findAlternativeSuppliers(sim.states,"FR","energy",5);
  assert.ok(alternatives.length>0);
  const supplier=alternatives[0].code;const base=sim.flows.partnerWeight(supplier,"FR","energy");
  sim.flows.setSupplierPreferences("FR","energy",[supplier],180);
  assert.ok(sim.flows.partnerWeight(supplier,"FR","energy")>base);
});

test("PropagationQueue applique les conséquences avec délai et causalité",async()=>{
  const sim=await makeSimulation(609);const q=new PropagationQueue();const before=sim.getCountry("DE").metrics.economy.pressure;
  q.schedule({dueDay:10,target:"DE",metric:"economy",delta:-0.12,source:"FR",eventId:"T1",cause:"TEST_RIPPLE"});
  assert.equal(q.process(sim.states,9).length,0);
  const applied=q.process(sim.states,10);assert.equal(applied.length,1);
  assert.ok(sim.getCountry("DE").metrics.economy.pressure<before);
  assert.equal(applied[0].source,"FR");
});

test("WorldEventDirector génère événement autonome et effets retardés",async()=>{
  const sim=await makeSimulation(610);sim.events.nextDay=1;
  const events=sim.events.update(sim.states,1,{flowEngine:sim.flows,relations:sim.relations,propagation:sim.propagation,ledger:sim.ledger});
  assert.equal(events.length,1);assert.ok(events[0].type);assert.ok(events[0].endDay>1);
  assert.ok(sim.ledger.list({kind:"WORLD_EVENT"}).length===1);
  assert.ok(sim.propagation.queue.length>0);
});

test("même seed produit les mêmes plans autonomes",async()=>{
  const [a,b]=await Promise.all([makeSimulation(611),makeSimulation(611)]);
  const pa=a.policyAI.plan(a.states,{relations:a.relations,flowEngine:a.flows,day:30});
  const pb=b.policyAI.plan(b.states,{relations:b.relations,flowEngine:b.flows,day:30});
  assert.deepEqual(pa,pb);
});

test("API V0.6 expose politique, décisions, événements et propagation",async()=>{
  const [api,world]=await Promise.all([
    readFile(new URL("../src/game/GameAPI.js",import.meta.url),"utf8"),
    readFile(new URL("../src/game/simulation/WorldSimulation.js",import.meta.url),"utf8")
  ]);
  for(const symbol of ["getCountryPolicy","getCountryDecisions","getActiveWorldEvents","getPendingPropagation"])assert.match(api,new RegExp(symbol));
  assert.match(world,/CountryPolicyAI/);assert.match(world,/PropagationQueue/);assert.match(world,/DecisionLedger/);
});
