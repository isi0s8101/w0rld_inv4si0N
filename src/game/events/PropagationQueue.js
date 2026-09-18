export class PropagationQueue {
  constructor(){this.queue=[];this.sequence=0;this.applied=[];}
  schedule({dueDay,target,metric,delta,source=null,eventId=null,cause="PROPAGATION",confidence=1}={}){
    if(!target||!metric||!Number.isFinite(delta)||!Number.isFinite(dueDay))return null;
    const item={id:`PQ${++this.sequence}`,dueDay:Math.max(0,Math.floor(dueDay)),target,metric,delta,source,eventId,cause,confidence};
    this.queue.push(item);this.queue.sort((a,b)=>a.dueDay-b.dueDay||a.id.localeCompare(b.id));return item;
  }
  process(states,day){
    const due=[];const pending=[];
    for(const item of this.queue)(item.dueDay<=day?due:pending).push(item);
    this.queue=pending;this.applied=[];
    for(const item of due){
      const state=states.get(item.target);const metric=state?.metrics?.[item.metric];if(!metric)continue;
      metric.pressure+=item.delta;
      const applied={...item,appliedDay:day};this.applied.push(applied);
      const causes=state.lastExternalCauses||(state.lastExternalCauses=[]);causes.push(applied);if(causes.length>40)causes.splice(0,causes.length-40);
    }
    return this.applied;
  }
  pending({country=null}={}){return this.queue.filter(x=>!country||x.target===country||x.source===country).map(structuredClone);}
  snapshot(){return this.queue.map(structuredClone);}
}
