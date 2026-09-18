const CATEGORY_BY_KIND={
  WAR:'CONFLICT',BLOCKADE:'CONFLICT',VICTORY:'CONFLICT',DEFEAT:'CONFLICT',
  ALLIANCE:'DIPLOMACY',AGREEMENT:'DIPLOMACY',DIPLOMACY:'DIPLOMACY',DIPLOMATIC_BREAK:'DIPLOMACY',BLOC_TRANSITION:'DIPLOMACY',BETRAYAL:'DIPLOMACY',
  SANCTION:'ECONOMY',SANCTIONS:'ECONOMY',EMBARGO:'ECONOMY',AID:'COOPERATION',
  EVENT:'CRISIS',RIPPLE:'CRISIS',CRISIS:'CRISIS',INFRASTRUCTURE:'INFRASTRUCTURE',INFRASTRUCTURE_LOSS:'INFRASTRUCTURE',DECISION:'POLICY'
};

export class WorldMemory {
  constructor({ limit = 20000, startDate='2025-01-01' }={}){
    this.limit=limit;this.startDate=String(startDate).slice(0,10);this.records=[];this.sequence=0;this.relationEffects=new Map();this.seenLedgerIds=new Set();
  }

  dateForDay(day){
    const base=new Date(`${this.startDate}T00:00:00Z`);base.setUTCDate(base.getUTCDate()+Math.max(0,Number(day)||0));return base.toISOString().slice(0,10);
  }

  categoryFor(entry){return entry.category||CATEGORY_BY_KIND[entry.kind]||'WORLD';}

  remember(entry={}){
    const day=Number(entry.day)||0;
    const row={
      id:`WM${++this.sequence}`,day,date:entry.date||this.dateForDay(day),kind:entry.kind||'WORLD_EVENT',country:entry.country||null,target:entry.target||null,
      importance:Math.max(0,Math.min(1,Number(entry.importance) || .5)),...structuredClone(entry),
      dataClass:entry.dataClass||'SIM_WORLD_MEMORY'
    };
    row.category=this.categoryFor(row);
    if(!row.date)row.date=this.dateForDay(row.day);
    this.records.push(row);if(this.records.length>this.limit)this.records.splice(0,this.records.length-this.limit);this.applyPathEffect(row);return row;
  }

  applyPathEffect(row){
    if(!row.country||!row.target)return;
    const key=`${row.country}>${row.target}`;const cur=this.relationEffects.get(key)||{trust:0,cooperation:0,hostility:0};const effects=row.pathEffects||{};
    cur.trust+=Number(effects.trust)||0;cur.cooperation+=Number(effects.cooperation)||0;cur.hostility+=Number(effects.hostility)||0;this.relationEffects.set(key,cur);
  }

  effect(from,to){return structuredClone(this.relationEffects.get(`${from}>${to}`)||{trust:0,cooperation:0,hostility:0});}

  timeline({country=null,sinceDay=0,untilDay=Infinity,kind=null,category=null,limit=250}={}){
    const rows=this.records.filter(r=>r.day>=sinceDay&&r.day<=untilDay&&(!country||r.country===country||r.target===country)&&(!kind||r.kind===kind)&&(!category||r.category===category));
    return rows.slice(-limit).map(r=>structuredClone(r));
  }

  summary({country=null,sinceDay=0}={}){
    const rows=this.timeline({country,sinceDay,limit:this.limit});const byKind={},byCategory={};
    for(const row of rows){byKind[row.kind]=(byKind[row.kind]||0)+1;byCategory[row.category]=(byCategory[row.category]||0)+1;}
    return {records:rows.length,byKind,byCategory,last:rows.at(-1)||null,dataClass:'SIM_WORLD_MEMORY_SUMMARY'};
  }

  ingestLedger(records=[]){
    for(const r of records){
      if(this.seenLedgerIds.has(r.id))continue;this.seenLedgerIds.add(r.id);
      if(['BLOC_REVIEW','GLOBAL_OPINION','STRATEGY_REVIEW','FOREIGN_POLICY_REVIEW'].includes(r.kind))continue;
      if(r.kind==='DIPLOMACY_SHIFT'&&Math.abs(Number(r.effects?.delta)||0)<.35)continue;
      if(r.kind==='COUNTRY_DECISION'&&!['AID_PARTNER','OPEN_ROUTE','REINFORCE_ALLIANCE','REINFORCE_BASE','DEPLOY_UNITS','SIGN_AGREEMENT','IMPOSE_SANCTION','START_PROJECT'].includes(r.type))continue;
      const mapping={WORLD_EVENT:'EVENT',DIPLOMACY_SHIFT:'DIPLOMACY',COUNTRY_DECISION:'DECISION',PROPAGATED_EFFECT:'RIPPLE',SANCTION_IMPOSED:r.type==='EMBARGO'?'EMBARGO':'SANCTION',AGREEMENT_SIGNED:'AGREEMENT',INFRA_PROJECT_COMPLETED:'INFRASTRUCTURE',BLOC_TRANSITION:'BLOC_TRANSITION',AID_GRANTED:'AID'};
      let pathEffects={};
      if(r.kind==='DIPLOMACY_SHIFT'){const d=Number(r.effects?.delta)||0;pathEffects={trust:d*.9,cooperation:d*.7,hostility:-d*.55};}
      else if(r.kind==='AGREEMENT_SIGNED'){pathEffects={trust:2.2,cooperation:3.4,hostility:-1.2};}
      else if(r.kind==='SANCTION_IMPOSED'){const sev=Number(r.effects?.severity)||.5;pathEffects={trust:-5*sev,cooperation:-4*sev,hostility:6*sev};}
      else if(r.kind==='COUNTRY_DECISION'&&r.type==='AID_PARTNER'){pathEffects={trust:2.8,cooperation:3.8,hostility:-1};}
      else if(r.kind==='BLOC_TRANSITION'){
        if(['JOIN','REJOIN'].includes(r.type))pathEffects={trust:1.6,cooperation:2.4,hostility:-.7};
        else if(['LEAVE','DISTANCE'].includes(r.type))pathEffects={trust:-2.2,cooperation:-2.0,hostility:1.3};
      }
      this.remember({day:r.day,kind:mapping[r.kind]||r.kind,country:r.country,target:r.target||r.source||null,type:r.type,eventId:r.eventId||null,details:r.effects||{},pathEffects,importance:r.kind==='WORLD_EVENT'?.8:r.kind==='SANCTION_IMPOSED'?.75:r.kind==='BLOC_TRANSITION'?.58:.45});
    }
  }

  snapshot(){return {startDate:this.startDate,records:this.timeline({limit:this.limit}),relationEffects:[...this.relationEffects.entries()],summary:this.summary(),dataClass:'SIM_WORLD_MEMORY'};}
}
