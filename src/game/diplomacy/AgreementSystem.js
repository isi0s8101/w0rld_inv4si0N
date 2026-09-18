export class AgreementSystem{
  constructor({ledger}={}){
    this.ledger=ledger;
    this.agreements=[];
    this.sequence=0;
    this.activeByPair=new Map();
    this._indexedLength=0;
  }

  rebuildIndex(){
    this.activeByPair.clear();
    for(const agreement of this.agreements){
      if(agreement.status!=="ACTIVE")continue;
      const key=`${agreement.from}>${agreement.to}`;
      const rows=this.activeByPair.get(key)||[];
      rows.push(agreement);
      this.activeByPair.set(key,rows);
    }
    this._indexedLength=this.agreements.length;
  }

  activeForPair(from,to){
    if(this._indexedLength!==this.agreements.length)this.rebuildIndex();
    return this.activeByPair.get(`${from}>${to}`)||[];
  }

  review(states,relations,blocs,day){
    if(day!==0&&day!==1&&day%90!==0)return[];
    const existing=new Map(this.agreements.filter(a=>a.status==="ACTIVE").map(a=>[`${a.from}>${a.to}:${a.scope}`,a]));
    for(const e of relations.all()){
      const a=states.get(e.from),b=states.get(e.to);if(!a||!b)continue;
      const sameBloc=blocs?.sameBloc(e.from,e.to);
      const relation=(e.diplomaticRelation*.45+e.trust*.35+e.trade*.20)+(sameBloc?6:0);
      const scopes=[];
      if(relation>=62)scopes.push("TRADE");
      if(relation>=68&&(a.metrics.energy.current<68||b.metrics.energy.current<68))scopes.push("ENERGY");
      if(relation>=67&&(a.metrics.technology.current>52||b.metrics.technology.current>52))scopes.push("DATA");
      if(relation>=72)scopes.push("LOGISTICS");
      for(const scope of scopes){
        const key=`${e.from}>${e.to}:${scope}`;
        if(existing.has(key))continue;
        const ag={id:`AG${++this.sequence}`,from:e.from,to:e.to,scope,startDay:day,endDay:day+720,status:"ACTIVE",tariffFactor:scope==="TRADE"?.82:.92,capacityFactor:scope==="LOGISTICS"?1.08:1.03,trustBonus:.05,dataClass:"SIM_DIPLOMATIC_AGREEMENT"};
        this.agreements.push(ag);existing.set(key,ag);
        this.ledger?.record({day,kind:"AGREEMENT_SIGNED",country:e.from,target:e.to,type:scope,effects:{agreementId:ag.id,endDay:ag.endDay}});
      }
    }
    for(const a of this.agreements)if(a.status==="ACTIVE"&&a.endDay<day)a.status="EXPIRED";
    this.rebuildIndex();
    return this.agreements.filter(a=>a.startDay===day);
  }


  sign({from,to,scope="TRADE",day=0,durationDays=720,tariffFactor=null,capacityFactor=null}={}){
    if(!from||!to||from===to)return null;
    const existing=this.activeForPair(from,to).find(a=>a.scope===scope);
    if(existing)return existing;
    const ag={
      id:`AG${++this.sequence}`,from,to,scope,startDay:day,endDay:day+Math.max(30,Number(durationDays)||720),status:"ACTIVE",
      tariffFactor:tariffFactor??(scope==="TRADE"?.82:.92),
      capacityFactor:capacityFactor??(scope==="LOGISTICS"?1.08:1.03),
      trustBonus:.05,dataClass:"SIM_DIPLOMATIC_AGREEMENT"
    };
    this.agreements.push(ag);this._indexedLength=-1;this.rebuildIndex();
    this.ledger?.record({day,kind:"AGREEMENT_SIGNED",country:from,target:to,type:scope,effects:{agreementId:ag.id,endDay:ag.endDay,source:"AI_DECISION"}});
    return ag;
  }

  pairBonus(from,to){return Math.min(.35,this.activeForPair(from,to).length*.07);}

  modifiers(from,to,resource){
    const active=this.activeForPair(from,to);
    let weight=0,capacity=1,price=1;
    for(const a of active){
      if(a.scope==="TRADE"&&["food","goods"].includes(resource)){weight+=.18;price*=a.tariffFactor;}
      if(a.scope==="ENERGY"&&resource==="energy"){weight+=.22;price*=a.tariffFactor;}
      if(a.scope==="DATA"&&resource==="data"){weight+=.22;price*=a.tariffFactor;}
      capacity*=a.capacityFactor;
    }
    return {weight,capacity,price};
  }

  list(filter={}){return structuredClone(this.agreements.filter(a=>(!filter.country||a.from===filter.country||a.to===filter.country)&&(!filter.scope||a.scope===filter.scope)&&(!filter.status||a.status===filter.status)));}
}
