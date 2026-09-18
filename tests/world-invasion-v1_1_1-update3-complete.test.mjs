import test from 'node:test';
import assert from 'node:assert/strict';
import { AllianceBlocSystem } from '../src/game/diplomacy/AllianceBlocSystem.js';
import { IntelligenceEngine } from '../src/game/intelligence/IntelligenceEngine.js';
import { StrategicObjectiveEngine } from '../src/game/ai/StrategicObjectiveEngine.js';
import { CountryPolicyAI } from '../src/game/ai/CountryPolicyAI.js';
import { CountryPolicySystem } from '../src/game/ai/CountryPolicySystem.js';
import { CausalEventEngine } from '../src/game/simulation/CausalEventEngine.js';
import { FeedbackLoopEngine } from '../src/game/systems/FeedbackLoopEngine.js';
import { WorldMemory } from '../src/game/history/WorldMemory.js';
import { ScenarioEngine } from '../src/game/scenario/ScenarioEngine.js';

const metric=(current=60)=>({current,baseline:current,pressure:0});
const fullState=(code,overrides={})=>({
  code,
  metrics:{stability:metric(65),resilience:metric(65),militaryReadiness:metric(65),economy:metric(65),energy:metric(65),food:metric(65),infrastructure:metric(65),technology:metric(65),science:metric(65),cohesion:metric(65),diplomaticInfluence:metric(60),awareness:metric(35)},
  resources:{food:{shortage:0,productionCapacity:10,stock:50,stockCapacity:100,consumption:1,priceIndex:100},energy:{shortage:0,productionCapacity:10,stock:50,stockCapacity:100,consumption:1,priceIndex:100},goods:{shortage:0,stock:50,stockCapacity:100,consumption:1,priceIndex:100},data:{shortage:0,stock:50,stockCapacity:100,consumption:1,priceIndex:100}},
  policy:{priorities:{infrastructure:.5,energy:.5,data:.5,resilience:.5,science:.5,technology:.5},budget:{treasury:100,monthlyRevenue:10,debt:0,debtLimit:100,spentThisYear:0},reserveTargetRatio:{food:.5,energy:.5,goods:.5,data:.5},supplierPreferences:{food:[],energy:[],goods:[],data:[]},adaptation:{diversification:0,stockpiling:0,investment:0,aid:0},lastReviewDay:0,lastDecisionDay:0,decisionCount:0},
  ...overrides
});

function relationStore(edges){
  const map=new Map(edges.map(e=>[`${e.from}>${e.to}`,e]));
  return {all:()=>[...map.values()],get:(a,b)=>map.get(`${a}>${b}`)||null,outgoing:(a)=>[...map.values()].filter(e=>e.from===a),routeCache:{clear(){}}};
}

function bilateral(codes,value=82){
  const rows=[];for(const a of codes)for(const b of codes)if(a!==b)rows.push({from:a,to:b,diplomaticRelation:value,trust:value,alliance:value,trade:75,energyDependency:30,technologyDependency:35});return rows;
}

test('Strategic Blocs expose JOIN, SUSPEND/LEAVE et statut de membership',()=>{
  const states=new Map(['AA','BB','CC','DD'].map(c=>[c,fullState(c)]));
  const edges=bilateral(['AA','BB','CC'],84);
  for(const c of ['AA','BB','CC']){edges.push({from:c,to:'DD',diplomaticRelation:40,trust:40,alliance:30,trade:45});edges.push({from:'DD',to:c,diplomaticRelation:40,trust:40,alliance:30,trade:45});}
  const relations=relationStore(edges),world={getCountryMeta:()=>({region:'TEST'})};
  const system=new AllianceBlocSystem();
  const first=system.review(states,relations,world,0);
  assert.ok(first.blocs.length>=1);assert.equal(system.getMembership('AA').status,'ACTIVE');assert.ok(system.getTransitions({country:'AA'}).some(t=>t.type==='JOIN'));
  for(const e of edges){if(['AA','BB','CC'].includes(e.from)&&['AA','BB','CC'].includes(e.to)){e.diplomaticRelation=12;e.trust=10;e.alliance=8;}}
  system.review(states,relations,world,90);
  assert.ok(['DISTANCING','UNALIGNED'].includes(system.getMembership('AA').status));assert.ok(system.getTransitions({country:'AA'}).some(t=>['LEAVE','DISTANCE'].includes(t.type)));
});

