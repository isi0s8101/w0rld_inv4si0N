const RES=["food","energy","goods","data"];
export class SanctionSystem{
  constructor({ledger,random}={}){
    this.ledger=ledger;
    this.random=random;
    this.sanctions=[];
    this.sequence=0;
    this.activeByPair=new Map();
    this._indexedLength=0;
  }

  rebuildIndex(){
    this.activeByPair.clear();
    for(const sanction of this.sanctions){
      if(sanction.status!=="ACTIVE")continue;
      const key=`${sanction.from}>${sanction.to}`;
      const rows=this.activeByPair.get(key)||[];
      rows.push(sanction);
      this.activeByPair.set(key,rows);
    }
    this._indexedLength=this.sanctions.length;
  }

  activeForPair(from,to){
    // Tests, scenarios and future gameplay may inject a sanction directly.
    if(this._indexedLength!==this.sanctions.length)this.rebuildIndex();
    return this.activeByPair.get(`${from}>${to}`)||[];
  }

  review(states,relations,day){
    if(day!==0&&day!==1&&day%90!==0)return[];
    const created=[];
    for(const e of relations.all()){
      const already=this.activeForPair(e.from,e.to).length>0;
      if(already)continue;
      const issuer=states.get(e.from);if(!issuer)continue;
      const fp=issuer.foreignPolicy;
      const hostility=(45-e.diplomaticRelation)+(42-e.trust)*.7+(fp?.security||.5)*10;
      if(hostility<29)continue;
      const chance=Math.min(.10,Math.max(0,(hostility-29)/220));
      if(!(this.random?.chance?.(chance)))continue;
      const resource=RES[Math.abs((e.from.charCodeAt(0)+e.to.charCodeAt(1)+day))%RES.length];
      const severity=Math.min(.85,.25+(hostility-29)/70);
      const type=severity>.62?"EMBARGO":"SANCTION";
      const s={id:`SA${++this.sequence}`,from:e.from,to:e.to,type,resource,severity:Number(severity.toFixed(3)),startDay:day,endDay:day+180+Math.round(severity*360),status:"ACTIVE",dataClass:"SIM_ABSTRACT_POLICY"};
      this.sanctions.push(s);created.push(s);
      this.ledger?.record({day,kind:"SANCTION_IMPOSED",country:e.from,target:e.to,type,resource,effects:{severity:s.severity,endDay:s.endDay}});
      // Keep subsequent checks in the same review O(1).
      this._indexedLength=-1;
    }
    for(const s of this.sanctions)if(s.status==="ACTIVE"&&s.endDay<day)s.status="EXPIRED";
    this.rebuildIndex();
    return created;
  }


  impose({from,to,type="SANCTION",resource="goods",severity=.4,day=0,durationDays=null}={}){
    if(!from||!to||from===to)return null;
    const existing=this.activeForPair(from,to).find(s=>s.resource===resource&&s.type===type);
    if(existing)return existing;
    const sev=Math.max(.05,Math.min(.95,Number(severity)||.4));
    const s={id:`SA${++this.sequence}`,from,to,type,resource,severity:Number(sev.toFixed(3)),startDay:day,endDay:day+(durationDays??(180+Math.round(sev*360))),status:"ACTIVE",dataClass:"SIM_ABSTRACT_POLICY"};
    this.sanctions.push(s);this._indexedLength=-1;this.rebuildIndex();
    this.ledger?.record({day,kind:"SANCTION_IMPOSED",country:from,target:to,type,resource,effects:{severity:s.severity,endDay:s.endDay,source:"AI_DECISION"}});
    return s;
  }

  pairPressure(from,to){return Math.min(1,this.activeForPair(from,to).reduce((a,s)=>a+s.severity,0));}

  modifier(from,to,resource){
    const active=this.activeForPair(from,to).filter(s=>s.resource===resource||s.type==="EMBARGO");
    if(!active.length)return {blocked:false,weight:0,price:1};
    const sev=Math.min(1,active.reduce((a,s)=>a+s.severity,0));
    return {blocked:active.some(s=>s.type==="EMBARGO"&&s.severity>.65),weight:-.70*sev,price:1+.45*sev};
  }

  list(filter={}){return structuredClone(this.sanctions.filter(s=>(!filter.country||s.from===filter.country||s.to===filter.country)&&(!filter.status||s.status===filter.status)&&(!filter.resource||s.resource===filter.resource)));}
}
