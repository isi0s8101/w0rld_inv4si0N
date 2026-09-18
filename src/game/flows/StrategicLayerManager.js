const LAYERS = ["GLOBAL","TRADE","ENERGY","AIR","SEA","LAND","DATA"];
const CAPS = {
  GLOBE:{ GLOBAL:48, TRADE:34, ENERGY:30, AIR:42, SEA:38, LAND:24, DATA:42 },
  WORLD:{ GLOBAL:110, TRADE:140, ENERGY:100, AIR:150, SEA:140, LAND:120, DATA:150 },
  COUNTRY:{ GLOBAL:130, TRADE:160, ENERGY:130, AIR:170, SEA:160, LAND:160, DATA:180 }
};

function score(flow){
  const importance=Number(flow.importance)||0;
  const util=Number(flow.utilization)||0;
  const active=flow.state==="ACTIVE"?0.08:0;
  return importance*0.72 + Math.min(1,util)*0.20 + active;
}

export class StrategicLayerManager {
  constructor(){ this.layer="GLOBAL"; this.dataMode="ALL"; }
  setLayer(layer){ const next=String(layer||"").toUpperCase(); if(!LAYERS.includes(next))return false; this.layer=next; return true; }
  getLayer(){ return this.layer; }
  setDataMode(mode){ const m=String(mode||"ALL").toUpperCase(); if(!["ALL","TERRESTRIAL","SUBMARINE","SPACE"].includes(m))return false; this.dataMode=m; return true; }
  listLayers(){ return LAYERS.slice(); }

  select(flows,{ view="WORLD", country=null, layer=this.layer, dataMode=this.dataMode, limit=null }={}){
    const V=String(view||"WORLD").toUpperCase(); const L=String(layer||"GLOBAL").toUpperCase();
    let rows=flows.filter(f=>{
      if(country && f.from!==country && f.to!==country && !(f.route||[]).includes(country)) return false;
      if(L!=="GLOBAL" && f.family!==L) return false;
      if(L==="GLOBAL" && !["TRADE","ENERGY","AIR","SEA","DATA"].includes(f.family)) return false;
      if((L==="DATA"||f.family==="DATA") && dataMode!=="ALL"){
        const wanted={TERRESTRIAL:"DATA_TERRESTRIAL",SUBMARINE:"DATA_SUBMARINE",SPACE:"DATA_SPACE"}[dataMode];
        if(wanted && f.mode!==wanted) return false;
      }
      return true;
    });
    rows.sort((a,b)=>score(b)-score(a));
    const cap=limit??CAPS[V]?.[L]??100;
    return rows.slice(0,cap);
  }
}
