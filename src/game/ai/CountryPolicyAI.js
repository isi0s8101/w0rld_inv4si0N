const RESOURCES=['food','energy','goods','data'];
const INVESTMENT_METRICS=['infrastructure','energy','science','technology','resilience'];
function clamp(v,min=0,max=1){return Math.max(min,Math.min(max,v));}
function stockRatio(r){return r?.stockCapacity>0?r.stock/r.stockCapacity:0;}

export class CountryPolicyAI {
  constructor(random){this.random=random;this.reviewInterval=30;this.sequence=0;}

  scoreResource(state,resource){
    const r=state.resources[resource];if(!r)return 0;
    const lowStock=clamp((0.55-stockRatio(r))/0.55);const shortage=clamp(r.shortage||0);const price=clamp(((r.priceIndex||100)-100)/85);const dependency=clamp(state.dependencies?.resources?.[resource]?.strategicDependency||0);
    return clamp(shortage*0.44+lowStock*0.24+price*0.20+dependency*0.12);
  }

  chooseInvestment(state,goal=null){
    const goalBoost={
      SURVIVAL:{resilience:.48,infrastructure:.22},SECURITY:{infrastructure:.28,resilience:.24},ECONOMIC_GROWTH:{infrastructure:.34,technology:.18},
      ENERGY_SECURITY:{energy:.52,infrastructure:.16},INFLUENCE:{science:.20,technology:.22},PRESTIGE:{science:.42,technology:.26},
      TECHNOLOGY:{technology:.58,science:.35},TERRITORIAL_CONTROL:{infrastructure:.38,resilience:.22}
    }[goal]||{};
    const scored=INVESTMENT_METRICS.map(name=>({name,score:clamp((62-state.metrics[name].current)/40)+(state.policy?.priorities?.[name]||0)*0.25+(goalBoost[name]||0)}));
    scored.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));return scored[0];
  }

  chooseProject(state,goal=null){
    const rows=[
      {sector:'LOGISTICS',score:(state.policy.priorities.infrastructure||0.5)*0.55+clamp((65-state.metrics.infrastructure.current)/45)*0.45+((goal==='ECONOMIC_GROWTH'||goal==='TERRITORIAL_CONTROL') ? .22 : 0)},
      {sector:'ENERGY',score:(state.policy.priorities.energy||0.5)*0.55+clamp((66-state.metrics.energy.current)/45)*0.45+(goal==='ENERGY_SECURITY' ? .42 : 0)},
      {sector:'DATA',score:(state.policy.priorities.data||0.4)*0.5+clamp((67-state.metrics.technology.current)/48)*0.5+((goal==='TECHNOLOGY'||goal==='PRESTIGE') ? .32 : 0)},
      {sector:'RESILIENCE',score:(state.policy.priorities.resilience||0.5)*0.55+clamp((66-state.metrics.resilience.current)/45)*0.45+((goal==='SURVIVAL'||goal==='SECURITY') ? .30 : 0)}
    ];return rows.sort((a,b)=>b.score-a.score||a.sector.localeCompare(b.sector))[0];
  }

  strategicActions(state,{states,relations,day,goal,budget,monthly}){
    const decisions=[];
    const outgoing=(relations?.outgoing(state.code)||[]).filter(e=>states.has(e.to));
    const friendly=outgoing.slice().sort((a,b)=>((b.trust||0)+(b.diplomaticRelation||0)+(b.trade||0)*.35)-((a.trust||0)+(a.diplomaticRelation||0)+(a.trade||0)*.35));
    const hostile=outgoing.slice().sort((a,b)=>((a.trust||0)+(a.diplomaticRelation||0))-((b.trust||0)+(b.diplomaticRelation||0)));
    const friend=friendly[0]||null,threat=hostile[0]||null;

    if(goal==='SURVIVAL'){
      decisions.push({type:'INVEST',country:state.code,metric:'resilience',cost:Math.min(monthly*.22,3.1),priority:.93,reason:'strategic objective SURVIVAL'});
      const critical=RESOURCES.map(resource=>({resource,score:this.scoreResource(state,resource)})).sort((a,b)=>b.score-a.score)[0];
      if(critical&&stockRatio(state.resources[critical.resource])<.62)decisions.push({type:'BUILD_RESERVE',country:state.code,resource:critical.resource,cost:Math.min(monthly*.14,2.2),priority:.91,reason:`survival reserve ${critical.resource}`});
    }
    if(goal==='SECURITY'){
      decisions.push({type:'REINFORCE_BASE',country:state.code,cost:Math.min(monthly*.20,3.2),priority:.92,reason:'strategic objective SECURITY'});
      if(threat&&((threat.trust||50)<30||(threat.diplomaticRelation||50)<30))decisions.push({type:'DEPLOY_UNITS',country:state.code,target:threat.to,cost:Math.min(monthly*.10,1.8),priority:.78,reason:`security posture toward ${threat.to}`});
    }
    if(goal==='ECONOMIC_GROWTH'&&friend){
      decisions.push({type:'OPEN_ROUTE',country:state.code,target:friend.to,cost:Math.min(monthly*.12,2.0),priority:.86,reason:`expand trade corridor with ${friend.to}`});
    }
    if(goal==='ENERGY_SECURITY'){
      decisions.push({type:'BUILD_RESERVE',country:state.code,resource:'energy',cost:Math.min(monthly*.16,2.5),priority:.94,reason:'strategic objective ENERGY_SECURITY'});
      if(day===1||day%90===0)decisions.push({type:'START_PROJECT',country:state.code,sector:'ENERGY',cost:Math.min(monthly*.25,3.1),priority:.90,reason:'expand domestic energy capacity'});
    }
    if(goal==='INFLUENCE'&&friend){
      decisions.push({type:'REINFORCE_ALLIANCE',country:state.code,target:friend.to,cost:Math.min(monthly*.09,1.4),priority:.88,reason:`increase influence through ${friend.to}`});
      decisions.push({type:'SIGN_AGREEMENT',country:state.code,target:friend.to,scope:'TRADE',cost:Math.min(monthly*.07,1.2),priority:.80,reason:`deepen bilateral influence with ${friend.to}`});
    }
    if(goal==='PRESTIGE')decisions.push({type:'INVEST',country:state.code,metric:'science',cost:Math.min(monthly*.23,3.2),priority:.90,reason:'strategic objective PRESTIGE'});
    if(goal==='TECHNOLOGY'){
      decisions.push({type:'INVEST',country:state.code,metric:'technology',cost:Math.min(monthly*.24,3.3),priority:.95,reason:'strategic objective TECHNOLOGY'});
      if(day===1||day%90===0)decisions.push({type:'START_PROJECT',country:state.code,sector:'DATA',cost:Math.min(monthly*.22,2.8),priority:.87,reason:'expand strategic digital capacity'});
    }
    if(goal==='TERRITORIAL_CONTROL'){
      decisions.push({type:'DEPLOY_UNITS',country:state.code,target:threat?.to||null,cost:Math.min(monthly*.12,2.0),priority:.89,reason:'strategic objective TERRITORIAL_CONTROL'});
      decisions.push({type:'INVEST',country:state.code,metric:'infrastructure',cost:Math.min(monthly*.20,3.0),priority:.82,reason:'harden territorial logistics'});
    }
    if(['SECURITY','TERRITORIAL_CONTROL','SURVIVAL'].includes(goal)&&threat&&(threat.trust||50)<22&&(threat.diplomaticRelation||50)<25){
      decisions.push({type:'IMPOSE_SANCTION',country:state.code,target:threat.to,resource:'goods',severity:.38,cost:Math.min(monthly*.04,.8),priority:.68,reason:`strategic pressure on ${threat.to}`});
    }
    return decisions;
  }

  planCountry(state,{states,relations,flowEngine,contractSystem,projectSystem,day}){
    if(day>1&&day-(state.policy?.lastReviewDay||0)<this.reviewInterval)return[];
    const decisions=[];const budget=Math.max(0,state.policy?.budget?.treasury||0);const monthly=Math.max(1,state.policy?.budget?.monthlyRevenue||1);
    const goal=state.strategicObjectives?.primary||null;
    decisions.push(...this.strategicActions(state,{states,relations,day,goal,budget,monthly}));

    const risk=RESOURCES.map(resource=>({resource,score:this.scoreResource(state,resource)})).sort((a,b)=>b.score-a.score||a.resource.localeCompare(b.resource));const top=risk[0];
    if(top.score>0.28){
      const alternatives=flowEngine?.findAlternativeSuppliers?.(states,state.code,top.resource,5)||[];
      if(alternatives.length){
        decisions.push({type:'DIVERSIFY_SUPPLIERS',country:state.code,resource:top.resource,cost:Math.min(monthly*0.08,1.5),priority:0.92,reason:`${top.resource} supply risk ${top.score.toFixed(2)}`,suppliers:alternatives.map(x=>x.code)});
        if(!contractSystem?.hasBuyerContract?.(state.code,top.resource)){
          const seller=alternatives[0];decisions.push({type:'SIGN_CONTRACT',country:state.code,seller:seller.code,resource:top.resource,dailyAmount:Math.min(0.5,0.12+top.score*0.34),durationDays:360,cost:Math.min(monthly*0.07,1.15),priority:0.90,reason:`secure ${top.resource} supply with ${seller.code}`});
        }
      }
      if(stockRatio(state.resources[top.resource])<0.42)decisions.push({type:'BUILD_RESERVE',country:state.code,resource:top.resource,cost:Math.min(monthly*0.16,2.4),priority:0.88,reason:`${top.resource} stock ratio ${stockRatio(state.resources[top.resource]).toFixed(2)}`});
    }
    if((day===1||day%90===0)&&budget>monthly*2.1){const prj=this.chooseProject(state,goal);if(!projectSystem?.active?.(state.code,prj.sector)?.length)decisions.push({type:'START_PROJECT',country:state.code,sector:prj.sector,cost:Math.min(monthly*0.26,3.0),priority:0.74+Math.min(0.12,prj.score*0.08),reason:`long-horizon ${prj.sector.toLowerCase()} capacity`});}
    const inv=this.chooseInvestment(state,goal);if(inv.score>0.22||decisions.length===0)decisions.push({type:'INVEST',country:state.code,metric:inv.name,cost:Math.min(monthly*0.24,3.5),priority:0.60+Math.min(0.3,inv.score*0.2),reason:`${inv.name} capacity ${state.metrics[inv.name].current.toFixed(1)}`});
    if(budget>monthly*1.8){
      const outgoing=(relations?.outgoing(state.code)||[]).filter(e=>e.trust>58||e.diplomaticRelation>62).sort((a,b)=>(b.trust+b.diplomaticRelation)-(a.trust+a.diplomaticRelation));
      for(const edge of outgoing.slice(0,5)){const target=states.get(edge.to);if(!target)continue;const needy=RESOURCES.map(resource=>({resource,shortage:target.resources[resource].shortage||0})).sort((a,b)=>b.shortage-a.shortage)[0];const donor=state.resources[needy.resource];if(needy.shortage>0.55&&stockRatio(donor)>0.62){decisions.push({type:'AID_PARTNER',country:state.code,target:target.code,resource:needy.resource,cost:Math.min(monthly*0.08,1.2),priority:0.54,reason:`partner ${target.code} ${needy.resource} shortage ${needy.shortage.toFixed(2)}`});break;}}
    }

    const dedup=new Map();
    for(const decision of decisions){const key=[decision.type,decision.metric||'',decision.resource||'',decision.target||decision.seller||'',decision.sector||''].join(':');const previous=dedup.get(key);if(!previous||decision.priority>previous.priority)dedup.set(key,decision);}
    state.policy.lastReviewDay=day;
    state.policy.lastStrategicGoal=goal;
    return [...dedup.values()].sort((a,b)=>b.priority-a.priority||a.type.localeCompare(b.type)).slice(0,5);
  }

  plan(states,context){const rows=[];for(const code of [...states.keys()].sort())rows.push(...this.planCountry(states.get(code),{states,...context}));return rows;}
}
