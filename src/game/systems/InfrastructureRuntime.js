const FLOW_TYPES=['goods','oil','gas','electricity','rawMaterials','food','militarySupplies','fuel','people','data'];
const STATUS_FACTOR={OPERATIONAL:1,DEGRADED:.78,DISRUPTED:.52,CRITICAL:.28,OFFLINE:0,DESTROYED:0};
const p=(produce={},consume={},stock=[])=>({produce,consume,stock});
const PROFILES={
  CAPITAL:p({}, {electricity:2.2,goods:1.3,food:1.4,people:.4,data:2.2}, ['food','goods']),
  CITY:p({}, {electricity:2.5,goods:1.6,food:1.8,people:.5,data:1.8}, ['food','goods']),
  PORT:p({}, {electricity:.6,fuel:.4,data:.3}, ['goods','oil','fuel','rawMaterials','food','militarySupplies']),
  AIRPORT:p({}, {electricity:.8,fuel:1.1,data:.5}, ['fuel','goods','people']),
  LOGISTICS_HUB:p({}, {electricity:.4,fuel:.35,data:.2}, ['goods','food','rawMaterials','militarySupplies','fuel']),
  ROAD_HUB:p({}, {fuel:.12,data:.06}, ['goods','food']),
  RAIL_HUB:p({}, {electricity:.25,data:.08}, ['goods','rawMaterials','food','militarySupplies']),
  INDUSTRY:p({goods:2.4,militarySupplies:.45},{electricity:1.5,rawMaterials:1.9,fuel:.35,people:.25,data:.15},['goods','rawMaterials','fuel','militarySupplies']),
  POWER_PLANT:p({electricity:4.5},{fuel:.55,gas:.35,rawMaterials:.08},['fuel','gas']),
  DAM:p({electricity:2.8},{},{ }),
  POWER_GRID:p({}, {electricity:.06,data:.04}, []),
  REFINERY:p({fuel:2.4},{oil:2.7,electricity:.55},['oil','fuel']),
  PIPELINE_NODE:p({}, {electricity:.08,data:.03}, ['oil','gas']),
  ENERGY_STORAGE:p({}, {electricity:.04}, ['oil','gas','fuel']),
  MINE:p({rawMaterials:2.8},{electricity:.45,fuel:.25,people:.12},['rawMaterials']),
  DATACENTER:p({data:3.4},{electricity:1.7},[]),
  IXP:p({data:2.8},{electricity:.55},[]),
  CABLE_LANDING:p({data:2.2},{electricity:.35},[]),
  SPACEPORT:p({data:.25},{electricity:.7,fuel:.7,goods:.2},['fuel','goods']),
  GROUND_STATION:p({data:1.4},{electricity:.28},[]),
  AIRBASE:p({}, {electricity:.6,fuel:1.25,militarySupplies:.65,food:.18,data:.35},['fuel','militarySupplies','food']),
  NAVAL_BASE:p({}, {electricity:.5,fuel:1.15,militarySupplies:.6,food:.2,data:.3},['fuel','militarySupplies','food']),
  MILITARY_BASE:p({}, {electricity:.45,fuel:.8,militarySupplies:.7,food:.24,data:.25},['fuel','militarySupplies','food']),
  ARSENAL:p({}, {electricity:.2,data:.08},['militarySupplies','fuel']),
  RADAR:p({data:.15},{electricity:.35},[]),
  COMMAND_CENTER:p({data:.2},{electricity:.42},[]),
  HOSPITAL:p({}, {electricity:.65,food:.18,goods:.25,data:.22},['food','goods']),
  BRIDGE:p({}, {}, []), CHOKEPOINT:p({}, {}, []),
};
function clamp(v,min=0,max=1){return Math.max(min,Math.min(max,v));}
function normalizeStockList(v){return Array.isArray(v)?v:[];}
export class InfrastructureRuntime {
  constructor({ infrastructureGraph }={}){this.graph=infrastructureGraph;this.nodes=new Map();this.hour=0;}
  init(){
    this.nodes.clear();
    for(const node of this.graph?.list?.()||[]){
      const profile=PROFILES[node.type]||p({}, {}, []);const stocks={};
      for(const type of FLOW_TYPES){const listed=normalizeStockList(profile.stock).includes(type);const capacity=listed?Math.max(10,node.capacity*.9):Math.max(2,node.capacity*.08);stocks[type]={capacity,current:capacity*(listed?.58:.25),incoming:0,outgoing:0};}
      this.nodes.set(node.id,{id:node.id,country:node.country,type:node.type,profile,stocks,damage:{physicalDamage:0,cyberDisruption:0,energyFailure:0,supplyFailure:0,staffShortage:0},dependencyFactor:1,effectiveCapacity:node.capacity,status:node.status,lastProduction:{},lastConsumption:{},dataClass:'SIM_INFRA_RUNTIME'});
    }
    return this;
  }
  get(id){return this.nodes.get(id)||null;}
  list(){return [...this.nodes.values()];}
  statusFactor(nodeId){const node=this.graph?.get?.(nodeId);const rt=this.get(nodeId);if(!node||!rt)return 0;const damage=Object.values(rt.damage).reduce((a,b)=>a+clamp(Number(b)||0),0)/5;return clamp((STATUS_FACTOR[node.status]??0)*clamp(node.health/100)*(1-damage*.72)*rt.dependencyFactor);}
  effectiveCapacity(nodeId){const node=this.graph?.get?.(nodeId);const rt=this.get(nodeId);if(!node||!rt)return 0;rt.effectiveCapacity=node.capacity*this.statusFactor(nodeId);rt.status=node.status;return rt.effectiveCapacity;}
  setDependencyFactor(id,value){const rt=this.get(id);if(!rt)return false;rt.dependencyFactor=clamp(value);return true;}
  setDamage(id,damage={}){const rt=this.get(id);if(!rt)return false;for(const k of Object.keys(rt.damage))if(k in damage)rt.damage[k]=clamp(Number(damage[k])||0);return true;}
  resetHour(){for(const rt of this.nodes.values())for(const s of Object.values(rt.stocks)){s.incoming=0;s.outgoing=0;}}
  profileRates(id){const rt=this.get(id);if(!rt)return {production:{},consumption:{}};const factor=this.statusFactor(id);const production={},consumption={};for(const [k,v] of Object.entries(rt.profile.produce||{}))production[k]=v*factor;for(const [k,v] of Object.entries(rt.profile.consume||{}))consumption[k]=v*(.35+.65*factor);rt.lastProduction=production;rt.lastConsumption=consumption;return {production,consumption};}
  deposit(id,type,amount){const s=this.get(id)?.stocks?.[type];if(!s)return 0;const add=Math.max(0,Math.min(Number(amount)||0,s.capacity-s.current));s.current+=add;s.incoming+=add;return add;}
  withdraw(id,type,amount){const s=this.get(id)?.stocks?.[type];if(!s)return 0;const take=Math.max(0,Math.min(Number(amount)||0,s.current));s.current-=take;s.outgoing+=take;return take;}
  shortage(id,type,demand){const s=this.get(id)?.stocks?.[type];if(!s||demand<=0)return 0;return clamp(1-Math.min(1,s.current/Math.max(.001,demand*8)));}
  snapshot(){return {hour:this.hour,nodes:this.list().map(x=>structuredClone(x))};}
}
export { FLOW_TYPES as INFRA_FLOW_TYPES };
