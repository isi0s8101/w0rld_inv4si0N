import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/EventBus.js';
import { StateManager } from '../src/core/StateManager.js';
import { CausalityModeEngine } from '../src/analysis/CausalityModeEngine.js';
import { TimelineReplayEngine } from '../src/analysis/TimelineReplayEngine.js';
import { GlobalSearchEngine } from '../src/analysis/GlobalSearchEngine.js';

const nodes=[
 {id:'grid',name:'Power Grid',type:'POWER_GRID',country:'FR',position:{lon:2,lat:46},dependencies:[],connections:['r1'],status:'OPERATIONAL',strategicValue:.9},
 {id:'dc',name:'Paris Data Center',type:'DATACENTER',country:'FR',position:{lon:2.3,lat:48.8},dependencies:['grid'],connections:['r1'],status:'OPERATIONAL',strategicValue:.85},
 {id:'ixp',name:'Paris IXP',type:'IXP',country:'FR',position:{lon:2.35,lat:48.85},dependencies:['dc'],connections:[],status:'OPERATIONAL',strategicValue:.8}
];
const graph={list:()=>nodes,get:id=>nodes.find(n=>n.id===id)||null};
const routes={routes:[{id:'r1',from:'grid',to:'dc',type:'DIGITAL_ROUTE',status:'OPEN',distanceKm:300,layer:'DIGITAL'}],get(id){return this.routes.find(r=>r.id===id)||null;}};
const timeline=[
 {id:'WM1',eventId:'CE1',day:4,date:'2032-04-18',kind:'BLOCKADE',type:'BLOCKADE',country:'EG',target:'SG',importance:.9,details:{}},
 {id:'WM2',eventId:'CE1',day:5,date:'2032-04-19',kind:'RIPPLE',type:'BLOCKADE:rerouting',country:'EG',details:{step:1,name:'rerouting',impact:.8}},
 {id:'WM3',eventId:'CE1',day:7,date:'2032-04-21',kind:'RIPPLE',type:'BLOCKADE:transportCost',country:'EG',details:{step:2,name:'transportCost',impact:.6}}
];

test('LOT 11: causality traces upstream and downstream infrastructure dependencies',()=>{
 const bus=new EventBus(),state=new StateManager(bus),game={api:{getTimeline:()=>timeline,getCausalEvents:()=>[]}};
 const engine=new CausalityModeEngine({stateManager:state,infrastructureGraph:graph,routeEngine:routes,gameEngine:game,bus});
 const result=engine.analyze('INFRASTRUCTURE','dc',{direction:'BOTH'});
 assert.equal(result.rootId,'dc');
 assert.deepEqual(new Set(result.nodeIds),new Set(['grid','dc','ixp']));
 assert.ok(result.edges.some(e=>e.from==='grid'&&e.to==='dc'));
 assert.ok(result.edges.some(e=>e.from==='dc'&&e.to==='ixp'));
 assert.ok(result.routeIds.includes('r1'));
 assert.equal(state.get().causality.active,true);
});

test('LOT 11: WHY builds a dated causal event chain from world memory',()=>{
 const state=new StateManager(new EventBus()),game={api:{getTimeline:()=>timeline,getCausalEvents:()=>[]}};
 const engine=new CausalityModeEngine({stateManager:state,infrastructureGraph:graph,routeEngine:routes,gameEngine:game});
 const result=engine.analyze('EVENT','CE1');
 assert.equal(result.eventId,'CE1');
 assert.equal(result.nodes.length,3);
 assert.equal(result.nodes[1].label,'rerouting');
 assert.equal(result.nodes[2].date,'2032-04-21');
});

test('LOT 12: timeline history pauses simulation and LIVE restores speed',()=>{
 const bus=new EventBus(),state=new StateManager(bus);let speed=5;
 const api={getTimeline:()=>timeline,getClock:()=>({day:12,date:'2032-04-26',speed}),pause:()=>{speed=0;},setSpeed:v=>{speed=v;return true;}};
 const game={api,snapshot:()=>({clock:api.getClock()})};
 const engine=new TimelineReplayEngine({gameEngine:game,stateManager:state,bus});
 engine.setCursorDay(6);
 assert.equal(speed,0);assert.equal(state.get().timeline.mode,'HISTORY');assert.equal(state.get().timeline.selectedId,'WM2');
 engine.live();assert.equal(speed,5);assert.equal(state.get().timeline.mode,'LIVE');
});

test('LOT 12: replay walks event root and RIPPLE consequences deterministically',()=>{
 const state=new StateManager(new EventBus());let speed=1;const api={getTimeline:()=>timeline,getClock:()=>({day:12,date:'2032-04-26',speed}),pause:()=>{speed=0;},setSpeed:v=>{speed=v;return true;}};
 const game={api,snapshot:()=>({})};const causal={analyze:(type,id)=>({type,id})};
 const engine=new TimelineReplayEngine({gameEngine:game,stateManager:state,causalityEngine:causal});
 const replay=engine.replayEvent('CE1',{stepSeconds:.1});assert.equal(replay.sequence.length,3);assert.equal(state.get().timeline.selectedId,'WM1');
 engine.update(.11);assert.equal(state.get().timeline.selectedId,'WM2');engine.update(.11);assert.equal(state.get().timeline.selectedId,'WM3');assert.equal(state.get().timeline.replayProgress,1);
});

test('LOT 12: snapshots are bounded read-only observation captures',()=>{
 const state=new StateManager(new EventBus()),api={getTimeline:()=>timeline,getClock:()=>({day:12,date:'2032-04-26',speed:1}),pause:()=>{},setSpeed:()=>true};const game={api,snapshot:()=>({version:5})};
 const engine=new TimelineReplayEngine({gameEngine:game,stateManager:state});const snap=engine.createSnapshot('Before crisis');assert.equal(snap.mode,'READ_ONLY');assert.equal(snap.day,12);assert.equal(engine.listSnapshots().length,1);
});

test('LOT 13: global search indexes countries, infrastructures, routes, vehicles and events',()=>{
 const world={listCountries:()=>[{iso2:'FR',iso3:'FRA',name:'France',continent:'Europe',center:[2,46]}]};
 const routeEngine={routes:[{id:'sea-suez',type:'SEA_ROUTE',status:'BLOCKED',distanceKm:1200,from:'port-a',to:'port-b',layer:'MARITIME'}],get(id){return this.routes.find(r=>r.id===id)}};
 const traffic={entities:[{id:'SHIP-021',name:'SHIP-021',type:'SHIP',state:'MOVING',cargo:'crude_oil',origin:'Marseille',destination:'Shanghai',position:{lon:15,lat:35}}]};
 const g={list:()=>[{id:'mrs',name:'Port Marseille',type:'PORT',category:'TRANSPORT',layer:'PORTS',status:'OPERATIONAL',country:'FR',position:{lon:5.3,lat:43.2},strategicValue:.9}]};
 const game={api:{getTimeline:()=>timeline}};const engine=new GlobalSearchEngine({worldEngine:world,infrastructureGraph:g,routeEngine,trafficEngine:traffic,gameEngine:game});
 assert.equal(engine.search('France')[0].kind,'COUNTRY');
 assert.equal(engine.search('Marseille')[0].id,'mrs');
 assert.equal(engine.search('blocked routes')[0].id,'sea-suez');
 assert.ok(engine.search('oil').some(r=>r.id==='SHIP-021'));
 assert.ok(engine.search('blockade').some(r=>r.kind==='EVENT'));
});
