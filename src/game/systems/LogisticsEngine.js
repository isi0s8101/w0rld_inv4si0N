const ROUTE_FOR_FLOW={
  goods:['ROAD_ROUTE','RAIL_ROUTE','SEA_ROUTE','AIR_ROUTE'], rawMaterials:['RAIL_ROUTE','ROAD_ROUTE','SEA_ROUTE'], food:['ROAD_ROUTE','RAIL_ROUTE','SEA_ROUTE','AIR_ROUTE'],
  militarySupplies:['ROAD_ROUTE','RAIL_ROUTE','SEA_ROUTE','AIR_ROUTE'], fuel:['PIPELINE_ROUTE','ROAD_ROUTE','RAIL_ROUTE','SEA_ROUTE'], oil:['PIPELINE_ROUTE','SEA_ROUTE'], gas:['PIPELINE_ROUTE','SEA_ROUTE'],
  people:['ROAD_ROUTE','RAIL_ROUTE','AIR_ROUTE','SEA_ROUTE'], data:['DIGITAL_ROUTE','ORBITAL_ROUTE'], electricity:[]
};
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
export class LogisticsEngine {
  constructor({ routeEngine, infrastructureRuntime }={}){this.routes=routeEngine;this.runtime=infrastructureRuntime;this.lastBottlenecks=[];this.lastReroutes=[];}
  beginHour(){this.routes?.beginUsageCycle?.();this.lastBottlenecks=[];this.lastReroutes=[];}
  route(from,to,flowType,amount=0){
    const allowed=ROUTE_FOR_FLOW[flowType]||[]; if(!allowed.length)return null;
    const result=this.routes?.shortestPath?.(from,to,{allowedTypes:allowed,capacityAware:true});if(!result)return null;
    const reservations=[];let deliverable=Math.max(0,Number(amount)||0);
    for(const routeId of result.routes){const route=this.routes.get(routeId);deliverable=Math.min(deliverable,route.availableCapacity??route.maxCapacity??route.capacity);}
    if(deliverable<=0)return null;
    for(const routeId of result.routes){const reserved=this.routes.reserveCapacity(routeId,deliverable);reservations.push({routeId,reserved});if(reserved<deliverable){deliverable=reserved;break;}}
    const travelTime=result.routes.reduce((s,id)=>s+(this.routes.get(id)?.travelTimeHours||0),0);
    const distance=result.routes.reduce((s,id)=>s+(this.routes.get(id)?.distanceKm||0),0);
    const risk=result.routes.reduce((s,id)=>s+(this.routes.get(id)?.risk||0),0)/Math.max(1,result.routes.length);
    return {...result,flowType,requested:amount,amount:deliverable,travelTimeHours:travelTime,distanceKm:distance,risk,reservations};
  }
  summarize(){
    const routes=this.routes?.routes||[];this.lastBottlenecks=routes.filter(r=>(r.congestionRuntime??r.congestion)>=.82||r.availableCapacity<=Math.max(1,(r.maxCapacity||r.capacity)*.08)).map(r=>({id:r.id,usage:r.currentUsage||0,capacity:r.maxCapacity||r.capacity,congestion:r.congestionRuntime??r.congestion,status:r.status})).sort((a,b)=>b.congestion-a.congestion);
    const total=routes.reduce((s,r)=>s+(r.maxCapacity||r.capacity||0),0);const available=routes.reduce((s,r)=>s+(r.availableCapacity??r.capacity??0),0);
    return {capacity:total,available,utilization:total?1-available/total:0,bottlenecks:this.lastBottlenecks.slice(0,12),dataClass:'SIM_DERIVED'};
  }
  countryCapacity(country){const routes=(this.routes?.routes||[]).filter(r=>r.country===country||this.routes.infrastructure?.get(r.from)?.country===country||this.routes.infrastructure?.get(r.to)?.country===country);if(!routes.length)return 50;const score=routes.reduce((s,r)=>s+(r.status==='CLOSED'?0:(1-(r.congestionRuntime??r.congestion))*Math.max(.1,r.availableCapacity/(r.maxCapacity||r.capacity||1))*100),0)/routes.length;return Math.max(0,Math.min(100,score));}
}
