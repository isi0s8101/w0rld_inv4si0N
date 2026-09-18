import { TrafficPlanner } from './TrafficPlanner.js';
import { VehicleSpawner } from './VehicleSpawner.js';
import { VehicleMovement } from './VehicleMovement.js';
import { DeliveryResolver } from './DeliveryResolver.js';

export class TrafficLogisticsEngine {
  constructor({routeEngine,simulation=null,deliveryMode='MIRROR',settleDelivery=null}={}){
    this.routes=routeEngine;this.simulation=simulation;this.entities=[];this.byId=new Map();this.lastSyncKey='';this.arrivals=[];this.lastDeliveries=[];
    this.planner=new TrafficPlanner({routeEngine});this.spawner=new VehicleSpawner();this.movement=new VehicleMovement({routeEngine,descriptorResolver:(type)=>this.spawner.descriptor(type)});this.delivery=new DeliveryResolver({settle:settleDelivery,mode:deliveryMode});
  }
  get(id){return this.byId.get(id)||null;}
  setSimulation(sim){this.simulation=sim;return this;}
  density(ratio){return this.spawner.density(ratio);}
  syncFromSimulation(force=false){
    if(!this.simulation)return;const t=this.simulation.getSimulationTime?.()||{},flows=this.simulation.getInfrastructureFlows?.()||[];const key=`${t.hour??0}:${flows.length}:${flows.map(f=>f.id).slice(-4).join(',')}`;if(!force&&key===this.lastSyncKey)return;this.lastSyncKey=key;
    const plans=this.planner.plan(flows);const result=this.spawner.reconcile(plans,{entities:this.entities,byId:this.byId});this.entities=result.entities;for(const e of this.entities)this.movement.refresh(e);
  }
  update(dt,{simulationSpeed=1}={}){this.arrivals=this.movement.update(this.entities,dt,{simulationSpeed});this.lastDeliveries=this.delivery.resolve(this.arrivals,{simulationTime:this.simulation?.getSimulationTime?.()||null,simulation:this.simulation});return this.arrivals;}
  visible({country=null,layers=null,limit=Infinity}={}){const enabled=layers?new Set(layers):null;const layerFor={SHIP:'MARITIME',PLANE:'AVIATION',TRAIN:'RAIL',TRUCK:'ROAD'};let list=this.entities.filter(e=>{if(enabled&&!enabled.has('TRAFFIC'))return false;if(enabled&&!enabled.has(layerFor[e.type]))return false;if(!country)return true;const r=this.routes.get(e.routeId);return r?.country===country||this.routes.infrastructure?.get(r?.from)?.country===country||this.routes.infrastructure?.get(r?.to)?.country===country;});if(Number.isFinite(limit)&&list.length>limit)list=list.slice(0,limit);return list;}
  summary(){return {active:this.entities.length,arrivals:this.arrivals.length,deliveries:this.lastDeliveries.length,byType:Object.fromEntries(['SHIP','PLANE','TRAIN','TRUCK'].map(t=>[t,this.entities.filter(e=>e.type===t).length])),accountingMode:this.delivery.mode,dataClass:'SIM_AGGREGATED_TRAFFIC'};}
  destroy(){this.entities.length=0;this.byId.clear();}
}
