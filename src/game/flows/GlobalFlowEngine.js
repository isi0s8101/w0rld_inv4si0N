import { FlowNetwork } from "./FlowNetwork.js";
import { StrategicLayerManager } from "./StrategicLayerManager.js";

const RESOURCE_TYPES=["food","energy","goods","data"];
function clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,v)); }
function gameAmountFromUsd(usd){ return Math.max(0,Math.log10(1+Math.max(0,usd)/1e6)*0.32); }

export class GlobalFlowEngine {
  constructor({ dataStore, resourceEconomy, random }={}){
    this.dataStore=dataStore;
    this.resourceEconomy=resourceEconomy;
    this.random=random;
    this.network=new FlowNetwork(dataStore?.corridors||[]);
    this.layers=new StrategicLayerManager();
    this.day=0;
    this.sequence=0;
    this.lastFlows=[];
    this.routeCache=new Map();
    this.tradeByPair=new Map((dataStore?.tradeDemands||[]).map(d=>[`${d.from}>${d.to}`,d]));
    this.energyByPair=new Map((dataStore?.energyDemands||[]).map(d=>[`${d.from}>${d.to}`,d]));
    this.dataByPair=new Map((dataStore?.dataDemands||[]).map(d=>[`${d.from}>${d.to}`,d]));
    this.lastStats={};
    this.visualCache=new Map();
    this.supplierPreferences=new Map();
    this.diplomacy={agreements:null,sanctions:null,relations:null,blocs:null};
  }

  setDiplomacySystems(systems={}){ this.diplomacy={...this.diplomacy,...systems}; return true; }

  tradeAccess(from,to,resource){
    const ag=this.diplomacy.agreements?.modifiers?.(from,to,resource)||{weight:0,capacity:1,price:1};
    const sa=this.diplomacy.sanctions?.modifier?.(from,to,resource)||{blocked:false,weight:0,price:1};
    const edge=this.diplomacy.relations?.get?.(from,to);
    const relation=edge?((edge.diplomaticRelation||50)+(edge.trust||50)-100)/200:0;
    const bloc=this.diplomacy.blocs?.sameBloc?.(from,to)?0.10:0;
    return {blocked:!!sa.blocked,weight:(ag.weight||0)+(sa.weight||0)+relation*.18+bloc,capacity:Math.max(.25,ag.capacity||1),price:(ag.price||1)*(sa.price||1)};
  }

  stateFactor(state){
    if(!state)return 0;
    const m=state.metrics;
    return clamp((m.infrastructure.current*0.34+m.economy.current*0.34+m.stability.current*0.18+m.resilience.current*0.14)/100,0.25,1.15);
  }

  modeFamilies(mode){
    if(mode==="AIR")return {families:["AIR"],modes:["AIR"]};
    if(mode==="SEA")return {families:["SEA"],modes:["SEA"]};
    if(mode==="LAND")return {families:["LAND"],modes:["LAND"]};
    return {families:["AIR","SEA","LAND"],modes:null};
  }

  route(from,to,{mode=null,data=false}={}){
    const key=`${from}>${to}:${data?"DATA":mode||"ANY"}`;
    const cached=this.routeCache.get(key);
    if(cached){
      const edges=cached.map(id=>this.network.get(id)).filter(Boolean);
      if(edges.length===cached.length && edges.every(e=>e.status!=="CLOSED" && this.network.residualCapacity(e)>0.01)) return this.network.describePath(from,edges);
    }
    const options=data?{families:["DATA"],maxHops:7,cache:false}:{...this.modeFamilies(mode),maxHops:7,cache:false};
    const direct=this.network.directBetween(from,to,options).find(e=>this.network.residualCapacity(e)>0.01);
    const path=direct?this.network.describePath(from,[direct]):this.network.findRoute(from,to,options);
    if(path)this.routeCache.set(key,path.edges.map(e=>e.id));
    return path;
  }

