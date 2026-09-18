import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldMemory } from '../src/game/history/WorldMemory.js';
import { ScenarioEngine } from '../src/game/scenario/ScenarioEngine.js';
import { CausalEventEngine } from '../src/game/simulation/CausalEventEngine.js';
import { StrategicObjectiveEngine } from '../src/game/ai/StrategicObjectiveEngine.js';
import { DiplomacySystem } from '../src/game/diplomacy/DiplomacySystem.js';

test('World Memory applique une path dependency durable aux relations',()=>{const m=new WorldMemory();m.remember({day:10,kind:'SANCTION',country:'AA',target:'BB',pathEffects:{trust:-12,cooperation:-8,hostility:15}});assert.deepEqual(m.effect('AA','BB'),{trust:-12,cooperation:-8,hostility:15});assert.equal(m.timeline({country:'AA'}).length,1);});

test('Scenario Engine expose seed, état initial, règles, événements et objectifs',()=>{const a=new ScenarioEngine({seed:8152042,mode:'SCENARIO'}).configure({rules:{fogOfWar:true},events:[{type:'TEST'}],objectives:['SURVIVAL']});const b=new ScenarioEngine({seed:8152042,mode:'SCENARIO'}).configure({rules:{fogOfWar:true},events:[{type:'TEST'}],objectives:['SURVIVAL']});assert.deepEqual(a.descriptor(),b.descriptor());assert.equal(a.descriptor().reproducibilityKey,'SCENARIO:8152042');});

test('Causal Event Engine produit une chaîne explicable quand une condition est remplie',()=>{const random={next:()=>0,range:(a,b)=>(a+b)/2};const memory=new WorldMemory();const e=new CausalEventEngine({random,worldMemory:memory});const state={code:'AA',resources:{food:{shortage:.8,productionCapacity:10},energy:{shortage:0,productionCapacity:10}},metrics:{food:{current:30,pressure:0},energy:{current:60,pressure:0},economy:{current:60,pressure:0},infrastructure:{current:60,pressure:0},stability:{current:60,pressure:0,baseline:60}}};const rows=e.evaluate(new Map([['AA',state]]),7);assert.ok(rows.length>=1);assert.ok(rows[0].chain.length>=4);assert.equal(memory.timeline({country:'AA'}).length>=1,true);});

test('Strategic Objective Engine classe explicitement les huit objectifs',()=>{const metrics={};for(const k of ['stability','resilience','militaryReadiness','economy','energy','diplomaticInfluence','science','technology','cohesion'])metrics[k]={current:50};const state={code:'AA',metrics,derivedSystems:{energy:{energySecurity:35}},influenceV1:{value:40}};const e=new StrategicObjectiveEngine();e.review(new Map([['AA',state]]),1);const row=e.get('AA');assert.ok(row.primary);assert.equal(row.ranking.length,8);assert.equal(row.dataClass,'SIM_AI_OBJECTIVES');});

test('Diplomacy System expose une relation multidimensionnelle',()=>{const edge={from:'AA',to:'BB',diplomaticRelation:60,trust:65,alliance:55,trade:72,energyDependency:40,technologyDependency:50};const relations={all:()=>[edge],outgoing:()=>[edge]};const states=new Map([['AA',{foreignPolicy:{openness:.5}}],['BB',{foreignPolicy:{openness:.5}}]]);const d=new DiplomacySystem();d.initialize(relations);d.update(states,relations,{day:30,agreements:{pairBonus:()=>0},sanctions:{pairPressure:()=>0},blocs:{sameBloc:()=>false},worldMemory:new WorldMemory()});const row=d.get(relations,'AA')[0];for(const key of ['trust','trade','alliance','rivalry','influence','sanctions','energyDependency','militaryAccess','securityGuarantee'])assert.ok(key in row,key);});
