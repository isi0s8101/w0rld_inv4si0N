import test from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../src/core/EventBus.js";
import { StateManager } from "../src/core/StateManager.js";
import { EventEngine } from "../src/core/EventEngine.js";
import { TransitionManager } from "../src/core/TransitionManager.js";

function fixtures(){
  const bus=new EventBus(), state=new StateManager(bus);
  state.setRuntime({time:0,delta:0,elapsed:0});
  const nodes=[{id:"a",location:{country:"FR",lat:48,lon:2}},{id:"b",location:{country:"US",lat:40,lon:-74}}];
  const nodeNetwork={setState(){},surge(){},pickNode(){return nodes[0];},get(id){return nodes.find(n=>n.id===id)||null}};
  const route={id:"r",from:"a",to:"b"};
  const trafficEngine={started:[],pickRoute(){return route},startFromEvent(e){this.started.push(e)}};
  const events=new EventEngine(bus,state,nodeNetwork,trafficEngine);
  const camera={toWorld(){},toGlobe(){},focusCountry(){}};
  const transitions=new TransitionManager(bus,state,events,camera);
  return {bus,state,events,transitions,trafficEngine};
}

test("état global contient les domaines obligatoires",()=>{
  const {state}=fixtures(); const s=state.get();
  for(const key of ["view","hoveredCountry","selectedCountry","selectedNode","globe","world","country","network","transition","runtime"]) assert.ok(key in s);
});

test("un événement trafic garde son progress sur la timeline globale",()=>{
  const {state,events,trafficEngine}=fixtures();
  const e=events.emit("TRAFFIC_STARTED",{duration:4,startTime:10,data:{routeId:"r",from:"a",to:"b"}});
  assert.equal(trafficEngine.started.length,1);
  state.get().runtime.elapsed=12; events.update();
  assert.ok(Math.abs(e.progress-.5)<1e-9);
});

test("transition Globe vers World est centralisée et termine sur WORLD",()=>{
  const {state,events,transitions}=fixtures();
  state.setView("GLOBE"); state.get().runtime.elapsed=1;
  assert.equal(transitions.toWorld(),true);
  assert.equal(state.get().view,"TRANSITION_GLOBE_WORLD");
  state.get().runtime.elapsed=3; transitions.update();
  assert.equal(state.get().view,"WORLD");
  assert.equal(state.get().transition.active,false);
  assert.ok(events.active.some(e=>e.type==="VIEW_CHANGED"));
});

test("sélection puis changement de pays ne repasse pas par GLOBE",()=>{
  const {state,transitions}=fixtures();
  state.setView("WORLD"); state.get().runtime.elapsed=1;
  transitions.selectCountry("FR"); state.get().runtime.elapsed=2; transitions.update();
  assert.equal(state.get().view,"COUNTRY");
  state.get().runtime.elapsed=3; transitions.switchCountry("FR","DE");
  assert.equal(state.get().selectedCountry,"DE");
  assert.equal(state.get().view,"COUNTRY");
});
