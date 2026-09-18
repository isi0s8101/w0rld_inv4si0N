const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const COUNTRY_TEMPLATES=[
 {type:'DROUGHT',category:'CLIMATE',condition:s=>(s.resources.food.shortage||0)>.35||s.metrics.food.current<48,probability:.06,chain:['hydroProduction','electricityAvailability','energyPrice','industrialProduction','employment','stability']},
 {type:'ENERGY_CRISIS',category:'ENERGY',condition:s=>(s.resources.energy.shortage||0)>.42||s.derivedSystems?.energy?.energySecurity<45,probability:.08,chain:['energyAvailability','energyPrice','industrialProduction','imports','stability']},
 {type:'LOGISTICS_SHOCK',category:'LOGISTICS',condition:s=>s.economyV1?.logisticsCapacity<42,probability:.07,chain:['routeCapacity','transportCost','imports','industrialStocks','production','employment']},
 {type:'FINANCIAL_CRISIS',category:'ECONOMY',condition:s=>s.metrics.economy.current<44&&s.metrics.stability.current<52,probability:.05,chain:['credit','investment','employment','stability']},
 {type:'INDUSTRIAL_ACCIDENT',category:'INFRASTRUCTURE',condition:s=>s.metrics.infrastructure.current<58,probability:.025,chain:['industrialCapacity','localSupply','employment','stability']},
 {type:'NATURAL_DISASTER',category:'DISASTER',condition:s=>s.metrics.resilience.current<55,probability:.018,chain:['infrastructureDamage','logisticsCapacity','publicServices','stability']},
 {type:'POLITICAL_CRISIS',category:'POLITICS',condition:s=>s.metrics.stability.current<45,probability:.035,chain:['confidence','investment','diplomaticInfluence','stability']},
 {type:'REBELLION',category:'POLITICS',condition:s=>s.metrics.stability.current<36&&s.metrics.cohesion.current<44,probability:.018,chain:['internalSecurity','transportDisruption','investment','employment','stability']},
 {type:'GOVERNMENT_CHANGE',category:'POLITICS',condition:s=>s.metrics.stability.current<31&&s.metrics.cohesion.current<40,probability:.010,chain:['policyUncertainty','foreignPolicy','investment','tradeConfidence','stability']}
];

const GEO_RULES=[
 {type:'BLOCKADE',condition:e=>(e.diplomaticRelation||50)<24&&(e.trust||50)<28,probability:.012,chain:['seaCapacity','rerouting','transportCost','imports','industrialStocks','stability']},
 {type:'SANCTIONS',condition:e=>(e.diplomaticRelation||50)<34&&(e.trust||50)<36,probability:.020,chain:['tradeAccess','imports','prices','production','employment','stability']},
 {type:'EMBARGO',condition:e=>(e.diplomaticRelation||50)<19&&(e.trust||50)<23,probability:.008,chain:['resourceAccess','rerouting','prices','production','stability']},
 {type:'DIPLOMATIC_BREAK',condition:e=>(e.diplomaticRelation||50)<18&&(e.trust||50)<20,probability:.010,chain:['trust','cooperation','tradeConfidence','allianceCohesion','stability']},
 {type:'ALLIANCE',condition:e=>(e.diplomaticRelation||0)>76&&(e.trust||0)>78&&(e.alliance||0)>72,probability:.010,chain:['trust','militaryAccess','securityGuarantee','tradeConfidence','influence']},
 {type:'WAR',condition:(e,a,b)=>(e.diplomaticRelation||50)<14&&(e.trust||50)<15&&(a?.metrics?.militaryReadiness?.current||0)>55&&(b?.metrics?.militaryReadiness?.current||0)>55,probability:.0025,chain:['militarySpending','tradeDisruption','infrastructureRisk','investment','economy','stability']}
];

function pathEffectsFor(type,severity){
  if(type==='ALLIANCE')return {trust:8*severity,cooperation:12*severity,hostility:-5*severity};
  if(type==='DIPLOMATIC_BREAK')return {trust:-12*severity,cooperation:-10*severity,hostility:9*severity};
  if(type==='BLOCKADE')return {trust:-8*severity,cooperation:-6*severity,hostility:14*severity};
  if(type==='WAR')return {trust:-18*severity,cooperation:-15*severity,hostility:22*severity};
  if(type==='SANCTIONS'||type==='EMBARGO')return {trust:-6*severity,cooperation:-5*severity,hostility:8*severity};
  return {};
}

export class CausalEventEngine {
  constructor({random,worldMemory=null}={}){this.random=random;this.memory=worldMemory;this.sequence=0;this.active=[];}

  expire(day,{flowEngine=null}={}){
    const kept=[];
    for(const event of this.active){
      if(event.endDay>=day){kept.push(event);continue;}
      if(event.corridorId&&event.corridorBefore)flowEngine?.setCorridorState?.(event.corridorId,event.corridorBefore);
    }
    this.active=kept;
  }