  reserveDemand({family,from,to,amount,mode=null,importance=0,dataClass,provenance,unit,displayAmount=null}){
    const path=this.route(from,to,{mode,data:family==="DATA"});
    if(!path || !path.edges.length)return null;
    const reserved=this.network.reserve(path,amount);
    if(reserved<=0)return null;
    const primaryMode=path.modes[0]||mode||null;
    const utilization=path.edges.reduce((s,e)=>s+e.utilization,0)/path.edges.length;
    return { id:`GF${++this.sequence}`,family,from,to,mode:primaryMode,route:path.nodes,routeModes:path.modes,
      distanceKm:path.distanceKm,amount:displayAmount??reserved,networkUnits:reserved,unit,importance,utilization,
      state:reserved+1e-9<amount?"CONSTRAINED":"ACTIVE",dataClass,provenance };
  }

  processMacroDemands(states){
    const flows=[];
    for(const d of this.dataStore.tradeDemands){
      const sf=this.stateFactor(states.get(d.from)),tf=this.stateFactor(states.get(d.to));
      const activeUsd=d.dailyUsd*(0.72+0.28*Math.sqrt(sf*tf));
      for(const [mode,share] of Object.entries(d.modeShares||{})){
        if(share<=0.005)continue;
        const usd=activeUsd*share;
        const netUnits=Math.max(0.03,Math.log10(1+usd/1e6)*0.23);
        const f=this.reserveDemand({family:"TRADE",from:d.from,to:d.to,amount:netUnits,mode,importance:d.importance*share,dataClass:d.dataClass,provenance:d.provenance,unit:"USD_DAY",displayAmount:usd});
        if(f)flows.push(f);
      }
    }
    for(const d of this.dataStore.energyDemands){
      const sf=this.stateFactor(states.get(d.from)),tf=this.stateFactor(states.get(d.to));
      const amount=d.dailyModelUnits*(0.68+0.32*Math.sqrt(sf*tf));
      const f=this.reserveDemand({family:"ENERGY",from:d.from,to:d.to,amount:Math.max(0.02,amount*0.08),mode:d.mode,importance:d.importance,dataClass:d.dataClass,provenance:d.provenance,unit:"MODEL_ENERGY_UNITS_DAY",displayAmount:amount});
      if(f)flows.push(f);
    }
    for(const d of this.dataStore.dataDemands){
      const sf=this.stateFactor(states.get(d.from)),tf=this.stateFactor(states.get(d.to));
      const volume=d.dailyModelGbpsEq*(0.78+0.22*Math.sqrt(sf*tf));
      const f=this.reserveDemand({family:"DATA",from:d.from,to:d.to,amount:Math.max(0.02,volume*0.07),importance:d.importance,dataClass:d.dataClass,provenance:d.provenance,unit:"MODEL_GBPS_EQ",displayAmount:volume});
      if(f)flows.push(f);
    }
    return flows;
  }

  transportActivity(){
    const rows=[];
    for(const c of this.network.all()){
      if(!["AIR","SEA","LAND"].includes(c.family))continue;
      const load=c.currentLoad+c.baselineLoad*0.34;
      if(load<=0.04)continue;
      const cap=this.network.effectiveCapacity(c);
      rows.push({ id:`TC:${c.id}:${this.day}`,family:c.family,from:c.from,to:c.to,mode:c.mode,route:[c.from,c.to],routeModes:[c.mode],
        distanceKm:c.distanceKm,amount:load,networkUnits:load,unit:"AGGREGATE_TRAFFIC_INDEX",importance:c.importance,
        utilization:load/Math.max(0.001,cap),state:c.status==="CLOSED"?"CLOSED":load>cap?"CONSTRAINED":"ACTIVE",
        dataClass:c.dataClass,provenance:c.provenance });
    }
    return rows;
  }

  setSupplierPreferences(target,resource,codes,expiresDay=Infinity){
    this.supplierPreferences.set(`${target}:${resource}`,{codes:[...new Set(codes||[])],expiresDay});
    return true;
  }

  preferenceBoost(from,to,resource){
    const pref=this.supplierPreferences.get(`${to}:${resource}`);if(!pref)return 0;
    if(pref.expiresDay<this.day){this.supplierPreferences.delete(`${to}:${resource}`);return 0;}
    const idx=pref.codes.indexOf(from);return idx<0?0:Math.max(0.08,0.34-idx*0.05);
  }

