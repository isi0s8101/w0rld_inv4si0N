import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const flowUrl=new URL("../src/game/data/flow-world-start-snapshot.json",import.meta.url);
const worldUrl=new URL("../src/game/data/real-world-start-snapshot.json",import.meta.url);
const flow=JSON.parse(await readFile(flowUrl,"utf8"));
const world=JSON.parse(await readFile(worldUrl,"utf8"));
const baseline=world.baseline.countries;
const profiles=new Map(flow.profiles.map(p=>[p.code,p]));
const old=new Map(flow.profiles.map(p=>[p.code,{gdp:p.gdpCurrentUsd,pop:p.population,imp:p.importsAnnualUsd,exp:p.exportsAnnualUsd}]));
for(const p of flow.profiles){
  const r=baseline[p.code]||{};
  const v=(key,fallback)=>Number(r[key]?.value??fallback);
  p.population=v("population",p.population);p.gdpCurrentUsd=v("gdpCurrentUsd",p.gdpCurrentUsd);p.gdpPerCapitaUsd=v("gdpPerCapitaUsd",p.gdpPerCapitaUsd);
  p.tradePctGdp=v("tradePctGdp",p.tradePctGdp);p.importsPctGdp=v("importsPctGdp",p.importsPctGdp);p.exportsPctGdp=v("exportsPctGdp",p.exportsPctGdp);
  p.tradeAnnualUsd=p.gdpCurrentUsd*p.tradePctGdp/100;p.importsAnnualUsd=p.gdpCurrentUsd*p.importsPctGdp/100;p.exportsAnnualUsd=p.gdpCurrentUsd*p.exportsPctGdp/100;
}
const matrix=new Map(flow.tradeDemands.map(d=>[`${d.from}>${d.to}`,Math.max(1,d.annualUsd)]));
const totalExp=flow.profiles.reduce((s,p)=>s+p.exportsAnnualUsd,0),totalImp=flow.profiles.reduce((s,p)=>s+p.importsAnnualUsd,0),impScale=totalImp?totalExp/totalImp:1;
for(let n=0;n<24;n++){
  for(const p of flow.profiles){const keys=[...matrix.keys()].filter(k=>k.startsWith(`${p.code}>`)),sum=keys.reduce((s,k)=>s+matrix.get(k),0),f=sum?p.exportsAnnualUsd/sum:0;for(const k of keys)matrix.set(k,matrix.get(k)*f);}
  for(const p of flow.profiles){const suffix=`>${p.code}`,keys=[...matrix.keys()].filter(k=>k.endsWith(suffix)),sum=keys.reduce((s,k)=>s+matrix.get(k),0),f=sum?p.importsAnnualUsd*impScale/sum:0;for(const k of keys)matrix.set(k,matrix.get(k)*f);}
}
const max=Math.max(...matrix.values());
for(const d of flow.tradeDemands){d.annualUsd=matrix.get(`${d.from}>${d.to}`)||0;d.dailyUsd=d.annualUsd/365;d.importance=Math.log10(1+d.annualUsd)/Math.log10(1+max);}
for(const d of flow.energyDemands){const a=profiles.get(d.from),b=profiles.get(d.to),oa=old.get(d.from),ob=old.get(d.to);const scale=Math.sqrt((a.gdpCurrentUsd/Math.max(1,oa.gdp))*(b.population/Math.max(1,ob.pop)));d.dailyModelUnits*=Math.max(.6,Math.min(1.6,scale));d.annualModelUnits=d.dailyModelUnits*365;}
for(const d of flow.dataDemands){const a=profiles.get(d.from),b=profiles.get(d.to),oa=old.get(d.from),ob=old.get(d.to);const scale=Math.pow((a.gdpCurrentUsd/Math.max(1,oa.gdp))*(b.gdpCurrentUsd/Math.max(1,ob.gdp)),.18);d.dailyModelGbpsEq*=Math.max(.7,Math.min(1.45,scale));}
flow.generatedAt=new Date().toISOString();delete flow.integrity;const canonical=JSON.stringify(flow);flow.integrity={sha256:createHash("sha256").update(canonical).digest("hex")};
await writeFile(flowUrl,JSON.stringify(flow,null,2)+"\n");console.log(`Flow snapshot refreshed: ${flow.tradeDemands.length} trade, ${flow.energyDemands.length} energy, ${flow.dataDemands.length} data demands.`);
