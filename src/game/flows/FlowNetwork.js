function clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,v)); }

const FAMILY_FOR_MODE = {
  AIR:"AIR", SEA:"SEA", LAND:"LAND",
  DATA_TERRESTRIAL:"DATA", DATA_SUBMARINE:"DATA", DATA_SPACE:"DATA"
};

export class FlowNetwork {
  constructor(corridors=[]){
    this.corridors = corridors.map((c)=>({ ...structuredClone(c), currentLoad:0, utilization:0, status:"OPEN", disruption:0 }));
    this.byId = new Map(this.corridors.map((c)=>[c.id,c]));
    this.out = new Map();
    this.direct = new Map();
    this.routeCache = new Map();
    for(const c of this.corridors){
      const list=this.out.get(c.from)||[]; list.push(c); this.out.set(c.from,list);
      const directList=this.direct.get(`${c.from}>${c.to}`)||[]; directList.push(c); this.direct.set(`${c.from}>${c.to}`,directList);
    }
  }

  resetDay(){
    for(const c of this.corridors){ c.currentLoad=0; c.utilization=0; }
  }

  get(id){ return this.byId.get(id)||null; }
  directBetween(from,to,{families=null,modes=null}={}){
    const familySet=families?new Set(families):null, modeSet=modes?new Set(modes):null;
    return (this.direct.get(`${from}>${to}`)||[]).filter(e=>(!familySet||familySet.has(e.family))&&(!modeSet||modeSet.has(e.mode))&&e.status!=="CLOSED").sort((a,b)=>this.routeCost(a)-this.routeCost(b));
  }
  outgoing(code){ return this.out.get(code)||[]; }
  all(){ return this.corridors; }

  effectiveCapacity(c){
    if(!c || c.status === "CLOSED") return 0;
    return Math.max(0,c.capacity * c.reliability * (1-clamp(c.disruption||0,0,1)));
  }

  residualCapacity(c){ return Math.max(0,this.effectiveCapacity(c)-c.currentLoad); }

  reserve(path, amount){
    if(!path?.edges?.length || amount<=0) return 0;
    const max = Math.min(...path.edges.map((e)=>this.residualCapacity(e)));
    const accepted=Math.max(0,Math.min(amount,max));
    for(const e of path.edges){ e.currentLoad += accepted; e.utilization = e.currentLoad/Math.max(0.0001,this.effectiveCapacity(e)); }
    return accepted;
  }

  setCorridorState(id,{ status, disruption, reliability }={}){
    const c=this.get(id); if(!c) return false;
    if(status) c.status=status;
    if(Number.isFinite(disruption)) c.disruption=clamp(disruption);
    if(Number.isFinite(reliability)) c.reliability=clamp(reliability,0.05,1);
    this.routeCache.clear();
    return true;
  }


  boostCountryCapacity(code,families,factor){
    const set=families?new Set(families):null;let changed=0;
    for(const c of this.corridors){
      if(c.from!==code && c.to!==code)continue;
      if(set && !set.has(c.family))continue;
      c.capacity=Math.max(0.01,c.capacity*Math.max(0.5,Math.min(2,factor)));changed++;
    }
    if(changed)this.routeCache.clear();
    return changed;
  }

  routeCost(edge){
    const cap=Math.max(0.001,this.effectiveCapacity(edge));
    const congestion=1+Math.max(0,edge.currentLoad/cap-0.72)*2.8;
    const reliabilityPenalty=1+(1-edge.reliability)*2.2+(edge.disruption||0)*4;
    const familyPenalty=edge.family === "AIR" ? 1.45 : edge.family === "SEA" ? 1.1 : edge.mode === "DATA_SPACE" ? 1.75 : 1;
    return (0.18+edge.distanceKm/2200)*congestion*reliabilityPenalty*familyPenalty + edge.costIndex/280;
  }

  findRoute(from,to,{ families=null, modes=null, maxHops=6, minResidual=0.01, cache=true }={}){
    if(from===to) return {nodes:[from],edges:[],capacity:Infinity,cost:0};
    const familyKey=families?[...families].sort().join(","):"*";
    const modeKey=modes?[...modes].sort().join(","):"*";
    const key=`${from}>${to}|${familyKey}|${modeKey}|${maxHops}`;
    if(cache && this.routeCache.has(key)){
      const ids=this.routeCache.get(key); if(ids===null) return null;
      const edges=ids.map(id=>this.get(id)).filter(Boolean);
      if(edges.length===ids.length && edges.every(e=>this.residualCapacity(e)>=minResidual && e.status!=="CLOSED")){
        return this.describePath(from,edges);
      }
    }
    const familySet=families?new Set(families):null, modeSet=modes?new Set(modes):null;
    const dist=new Map([[from,0]]), hops=new Map([[from,0]]), prev=new Map();
    const queue=[{code:from,cost:0}];
    while(queue.length){
      queue.sort((a,b)=>a.cost-b.cost); const cur=queue.shift();
      if(cur.cost!==dist.get(cur.code)) continue;
      if(cur.code===to) break;
      const hop=hops.get(cur.code)||0; if(hop>=maxHops) continue;
      for(const e of this.outgoing(cur.code)){
        if(familySet && !familySet.has(e.family)) continue;
        if(modeSet && !modeSet.has(e.mode)) continue;
        if(e.status==="CLOSED" || this.residualCapacity(e)<minResidual) continue;
        const next=cur.cost+this.routeCost(e);
        if(next<(dist.get(e.to)??Infinity)){
          dist.set(e.to,next); hops.set(e.to,hop+1); prev.set(e.to,e); queue.push({code:e.to,cost:next});
        }
      }
    }
    if(!prev.has(to)){ if(cache)this.routeCache.set(key,null); return null; }
    const edges=[]; let cursor=to;
    while(cursor!==from){ const e=prev.get(cursor); if(!e)return null; edges.push(e); cursor=e.from; }
    edges.reverse(); if(cache)this.routeCache.set(key,edges.map(e=>e.id));
    return this.describePath(from,edges,dist.get(to));
  }

  describePath(from,edges,cost=null){
    const nodes=[from]; for(const e of edges)nodes.push(e.to);
    return { nodes, edges, modes:edges.map(e=>e.mode), capacity:edges.length?Math.min(...edges.map(e=>this.effectiveCapacity(e))):Infinity,
      residual:edges.length?Math.min(...edges.map(e=>this.residualCapacity(e))):Infinity,
      cost:cost??edges.reduce((s,e)=>s+this.routeCost(e),0), distanceKm:edges.reduce((s,e)=>s+e.distanceKm,0) };
  }

  summarize(){
    const byFamily={}; let congested=0,closed=0;
    for(const c of this.corridors){
      const row=byFamily[c.family]||(byFamily[c.family]={corridors:0,load:0,capacity:0,avgUtilization:0});
      row.corridors++; row.load+=c.currentLoad; row.capacity+=this.effectiveCapacity(c); row.avgUtilization+=c.utilization;
      if(c.utilization>0.9)congested++; if(c.status==="CLOSED")closed++;
    }
    for(const row of Object.values(byFamily))row.avgUtilization=row.corridors?row.avgUtilization/row.corridors:0;
    return { corridors:this.corridors.length,congested,closed,byFamily };
  }
}
