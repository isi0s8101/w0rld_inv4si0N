const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
function avgShortage(s){const r=Object.values(s.resources||{});return r.reduce((a,x)=>a+(x.shortage||0),0)/Math.max(1,r.length);}
export class ForeignPolicySystem{
  constructor({ledger}={}){this.ledger=ledger;}
  initialize(states){for(const s of states.values())if(!s.foreignPolicy)s.foreignPolicy={doctrine:"BALANCED",openness:.5,autonomy:.5,regionalism:.5,security:.5,technology:.5,lastReviewDay:0,history:[{day:0,doctrine:"BALANCED"}]};}
  review(states,day){if(day!==1&&day%90!==0)return[];const out=[];
    for(const s of states.values()){
      const shortage=avgShortage(s),econ=s.metrics.economy.current/100,res=s.metrics.resilience.current/100,tech=(s.metrics.technology.current+s.metrics.science.current)/200,inf=s.metrics.diplomaticInfluence.current/100;
      const scores={
        OPEN_TRADE:clamp(econ*.34+inf*.28+(1-shortage)*.20+s.metrics.infrastructure.current/100*.18),
        REGIONAL_COOPERATION:clamp(inf*.34+res*.26+econ*.22+s.metrics.cohesion.current/100*.18),
        STRATEGIC_AUTONOMY:clamp(shortage*.34+res*.30+(1-econ)*.16+s.metrics.energy.current/100*.20),
        TECHNOLOGY_FIRST:clamp(tech*.62+econ*.18+inf*.20),
        SECURITY_FIRST:clamp(shortage*.40+s.metrics.militaryReadiness.current/100*.24+res*.24+(1-s.metrics.stability.current/100)*.12),
        BALANCED:.44
      };
      const doctrine=Object.entries(scores).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0],previous=s.foreignPolicy.doctrine;
      const cfg={OPEN_TRADE:[.80,.28,.48,.28,.52],REGIONAL_COOPERATION:[.62,.42,.82,.38,.48],STRATEGIC_AUTONOMY:[.36,.84,.46,.66,.48],TECHNOLOGY_FIRST:[.66,.48,.44,.34,.88],SECURITY_FIRST:[.32,.76,.54,.88,.44],BALANCED:[.52,.52,.52,.52,.52]}[doctrine];
      [s.foreignPolicy.openness,s.foreignPolicy.autonomy,s.foreignPolicy.regionalism,s.foreignPolicy.security,s.foreignPolicy.technology]=cfg;
      s.foreignPolicy.doctrine=doctrine;s.foreignPolicy.lastReviewDay=day;s.foreignPolicy.history.push({day,doctrine});if(s.foreignPolicy.history.length>24)s.foreignPolicy.history.shift();
      const row={day,country:s.code,previous,doctrine,scores};out.push(row);this.ledger?.record({day,kind:"FOREIGN_POLICY_REVIEW",country:s.code,type:doctrine,effects:{previous,scores}});
    }return out;
  }
}