  buildEvent({type,category='SYSTEM',country,target=null,day,severity,chain,conditions=null}){
    return {
      id:`CE${++this.sequence}`,type,category,country,target,startDay:day,endDay:day+Math.round(21+severity*120),severity,
      conditions:conditions?structuredClone(conditions):null,
      chain:chain.map((name,index)=>({step:index+1,name,delayDays:index*2,impact:Number((severity*Math.max(.2,1-index*.11)).toFixed(3))})),
      status:'ACTIVE',recordedSteps:[],dataClass:'SIM_CAUSAL_EVENT'
    };
  }

  recordDueSteps(day){
    if(!this.memory)return 0;
    let recorded=0;
    for(const event of this.active){
      event.recordedSteps=event.recordedSteps||[];
      const seen=new Set(event.recordedSteps);
      for(const step of event.chain||[]){
        const due=event.startDay+(step.delayDays||0);
        if(due>day||seen.has(step.step))continue;
        event.recordedSteps.push(step.step);seen.add(step.step);recorded++;
        this.memory.remember({day:due,kind:'RIPPLE',country:event.country,target:event.target,type:`${event.type}:${step.name}`,eventId:event.id,importance:Math.min(1,event.severity*Math.max(.25,1-(step.step-1)*.09)),details:{category:event.category,step:step.step,name:step.name,impact:step.impact,parentType:event.type}});
      }
    }
    return recorded;
  }

  remember(event){
    const directKinds=new Set(['WAR','BLOCKADE','ALLIANCE','DIPLOMATIC_BREAK','SANCTIONS','EMBARGO']);
    const kind=directKinds.has(event.type)?event.type:'EVENT';
    this.memory?.remember({day:event.startDay,kind,country:event.country,target:event.target,type:event.type,eventId:event.id,importance:Math.min(1,event.severity*2.4),details:{category:event.category,conditions:event.conditions,chain:event.chain},pathEffects:pathEffectsFor(event.type,event.severity)});
  }

  applyCountry(event,state){
    const sev=event.severity;
    if(event.type==='DROUGHT'){state.resources.food.productionCapacity*=1-sev*.35;state.metrics.food.pressure-=sev*.22;state.metrics.energy.pressure-=sev*.08;}
    else if(event.type==='ENERGY_CRISIS'){state.resources.energy.productionCapacity*=1-sev*.38;state.metrics.energy.pressure-=sev*.24;state.metrics.economy.pressure-=sev*.08;}
    else if(event.type==='LOGISTICS_SHOCK'){state.metrics.infrastructure.pressure-=sev*.18;state.metrics.economy.pressure-=sev*.12;}
    else if(event.type==='FINANCIAL_CRISIS'){state.metrics.economy.pressure-=sev*.22;state.metrics.stability.pressure-=sev*.12;if(state.policy?.budget)state.policy.budget.debt=Math.min(state.policy.budget.debtLimit,state.policy.budget.debt+state.policy.budget.monthlyRevenue*sev*.25);}
    else if(event.type==='INDUSTRIAL_ACCIDENT'){state.metrics.infrastructure.pressure-=sev*.22;state.metrics.economy.pressure-=sev*.11;}
    else if(event.type==='NATURAL_DISASTER'){state.metrics.infrastructure.pressure-=sev*.26;state.metrics.resilience.pressure-=sev*.16;state.metrics.stability.pressure-=sev*.10;}
    else if(event.type==='POLITICAL_CRISIS'){state.metrics.stability.pressure-=sev*.25;state.metrics.diplomaticInfluence.pressure-=sev*.12;}
    else if(event.type==='REBELLION'){state.metrics.stability.pressure-=sev*.30;state.metrics.cohesion.pressure-=sev*.24;state.metrics.infrastructure.pressure-=sev*.08;}
    else if(event.type==='GOVERNMENT_CHANGE'){state.metrics.stability.pressure-=sev*.12;state.metrics.diplomaticInfluence.pressure-=sev*.10;if(state.foreignPolicy)state.foreignPolicy.transitionUntilDay=event.endDay;}
    state.metrics.stability.baseline=clamp(state.metrics.stability.baseline-sev*4);
  }

  pickSeaCorridor(flowEngine,from,to){
    const rows=flowEngine?.network?.all?.().filter(c=>c.family==='SEA'&&c.status!=='CLOSED'&&((c.from===from&&c.to===to)||(c.from===to&&c.to===from)))||[];
    return rows.sort((a,b)=>(b.importance||0)-(a.importance||0))[0]||null;
  }

