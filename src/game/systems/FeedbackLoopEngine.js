const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export class FeedbackLoopEngine {
  constructor(){this.byCountry=new Map();this.lastDay=-1;}

  update(states,{day=0,events=[],worldMemory=null}={}){
    if(day!==1&&day%7!==0)return this.byCountry;
    this.lastDay=day;this.byCountry.clear();
    for(const state of states.values()){
      const loops=[];
      const countryEvents=(events||[]).filter(e=>e.country===state.code||e.target===state.code);
      const atWar=countryEvents.some(e=>e.type==='WAR');
      const blockade=countryEvents.some(e=>e.type==='BLOCKADE');
      const energy=state.derivedSystems?.energy?.energySecurity??state.metrics.energy.current;
      const logistics=state.economyV1?.logisticsCapacity??state.metrics.infrastructure.current;
      const economy=state.metrics.economy.current;
      const stability=state.metrics.stability.current;
      const infrastructure=state.metrics.infrastructure.current;

      if(atWar){
        const budget=state.policy?.budget;
        if(budget){const extra=Math.min(budget.treasury,budget.monthlyRevenue*.035);budget.treasury-=extra;budget.spentThisYear+=extra;budget.debt=Math.min(budget.debtLimit,budget.debt+budget.monthlyRevenue*.012);}
        state.metrics.militaryReadiness.pressure+=.022;
        state.metrics.economy.pressure-=.026;
        state.metrics.stability.pressure-=.024;
        state.metrics.infrastructure.pressure-=.010;
        loops.push({id:'WAR_BURDEN',polarity:'NEGATIVE',chain:['war','militarySpending','debt','civilInvestment','economy','stability'],strength:.78});
      }

      if(blockade){
        state.metrics.economy.pressure-=.015;state.metrics.infrastructure.pressure-=.012;
        loops.push({id:'BLOCKADE_COST',polarity:'NEGATIVE',chain:['blockade','rerouting','transportCost','imports','production','stability'],strength:.58});
      }

      if(energy<42){
        state.metrics.economy.pressure-=.010;state.metrics.infrastructure.pressure-=.004;
        loops.push({id:'ENERGY_SCARCITY',polarity:'NEGATIVE',chain:['energyInsecurity','prices','industrialOutput','employment','stability'],strength:Number(((42-energy)/42).toFixed(3))});
      }

      if(stability<42&&economy<48){
        state.metrics.economy.pressure-=.006;state.metrics.stability.pressure-=.007;
        loops.push({id:'INSTABILITY_TRAP',polarity:'NEGATIVE',chain:['instability','investment','employment','revenue','publicServices','instability'],strength:Number((((42-stability)+(48-economy))/90).toFixed(3))});
      }

      if(economy>66&&infrastructure>60&&stability>58&&logistics>58){
        state.metrics.economy.pressure+=.006;state.metrics.infrastructure.pressure+=.004;state.metrics.technology.pressure+=.003;
        loops.push({id:'GROWTH_REINVESTMENT',polarity:'POSITIVE',chain:['growth','investment','infrastructure','production','exports','growth'],strength:Number((((economy-66)+(infrastructure-60)+(stability-58))/120).toFixed(3))});
      }

      if(energy>70&&logistics>65&&economy>60){
        state.metrics.resilience.pressure+=.004;state.metrics.economy.pressure+=.003;
        loops.push({id:'SECURE_SUPPLY_GROWTH',polarity:'POSITIVE',chain:['energySecurity','logistics','production','exports','resilience'],strength:Number((((energy-70)+(logistics-65))/70).toFixed(3))});
      }

      const recent=worldMemory?.timeline?.({country:state.code,sinceDay:Math.max(0,day-365),limit:100})||[];
      const cooperation=recent.filter(r=>['ALLIANCE','AGREEMENT','AID'].includes(r.kind)).length;
      if(cooperation>=3){
        state.metrics.diplomaticInfluence.pressure+=.004;state.metrics.stability.pressure+=.002;
        loops.push({id:'COOPERATION_DIVIDEND',polarity:'POSITIVE',chain:['cooperation','trust','trade','influence','stability'],strength:Math.min(1,cooperation/10)});
      }

      const row={day,country:state.code,loops:loops.map(loop=>({...loop,strength:clamp(loop.strength*100)/100})),dataClass:'SIM_FEEDBACK_LOOPS'};
      this.byCountry.set(state.code,row);state.feedbackLoops=row;
    }
    return this.byCountry;
  }

  get(code){return structuredClone(this.byCountry.get(code)||{country:code,day:this.lastDay,loops:[],dataClass:'SIM_FEEDBACK_LOOPS'});}
  summary(){
    let positive=0,negative=0,total=0;for(const row of this.byCountry.values())for(const loop of row.loops){total++;if(loop.polarity==='POSITIVE')positive++;else negative++;}
    return {countries:this.byCountry.size,total,positive,negative,day:this.lastDay,dataClass:'SIM_FEEDBACK_LOOPS'};
  }
}
