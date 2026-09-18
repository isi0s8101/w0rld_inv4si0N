function weak(state,name){return Math.max(0,65-(state.metrics?.[name]?.current??50))/65;}
export class StrategySystem{
  constructor({ledger}={}){this.ledger=ledger;this.lastReviews=[];}
  review(states,marketSystem,day){if(day!==1&&day%90!==0)return[];this.lastReviews=[];
    const energyPrice=marketSystem?.get("energy")?.priceIndex||100;const foodPrice=marketSystem?.get("food")?.priceIndex||100;
    for(const state of states.values()){
      const risk=Math.max(...Object.values(state.resources).map(r=>r.shortage||0));const fiscal=(state.policy?.budget?.debt||0)/Math.max(1,state.policy?.budget?.debtLimit||1);
      const scores={
        SECURITY:risk*0.7+Math.max(0,energyPrice-110)/100*0.3,
        RESILIENCE:weak(state,"resilience")*0.55+Math.max(0,foodPrice-110)/100*0.25+risk*0.2,
        GROWTH:weak(state,"economy")*0.55+weak(state,"infrastructure")*0.35+(1-fiscal)*0.1,
        TECHNOLOGY:weak(state,"science")*0.5+weak(state,"technology")*0.5,
        BALANCED:0.36
      };
      const strategy=Object.entries(scores).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];const previous=state.policy.strategy;state.policy.strategy=strategy;
      const p=state.policy.priorities;
      if(strategy==="SECURITY"){p.energy=0.78;p.food=0.68;p.resilience=0.66;p.infrastructure=0.56;}
      if(strategy==="RESILIENCE"){p.resilience=0.82;p.food=0.67;p.energy=0.62;p.infrastructure=0.62;}
      if(strategy==="GROWTH"){p.infrastructure=0.80;p.goods=0.68;p.science=0.58;p.energy=0.56;}
      if(strategy==="TECHNOLOGY"){p.science=0.84;p.data=0.76;p.infrastructure=0.58;p.resilience=0.48;}
      if(strategy==="BALANCED"){p.infrastructure=0.55;p.science=0.48;p.resilience=0.55;p.food=0.52;p.energy=0.55;}
      const row={day,country:state.code,previous,strategy,scores};this.lastReviews.push(row);this.ledger?.record({day,kind:"STRATEGY_REVIEW",country:state.code,type:strategy,effects:{previous,scores}});
    }return this.lastReviews;
  }
}
