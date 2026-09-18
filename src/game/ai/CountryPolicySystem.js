const EFFECTS={
  infrastructure:{baseline:0.34,current:0.10},
  energy:{baseline:0.32,current:0.09},
  science:{baseline:0.30,current:0.08},
  technology:{baseline:0.31,current:0.09},
  resilience:{baseline:0.30,current:0.08}
};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export class CountryPolicySystem {
  constructor({budgetSystem,ledger,contractSystem=null,projectSystem=null,marketSystem=null,agreementSystem=null,sanctionSystem=null}={}){
    this.budgetSystem=budgetSystem;this.ledger=ledger;this.contractSystem=contractSystem;this.projectSystem=projectSystem;this.marketSystem=marketSystem;this.agreementSystem=agreementSystem;this.sanctionSystem=sanctionSystem;
  }
  record(day,decision,applied,effects={}){
    return this.ledger?.record({day,kind:'COUNTRY_DECISION',country:decision.country,target:decision.target||decision.seller||null,type:decision.type,resource:decision.resource||null,metric:decision.metric||null,cost:decision.cost||0,reason:decision.reason||'',strategicGoal:decision.strategicGoal||null,applied,effects});
  }
  refund(state,decision){const b=state.policy.budget;b.treasury+=decision.cost||0;b.spentThisYear=Math.max(0,b.spentThisYear-(decision.cost||0));}

  apply(decision,{states,flowEngine,relations=null,day}={}){
    const state=states.get(decision.country);if(!state)return this.record(day,decision,false,{reason:'COUNTRY_MISSING'});
    if(!this.budgetSystem.spend(state,decision.cost||0))return this.record(day,decision,false,{reason:'BUDGET_DENIED'});
    let effects={};let applied=true;

    if(decision.type==='INVEST'){
      const metric=state.metrics[decision.metric],cfg=EFFECTS[decision.metric];if(!metric||!cfg)applied=false;
      else{
        const scale=Math.max(0.35,Math.min(1.4,(decision.cost||1)/2));
        metric.baseline=Math.min(100,metric.baseline+cfg.baseline*scale);metric.current=Math.min(100,metric.current+cfg.current*scale);
        if(decision.metric==='energy')state.resources.energy.productionCapacity*=1+0.0028*scale;
        if(decision.metric==='infrastructure')for(const r of Object.values(state.resources))r.productionCapacity*=1+0.0015*scale;
        if(decision.metric==='technology')state.resources.data.productionCapacity*=1+0.0022*scale;
        state.policy.adaptation.investment+=1;effects={metric:decision.metric,baselineDelta:cfg.baseline*scale};
      }
    } else if(decision.type==='BUILD_RESERVE'){
      const resource=state.resources[decision.resource];if(!resource)applied=false;
      else{
        const old=state.policy.reserveTargetRatio[decision.resource]??0.5;const next=Math.min(0.82,old+0.065);
        state.policy.reserveTargetRatio[decision.resource]=next;resource.stockCapacity*=1.006;
        state.policy.adaptation.stockpiling+=1;effects={resource:decision.resource,targetRatioBefore:old,targetRatioAfter:next};
      }
    } else if(decision.type==='DIVERSIFY_SUPPLIERS'){
      const suppliers=(decision.suppliers||[]).slice(0,5);if(!suppliers.length)applied=false;
      else{
        state.policy.supplierPreferences[decision.resource]=suppliers;
        flowEngine?.setSupplierPreferences?.(state.code,decision.resource,suppliers,day+180);
        state.policy.adaptation.diversification+=1;effects={resource:decision.resource,suppliers};
      }
    } else if(decision.type==='SIGN_CONTRACT'||decision.type==='BUY_RESOURCE'){
      const seller=states.get(decision.seller);if(!seller)applied=false;
      else{
        const market=this.marketSystem?.get(decision.resource)?.priceIndex||100;
        const contract=this.contractSystem?.sign({buyer:state.code,seller:seller.code,resource:decision.resource,dailyAmount:decision.dailyAmount,day,marketPriceIndex:market,durationDays:decision.durationDays||360,priceFactor:decision.priceFactor||1});
        if(!contract)applied=false;else effects={contractId:contract.id,seller:seller.code,resource:decision.resource,dailyAmount:contract.dailyAmount,endDay:contract.endDay};
      }
    } else if(decision.type==='START_PROJECT'){
      const project=this.projectSystem?.start(state,decision.sector,day,{totalCost:decision.totalCost,durationDays:decision.durationDays});
      if(!project)applied=false;else effects={projectId:project.id,sector:project.sector,totalCost:project.totalCost,durationDays:project.durationDays};
    } else if(decision.type==='AID_PARTNER'){
      const target=states.get(decision.target),from=state.resources[decision.resource],to=target?.resources?.[decision.resource];
      if(!target||!from||!to)applied=false;
      else{
        const amount=Math.min(from.stock*0.015,to.consumption*2.5,Math.max(0,to.stockCapacity-to.stock));
        if(amount<=0.001)applied=false;else{from.stock-=amount;to.stock+=amount;state.policy.adaptation.aid+=1;effects={resource:decision.resource,amount,target:target.code};}
      }
    } else if(decision.type==='REINFORCE_BASE'){
      const scale=Math.max(.4,Math.min(1.6,(decision.cost||1)/2));
      state.metrics.militaryReadiness.baseline=clamp(state.metrics.militaryReadiness.baseline+.38*scale);
      state.metrics.militaryReadiness.current=clamp(state.metrics.militaryReadiness.current+.16*scale);
      state.metrics.resilience.baseline=clamp(state.metrics.resilience.baseline+.10*scale);
      effects={readinessDelta:.38*scale,resilienceDelta:.10*scale};
    } else if(decision.type==='DEPLOY_UNITS'){
      state.policy.deployments=state.policy.deployments||[];
      const deployment={id:`DEP:${state.code}:${day}:${state.policy.deployments.length+1}`,target:decision.target||null,startDay:day,status:'ACTIVE',posture:'DETERRENCE'};
      state.policy.deployments.push(deployment);if(state.policy.deployments.length>24)state.policy.deployments.shift();
      state.metrics.militaryReadiness.pressure+=.018;state.metrics.stability.pressure-=.003;
      effects={deployment};
    } else if(decision.type==='REINFORCE_ALLIANCE'){
      const edge=relations?.get?.(state.code,decision.target);const reverse=relations?.get?.(decision.target,state.code);
      if(!edge)applied=false;
      else{
        for(const e of [edge,reverse].filter(Boolean)){e.trust=clamp((e.trust||50)+1.8);e.alliance=clamp((e.alliance||40)+2.4);e.diplomaticRelation=clamp((e.diplomaticRelation||50)+1.2);}
        relations?.routeCache?.clear?.();effects={target:decision.target,trustDelta:1.8,allianceDelta:2.4};
      }
    } else if(decision.type==='OPEN_ROUTE'){
      const edge=relations?.get?.(state.code,decision.target);
      if(!edge)applied=false;
      else{
        edge.transport=clamp((edge.transport||50)+3.5);edge.trade=clamp((edge.trade||50)+2.1);
        for(const mode of Object.keys(edge.capacities||{}))edge.capacities[mode]*=1.035;
        relations?.routeCache?.clear?.();effects={target:decision.target,transportDelta:3.5,tradeDelta:2.1,capacityFactor:1.035};
      }
    } else if(decision.type==='SIGN_AGREEMENT'){
      const agreement=this.agreementSystem?.sign?.({from:state.code,to:decision.target,scope:decision.scope||'TRADE',day,durationDays:decision.durationDays||720});
      if(!agreement)applied=false;else effects={agreementId:agreement.id,target:decision.target,scope:agreement.scope,endDay:agreement.endDay};
    } else if(decision.type==='IMPOSE_SANCTION'){
      const sanction=this.sanctionSystem?.impose?.({from:state.code,to:decision.target,type:decision.sanctionType||'SANCTION',resource:decision.resource||'goods',severity:decision.severity||.4,day,durationDays:decision.durationDays});
      if(!sanction)applied=false;else effects={sanctionId:sanction.id,target:decision.target,resource:sanction.resource,severity:sanction.severity,endDay:sanction.endDay};
    } else applied=false;

    if(!applied)this.refund(state,decision);
    else{state.policy.lastDecisionDay=day;state.policy.decisionCount++;state.policy.lastStrategicGoal=state.strategicObjectives?.primary||state.policy.lastStrategicGoal||null;}
    return this.record(day,decision,applied,effects);
  }
  applyAll(decisions,context){return decisions.map(d=>this.apply(d,context));}
}
