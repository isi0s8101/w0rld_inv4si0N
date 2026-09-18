const LEVELS=['UNKNOWN','ESTIMATED','PROBABLE','CONFIRMED'];
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const clamp01=v=>clamp(v,0,1);

export class IntelligenceEngine {
  constructor({ random, infrastructureGraph=null, runtime=null }={}){
    this.random=random;
    this.graph=infrastructureGraph;
    this.runtime=runtime;
    this.byObserver=new Map();
  }

  infrastructureSignals(code){
    const nodes=this.graph?.forCountry?.(code)||[];
    const availability=(n)=>this.runtime?.statusFactor?.(n.id)??1;
    const sum=(types)=>nodes.filter(n=>types.includes(n.type)).reduce((s,n)=>s+availability(n),0);
    return {
      radar:sum(['RADAR']),
      groundStation:sum(['GROUND_STATION']),
      digital:sum(['DATACENTER','IXP','CABLE_LANDING']),
      command:sum(['COMMAND_CENTER']),
      airbase:sum(['AIRBASE']),
      spaceport:sum(['SPACEPORT'])
    };
  }

  sourceProfile(observer,edge,blocs){
    const infra=this.infrastructureSignals(observer.code);
    const tech=observer.metrics?.technology?.current??50;
    const awareness=observer.metrics?.awareness?.current??10;
    const military=observer.metrics?.militaryReadiness?.current??50;
    const trust=edge?.trust??0;
    const sameBloc=blocs?.sameBloc?.(observer.code,edge?.to)?1:0;
    const distancePenalty=Math.min(0.38,(edge?.distanceKm||0)/30000);

    const sources={
      satellite:clamp01((10+infra.groundStation*19+infra.spaceport*8+tech*.34+awareness*.22)/100-distancePenalty*.12),
      radar:clamp01((infra.radar*24+military*.22+awareness*.18)/100-distancePenalty*.55),
      reconnaissance:clamp01((military*.46+awareness*.34+infra.airbase*9+infra.command*5)/100-distancePenalty*.32),
      allies:clamp01((sameBloc?0.58:0.08)+trust/250),
      cyber:clamp01((tech*.50+infra.digital*10+awareness*.12)/100),
      openSources:clamp01(0.38+tech/340+infra.digital*.025)
    };
    return {sources,infra};
  }

  estimateTarget(target,confidence,level){
    if(level==='UNKNOWN')return null;
    const sigma=level==='CONFIRMED'?2.2:level==='PROBABLE'?7.5:14.5;
    const estimate=(value)=>{
      const actual=Number(value)||0;
      const noise=this.random?.range?.(-sigma,sigma)??0;
      return Number(clamp(actual+noise).toFixed(1));
    };
    return {
      economy:estimate(target.metrics?.economy?.current),
      militaryReadiness:estimate(target.metrics?.militaryReadiness?.current),
      stability:estimate(target.metrics?.stability?.current),
      energySecurity:estimate(target.derivedSystems?.energy?.energySecurity??target.metrics?.energy?.current),
      infrastructure:estimate(target.metrics?.infrastructure?.current),
      uncertainty:Number(((1-confidence)*100).toFixed(1)),
      dataClass:'SIM_INTELLIGENCE_ESTIMATE'
    };
  }

  update(states,relations,blocs,{day=0}={}){
    this.byObserver.clear();
    for(const observer of states.values()){
      const rows=[];
      const observerSignals=this.infrastructureSignals(observer.code);
      const selfSensorStrength=clamp(18+observerSignals.radar*12+observerSignals.groundStation*10+observerSignals.digital*3+observerSignals.command*5+(observer.metrics?.technology?.current??50)*.22);

      for(const edge of relations.outgoing(observer.code)){
        const target=states.get(edge.to);if(!target)continue;
        const {sources}=this.sourceProfile(observer,edge,blocs);
        const sourceScore=(sources.satellite*.20+sources.radar*.16+sources.reconnaissance*.18+sources.allies*.14+sources.cyber*.18+sources.openSources*.14)*100;
        const trustBonus=(edge.trust||0)*.10;
        const score=clamp(sourceScore*.82+trustBonus+selfSensorStrength*.08);
        const idx=score>=76?3:score>=51?2:score>=26?1:0;
        const level=LEVELS[idx];
        const confidence=Number((score/100).toFixed(3));
        const evidence=Object.entries(sources).sort((a,b)=>b[1]-a[1]).map(([source,strength])=>({source,strength:Number(strength.toFixed(3))}));
        rows.push({
          target:target.code,level,confidence,sources,evidence,
          estimate:this.estimateTarget(target,confidence,level),
          lastObservedDay:day,freshnessDays:0,
          provenance:{basis:'seeded multi-source intelligence model',objectiveDataExposed:false},
          dataClass:'SIM_INTELLIGENCE'
        });
      }
      this.byObserver.set(observer.code,rows);
      const averageConfidence=rows.length?rows.reduce((s,r)=>s+r.confidence,0)/rows.length:0;
      observer.intelligence={
        awareness:clamp(selfSensorStrength*.56+averageConfidence*44),
        known:rows.filter(r=>r.level!=='UNKNOWN').length,
        estimated:rows.filter(r=>r.level==='ESTIMATED').length,
        probable:rows.filter(r=>r.level==='PROBABLE').length,
        confirmed:rows.filter(r=>r.level==='CONFIRMED').length,
        sourceProfile:{...observerSignals},
        dataClass:'DERIVED_SIMULATION'
      };
      if(observer.metrics?.awareness)observer.metrics.awareness.baseline=clamp(observer.metrics.awareness.baseline*.82+observer.intelligence.awareness*.18);
    }
    return this.byObserver;
  }

  get(observer,target=null){
    const rows=this.byObserver.get(observer)||[];
    return target?structuredClone(rows.find(r=>r.target===target)||{target,level:'UNKNOWN',confidence:0,sources:{},evidence:[],estimate:null,dataClass:'SIM_INTELLIGENCE'}):structuredClone(rows);
  }
}
