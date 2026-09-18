const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export class EconomyEngineV1 {
  constructor({ graph, runtime, logistics, infraFlows }={}){this.graph=graph;this.runtime=runtime;this.logistics=logistics;this.infraFlows=infraFlows;this.byCountry=new Map();}
  update(states,day){this.byCountry.clear();for(const state of states.values()){
    for(const resource of Object.values(state.strategicResources||{})){
      const net=(resource.production||0)+(resource.imports||0)-(resource.consumption||0)-(resource.exports||0);
      resource.stock=Math.max(0,Math.min(resource.stockCapacity||Infinity,(resource.stock||0)+net*.12));
      const coverage=(resource.stockCapacity||0)>0?resource.stock/resource.stockCapacity:.5;
      const deficit=Math.max(0,(resource.consumption||0)-(resource.production||0));
      resource.dependency=Math.max(0,Math.min(1,deficit/Math.max(.001,resource.consumption||0)));
      resource.price=Math.max(20,Math.min(400,(resource.price||100)*(1+(0.45-coverage)*.012+resource.dependency*.004)));
    }
    const nodes=this.graph.forCountry(state.code);const industry=nodes.filter(n=>n.type==='INDUSTRY');const industrialCapacity=industry.length?industry.reduce((s,n)=>s+this.runtime.effectiveCapacity(n.id),0)/industry.length:state.metrics.infrastructure.current*.72;const logisticsCapacity=this.logistics.countryCapacity(state.code);const digitalNodes=nodes.filter(n=>['DATACENTER','IXP','CABLE_LANDING','GROUND_STATION'].includes(n.type));const digitalConnectivity=digitalNodes.length?digitalNodes.reduce((s,n)=>s+this.runtime.effectiveCapacity(n.id),0)/digitalNodes.length:state.metrics.technology.current*.65;const imports=Object.values(state.resources).reduce((s,r)=>s+(r.imports||0),0);const exports=Object.values(state.resources).reduce((s,r)=>s+(r.exports||0),0);const production=Object.values(state.resources).reduce((s,r)=>s+(r.production||0),0);const consumption=Object.values(state.resources).reduce((s,r)=>s+(r.consumption||0),0);const prices=Object.values(state.resources).reduce((s,r)=>s+(r.priceIndex||100),0)/Math.max(1,Object.keys(state.resources).length);const tradeDependency=clamp(imports/Math.max(1,consumption)*100);const employment=clamp(42+industrialCapacity*.24+state.metrics.economy.current*.34-state.metrics.stability.pressure*8);const resilience=clamp(state.metrics.resilience.current*.55+logisticsCapacity*.2+digitalConnectivity*.1+(100-tradeDependency)*.15);const row={production,consumption,imports,exports,stocks:Object.values(state.resources).reduce((s,r)=>s+(r.stock||0),0),prices,tradeBalance:exports-imports,employment,industrialOutput:industrialCapacity,logisticsCapacity,digitalConnectivity,resilience,tradeDependency,day,dataClass:'DERIVED_SIMULATION'};this.byCountry.set(state.code,row);state.economyV1=row;}
    return this.byCountry;}
  get(code){return this.byCountry.get(code)||null;}
}
