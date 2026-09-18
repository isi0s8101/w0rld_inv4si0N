export class DecisionLedger {
  constructor(limit=12000){ this.limit=limit; this.records=[]; this.sequence=0; }
  record(entry={}){
    const row={ id:`DL${++this.sequence}`, day:Number(entry.day)||0, kind:entry.kind||"DECISION", ...structuredClone(entry) };
    row.id=row.id||`DL${this.sequence}`;
    this.records.push(row); if(this.records.length>this.limit)this.records.splice(0,this.records.length-this.limit);
    return row;
  }
  list({country=null,kind=null,sinceDay=0,limit=100}={}){
    const rows=this.records.filter(r=>(!country||r.country===country||r.target===country||r.source===country)&&(!kind||r.kind===kind)&&r.day>=sinceDay);
    return rows.slice(Math.max(0,rows.length-limit)).map(r=>structuredClone(r));
  }
  latest(limit=100){ return this.records.slice(-limit).map(r=>structuredClone(r)); }
  clear(){this.records.length=0;this.sequence=0;}
  snapshot(){return this.latest(this.limit);}
}
