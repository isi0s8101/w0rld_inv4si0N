export class DeliveryResolver {
  constructor({settle=null,mode='MIRROR'}={}){this.settle=typeof settle==='function'?settle:null;this.mode=mode;this.records=[];}
  resolve(arrivals=[],context={}){const out=[];for(const arrival of arrivals){let settled=false;if(this.mode==='DEFERRED'&&this.settle)settled=Boolean(this.settle(arrival,context));const record={...arrival,settled,accountingMode:this.mode,resolvedAt:context.simulationTime||null,dataClass:'SIM_TRAFFIC_DELIVERY'};this.records.push(record);out.push(record);}if(this.records.length>500)this.records.splice(0,this.records.length-500);return out;}
  latest(limit=50){return this.records.slice(-Math.max(0,limit));}
}
