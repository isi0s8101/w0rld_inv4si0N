export class ClusterManager {
  constructor(){this.last=new Map();}
  cluster(nodes,projection,{radius=0,priorityManager=null,selectedId=null}={}){
    this.last.clear();if(!radius||radius<4)return {nodes,clusters:[]};
    const cells=new Map(),singles=[];
    for(const node of nodes){if(node.id===selectedId){singles.push(node);continue;}const p=projection.project(node.position.lat,node.position.lon);if(!p?.visible)continue;const key=`${Math.round(p.x/radius)}:${Math.round(p.y/radius)}:${node.category||node.layer||'MIX'}`;const list=cells.get(key)||[];list.push({node,p});cells.set(key,list);}
    const clusters=[];for(const [key,list] of cells){if(list.length<2){singles.push(list[0].node);continue;}const members=list.map(v=>v.node);const x=list.reduce((s,v)=>s+v.p.x,0)/list.length,y=list.reduce((s,v)=>s+v.p.y,0)/list.length;const types={};for(const m of members)types[m.type]=(types[m.type]||0)+1;const top=[...members].sort((a,b)=>(priorityManager?.priority(b,{selectedId})||0)-(priorityManager?.priority(a,{selectedId})||0))[0];const cluster={id:`cluster:${key}`,isCluster:true,count:members.length,members,x,y,position:{lat:members.reduce((s,m)=>s+m.position.lat,0)/members.length,lon:members.reduce((s,m)=>s+m.position.lon,0)/members.length},category:top.category,layer:top.layer,types,label:`${members.length} ${top.category||top.layer||'NODES'}`};clusters.push(cluster);this.last.set(cluster.id,cluster);}
    return {nodes:singles,clusters};
  }
  get(id){return this.last.get(id)||null;}
  bounds(cluster){const members=cluster?.members||[];if(!members.length)return null;const lons=members.map(m=>m.position.lon),lats=members.map(m=>m.position.lat);return [Math.min(...lons),Math.min(...lats),Math.max(...lons),Math.max(...lats)];}
}
