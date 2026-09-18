function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
function hashText(text){let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');}

export class ScenarioEngine {
  constructor({ seed, mode='REAL_WORLD' }={}){
    this.seed=Number(seed)>>>0;this.mode=mode;this.rules={};this.objectives=[];this.events=[];this.startingWorldState=null;this.decisionInputs=[];
  }
  configure({seed=this.seed,startingWorldState=null,rules={},events=[],objectives=[],decisions=[]}={}){
    this.seed=Number(seed)>>>0;this.startingWorldState=startingWorldState?structuredClone(startingWorldState):null;this.rules=structuredClone(rules);this.events=structuredClone(events);this.objectives=structuredClone(objectives);this.decisionInputs=structuredClone(decisions||[]);return this;
  }
  recordDecisionInput(entry={}){const row={index:this.decisionInputs.length,day:Number(entry.day)||0,...structuredClone(entry)};this.decisionInputs.push(row);return structuredClone(row);}
  applyStartingState(states){
    if(this.mode!=="SCENARIO"||!this.startingWorldState?.countries)return 0;
    let applied=0;
    for(const [code,patch] of Object.entries(this.startingWorldState.countries)){
      const state=states.get(code);if(!state)continue;
      if(Number.isFinite(patch.populationCount)&&patch.populationCount>=0)state.populationCount=patch.populationCount;
      for(const [name,value] of Object.entries(patch.metrics||{})){if(state.metrics?.[name]&&Number.isFinite(value))state.metrics[name].current=state.metrics[name].baseline=Math.max(0,Math.min(100,value));}
      for(const [name,row] of Object.entries(patch.resources||{})){const target=state.resources?.[name];if(!target)continue;for(const field of ['productionCapacity','stockCapacity','stock','demandBase','priceIndex']){if(Number.isFinite(row?.[field]))target[field]=Math.max(0,row[field]);}}
      applied++;
    }
    return applied;
  }
  deterministicPayload(){return canonical({seed:this.seed,startingWorldState:this.startingWorldState,rules:this.rules,events:this.events,objectives:this.objectives,decisions:this.decisionInputs});}
  descriptor(){
    const payload=this.deterministicPayload();const configurationHash=hashText(JSON.stringify(payload));
    return {
      mode:this.mode,seed:this.seed,startingWorldState:this.startingWorldState,rules:structuredClone(this.rules),events:structuredClone(this.events),objectives:structuredClone(this.objectives),decisions:structuredClone(this.decisionInputs),
      reproducibilityKey:`${this.mode}:${this.seed}`,configurationHash,replayKey:`${this.mode}:${this.seed}:${configurationHash}`,
      determinismContract:'same engine version + seed + startingWorldState + rules + events + objectives + ordered decisions => same simulation',
      dataClass:this.mode==='SCENARIO'?'SCENARIO_CONFIG':'REAL_WORLD_CONFIG'
    };
  }
}
