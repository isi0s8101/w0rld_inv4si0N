export class FocusModeEngine {
  constructor({stateManager,infrastructureGraph,routeEngine,trafficEngine=null,bus=null}={}){this.state=stateManager;this.graph=infrastructureGraph;this.routes=routeEngine;this.traffic=trafficEngine;this.bus=bus;}
  clear(){this.state.patch({focus:{active:false,type:null,id:null,nodeIds:[],routeIds:[],vehicleIds:[]}},'focus:clear');this.bus?.emit?.('focus:changed',{active:false});}
  resolve(type,id){const nodeIds=new Set(),routeIds=new Set(),vehicleIds=new Set();const key=String(type||'').toUpperCase();
    if(key==='INFRASTRUCTURE'){
      const node=this.graph?.get(id);if(node){nodeIds.add(node.id);for(const d of node.dependencies||[])nodeIds.add(d);for(const c of node.connections||[]){if(this.graph.get(c))nodeIds.add(c);if(this.routes.get(c))routeIds.add(c);}for(const r of this.routes?.routes||[])if(r.from===node.id||r.to===node.id)routeIds.add(r.id);}
    } else if(key==='ROUTE'){
      const route=this.routes?.get(id);if(route){routeIds.add(id);nodeIds.add(route.from);nodeIds.add(route.to);}
    } else if(key==='VEHICLE'){
      const v=this.traffic?.get?.(id);if(v){vehicleIds.add(id);for(const rid of v.routePlan||[v.routeId].filter(Boolean))routeIds.add(rid);if(v.origin)nodeIds.add(v.origin);if(v.destination)nodeIds.add(v.destination);}
    }
    if(this.traffic){for(const v of this.traffic.entities||[])if(routeIds.has(v.routeId)||(v.routePlan||[]).some(r=>routeIds.has(r)))vehicleIds.add(v.id);}
    return {nodeIds:[...nodeIds],routeIds:[...routeIds],vehicleIds:[...vehicleIds]};
  }
  set(type,id){if(!id)return this.clear();const related=this.resolve(type,id);const focus={active:true,type:String(type).toUpperCase(),id,...related};this.state.patch({focus},'focus:set');this.bus?.emit?.('focus:changed',focus);return focus;}
  alpha(kind,id){const f=this.state.get().focus;if(!f?.active)return 1;if(f.type===kind&&f.id===id)return 1;const list=kind==='INFRASTRUCTURE'?f.nodeIds:kind==='ROUTE'?f.routeIds:f.vehicleIds;return list?.includes(id)?(kind==='ROUTE'?.8:.9):.15;}
}
