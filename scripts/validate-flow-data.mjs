import { readFile } from "node:fs/promises";
import { FlowDataStore } from "../src/game/flows/FlowDataStore.js";

const snapshot=JSON.parse(await readFile(new URL("../src/game/data/flow-world-start-snapshot.json",import.meta.url),"utf8"));
const store=new FlowDataStore().load(snapshot);
if(!store.validate())throw new Error("Global flow snapshot validation failed");
if(store.profileByCode.size!==175)throw new Error(`Flow country coverage ${store.profileByCode.size}/175`);
const families=new Set(store.corridors.map(c=>c.family));
for(const family of ["AIR","SEA","LAND","DATA"])if(!families.has(family))throw new Error(`Missing corridor family ${family}`);
if(!store.tradeDemands.length||!store.energyDemands.length||!store.dataDemands.length)throw new Error("Missing macro demand family");
const exportsTotal=store.listProfiles().reduce((s,p)=>s+p.exportsAnnualUsd,0);
const tradeTotal=store.tradeDemands.reduce((s,d)=>s+d.annualUsd,0);
const drift=exportsTotal?Math.abs(tradeTotal-exportsTotal)/exportsTotal:0;
if(drift>0.001)throw new Error(`Trade matrix drift ${(drift*100).toFixed(4)}%`);
console.log(JSON.stringify({ok:true,coverage:store.getCoverage(),tradeBalanceDriftPct:drift*100,methodology:store.getMethodology()},null,2));
