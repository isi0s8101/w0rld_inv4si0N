const norm=(v)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const words=(v)=>norm(v).split(/\s+/).filter(Boolean);
const scoreText=(text,tokens)=>{const t=norm(text);let score=0;for(const token of tokens){if(t===token)score+=80;else if(t.startsWith(token))score+=42;else if(t.includes(token))score+=20;else return -1;}return score;};
export class GlobalSearchEngine {
  constructor({worldEngine,infrastructureGraph,routeEngine,trafficEngine,gameEngine,bus=null}={}){this.world=worldEngine;this.graph=infrastructureGraph;this.routes=routeEngine;this.traffic=trafficEngine;this.game=gameEngine;this.bus=bus;this.navigator=null;}
  setNavigator(api){this.navigator=api;return this;}
  dynamicEntries(){const out=[];
    for(const c of this.world?.listCountries?.()||[])out.push({kind:'COUNTRY',id:c.iso2,title:c.name,subtitle:`${c.iso2} · ${c.continent||'WORLD'}`,keywords:`country pays territory ${c.iso2} ${c.iso3||''} ${c.name}`,position:c.center?{lon:c.center[0],lat:c.center[1]}:null,country:c.iso2,priority:8});
    for(const n of this.graph?.list?.()||[])out.push({kind:'INFRASTRUCTURE',id:n.id,title:n.name||n.id,subtitle:`${n.type} · ${n.country} · ${n.status}`,keywords:`${n.type} ${n.category} ${n.layer} ${n.status} ${n.country} ${n.name||''} infrastructure critical strategic`,position:n.position,country:n.country,priority:10});
    for(const r of this.routes?.routes||[])out.push({kind:'ROUTE',id:r.id,title:r.name||r.id,subtitle:`${r.type} · ${r.status} · ${Math.round(r.distanceKm||0)} km`,keywords:`${r.type} ${r.layer} ${r.status} route routes corridor corridors blocked closed congested risky ${r.from} ${r.to}`,country:r.country||null,priority:7});
    for(const v of this.traffic?.entities||[])out.push({kind:'VEHICLE',id:v.id,title:v.name||v.id,subtitle:`${v.type} · ${v.state||v.status||'MOVING'} · ${v.cargo||'cargo'}`,keywords:`${v.type} ${v.state||''} ${v.cargo||''} ship plane train truck vehicle traffic ${v.origin||''} ${v.destination||''}`,position:v.position||null,country:v.country||null,priority:9});
    for(const e of this.game?.api?.getTimeline?.({limit:800})||[])out.push({kind:'EVENT',id:e.id,title:e.type||e.kind||e.id,subtitle:`${e.date||`DAY ${e.day}`} · ${e.country||'WORLD'}${e.target?` → ${e.target}`:''}`,keywords:`${e.kind} ${e.type||''} ${e.category||''} event crisis blocked blockade sanctions war energy shortage ${e.country||''} ${e.target||''} ${e.details?.name||''}`,country:e.country||null,priority:11,eventId:e.eventId||null});
    return out;
  }
  search(query,{limit=14}={}){const tokens=words(query);if(!tokens.length)return[];const entries=this.dynamicEntries();const results=[];for(const item of entries){const text=`${item.title} ${item.subtitle} ${item.keywords}`;const s=scoreText(text,tokens);if(s<0)continue;let bonus=item.priority||0;const q=norm(query);if(norm(item.id)===q||norm(item.title)===q)bonus+=120;if(q.includes('blocked')&&item.kind==='ROUTE'&&['BLOCKED','CLOSED'].includes((this.routes?.get?.(item.id)?.status||'').toUpperCase()))bonus+=90;if(q.includes('critical')&&item.kind==='INFRASTRUCTURE'&&(this.graph?.get?.(item.id)?.strategicValue||0)>=.75)bonus+=55;if(q.includes('oil')&&(norm(item.keywords).includes('oil')||norm(item.keywords).includes('petrol')))bonus+=35;results.push({...item,score:s+bonus});}return results.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,limit);}
  activate(result){if(!result)return false;this.bus?.emit?.('search:activate',structuredClone(result));if(!this.navigator)return result;
    if(result.kind==='COUNTRY')return this.navigator.selectCountry(result.id);
    if(result.kind==='INFRASTRUCTURE'){this.navigator.selectInfrastructure(result.id);this.navigator.fitSelection();return true;}
    if(result.kind==='ROUTE'){this.navigator.selectRoute(result.id);this.navigator.fitSelection();return true;}
    if(result.kind==='VEHICLE'){this.navigator.selectVehicle(result.id);this.navigator.fitSelection();return true;}
    if(result.kind==='EVENT'){this.navigator.selectTimelineEvent?.(result.id);return true;}
    return false;
  }
}
