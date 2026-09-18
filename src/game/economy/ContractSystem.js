const RESOURCES=["food","energy","goods","data"];
function routeLeadDays(route,resource){
  if(resource==="data")return 1;
  const modes=route?.modes||[];const km=route?.distanceKm||1200;
  if(modes.includes("AIR"))return Math.max(2,Math.min(6,Math.ceil(km/3500)+1));
  if(modes.includes("LAND"))return Math.max(3,Math.min(14,Math.ceil(km/900)+2));
  return Math.max(7,Math.min(35,Math.ceil(km/700)+5));
}
function mergeTransfer(map,code,resource,kind,amount){
  if(!map.has(code))map.set(code,{});const row=map.get(code);if(!row[resource])row[resource]={imports:0,exports:0};row[resource][kind]+=amount;
}
export class ContractSystem{
  constructor({budgetSystem,ledger}={}){this.budgetSystem=budgetSystem;this.ledger=ledger;this.contracts=[];this.shipments=[];this.sequence=0;this.lastDeliveries=[];}
  activeFor(country,resource=null){return this.contracts.filter(c=>c.status==="ACTIVE"&&(c.buyer===country||c.seller===country)&&(!resource||c.resource===resource));}
  hasBuyerContract(country,resource){return this.contracts.some(c=>c.status==="ACTIVE"&&c.buyer===country&&c.resource===resource);}
  sign({buyer,seller,resource,dailyAmount=0.18,day,marketPriceIndex=100,durationDays=360,priceFactor=1}={}){
    if(!buyer||!seller||buyer===seller||!RESOURCES.includes(resource)||this.hasBuyerContract(buyer,resource))return null;
    const contract={id:`C${++this.sequence}`,buyer,seller,resource,dailyAmount:Math.max(0.04,Math.min(0.9,dailyAmount)),startDay:day,endDay:day+durationDays,status:"ACTIVE",priceIndexAtSigning:marketPriceIndex,priceFactor:Math.max(0.82,Math.min(1.18,priceFactor)),nextDispatchDay:day+1,delivered:0,delayed:0,failed:0};
    this.contracts.push(contract);return contract;
  }
  step(states,flowEngine,marketSystem,day){
    const transfers=new Map();const deliveryFlows=[];this.lastDeliveries=[];
    for(const contract of this.contracts){if(contract.status!=="ACTIVE")continue;if(day>contract.endDay){contract.status="EXPIRED";continue;}
      if(day>=contract.nextDispatchDay){
        const access=flowEngine?.tradeAccess?.(contract.seller,contract.buyer,contract.resource)||{blocked:false,price:1};
        if(access.blocked){contract.delayed++;contract.nextDispatchDay=day+7;continue;}
        const seller=states.get(contract.seller),buyer=states.get(contract.buyer);const sr=seller?.resources?.[contract.resource];
        const route=contract.resource==="data"?flowEngine?.route(contract.seller,contract.buyer,{data:true}):flowEngine?.route(contract.seller,contract.buyer,{mode:null});
        if(seller&&buyer&&sr&&route?.edges?.length){
          const reserve=Math.max(0,sr.stock-sr.stockCapacity*0.30);const amount=Math.min(contract.dailyAmount*7,Math.max(0.04,reserve*0.20));
          if(amount>0.035){
            const market=marketSystem?.get(contract.resource)?.priceIndex||100;const settlement=amount*(market/100)*contract.priceFactor*(access.price||1)*0.09;
            if(this.budgetSystem?.spend(buyer,settlement)){
              seller.policy.budget.treasury+=settlement*0.88;
              const arrivalDay=day+routeLeadDays(route,contract.resource);
              const shipment={id:`S${++this.sequence}`,contractId:contract.id,buyer:contract.buyer,seller:contract.seller,resource:contract.resource,amount,dispatchDay:day,arrivalDay,status:"IN_TRANSIT",settlement,route:route.nodes,modes:route.modes};
              this.shipments.push(shipment);mergeTransfer(transfers,contract.seller,contract.resource,"exports",amount);contract.nextDispatchDay=day+7;
              flowEngine?.reserveDemand?.({family:contract.resource==="energy"?"ENERGY":contract.resource==="data"?"DATA":"TRADE",from:contract.seller,to:contract.buyer,amount:Math.max(0.02,amount*0.08),mode:null,importance:0.65,dataClass:"SIM_CONTRACT",provenance:{basis:"long-term market contract"},unit:"GAME_RESOURCE_UNITS",displayAmount:amount});
            }else{contract.delayed++;contract.nextDispatchDay=day+3;}
          }else{contract.delayed++;contract.nextDispatchDay=day+3;}
        }else{contract.delayed++;contract.nextDispatchDay=day+3;}
      }
    }
    for(const shipment of this.shipments){if(shipment.status!=="IN_TRANSIT"||shipment.arrivalDay>day)continue;const buyer=states.get(shipment.buyer);if(!buyer){shipment.status="FAILED";continue;}
      shipment.status="DELIVERED";mergeTransfer(transfers,shipment.buyer,shipment.resource,"imports",shipment.amount);const contract=this.contracts.find(c=>c.id===shipment.contractId);if(contract)contract.delivered+=shipment.amount;
      const flow={id:`CF:${shipment.id}`,family:shipment.resource==="energy"?"ENERGY":shipment.resource==="data"?"DATA":"TRADE",subtype:`CONTRACT_${shipment.resource.toUpperCase()}`,from:shipment.seller,to:shipment.buyer,route:shipment.route,routeModes:shipment.modes,amount:shipment.amount,unit:"GAME_RESOURCE_UNITS",importance:0.72,state:"DELIVERED",dataClass:"SIM_CONTRACT",provenance:{contractId:shipment.contractId}};
      deliveryFlows.push(flow);this.lastDeliveries.push(structuredClone(shipment));
    }
    return {transfers,flows:deliveryFlows,deliveries:this.lastDeliveries};
  }
  list(filter={}){return structuredClone(this.contracts.filter(c=>(!filter.country||c.buyer===filter.country||c.seller===filter.country)&&(!filter.resource||c.resource===filter.resource)&&(!filter.status||c.status===filter.status)));}
  snapshot(){return {version:1,contracts:structuredClone(this.contracts),shipments:structuredClone(this.shipments.slice(-500))};}
}
