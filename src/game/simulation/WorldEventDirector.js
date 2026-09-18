const EVENT_TYPES = [
  { type:"ECONOMIC_SLOWDOWN", category:"ECONOMY", metric:"economy", magnitude:-0.20, minDuration:45, maxDuration:150, rippleMetric:"economy" },
  { type:"ENERGY_SUPPLY_STRESS", category:"ENERGY", metric:"energy", magnitude:-0.24, resource:"energy", capacityFactor:0.91, minDuration:30, maxDuration:120, rippleMetric:"economy" },
  { type:"CLIMATE_STRESS", category:"CLIMATE", metric:"food", secondaryMetric:"infrastructure", magnitude:-0.20, resource:"food", capacityFactor:0.90, minDuration:35, maxDuration:135, rippleMetric:"food" },
  { type:"LOGISTICS_DISRUPTION", category:"LOGISTICS", metric:"infrastructure", magnitude:-0.13, corridor:true, minDuration:18, maxDuration:75, rippleMetric:"economy" },
  { type:"TECHNOLOGY_WAVE", category:"TECHNOLOGY", metric:"science", secondaryMetric:"technology", magnitude:0.19, minDuration:40, maxDuration:160, rippleMetric:"technology" },
  { type:"INDUSTRIAL_EXPANSION", category:"ECONOMY", metric:"economy", secondaryMetric:"infrastructure", magnitude:0.13, minDuration:50, maxDuration:180, rippleMetric:"economy" }
];

function importance(edge){return (edge.trade||0)*0.45+(edge.trust||0)*0.25+(edge.transport||0)*0.20+(edge.diplomaticRelation||0)*0.10;}

export class WorldEventDirector {
  constructor(random){this.random=random;this.active=[];this.nextDay=18+random.int(0,26);this.sequence=0;this.generated=0;}

  cleanupEvent(event,{states,flowEngine}={}){
    if(event.resource && Number.isFinite(event.capacityBefore)){
      const state=states.get(event.country);if(state?.resources?.[event.resource])state.resources[event.resource].productionCapacity=event.capacityBefore;
    }
    if(event.corridorId && event.corridorBefore){
      const stillUsed=this.active.some(e=>e.id!==event.id && e.corridorId===event.corridorId && e.endDay>=event.endDay);
      if(!stillUsed)flowEngine?.setCorridorState?.(event.corridorId,event.corridorBefore);
    }
  }

  expire(day,context){
    const kept=[];
    for(const event of this.active){
      if(event.endDay<day)this.cleanupEvent(event,context);else kept.push(event);
    }
    this.active=kept;
  }

  scheduleRipple(event,{states,relations,propagation}={}){
    if(!propagation||!relations)return;
    const edges=(relations.outgoing(event.country)||[]).slice().sort((a,b)=>importance(b)-importance(a)).slice(0,7);
    for(let i=0;i<edges.length;i++){
      const edge=edges[i];if(!states.has(edge.to))continue;
      const attenuation=Math.max(0.10,0.44-i*0.045)*(importance(edge)/100);
      const delay=this.random.int(event.category==="LOGISTICS"?4:8,event.category==="TECHNOLOGY"?55:42);
      propagation.schedule({dueDay:event.startDay+delay,target:edge.to,metric:event.rippleMetric||event.metric,delta:event.magnitude*attenuation,source:event.country,eventId:event.id,cause:`${event.type}_RIPPLE`,confidence:0.72});
    }
  }

  createEvent(states,day,{flowEngine,relations,propagation,ledger}={}){
    const countries=[...states.values()].filter(s=>s.code!=="AQ");
    const target=this.random.pick(countries);const template=this.random.pick(EVENT_TYPES);if(!target||!template)return null;
    const duration=this.random.int(template.minDuration,template.maxDuration);
    const event={id:`WE${++this.sequence}`,...template,country:target.code,startDay:day,endDay:day+duration,dataClass:"SIM_WORLD_EVENT",provenance:{basis:"seeded autonomous world-event model"}};
    target.metrics[template.metric].pressure+=template.magnitude;
    if(template.secondaryMetric)target.metrics[template.secondaryMetric].pressure+=template.magnitude*0.48;
    if(template.resource){
      const r=target.resources[template.resource];event.capacityBefore=r.productionCapacity;r.productionCapacity=Math.max(r.demandBase*0.30,r.productionCapacity*template.capacityFactor);
    }
    if(template.corridor && flowEngine?.network){
      const candidates=flowEngine.network.all().filter(c=>(c.from===target.code||c.to===target.code)&&c.status!=="CLOSED");
      const corridor=this.random.pick(candidates);
      if(corridor){
        event.corridorId=corridor.id;event.corridorBefore={status:corridor.status,disruption:corridor.disruption,reliability:corridor.reliability};
        event.disruption=Number(this.random.range(0.45,0.82).toFixed(3));flowEngine.setCorridorState(corridor.id,{status:"OPEN",disruption:event.disruption});
      }
    }
    this.active.push(event);this.generated++;
    this.scheduleRipple(event,{states,relations,propagation});
    ledger?.record({day,kind:"WORLD_EVENT",country:target.code,type:event.type,eventId:event.id,effects:{metric:event.metric,magnitude:event.magnitude,corridorId:event.corridorId||null,endDay:event.endDay}});
    return event;
  }

  update(states,day,context={}){
    this.expire(day,{states,...context});
    if(day<this.nextDay)return [];
    const event=this.createEvent(states,day,context);this.nextDay=day+this.random.int(24,72);return event?[event]:[];
  }
}