test('Intelligence Engine combine six sources et masque les valeurs exactes par une estimation',()=>{
  const states=new Map([['AA',fullState('AA')],['BB',fullState('BB',{derivedSystems:{energy:{energySecurity:72}}})]]);
  const edge={from:'AA',to:'BB',trust:55,distanceKm:1800};const relations={outgoing:c=>c==='AA'?[edge]:[]};
  const graph={forCountry:()=>[{id:'r1',type:'RADAR'},{id:'g1',type:'GROUND_STATION'},{id:'d1',type:'DATACENTER'},{id:'i1',type:'IXP'}]};
  const runtime={statusFactor:()=>1};const random={range:(a,b)=>(a+b)/2};
  const engine=new IntelligenceEngine({random,infrastructureGraph:graph,runtime});engine.update(states,relations,{sameBloc:()=>false},{day:14});
  const row=engine.get('AA','BB');
  for(const key of ['satellite','radar','reconnaissance','allies','cyber','openSources'])assert.ok(key in row.sources,key);
  assert.ok(['ESTIMATED','PROBABLE','CONFIRMED'].includes(row.level));assert.ok(row.estimate);assert.equal(row.estimate.dataClass,'SIM_INTELLIGENCE_ESTIMATE');assert.equal(row.lastObservedDay,14);
});

test('Strategic Objective Engine intègre menace, opportunité, ressources et historique',()=>{
  const aa=fullState('AA');aa.metrics.militaryReadiness.current=35;aa.metrics.stability.current=42;aa.resources.energy.shortage=.7;
  const bb=fullState('BB');const states=new Map([['AA',aa],['BB',bb]]);
  const edge={from:'AA',to:'BB',trust:10,diplomaticRelation:12,alliance:8,trade:35};const relations={outgoing:c=>c==='AA'?[edge]:[]};
  const memory=new WorldMemory();memory.remember({day:10,kind:'WAR',country:'AA',target:'BB',importance:.9});
  const engine=new StrategicObjectiveEngine();engine.review(states,30,{relations,worldMemory:memory,blocs:{getBlocFor:()=>null}});
  const row=engine.get('AA');assert.equal(row.ranking.length,8);assert.ok(row.factors.threat>60);assert.ok(row.factors.energyStress>60);assert.ok(['SURVIVAL','SECURITY','ENERGY_SECURITY','TERRITORIAL_CONTROL'].includes(row.primary));
});

test('Country Policy AI transforme les objectifs stratégiques en actions concrètes',()=>{
  const state=fullState('AA');state.strategicObjectives={primary:'INFLUENCE'};
  const states=new Map([['AA',state],['BB',fullState('BB')]]);const relations=relationStore([{from:'AA',to:'BB',trust:82,diplomaticRelation:80,trade:75,alliance:70}]);
  const ai=new CountryPolicyAI({});const rows=ai.strategicActions(state,{states,relations,day:30,goal:'INFLUENCE',budget:100,monthly:10});
  assert.ok(rows.some(r=>r.type==='REINFORCE_ALLIANCE'));assert.ok(rows.some(r=>r.type==='SIGN_AGREEMENT'));
});

test('Country Policy System applique route, alliance, accord, sanction, base et déploiement',()=>{
  const aa=fullState('AA'),bb=fullState('BB');const states=new Map([['AA',aa],['BB',bb]]);const edge={from:'AA',to:'BB',trust:60,diplomaticRelation:60,trade:60,alliance:50,transport:55,capacities:{SEA:10}},reverse={from:'BB',to:'AA',trust:60,diplomaticRelation:60,trade:60,alliance:50,transport:55,capacities:{SEA:10}};const relations=relationStore([edge,reverse]);
  const ledger={rows:[],record(x){this.rows.push(x);return x;}};const budget={spend(s,a){s.policy.budget.treasury-=a;s.policy.budget.spentThisYear+=a;return true;}};
  const system=new CountryPolicySystem({budgetSystem:budget,ledger,agreementSystem:{sign:x=>({id:'AGX',...x,endDay:x.day+720,scope:x.scope})},sanctionSystem:{impose:x=>({id:'SAX',...x,endDay:x.day+180})}});
  const context={states,relations,day:30};
  for(const decision of [
    {type:'REINFORCE_BASE',country:'AA',cost:1},{type:'DEPLOY_UNITS',country:'AA',target:'BB',cost:1},{type:'REINFORCE_ALLIANCE',country:'AA',target:'BB',cost:1},{type:'OPEN_ROUTE',country:'AA',target:'BB',cost:1},{type:'SIGN_AGREEMENT',country:'AA',target:'BB',scope:'TRADE',cost:1},{type:'IMPOSE_SANCTION',country:'AA',target:'BB',resource:'goods',cost:1}
  ]) assert.equal(system.apply(decision,context).applied,true,decision.type);
  assert.ok(edge.trust>60);assert.ok(edge.transport>55);assert.ok(aa.policy.deployments.length===1);assert.ok(aa.metrics.militaryReadiness.baseline>65);
});

