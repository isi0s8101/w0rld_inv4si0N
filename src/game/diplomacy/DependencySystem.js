const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const RES=["food","energy","goods","data"];
export class DependencySystem{
  update(states,{contracts,flowEngine,day}={}){
    for(const s of states.values()){
      const resources={};for(const r of RES){
        const rr=s.resources[r],self=rr.productionCapacity/Math.max(.01,rr.demandBase),importDependency=clamp(1-self);
        const active=contracts?.activeFor?.(s.code,r)||[];const suppliers=new Map();for(const c of active){const other=c.buyer===s.code?c.seller:c.buyer;if(other!==s.code)suppliers.set(other,(suppliers.get(other)||0)+c.dailyAmount);}
        if(!suppliers.size&&flowEngine?.partnerWeight){
          const candidates=[];for(const other of states.values()){if(other.code===s.code)continue;const balance=(other.resources?.[r]?.productionCapacity||0)-(other.resources?.[r]?.demandBase||0);if(balance<=0)continue;const weight=flowEngine.partnerWeight(other.code,s.code,r);if(weight>0.025)candidates.push({code:other.code,weight});}
          candidates.sort((a,b)=>b.weight-a.weight||a.code.localeCompare(b.code));for(const c of candidates.slice(0,4))suppliers.set(c.code,c.weight);
        }
        const total=[...suppliers.values()].reduce((a,b)=>a+b,0);const shares=[...suppliers.entries()].map(([code,v])=>({code,share:total?v/total:0})).sort((a,b)=>b.share-a.share);const hhi=shares.reduce((a,x)=>a+x.share*x.share,0);
        resources[r]={importDependency:Number(importDependency.toFixed(3)),supplierConcentration:Number(hhi.toFixed(3)),strategicDependency:Number(clamp(importDependency*(.55+.45*hhi)).toFixed(3)),topSuppliers:shares.slice(0,4),day,dataClass:"DERIVED_SIMULATION"};
      }s.dependencies={resources,overall:Number((RES.reduce((a,r)=>a+resources[r].strategicDependency,0)/RES.length).toFixed(3)),day};
    }
  }
  get(state){return structuredClone(state?.dependencies||null);}
}
