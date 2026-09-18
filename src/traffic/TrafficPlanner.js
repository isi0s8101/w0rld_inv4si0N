const TRANSPORT_TYPES=new Set(['SEA_ROUTE','AIR_ROUTE','RAIL_ROUTE','ROAD_ROUTE']);
export class TrafficPlanner {
  constructor({routeEngine}={}){this.routes=routeEngine;}
  plan(flows=[]){const groups=new Map();for(const flow of flows){for(const rid of flow.routes||[]){const route=this.routes?.get(rid);if(!route||!TRANSPORT_TYPES.has(route.type))continue;const g=groups.get(rid)||{routeId:rid,route,amount:0,flows:[],cargo:new Map(),origin:flow.from,destination:flow.to};g.amount+=Number(flow.amount)||0;g.flows.push(flow);g.cargo.set(flow.type,(g.cargo.get(flow.type)||0)+(Number(flow.amount)||0));groups.set(rid,g);}}return [...groups.values()].map(g=>({...g,dominantCargo:[...g.cargo.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'goods',dominantFlow:[...g.flows].sort((a,b)=>(b.amount||0)-(a.amount||0))[0]}));}
}
