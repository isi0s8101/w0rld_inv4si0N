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
  const e=new WorldEngine();Object.assign(e,{geojson:world,features:world.features,countries,regions,cities,countryMeta:meta});e.byCode=new Map(world.features.map(f=>[f.properties.iso2,f]));e.regionById=new Map(regions.map(r=>[r.id,r]));e.metaByCode=new Map(meta.map(m=>[m.iso2,m]));return e;
}
async function makeSimulation(seed=808){
  const [rw,flow,worldEngine]=await Promise.all([load("../src/game/data/real-world-start-snapshot.json"),load("../src/game/data/flow-world-start-snapshot.json"),makeWorldEngine()]);
  return new WorldSimulation({seed,worldEngine,realWorldDataStore:new RealWorldDataStore().loadStartSnapshot(rw),flowDataStore:new FlowDataStore().load(flow),mode:"REAL_WORLD"}).init();
}

test("V0.8 initialise politique extérieure, spécialisation et opinion pour 175 pays",async()=>{
  const sim=await makeSimulation();assert.equal(sim.states.size,175);for(const s of sim.states.values()){assert.ok(s.foreignPolicy?.doctrine);assert.ok(s.specialization?.primary);assert.ok(s.publicOpinion);}
});

test("diplomatie dynamique conserve un historique et une tendance explicables",async()=>{
  const sim=await makeSimulation(809);const edge=sim.relations.all()[0];const before=edge.relationHistory.length;sim.diplomacy.update(sim.states,sim.relations,{agreements:sim.agreements,sanctions:sim.sanctions,blocs:sim.blocs,day:30});assert.ok(edge.relationHistory.length>=before);assert.ok(Number.isFinite(edge.relationTrend));assert.equal(edge.dataClassDiplomacy,"SIM_RELATION_HISTORY");
});

test("alliances et blocs sont dérivés des relations simulées sans les présenter comme faits réels",async()=>{
  const sim=await makeSimulation(810);const all=sim.getAlliances();const blocs=sim.getBlocs();assert.ok(Array.isArray(all));assert.ok(Array.isArray(blocs));for(const a of all)assert.equal(a.dataClass,"SIM_ALLIANCE");for(const b of blocs)assert.equal(b.dataClass,"SIM_DYNAMIC_BLOC");
});

test("accords commerciaux modifient le poids partenaire et les conditions de prix",async()=>{
  const sim=await makeSimulation(811);const edge=sim.relations.all().find(e=>e.from!=="AQ"&&e.to!=="AQ");edge.diplomaticRelation=90;edge.trust=90;edge.trade=90;sim.agreements.review(sim.states,sim.relations,sim.blocs,90);const ag=sim.agreements.list({country:edge.from,status:"ACTIVE"}).find(a=>a.to===edge.to);assert.ok(ag);const mod=sim.agreements.modifiers(edge.from,edge.to,"goods");assert.ok(mod.weight>0||mod.capacity>1);assert.ok(mod.price<=1);
});

test("sanctions abstraites peuvent bloquer un couple ressource sans fermer physiquement le corridor",async()=>{
  const sim=await makeSimulation(812);sim.sanctions.sanctions.push({id:"TEST",from:"FR",to:"DE",type:"EMBARGO",resource:"energy",severity:.8,startDay:1,endDay:500,status:"ACTIVE",dataClass:"SIM_ABSTRACT_POLICY"});const m=sim.flows.tradeAccess("FR","DE","energy");assert.equal(m.blocked,true);const route=sim.flows.route("FR","DE",{mode:null});assert.ok(route?.edges?.length>0);
});

test("dépendances stratégiques séparent besoin d'import et concentration fournisseurs",async()=>{
  const sim=await makeSimulation(813);sim.dependencies.update(sim.states,{contracts:sim.contracts,flowEngine:sim.flows,day:30});const dep=sim.getDependencies("FR");assert.ok(dep);assert.ok(dep.overall>=0&&dep.overall<=1);for(const r of Object.values(dep.resources)){assert.ok(r.importDependency>=0&&r.importDependency<=1);assert.ok(r.supplierConcentration>=0&&r.supplierConcentration<=1);}
});

test("politique extérieure est réévaluée trimestriellement et historisée",async()=>{
  const sim=await makeSimulation(814);const fr=sim.getCountry("FR");fr.resources.energy.shortage=.95;const rows=sim.foreignPolicy.review(sim.states,90);assert.ok(rows.find(r=>r.country==="FR"));assert.ok(fr.foreignPolicy.history.length>=2);assert.ok(["OPEN_TRADE","REGIONAL_COOPERATION","STRATEGIC_AUTONOMY","TECHNOLOGY_FIRST","SECURITY_FIRST","BALANCED"].includes(fr.foreignPolicy.doctrine));
});

test("opinion et awareness globales réagissent aux tensions et restent bornées",async()=>{
  const sim=await makeSimulation(815);const before=sim.getWorldOpinion().state.awareness;for(const s of [...sim.states.values()].slice(0,30)){for(const r of Object.values(s.resources))r.shortage=.9;}sim.opinion.update(sim.states,{events:[{type:"STRESS"}],sanctions:sim.sanctions,agreements:sim.agreements,day:30});const after=sim.getWorldOpinion().state;assert.ok(after.awareness>=before);for(const k of ["awareness","cooperation","tension","confidence"])assert.ok(after[k]>=0&&after[k]<=100);
});

test("cycle V0.8 relie diplomatie, économie, contrats, blocs et opinion",async()=>{
  const sim=await makeSimulation(816);sim.step(120);const sum=sim.globalSummary();assert.equal(sim.validate(),true);assert.equal(sum.countries,175);assert.equal(typeof sum.alliances,"number");assert.equal(typeof sum.blocs,"number");assert.equal(typeof sum.activeAgreements,"number");assert.equal(typeof sum.activeSanctions,"number");assert.ok(sum.worldOpinion?.awareness>=0);
});

test("API et Focus Panel V0.8 exposent les nouvelles couches sans masquer leur nature SIM/DERIVED",async()=>{
  const [api,ui]=await Promise.all([readFile(new URL("../src/game/GameAPI.js",import.meta.url),"utf8"),readFile(new URL("../src/ui/FocusPanel.js",import.meta.url),"utf8")]);for(const x of ["getDiplomacy","getAlliances","getBlocs","getAgreements","getSanctions","getDependencies","getSpecialization","getForeignPolicy","getWorldOpinion"])assert.match(api,new RegExp(x));for(const x of ["FOREIGN POLICY · SIM","SPECIALIZATION · DERIVED","DEPENDENCY · DERIVED","BLOCS · SIM","SANCTIONS · SIM","WORLD AWARENESS · SIM"])assert.match(ui,new RegExp(x));
});
