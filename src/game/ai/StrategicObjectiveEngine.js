const GOALS=['SURVIVAL','SECURITY','ECONOMIC_GROWTH','ENERGY_SECURITY','INFLUENCE','PRESTIGE','TECHNOLOGY','TERRITORIAL_CONTROL'];
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const avg=(rows=[])=>rows.length?rows.reduce((s,v)=>s+v,0)/rows.length:0;

export class StrategicObjectiveEngine {
  constructor(){this.byCountry=new Map();}

  contextFactors(state,{relations=null,worldMemory=null,blocs=null,day=0}={}){
    const outgoing=relations?.outgoing?.(state.code)||[];
    const threat=outgoing.length?avg(outgoing.map(e=>clamp((100-(e.trust??50))*.48+(100-(e.diplomaticRelation??50))*.38+(100-(e.alliance??40))*.14))):25;
    const opportunity=outgoing.length?avg(outgoing.map(e=>clamp((e.trade??0)*.42+(e.trust??0)*.28+(e.diplomaticRelation??0)*.30))):30;
    const allianceCoverage=outgoing.length?avg(outgoing.map(e=>e.alliance??0)):0;
    const shortages=Object.values(state.resources||{}).map(r=>r.shortage||0);
    const resourceStress=clamp(avg(shortages)*100);
    const energyStress=clamp((state.resources?.energy?.shortage||0)*100);
    const recent=worldMemory?.timeline?.({country:state.code,sinceDay:Math.max(0,day-365),limit:120})||[];
    const crisisWeight=clamp(recent.filter(r=>['CRISIS','CONFLICT','ECONOMY','INFRASTRUCTURE'].includes(r.category)).reduce((s,r)=>s+(r.importance||.4)*7,0));
    const cooperation=clamp(recent.filter(r=>['ALLIANCE','AGREEMENT','AID'].includes(r.kind)).length*8);
    const bloc=blocs?.getBlocFor?.(state.code)||null;
    return {threat,opportunity,allianceCoverage,resourceStress,energyStress,crisisWeight,cooperation,blocCohesion:bloc?.cohesion||0};
  }

  review(states,day,context={}){
    if(day!==1&&day%30!==0)return this.byCountry;
    for(const state of states.values()){
      const f=this.contextFactors(state,{...context,day});
      const metric=(name,fallback=50)=>Number(state.metrics?.[name]?.current??fallback);
      const energy=state.derivedSystems?.energy?.energySecurity??metric('energy');
      const logistics=state.economyV1?.logisticsCapacity??metric('infrastructure');
      const influence=state.influenceV1?.value??metric('diplomaticInfluence');
      const score={
        SURVIVAL:(100-metric('stability'))*.30+(100-metric('resilience'))*.25+f.resourceStress*.20+f.crisisWeight*.25,
        SECURITY:(100-metric('militaryReadiness'))*.42+f.threat*.43+(100-f.allianceCoverage)*.15,
        ECONOMIC_GROWTH:(100-metric('economy'))*.42+(100-logistics)*.24+f.opportunity*.22+(100-metric('infrastructure'))*.12,
        ENERGY_SECURITY:(100-energy)*.68+f.energyStress*.22+f.resourceStress*.10,
        INFLUENCE:(100-influence)*.52+f.opportunity*.24+(100-f.allianceCoverage)*.14+f.cooperation*.10,
        PRESTIGE:(100-metric('diplomaticInfluence'))*.38+(100-metric('science'))*.34+(100-metric('technology'))*.18+f.opportunity*.10,
        TECHNOLOGY:(100-metric('technology'))*.64+(100-metric('science'))*.26+(100-metric('infrastructure'))*.10,
        TERRITORIAL_CONTROL:(100-metric('cohesion'))*.40+(100-metric('stability'))*.24+f.threat*.25+f.crisisWeight*.11
      };
      const ranked=GOALS.map(goal=>({goal,score:Number(clamp(score[goal]).toFixed(3))})).sort((a,b)=>b.score-a.score||a.goal.localeCompare(b.goal));
      const row={primary:ranked[0].goal,secondary:ranked[1].goal,ranking:ranked,factors:{...f,energySecurity:energy,logisticsCapacity:logistics,influence},day,dataClass:'SIM_AI_OBJECTIVES'};
      this.byCountry.set(state.code,row);state.strategicObjectives=row;
    }
    return this.byCountry;
  }
  get(code){return this.byCountry.get(code)||null;}
}
