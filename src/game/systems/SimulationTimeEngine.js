export class SimulationTimeEngine {
  constructor({ startDate = '2025-01-01T00:00:00Z' } = {}) {
    this.startDate = new Date(startDate);
    if (Number.isNaN(this.startDate.getTime())) this.startDate = new Date('2025-01-01T00:00:00Z');
    this.hour = 0;
    this.tick = 0;
  }
  advance(hours = 1) { const n=Math.max(0,Math.floor(Number(hours)||0)); this.hour+=n; this.tick+=n; return this; }
  get day() { return Math.floor(this.hour / 24); }
  get week() { return Math.floor(this.day / 7); }
  get monthIndex() { const d=this.dateObject(); return d.getUTCFullYear()*12+d.getUTCMonth(); }
  dateObject(){ const d=new Date(this.startDate); d.setUTCHours(d.getUTCHours()+this.hour); return d; }
  iso(){ return this.dateObject().toISOString(); }
  flags(previousHour = this.hour - 1){
    const prevDay=Math.floor(Math.max(0,previousHour)/24), day=this.day;
    const prevWeek=Math.floor(prevDay/7), week=this.week;
    const prevDate=new Date(this.startDate);prevDate.setUTCHours(prevDate.getUTCHours()+Math.max(0,previousHour));
    const now=this.dateObject();
    return { hourly:true, daily:day!==prevDay, weekly:week!==prevWeek, monthly:prevDate.getUTCMonth()!==now.getUTCMonth()||prevDate.getUTCFullYear()!==now.getUTCFullYear() };
  }
  snapshot(){ return { hour:this.hour,tick:this.tick,day:this.day,week:this.week,date:this.iso(),dataClass:'SIM_TIME' }; }
}
