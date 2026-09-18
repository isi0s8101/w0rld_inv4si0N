import { INFRA_FLOW_TYPES } from './InfrastructureRuntime.js';
const TRANSPORTED=new Set(['goods','oil','gas','rawMaterials','food','militarySupplies','fuel','people','data']);
export class InfrastructureFlowEngine {
  constructor({ infrastructureGraph, runtime, logistics }={}){this.graph=infrastructureGraph;this.runtime=runtime;this.logistics=logistics;this.sequence=0;this.lastFlows=[];this.cumulative=Object.fromEntries(INFRA_FLOW_TYPES.map(t=>[t,0]));}
  candidates(type){const supply=[],demand=[];for(const node of this.graph.list()){const rt=this.runtime.get(node.id),rates=this.runtime.profileRates(node.id);const p=rates.production[type]||0,c=rates.consumption[type]||0;if(p>0)supply.push({node,amount:p});if(c>0)demand.push({node,amount:c});const stock=rt?.stocks?.[type];if(stock?.current>stock?.capacity*.66)supply.push({node,amount:(stock.current-stock.capacity*.58)*.08});if(stock&&c>0&&stock.current<stock.capacity*.35)demand.push({node,amount:c*.65});}return {supply,demand};}
  localElectricity(){const flows=[];const plants=this.candidates('electricity').supply;const consumers=this.candidates('electricity').demand;for(const d of consumers){let need=d.amount;const same=plants.filter(p=>p.node.country===d.node.country).sort((a,b)=>Math.abs(a.node.position.lat-d.node.position.lat)-Math.abs(b.node.position.lat-d.node.position.lat));for(const s of same){if(need<=.001)break;const amount=Math.min(need,s.amount);s.amount-=amount;need-=amount;this.runtime.deposit(d.node.id,'electricity',amount);flows.push(this.flow('electricity',s.node.id,d.node.id,amount,[],0,0));}}return flows;}
  flow(type,from,to,amount,routes,distanceKm,travelTimeHours){this.cumulative[type]=(this.cumulative[type]||0)+amount;return {id:`IF${++this.sequence}`,type,from,to,amount,routes,distanceKm,travelTimeHours,hour:this.runtime.hour,dataClass:'SIM_PHYSICAL_FLOW'};}
  stepHour(hour){
    this.runtime.hour=hour;this.runtime.resetHour();this.logistics.beginHour();
    const rates=new Map();
    for(const node of this.graph.list()){const r=this.runtime.profileRates(node.id);rates.set(node.id,r);for(const [type,amount] of Object.entries(r.production||{}))if(type!=="electricity")this.runtime.deposit(node.id,type,amount);}
    const flows=[...this.localElectricity()];
    for(const type of INFRA_FLOW_TYPES){if(type==='electricity'||!TRANSPORTED.has(type))continue;const {supply,demand}=this.candidates(type);for(const d of demand){let need=d.amount;const ranked=supply.filter(s=>s.amount>.001&&s.node.id!==d.node.id).sort((a,b)=>(a.node.country===d.node.country?-1:0)-(b.node.country===d.node.country?-1:0));for(const s of ranked){if(need<=.001)break;const plan=this.logistics.route(s.node.id,d.node.id,type,Math.min(need,s.amount));if(!plan?.amount)continue;const loaded=this.runtime.withdraw(s.node.id,type,plan.amount);if(loaded<=0)continue;const delivered=Math.min(plan.amount,loaded);this.runtime.deposit(d.node.id,type,delivered);s.amount-=delivered;need-=delivered;flows.push(this.flow(type,s.node.id,d.node.id,delivered,plan.routes,plan.distanceKm,plan.travelTimeHours));}}}
    for(const node of this.graph.list()){const r=rates.get(node.id)||this.runtime.profileRates(node.id);for(const [type,amount] of Object.entries(r.consumption||{}))this.runtime.withdraw(node.id,type,amount);}
    this.lastFlows=flows;return flows;
  }
  getFlows({type=null,country=null}={}){return this.lastFlows.filter(f=>(!type||f.type===type)&&(!country||this.graph.get(f.from)?.country===country||this.graph.get(f.to)?.country===country));}
  summary(){return {active:this.lastFlows.length,byType:Object.fromEntries(INFRA_FLOW_TYPES.map(t=>[t,this.lastFlows.filter(f=>f.type===t).reduce((s,f)=>s+f.amount,0)])),cumulative:{...this.cumulative},dataClass:'SIM_PHYSICAL_FLOW'};}
}
