const BASE={CAPITAL:700,PORT:520,AIRPORT:500,CHOKEPOINT:500,MILITARY_BASE:470,AIRBASE:470,NAVAL_BASE:470,POWER_PLANT:450,INDUSTRY:440,CITY:400,DATACENTER:390,IXP:380,LOGISTICS_HUB:370,RAIL_HUB:360};
export class VisualPriorityManager {
  priority(item,{selectedId=null,criticalIds=null}={}){if(!item)return 0;if(item.id===selectedId)return 1000;if(criticalIds?.has?.(item.id))return 900;if(['CRITICAL','OFFLINE','DESTROYED'].includes(item.status))return 850+(item.status==='CRITICAL'?20:0);return BASE[item.type]||250+Math.round((item.strategicValue||0)*120);}
}
