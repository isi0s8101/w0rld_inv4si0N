const uniq=(xs)=>[...new Set(xs.filter(Boolean))];

export class CausalityModeEngine {
  constructor({stateManager,infrastructureGraph,routeEngine,gameEngine,bus=null}={}){
    this.state=stateManager;this.graph=infrastructureGraph;this.routes=routeEngine;this.game=gameEngine;this.bus=bus;
  }
  clear(){
    const causality={active:false,rootType:null,rootId:null,direction:'BOTH',nodes:[],edges:[],nodeIds:[],routeIds:[],eventId:null};
    this.state.patch({causality},'causality:clear');this.bus?.emit?.('causality:changed',causality);return causality;
  }
  dependentsOf(id){return this.graph?.list?.().filter(n=>(n.dependencies||[]).includes(id)).map(n=>n.id)||[];}
  routeIdsForNode(id){return this.routes?.routes?.filter(r=>r.from===id||r.to===id).map(r=>r.id)||[];}
  infrastructureGraph(id,{direction='BOTH',depth=4}={}){
    const root=this.graph?.get?.(id);if(!root)return null;
    const nodes=new Map(),edges=[],seen=new Set();
    const addNode=(node,level,relation)=>{if(!node)return;const prev=nodes.get(node.id);if(!prev||level<prev.level)nodes.set(node.id,{id:node.id,kind:'INFRASTRUCTURE',label:node.name||node.id,type:node.type,country:node.country,position:node.position,level,relation,status:node.status});};
    addNode(root,0,'ROOT');
    const walk=(nodeId,level)=>{
      if(level>=depth)return;const key=`${nodeId}:${level}`;if(seen.has(key))return;seen.add(key);
      const node=this.graph.get(nodeId);if(!node)return;
      if(direction!=='DOWNSTREAM')for(const depId of node.dependencies||[]){const dep=this.graph.get(depId);if(!dep)continue;addNode(dep,level+1,'UPSTREAM');edges.push({from:dep.id,to:node.id,kind:'DEPENDENCY',direction:'UPSTREAM'});walk(dep.id,level+1);}
      if(direction!=='UPSTREAM')for(const childId of this.dependentsOf(node.id)){const child=this.graph.get(childId);if(!child)continue;addNode(child,level+1,'DOWNSTREAM');edges.push({from:node.id,to:child.id,kind:'DEPENDENCY',direction:'DOWNSTREAM'});walk(child.id,level+1);}
    };
    walk(id,0);
    const nodeIds=[...nodes.keys()];const routeIds=uniq(nodeIds.flatMap(n=>this.routeIdsForNode(n)));
    return {active:true,rootType:'INFRASTRUCTURE',rootId:id,direction,nodes:[...nodes.values()],edges,nodeIds,routeIds,eventId:null};
  }
  routeGraph(id){
    const route=this.routes?.get?.(id);if(!route)return null;const from=this.graph?.get(route.from),to=this.graph?.get(route.to);
    const nodes=[from,to].filter(Boolean).map((n,i)=>({id:n.id,kind:'INFRASTRUCTURE',label:n.name||n.id,type:n.type,country:n.country,position:n.position,level:i,relation:i?'DESTINATION':'ORIGIN',status:n.status}));
    const edges=from&&to?[{from:from.id,to:to.id,kind:'ROUTE',direction:'FLOW',routeId:route.id,label:route.type}]:[];
    return {active:true,rootType:'ROUTE',rootId:id,direction:'FLOW',nodes,edges,nodeIds:nodes.map(n=>n.id),routeIds:[id],eventId:null};
  }
  eventGraph(ref){
    const timeline=this.game?.api?.getTimeline?.({limit:20000})||[];
    let root=timeline.find(r=>r.id===ref||r.eventId===ref&&r.kind!=='RIPPLE')||null;
    if(!root){const causal=this.game?.api?.getCausalEvents?.({})||[];const ce=causal.find(e=>e.id===ref);if(ce)root={id:ce.id,eventId:ce.id,day:ce.startDay,date:null,kind:ce.type,type:ce.type,country:ce.country,target:ce.target,details:{chain:ce.chain},importance:ce.severity};}
    if(!root)return null;const eventId=root.eventId||root.id;
    const ripples=timeline.filter(r=>r.eventId===eventId&&r.kind==='RIPPLE').sort((a,b)=>a.day-b.day||(a.details?.step||0)-(b.details?.step||0));
    const rootId=`event:${eventId}`;const nodes=[{id:rootId,kind:'EVENT',label:root.type||root.kind||eventId,type:root.kind,country:root.country,level:0,relation:'ROOT',day:root.day,date:root.date,importance:root.importance}];const edges=[];
    let prev=rootId;for(const [index,row] of ripples.entries()){const id=`ripple:${row.id}`;nodes.push({id,kind:'STEP',label:row.details?.name||row.type||`STEP ${index+1}`,type:'RIPPLE',country:row.country,level:index+1,relation:'EFFECT',day:row.day,date:row.date,impact:row.details?.impact});edges.push({from:prev,to:id,kind:'CAUSAL',direction:'DOWNSTREAM',delayDays:Math.max(0,(row.day||0)-(index?ripples[index-1].day:root.day||0))});prev=id;}
    if(!ripples.length&&Array.isArray(root.details?.chain)){for(const [index,step] of root.details.chain.entries()){const id=`chain:${eventId}:${index}`;nodes.push({id,kind:'STEP',label:step.name||String(step),type:'CHAIN',country:root.country,level:index+1,relation:'EFFECT',day:(root.day||0)+(step.delayDays||index*2),impact:step.impact});edges.push({from:prev,to:id,kind:'CAUSAL',direction:'DOWNSTREAM',delayDays:step.delayDays||0});prev=id;}}
    return {active:true,rootType:'EVENT',rootId:root.id||eventId,direction:'DOWNSTREAM',nodes,edges,nodeIds:[],routeIds:[],eventId};
  }
  analyze(type,id,options={}){
    const key=String(type||'').toUpperCase();let result=null;if(key==='INFRASTRUCTURE')result=this.infrastructureGraph(id,options);else if(key==='ROUTE')result=this.routeGraph(id);else if(key==='EVENT'||key==='TIMELINE')result=this.eventGraph(id);
    if(!result)return false;this.state.patch({causality:result},'causality:set');this.bus?.emit?.('causality:changed',structuredClone(result));return structuredClone(result);
  }
  why(id=null){
    const s=this.state.get();if(id)return this.analyze('EVENT',id);
    if(s.selectedInfrastructure)return this.analyze('INFRASTRUCTURE',s.selectedInfrastructure);
    if(s.selectedRoute)return this.analyze('ROUTE',s.selectedRoute);
    if(s.timeline?.selectedId)return this.analyze('EVENT',s.timeline.selectedId);
    return false;
  }
  setDirection(direction){const dir=String(direction||'BOTH').toUpperCase();if(!['UPSTREAM','DOWNSTREAM','BOTH'].includes(dir))return false;const c=this.state.get().causality;if(!c?.active||c.rootType!=='INFRASTRUCTURE')return false;return this.analyze('INFRASTRUCTURE',c.rootId,{direction:dir});}
  snapshot(){return structuredClone(this.state.get().causality||null);}
}