  applyGeopolitical(event,a,b,{relations,sanctions,agreements,flowEngine}={}){
    const sev=event.severity;const edge=relations?.get?.(event.country,event.target),reverse=relations?.get?.(event.target,event.country);
    if(event.type==='BLOCKADE'){
      const corridor=this.pickSeaCorridor(flowEngine,event.country,event.target);
      if(corridor){event.corridorId=corridor.id;event.corridorBefore={status:corridor.status,disruption:corridor.disruption,reliability:corridor.reliability};flowEngine.setCorridorState(corridor.id,{status:'OPEN',disruption:Math.min(.92,.48+sev)});}
      a.metrics.economy.pressure-=sev*.08;b.metrics.economy.pressure-=sev*.13;b.metrics.infrastructure.pressure-=sev*.08;
    }else if(event.type==='SANCTIONS'||event.type==='EMBARGO'){
      const type=event.type==='EMBARGO'?'EMBARGO':'SANCTION';const resource=event.type==='EMBARGO'?'energy':'goods';const row=sanctions?.impose?.({from:event.country,to:event.target,type,resource,severity:Math.min(.9,.3+sev),day:event.startDay,durationDays:Math.max(90,event.endDay-event.startDay)});event.sanctionId=row?.id||null;b.metrics.economy.pressure-=sev*.08;
    }else if(event.type==='DIPLOMATIC_BREAK'){
      for(const e of [edge,reverse].filter(Boolean)){e.trust=clamp((e.trust||50)-sev*16);e.diplomaticRelation=clamp((e.diplomaticRelation||50)-sev*18);e.alliance=clamp((e.alliance||40)-sev*12);}
    }else if(event.type==='ALLIANCE'){
      for(const e of [edge,reverse].filter(Boolean)){e.trust=clamp((e.trust||50)+sev*10);e.diplomaticRelation=clamp((e.diplomaticRelation||50)+sev*8);e.alliance=clamp((e.alliance||40)+sev*14);}
      const row=agreements?.sign?.({from:event.country,to:event.target,scope:'LOGISTICS',day:event.startDay,durationDays:1080});event.agreementId=row?.id||null;
    }else if(event.type==='WAR'){
      a.metrics.militaryReadiness.pressure+=sev*.05;b.metrics.militaryReadiness.pressure+=sev*.05;a.metrics.economy.pressure-=sev*.16;b.metrics.economy.pressure-=sev*.16;a.metrics.stability.pressure-=sev*.18;b.metrics.stability.pressure-=sev*.18;
    }
    relations?.routeCache?.clear?.();
  }

  evaluateCountry(states,day){
    const created=[];
    for(const state of states.values()){
      for(const template of COUNTRY_TEMPLATES){
        if(!template.condition(state)||this.random.next()>template.probability)continue;
        const severity=Number(this.random.range(.12,.34).toFixed(3));
        const event=this.buildEvent({type:template.type,category:template.category,country:state.code,day,severity,chain:template.chain,conditions:{trigger:'country_state_threshold'}});
        this.applyCountry(event,state);this.active.push(event);created.push(event);this.remember(event);break;
      }
    }
    return created;
  }

  evaluateGeopolitical(states,day,context){
    const relations=context?.relations;if(!relations)return[];
    const created=[];
    const edges=relations.all().slice().sort((a,b)=>`${a.from}>${a.to}`.localeCompare(`${b.from}>${b.to}`));
    const activePairs=new Set(this.active.filter(e=>e.target).map(e=>`${e.country}>${e.target}:${e.type}`));
    for(const edge of edges){
      if(created.length>=2)break;
      const a=states.get(edge.from),b=states.get(edge.to);if(!a||!b)continue;
      for(const rule of GEO_RULES){
        if(activePairs.has(`${edge.from}>${edge.to}:${rule.type}`)||!rule.condition(edge,a,b)||this.random.next()>rule.probability)continue;
        const severity=Number(this.random.range(.16,.42).toFixed(3));
        const event=this.buildEvent({type:rule.type,category:'GEOPOLITICS',country:edge.from,target:edge.to,day,severity,chain:rule.chain,conditions:{diplomaticRelation:edge.diplomaticRelation,trust:edge.trust,alliance:edge.alliance}});
        this.applyGeopolitical(event,a,b,{...context,relations});this.active.push(event);created.push(event);this.remember(event);activePairs.add(`${edge.from}>${edge.to}:${rule.type}`);break;
      }
    }
    return created;
  }

  evaluate(states,day,context={}){
    this.expire(day,context);
    this.recordDueSteps(day);
    if(day<1||day%7!==0)return[];
    const created=[...this.evaluateCountry(states,day),...this.evaluateGeopolitical(states,day,context)];
    this.recordDueSteps(day);
    return created;
  }

  list({country=null,type=null,category=null}={}){return structuredClone(this.active.filter(e=>(!country||e.country===country||e.target===country)&&(!type||e.type===type)&&(!category||e.category===category)));}
}
