const RESOURCES=["food","energy","goods","data"];
const CONFIG={
  food:{elasticity:0.72,smoothing:0.10,floor:62,ceiling:225},
  energy:{elasticity:0.86,smoothing:0.12,floor:58,ceiling:260},
  goods:{elasticity:0.62,smoothing:0.08,floor:68,ceiling:210},
  data:{elasticity:0.48,smoothing:0.07,floor:72,ceiling:185}
};
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
export class MarketSystem{
  constructor(){
    this.markets=Object.fromEntries(RESOURCES.map(resource=>[resource,{resource,priceIndex:100,targetPriceIndex:100,supply:0,demand:0,shortageRatio:0,volatility:0,lastDelta:0,history:[]} ]));
    this.day=0;
  }
  update(states,day){
    this.day=day;
    for(const resource of RESOURCES){
      const cfg=CONFIG[resource];let supply=0,demand=0,shortageWeighted=0,weight=0;
      for(const state of states.values()){
        const r=state.resources?.[resource];if(!r)continue;
        supply+=Math.max(0,r.production||0)+Math.max(0,r.imports||0)*0.18;
        demand+=Math.max(0,r.consumption||0);
        const w=Math.max(0.1,r.consumption||0.1); shortageWeighted+=(r.shortage||0)*w;weight+=w;
      }
      const ratio=demand/Math.max(0.01,supply);
      const shortageRatio=weight?shortageWeighted/weight:0;
      const scarcity=Math.pow(clamp(ratio,0.45,2.8),cfg.elasticity);
      const target=clamp(100*scarcity*(1+shortageRatio*0.32),cfg.floor,cfg.ceiling);
      const market=this.markets[resource];
      const previous=market.priceIndex;
      market.priceIndex=clamp(previous+(target-previous)*cfg.smoothing,cfg.floor,cfg.ceiling);
      market.targetPriceIndex=target;market.supply=supply;market.demand=demand;market.shortageRatio=shortageRatio;
      market.lastDelta=market.priceIndex-previous;
      market.volatility=market.volatility*0.88+Math.abs(market.lastDelta)*0.12;
      if(day===1||day%30===0){market.history.push({day,priceIndex:market.priceIndex,supply,demand,shortageRatio});if(market.history.length>120)market.history.shift();}
    }
    return this.snapshot();
  }
  applyLocalPrices(states,flowEngine=null){
    for(const state of states.values()){
      for(const resource of RESOURCES){
        const r=state.resources?.[resource];if(!r)continue;
        const global=this.markets[resource].priceIndex;
        const importShare=Math.max(0,r.imports||0)/Math.max(0.01,(r.production||0)+(r.imports||0));
        const isolationPremium=importShare>0.55?2.2:importShare>0.30?0.9:0;
        const local=clamp(global*(1+(r.shortage||0)*0.62)+isolationPremium,50,320);
        r.globalPriceIndex=global;r.priceIndex=local;r.marketPriceIndex=local;
      }
    }
  }
  get(resource){return structuredClone(this.markets[String(resource||"").toLowerCase()]||null);}
  summary(){return Object.fromEntries(RESOURCES.map(r=>[r,{priceIndex:this.markets[r].priceIndex,targetPriceIndex:this.markets[r].targetPriceIndex,supply:this.markets[r].supply,demand:this.markets[r].demand,volatility:this.markets[r].volatility}]));}
  snapshot(){return {version:1,day:this.day,markets:structuredClone(this.markets)};}
}
