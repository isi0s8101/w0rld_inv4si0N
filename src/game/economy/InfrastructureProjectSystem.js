const SECTORS={
  LOGISTICS:{duration:540,totalCost:16,families:["AIR","SEA","LAND"]},
  ENERGY:{duration:480,totalCost:14,families:[]},
  DATA:{duration:420,totalCost:12,families:["DATA"]},
  RESILIENCE:{duration:360,totalCost:10,families:[]}
};
export class InfrastructureProjectSystem{
  constructor({budgetSystem,ledger}={}){this.budgetSystem=budgetSystem;this.ledger=ledger;this.projects=[];this.sequence=0;this.lastCompleted=[];}
  active(country,sector=null){return this.projects.filter(p=>p.country===country&&["ACTIVE","STALLED"].includes(p.status)&&(!sector||p.sector===sector));}
  start(state,sector,day,{totalCost=null,durationDays=null}={}){
    const cfg=SECTORS[sector];if(!state||!cfg||this.active(state.code,sector).length)return null;
    const project={id:`P${++this.sequence}`,country:state.code,sector,startDay:day,durationDays:durationDays||cfg.duration,totalCost:totalCost||cfg.totalCost,remainingCost:(totalCost||cfg.totalCost)*0.85,progress:0,status:"ACTIVE",lastFundingDay:day,stalledDays:0};
    this.projects.push(project);return project;
  }
  update(states,flowEngine,day){this.lastCompleted=[];
    for(const project of this.projects){if(!["ACTIVE","STALLED"].includes(project.status))continue;const state=states.get(project.country);if(!state){project.status="CANCELLED";continue;}
      if(day-project.lastFundingDay>=30){const periods=Math.max(1,Math.ceil((project.durationDays*(1-project.progress))/30));const installment=Math.min(project.remainingCost,Math.max(0.05,project.remainingCost/periods));
        if(this.budgetSystem?.spend(state,installment)){project.remainingCost=Math.max(0,project.remainingCost-installment);project.progress=Math.min(1,project.progress+30/project.durationDays);project.lastFundingDay=day;project.status="ACTIVE";}
        else{project.status="STALLED";project.stalledDays+=30;project.lastFundingDay=day;}
      }
      if(project.progress>=0.999||project.remainingCost<=0.001){project.progress=1;project.status="COMPLETED";this.complete(state,project,flowEngine);this.lastCompleted.push(structuredClone(project));this.ledger?.record({day,kind:"INFRA_PROJECT_COMPLETED",country:state.code,type:project.sector,effects:{projectId:project.id}});}
    }
    return this.lastCompleted;
  }
  complete(state,project,flowEngine){
    if(project.sector==="LOGISTICS"){state.metrics.infrastructure.baseline=Math.min(100,state.metrics.infrastructure.baseline+2.2);state.metrics.infrastructure.current=Math.min(100,state.metrics.infrastructure.current+0.8);flowEngine?.boostCountryCorridors?.(state.code,["AIR","SEA","LAND"],1.035);}
    if(project.sector==="ENERGY"){state.metrics.energy.baseline=Math.min(100,state.metrics.energy.baseline+2.4);state.resources.energy.productionCapacity*=1.06;}
    if(project.sector==="DATA"){state.metrics.technology.baseline=Math.min(100,state.metrics.technology.baseline+1.8);state.resources.data.productionCapacity*=1.08;flowEngine?.boostCountryCorridors?.(state.code,["DATA"],1.045);}
    if(project.sector==="RESILIENCE"){state.metrics.resilience.baseline=Math.min(100,state.metrics.resilience.baseline+2.0);for(const r of Object.values(state.resources))r.stockCapacity*=1.04;}
  }
  list(filter={}){return structuredClone(this.projects.filter(p=>(!filter.country||p.country===filter.country)&&(!filter.sector||p.sector===filter.sector)&&(!filter.status||p.status===filter.status)));}
  snapshot(){return {version:1,projects:structuredClone(this.projects)};}
}
