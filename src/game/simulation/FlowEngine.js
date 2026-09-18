import { RESOURCE_TYPES } from "./constants.js";

const FLOW_NAME = { food: "FOOD", energy: "ENERGY", goods: "GOODS", data: "DATA" };

export class FlowEngine {
  constructor({ relationGraph, resourceEconomy, routingIntervalDays = 7 } = {}) {
    this.graph = relationGraph;
    this.resourceEconomy = resourceEconomy;
    this.routingIntervalDays = routingIntervalDays;
    this.contracts = [];
    this.lastFlows = [];
    this.sequence = 0;
    this.lastRoutingDay = -Infinity;
  }

  rebuildContracts(states, day) {
    const contracts=[];
    for (const type of RESOURCE_TYPES) {
      const balances = new Map();
      for (const state of states.values()) balances.set(state.code, this.resourceEconomy.projectedBalance(state,type));
      const importers=[...states.values()].map((state)=>({code:state.code,need:Math.max(0,-(balances.get(state.code)||0))})).filter((x)=>x.need>0.35).sort((a,b)=>b.need-a.need);
      const remaining = new Map([...states.keys()].map((code)=>[code,Math.max(0,balances.get(code)||0)]));
      for (const importer of importers) {
        let need=importer.need;
        const candidates=[];
        for (const edge of this.graph.incoming(importer.code)) {
          const available=remaining.get(edge.from)||0;
          if (available<=0.05) continue;
          const mode=this.graph.bestMode(edge,type); if(!mode)continue;
          const capacity=edge.capacities[mode]||0; if(capacity<=0)continue;
          const modePenalty=mode==="AIR"||mode==="DATA_SPACE"?1.7:1;
          const cost=(edge.distanceKm/1800+0.35)*modePenalty+(100-edge.transport)/170;
          candidates.push({edge,mode,capacity,available,cost});
        }
        candidates.sort((a,b)=>a.cost-b.cost);
        for (const item of candidates.slice(0,4)) {
          if(need<=0.05)break;
          const available=remaining.get(item.edge.from)||0;
          const amount=Math.min(need,available,item.capacity*0.18);
          if(amount<=0.05)continue;
          const route={nodes:[item.edge.from,importer.code],edges:[item.edge],modes:[item.mode],capacity:item.capacity,cost:item.cost};
          contracts.push({id:`C${++this.sequence}`,resource:type,from:item.edge.from,to:importer.code,amount,route,createdDay:day});
          remaining.set(item.edge.from,available-amount); need-=amount;
        }
      }
    }
    this.contracts=contracts; this.lastRoutingDay=day;
  }

  populationFlows(states, day) {
    if (day % 30 !== 0) return [];
    const flows=[];
    for (const source of states.values()) {
      const originScore=source.metrics.economy.current*0.48+source.metrics.stability.current*0.34+source.metrics.cohesion.current*0.18;
      let best=null;
      for(const edge of this.graph.outgoing(source.code)){
        const target=states.get(edge.to); if(!target)continue;
        const targetScore=target.metrics.economy.current*0.48+target.metrics.stability.current*0.34+target.metrics.cohesion.current*0.18;
        const delta=targetScore-originScore;
        if(delta<8||edge.trust<28)continue;
        const score=delta*(edge.trust/100)/(1+edge.distanceKm/2500);
        if(!best||score>best.score)best={edge,target,score,delta};
      }
      if(!best)continue;
      const count=Math.max(0,Math.round(source.populationCount*Math.min(0.00004,best.delta/100*0.00002)));
      if(count<50)continue;
      flows.push({id:`P${++this.sequence}`,type:"POPULATION",subtype:"MIGRATION",from:source.code,to:best.target.code,amount:count,mode:best.edge.modes.includes("LAND")?"LAND":"AIR",day});
    }
    return flows;
  }

  routeDay(states, day) {
    if (day - this.lastRoutingDay >= this.routingIntervalDays || !this.contracts.length) this.rebuildContracts(states, day);
    const transfers=new Map([...states.keys()].map((code)=>[code,Object.fromEntries(RESOURCE_TYPES.map((r)=>[r,{imports:0,exports:0}]))]));
    const flows=[];
    for(const contract of this.contracts){
      const source=states.get(contract.from), target=states.get(contract.to); if(!source||!target)continue;
      const sourceBalance=Math.max(0,this.resourceEconomy.projectedBalance(source,contract.resource));
      const targetNeed=Math.max(0,-this.resourceEconomy.projectedBalance(target,contract.resource));
      const amount=Math.min(contract.amount,sourceBalance,targetNeed,contract.route.capacity*0.18);
      if(amount<=0.02)continue;
      transfers.get(source.code)[contract.resource].exports+=amount;
      transfers.get(target.code)[contract.resource].imports+=amount;
      flows.push({id:`F${++this.sequence}`,type:FLOW_NAME[contract.resource],subtype:contract.resource.toUpperCase(),from:source.code,to:target.code,amount,mode:contract.route.modes[0],route:contract.route.nodes,day});
    }
    const population=this.populationFlows(states,day);
    for(const flow of population){
      const source=states.get(flow.from),target=states.get(flow.to); if(!source||!target)continue;
      const count=Math.min(flow.amount,Math.max(0,source.populationCount-1000));
      source.populationCount-=count; target.populationCount+=count;
      source.populationDelta-=count; target.populationDelta+=count;
      source.metrics.population.pressure-=Math.min(0.04,count/Math.max(1,source.populationCount)*100);
      target.metrics.population.pressure+=Math.min(0.04,count/Math.max(1,target.populationCount)*100);
    }
    this.lastFlows=[...flows,...population];
    return {transfers,flows:this.lastFlows};
  }

  getFlows({country=null,type=null}={}) {
    return this.lastFlows.filter((flow)=>(!country||flow.from===country||flow.to===country)&&(!type||flow.type===type));
  }

  snapshot(){return {contracts:this.contracts.map(c=>({id:c.id,resource:c.resource,from:c.from,to:c.to,amount:c.amount,createdDay:c.createdDay})),lastFlows:this.lastFlows,sequence:this.sequence,lastRoutingDay:this.lastRoutingDay};}
}
