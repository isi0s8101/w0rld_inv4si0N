const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const SECTORS=["AGRICULTURE","ENERGY","INDUSTRY","TECHNOLOGY","LOGISTICS","SERVICES"];

function score(state,sector){
  const m=state.metrics,r=state.resources;
  const prod=(name)=>r?.[name]?.productionCapacity||0;
  const demand=(name)=>Math.max(0.01,r?.[name]?.demandBase||0.01);
  const surplus=(name)=>clamp((prod(name)/demand(name)-0.75)/1.4);
  if(sector==="AGRICULTURE")return surplus("food")*.62+(m.food.current/100)*.22+(m.infrastructure.current/100)*.16;
  if(sector==="ENERGY")return surplus("energy")*.64+(m.energy.current/100)*.24+(m.infrastructure.current/100)*.12;
  if(sector==="INDUSTRY")return surplus("goods")*.48+(m.economy.current/100)*.27+(m.infrastructure.current/100)*.25;
  if(sector==="TECHNOLOGY")return surplus("data")*.28+(m.technology.current/100)*.38+(m.science.current/100)*.34;
  if(sector==="LOGISTICS")return (m.infrastructure.current/100)*.52+(m.economy.current/100)*.28+(m.resilience.current/100)*.20;
  return (m.economy.current/100)*.46+(m.stability.current/100)*.28+(m.technology.current/100)*.26;
}

function calculate(state,day=0,previous=null){
  const rows=SECTORS.map(sector=>({sector,score:Number(score(state,sector).toFixed(4))})).sort((a,b)=>b.score-a.score||a.sector.localeCompare(b.sector));
  const exportBias={food:1,energy:1,goods:1,data:1};
  for(const row of rows.slice(0,2)){
    if(row.sector==="AGRICULTURE")exportBias.food+=.18;
    if(row.sector==="ENERGY")exportBias.energy+=.20;
    if(row.sector==="INDUSTRY")exportBias.goods+=.18;
    if(row.sector==="TECHNOLOGY")exportBias.data+=.20;
    if(row.sector==="LOGISTICS"){exportBias.food+=.04;exportBias.energy+=.04;exportBias.goods+=.06;exportBias.data+=.03;}
  }
  const history=[...(previous?.history||[])];
  const changed=!previous||previous.primary!==rows[0].sector||previous.secondary!==rows[1].sector;
  if(changed||day===0)history.push({day,primary:rows[0].sector,secondary:rows[1].sector});
  if(history.length>24)history.splice(0,history.length-24);
  return {primary:rows[0].sector,secondary:rows[1].sector,scores:Object.fromEntries(rows.map(x=>[x.sector,x.score])),exportBias,lastReviewDay:day,history,dataClass:"DERIVED_SIMULATION",provenance:{basis:"country resource balance and simulated capacities"}};
}

export class SpecializationSystem{
  initialize(states){for(const state of states.values())state.specialization=calculate(state,0,state.specialization);}
  review(states,day){
    if(day!==1&&day%90!==0)return[];
    const changes=[];
    for(const state of states.values()){
      const previous=state.specialization;
      const next=calculate(state,day,previous);
      if(previous?.primary!==next.primary||previous?.secondary!==next.secondary)changes.push({country:state.code,day,from:previous?.primary||null,to:next.primary,secondary:next.secondary});
      state.specialization=next;
    }
    return changes;
  }
  get(state){return structuredClone(state?.specialization||null);}
}