  partnerWeight(from,to,resource){
    let base=0.02;
    if(resource==="energy")base+=(this.energyByPair.get(`${from}>${to}`)?.importance||0);
    else if(resource==="data")base+=(this.dataByPair.get(`${from}>${to}`)?.importance||0);
    else base+=(this.tradeByPair.get(`${from}>${to}`)?.importance||0);
    const access=this.tradeAccess(from,to,resource);
    if(access.blocked)return -1;
    return Math.max(0,base+this.preferenceBoost(from,to,resource)+access.weight);
  }

  findAlternativeSuppliers(states,targetCode,resource,limit=5){
    const rows=[];
    for(const state of states.values()){
      if(state.code===targetCode)continue;
      const balance=this.resourceEconomy.projectedBalance(state,resource);if(balance<=0.08)continue;
      const access=this.tradeAccess(state.code,targetCode,resource);if(access.blocked)continue;
      const weight=this.partnerWeight(state.code,targetCode,resource);
      const route=resource==="data"?this.route(state.code,targetCode,{data:true}):this.route(state.code,targetCode,{mode:null});
      if(!route||!route.edges.length)continue;
      const bias=state.specialization?.exportBias?.[resource]||1;
      const score=weight*0.50+Math.min(1,balance/3)*0.23+Math.min(1,route.residual/2)*0.17+Math.min(.10,(bias-1)*.5);
      rows.push({code:state.code,score,balance,routeCost:route.cost,residual:route.residual});
    }
    return rows.sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code)).slice(0,limit);
  }

  buildResourceTransfers(states){
    const transfers=new Map([...states.keys()].map(code=>[code,Object.fromEntries(RESOURCE_TYPES.map(r=>[r,{imports:0,exports:0}]))]));
    const resourceFlows=[];
    for(const resource of RESOURCE_TYPES){
      const remaining=new Map(); const importers=[];
      for(const state of states.values()){
        const balance=this.resourceEconomy.projectedBalance(state,resource);
        remaining.set(state.code,Math.max(0,balance));
        if(balance<-.20) importers.push({code:state.code,need:-balance});
      }
      importers.sort((a,b)=>b.need-a.need);
      for(const imp of importers){
        let need=imp.need;
        const candidates=[];
        for(const [code,available] of remaining){
          if(code===imp.code||available<=.03)continue;
          const access=this.tradeAccess(code,imp.code,resource); if(access.blocked)continue;
          const weight=this.partnerWeight(code,imp.code,resource); if(weight<=.02)continue;
          const bias=states.get(code)?.specialization?.exportBias?.[resource]||1;
          candidates.push({code,available,weight:weight*bias});
        }
        candidates.sort((a,b)=>b.weight-a.weight);
        for(const item of candidates.slice(0,6)){
          if(need<=.02)break;
          const available=remaining.get(item.code)||0;
          const amount=Math.min(need,available,0.20+item.weight*2.6);
          if(amount<=.02)continue;
          transfers.get(item.code)[resource].exports+=amount;
          transfers.get(imp.code)[resource].imports+=amount;
          remaining.set(item.code,available-amount); need-=amount;
          resourceFlows.push({id:`RF${++this.sequence}`,family:resource==="energy"?"ENERGY":resource==="data"?"DATA":"TRADE",subtype:`RESOURCE_${resource.toUpperCase()}`,from:item.code,to:imp.code,amount,unit:"GAME_RESOURCE_UNITS",importance:Math.min(1,item.weight),state:"ACTIVE",dataClass:"SIMULATION_TRANSFER_GUIDED_BY_GLOBAL_FLOW_MODEL",provenance:{basis:"resource balance routed by global macro partner weights"}});
        }
      }
    }
    return {transfers,resourceFlows};
  }

  populationFlows(states){
    if(this.day%30!==0)return [];
    const flows=[];
    for(const source of states.values()){
      const declared=Number(source.demography?.annualNetMigration)||0;
      if(Math.abs(declared)<100)continue;
      if(declared>0)continue; // source countries with net outflow only; inbound side is distributed by attractiveness.
      const amount=Math.min(Math.abs(declared)/12,source.populationCount*0.0002);
      if(amount<20)continue;
      const targets=[...states.values()].filter(s=>s.code!==source.code && (Number(s.demography?.annualNetMigration)||0)>0).map(target=>{
        const trade=this.tradeByPair.get(`${source.code}>${target.code}`)?.importance||0;
        const attract=(target.metrics.economy.current*0.45+target.metrics.stability.current*0.35+target.metrics.infrastructure.current*0.20)/100;
        return {target,score:attract*(0.35+trade)};
      }).sort((a,b)=>b.score-a.score).slice(0,3);
      const sum=targets.reduce((s,x)=>s+x.score,0)||1;
      for(const t of targets){
        const count=Math.round(amount*t.score/sum); if(count<10)continue;
        source.populationCount=Math.max(1000,source.populationCount-count); t.target.populationCount+=count;
        source.populationDelta-=count; t.target.populationDelta+=count;
        flows.push({id:`P${++this.sequence}`,family:"POPULATION",subtype:"MIGRATION",from:source.code,to:t.target.code,amount:count,unit:"PEOPLE_MONTH",importance:Math.min(1,count/50000),state:"ACTIVE",dataClass:source.demography?.migrationDataClass||"ESTIMATED_MODEL",provenance:{basis:"annual net migration baseline + destination attractiveness"}});
      }
    }
    return flows;
  }

  prime(states){
    this.day=0; this.network.resetDay();
    const macro=this.processMacroDemands(states);
    const transport=this.transportActivity();
    this.lastFlows=[...macro,...transport];
    this.visualCache.clear();
    this.lastStats={day:0,flows:this.lastFlows.length,...this.network.summarize()};
    return this;
  }

  step(states,day){
    this.day=day; this.network.resetDay();
    const macro=this.processMacroDemands(states);
    const {transfers,resourceFlows}=this.buildResourceTransfers(states);
    const population=this.populationFlows(states);
    const transport=this.transportActivity();
    this.lastFlows=[...macro,...transport,...resourceFlows,...population];
    this.visualCache.clear();
    this.lastStats={day,flows:this.lastFlows.length,...this.network.summarize()};
    return {transfers,flows:this.lastFlows,stats:this.lastStats};
  }

  getFlows({country=null,family=null,mode=null,includeResourceTransfers=false}={}){
    const F=family?String(family).toUpperCase():null;
    return this.lastFlows.filter(f=>(!country||f.from===country||f.to===country||(f.route||[]).includes(country))&&(!F||f.family===F)&&(!mode||f.mode===mode)&&(includeResourceTransfers||!String(f.subtype||"").startsWith("RESOURCE_")));
  }

  getVisualFlows(options={}){
    const key=JSON.stringify([this.day,options.view||"WORLD",options.country||null,options.layer||this.layers.getLayer(),options.dataMode||this.layers.dataMode,options.limit||null]);
    if(this.visualCache.has(key))return this.visualCache.get(key);
    const selected=this.layers.select(this.lastFlows,options);
    this.visualCache.set(key,selected);
    return selected;
  }
  setLayer(layer){ const ok=this.layers.setLayer(layer); if(ok)this.visualCache.clear(); return ok; }
  setDataMode(mode){ const ok=this.layers.setDataMode(mode); if(ok)this.visualCache.clear(); return ok; }
  getLayer(){ return this.layers.getLayer(); }
  setCorridorState(id,state){ return this.network.setCorridorState(id,state); }
  boostCountryCorridors(code,families,factor){ this.routeCache.clear(); return this.network.boostCountryCapacity(code,families,factor); }
  addSupplementalFlows(flows=[]){ if(flows.length){ this.lastFlows.push(...flows); this.visualCache.clear(); this.lastStats={...this.lastStats,flows:this.lastFlows.length}; } return flows.length; }
  getNetworkSummary(){ return structuredClone(this.lastStats); }
  getCoverage(){ return this.dataStore.getCoverage(); }
  getMethodology(){ return this.dataStore.getMethodology(); }
  snapshot(){ return {version:2,day:this.day,layer:this.layers.getLayer(),stats:this.lastStats,flows:this.lastFlows,supplierPreferences:[...this.supplierPreferences.entries()],corridors:this.network.all().map(c=>({id:c.id,status:c.status,disruption:c.disruption,reliability:c.reliability,currentLoad:c.currentLoad,utilization:c.utilization}))}; }
}