test('Causal Event Engine peut produire un blocus géopolitique et historiser ses étapes',()=>{
  const states=new Map([['AA',fullState('AA')],['BB',fullState('BB')]]);const edge={from:'AA',to:'BB',diplomaticRelation:10,trust:10,alliance:10};const relations=relationStore([edge]);
  const corridor={id:'SEA1',family:'SEA',from:'AA',to:'BB',status:'OPEN',disruption:0,reliability:1,importance:1};let applied=null;
  const flowEngine={network:{all:()=>[corridor]},setCorridorState:(id,state)=>{applied={id,state};Object.assign(corridor,state);return true;}};
  const random={next:()=>0,range:(a,b)=>(a+b)/2};const memory=new WorldMemory({startDate:'2032-04-11'});const engine=new CausalEventEngine({random,worldMemory:memory});
  const rows=engine.evaluate(states,7,{relations,flowEngine,sanctions:{impose:()=>null},agreements:{sign:()=>null}});
  const blockade=rows.find(r=>r.type==='BLOCKADE');assert.ok(blockade);assert.equal(blockade.corridorId,'SEA1');assert.ok(applied?.state?.disruption>0);
  engine.evaluate(states,9,{relations,flowEngine});const timeline=memory.timeline({country:'AA'});assert.ok(timeline.some(r=>r.kind==='BLOCKADE'));assert.ok(timeline.some(r=>r.kind==='RIPPLE'));assert.ok(timeline.every(r=>/^2032-04-\d{2}$/.test(r.date)));
});

test('Feedback Loop Engine expose boucles positives et négatives',()=>{
  const good=fullState('GG',{derivedSystems:{energy:{energySecurity:82}},economyV1:{logisticsCapacity:80}});good.metrics.economy.current=78;good.metrics.infrastructure.current=75;good.metrics.stability.current=72;
  const bad=fullState('BB',{derivedSystems:{energy:{energySecurity:25}},economyV1:{logisticsCapacity:35}});bad.metrics.economy.current=35;bad.metrics.stability.current=30;
  const engine=new FeedbackLoopEngine();engine.update(new Map([['GG',good],['BB',bad]]),{day:7,events:[{type:'WAR',country:'BB',target:'XX'}],worldMemory:new WorldMemory()});
  assert.ok(engine.get('GG').loops.some(l=>l.polarity==='POSITIVE'));assert.ok(engine.get('BB').loops.some(l=>l.polarity==='NEGATIVE'));assert.ok(engine.summary().positive>0&&engine.summary().negative>0);
});

test('World Memory date les événements et conserve une path dependency',()=>{
  const m=new WorldMemory({startDate:'2032-04-01'});m.remember({day:17,kind:'BLOCKADE',country:'AA',target:'BB',pathEffects:{trust:-8,cooperation:-4,hostility:10}});
  const row=m.timeline({country:'AA'})[0];assert.equal(row.date,'2032-04-18');assert.equal(row.category,'CONFLICT');assert.deepEqual(m.effect('AA','BB'),{trust:-8,cooperation:-4,hostility:10});
});

test('Scenario replayKey varie avec les décisions et reste stable à configuration identique',()=>{
  const config={startingWorldState:{countries:{AA:{metrics:{economy:40}}}},rules:{fogOfWar:true},events:[{type:'TEST'}],objectives:['SURVIVAL'],decisions:[{day:2,type:'INVEST',country:'AA'}]};
  const a=new ScenarioEngine({seed:8152042,mode:'SCENARIO'}).configure(config);const b=new ScenarioEngine({seed:8152042,mode:'SCENARIO'}).configure(config);assert.equal(a.descriptor().replayKey,b.descriptor().replayKey);
  b.recordDecisionInput({day:3,type:'SANCTION',country:'AA',target:'BB'});assert.notEqual(a.descriptor().replayKey,b.descriptor().replayKey);assert.match(a.descriptor().determinismContract,/same engine version/i);
});
