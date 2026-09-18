const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export class DiplomacySystem{
  constructor({ledger}={}){this.ledger=ledger;this.last=[];}
  initialize(relations){for(const e of relations.all()){
    if(!Number.isFinite(e.historicalRelation))e.historicalRelation=e.diplomaticRelation;
    e.relationTrend=0;e.sanctionPressure=0;e.agreementBonus=0;e.blocAffinity=0;e.rivalry=clamp(100-((e.trust||50)*.48+(e.diplomaticRelation||50)*.32+(e.trade||50)*.20));e.influence=clamp((e.trade||0)*.35+(e.technologyDependency||0)*.25+(e.energyDependency||0)*.20+(e.diplomaticRelation||0)*.20);e.militaryAccess=(e.alliance||0)>70&&e.trust>60;e.securityGuarantee=(e.alliance||0)>82&&e.diplomaticRelation>72;e.sanctions=0;e.relationHistory=[{day:0,value:e.diplomaticRelation,trust:e.trust,rivalry:e.rivalry,influence:e.influence}];e.dataClassDiplomacy="SIM_RELATION_HISTORY";
  }}
  update(states,relations,{agreements=null,sanctions=null,blocs=null,ledger=null,worldMemory=null,day=0}={}){
    if(day!==1&&day%30!==0)return[];this.last=[];
    for(const e of relations.all()){
      const a=states.get(e.from),b=states.get(e.to);if(!a||!b)continue;
      const agreement=agreements?.pairBonus?.(e.from,e.to)||0;const sanction=sanctions?.pairPressure?.(e.from,e.to)||0;const bloc=blocs?.sameBloc?.(e.from,e.to)?1:0;
      const tradePull=Math.min(1,(e.trade||0)/100)*1.2;const trustPull=((e.trust||50)-50)/50*.65;
      const fpA=a.foreignPolicy,fpB=b.foreignPolicy;const openness=((fpA?.openness||.5)+(fpB?.openness||.5)-1)*.45;
      const memory=worldMemory?.effect?.(e.from,e.to)||{trust:0,cooperation:0,hostility:0};const memoryPull=(memory.trust||0)*.08+(memory.cooperation||0)*.05-(memory.hostility||0)*.08;const target=clamp(e.historicalRelation+tradePull+trustPull+agreement*7+bloc*4+openness*3-sanction*16+memoryPull);
      const before=e.diplomaticRelation;const delta=Math.max(-2.5,Math.min(2.5,(target-before)*.10));
      e.diplomaticRelation=clamp(before+delta);e.trust=clamp(e.trust+delta*.38+agreement*.45-sanction*.75);e.alliance=clamp(e.alliance+delta*.24+bloc*.22-sanction*.50);
      e.relationTrend=delta;e.agreementBonus=agreement;e.sanctionPressure=sanction;e.blocAffinity=bloc;e.sanctions=sanction;e.rivalry=clamp(100-(e.trust*.46+e.diplomaticRelation*.34+e.trade*.20)+sanction*18);e.influence=clamp(e.trade*.34+e.technologyDependency*.24+e.energyDependency*.18+e.diplomaticRelation*.24);e.militaryAccess=e.alliance>70&&e.trust>60&&sanction<.25;e.securityGuarantee=e.alliance>82&&e.diplomaticRelation>72&&e.trust>68;
      e.relationHistory.push({day,value:Number(e.diplomaticRelation.toFixed(3)),trust:Number(e.trust.toFixed(3)),rivalry:Number(e.rivalry.toFixed(3)),influence:Number(e.influence.toFixed(3))});if(e.relationHistory.length>36)e.relationHistory.shift();
      if(Math.abs(delta)>.05){const row={day,from:e.from,to:e.to,before,after:e.diplomaticRelation,delta};this.last.push(row);(ledger||this.ledger)?.record({day,kind:"DIPLOMACY_SHIFT",country:e.from,target:e.to,type:"RELATION_UPDATE",effects:{before,after:e.diplomaticRelation,delta,agreement,sanction,bloc}});}
    }return this.last;
  }
  get(relations,code){return structuredClone(relations.outgoing(code).map(e=>({to:e.to,diplomaticRelation:e.diplomaticRelation,trust:e.trust,trade:e.trade,alliance:e.alliance,rivalry:e.rivalry,influence:e.influence,sanctions:e.sanctions,energyDependency:e.energyDependency,militaryAccess:e.militaryAccess,securityGuarantee:e.securityGuarantee,trend:e.relationTrend,historicalRelation:e.historicalRelation,agreementBonus:e.agreementBonus,sanctionPressure:e.sanctionPressure,blocAffinity:e.blocAffinity,history:e.relationHistory.slice(-12)})));}
}
