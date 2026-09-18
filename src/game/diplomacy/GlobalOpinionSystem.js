const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export class GlobalOpinionSystem{
  constructor({ledger}={}){this.ledger=ledger;this.state={awareness:22,cooperation:45,tension:20,confidence:55,lastDay:0};this.history=[];}
  initialize(states){for(const s of states.values())s.publicOpinion={confidence:55,tension:20,internationalism:50,lastDay:0};}
  update(states,{events=[],sanctions=null,agreements=null,day=0}={}){if(day!==1&&day%30!==0)return this.state;let shortage=0,aw=0,stability=0;for(const s of states.values()){shortage+=Object.values(s.resources).reduce((a,r)=>a+(r.shortage||0),0)/4;aw+=s.metrics.awareness.current;stability+=s.metrics.stability.current;}const n=Math.max(1,states.size);shortage/=n;aw/=n;stability/=n;
    const sanctionsCount=sanctions?.list?.({status:"ACTIVE"})?.length||0,agreementsCount=agreements?.list?.({status:"ACTIVE"})?.length||0,eventPressure=Math.min(1,(events?.length||0)/4);
    const targetAw=clamp(18+aw*.52+shortage*22+eventPressure*8);const targetTension=clamp(shortage*42+sanctionsCount/Math.max(1,n)*38+(100-stability)*.28);const targetCoop=clamp(38+agreementsCount/Math.max(1,n)*26-targetTension*.18+stability*.18);
    this.state.awareness=clamp(this.state.awareness*.72+targetAw*.28);this.state.tension=clamp(this.state.tension*.72+targetTension*.28);this.state.cooperation=clamp(this.state.cooperation*.72+targetCoop*.28);this.state.confidence=clamp(70-this.state.tension*.35+this.state.cooperation*.20);this.state.lastDay=day;
    for(const s of states.values()){const localShort=Object.values(s.resources).reduce((a,r)=>a+(r.shortage||0),0)/4;s.publicOpinion.confidence=clamp(72-localShort*42-(100-s.metrics.stability.current)*.28);s.publicOpinion.tension=clamp(16+localShort*46+(100-s.metrics.cohesion.current)*.22);s.publicOpinion.internationalism=clamp(35+(s.foreignPolicy?.openness||.5)*36+(s.metrics.diplomaticInfluence.current-50)*.18);s.publicOpinion.lastDay=day;s.metrics.awareness.pressure+=Math.max(-.04,Math.min(.08,(this.state.awareness-s.metrics.awareness.current)/900));}
    this.history.push({day,...this.state});if(this.history.length>120)this.history.shift();this.ledger?.record({day,kind:"GLOBAL_OPINION",type:"MONTHLY_UPDATE",effects:{...this.state}});return this.state;
  }
  snapshot(){return structuredClone({state:this.state,history:this.history});}
}
