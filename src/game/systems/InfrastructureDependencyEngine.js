const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const CRITICAL_BY_TYPE={DATACENTER:['electricity','data'],IXP:['electricity','data'],AIRBASE:['electricity','fuel','militarySupplies'],NAVAL_BASE:['electricity','fuel','militarySupplies'],MILITARY_BASE:['electricity','fuel','militarySupplies'],INDUSTRY:['electricity','rawMaterials'],HOSPITAL:['electricity','food','goods'],COMMAND_CENTER:['electricity','data'],RADAR:['electricity','data']};
export class InfrastructureDependencyEngine {
  constructor({ graph, runtime }={}){this.graph=graph;this.runtime=runtime;this.last=[];}
  update(){this.last=[];for(const node of this.graph.list()){const rt=this.runtime.get(node.id);let factor=1;const causes=[];for(const depId of node.dependencies||[]){const dep=this.graph.get(depId);if(!dep)continue;const depFactor=this.runtime.statusFactor(depId);factor*=.55+.45*depFactor;if(depFactor<.65)causes.push({type:'NODE_DEPENDENCY',dependency:depId,factor:depFactor});}
      for(const type of CRITICAL_BY_TYPE[node.type]||[]){const stock=rt?.stocks?.[type];if(!stock)continue;const ratio=stock.capacity?stock.current/stock.capacity:1;if(ratio<.22){factor*=.72;causes.push({type:'SUPPLY_DEPENDENCY',resource:type,ratio});}}
      factor=clamp(factor,.05,1);this.runtime.setDependencyFactor(node.id,factor);if(causes.length)this.last.push({nodeId:node.id,factor,causes,dataClass:'SIM_CAUSAL'});
    }return this.last;}
  impact(nodeId){return this.last.find(x=>x.nodeId===nodeId)||{nodeId,factor:1,causes:[]};}
}
