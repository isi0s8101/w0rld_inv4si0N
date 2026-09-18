const NODE_LEVEL={
  CAPITAL:1,CITY:2,PORT:2,AIRPORT:2,CHOKEPOINT:2,
  AIRBASE:3,NAVAL_BASE:3,MILITARY_BASE:3,INDUSTRY:3,POWER_PLANT:3,POWER_GRID:3,REFINERY:3,DATACENTER:3,IXP:3,CABLE_LANDING:3,SPACEPORT:3,RADAR:3,
  LOGISTICS_HUB:4,RAIL_HUB:4,ROAD_HUB:4,PIPELINE_NODE:4,MINE:4,DAM:4,BRIDGE:4,ARSENAL:4,GROUND_STATION:4,ENERGY_STORAGE:4,COMMAND_CENTER:4,HOSPITAL:4,HEALTH:4
};
const ROUTE_LEVEL={SEA_ROUTE:1,AIR_ROUTE:1,RAIL_ROUTE:2,ROAD_ROUTE:3,PIPELINE_ROUTE:3,DIGITAL_ROUTE:3,ORBITAL_ROUTE:2};
export class SemanticZoomEngine {
  level(view,zoom=1){const z=Number(zoom)||1;if(view==='COUNTRY')return z<1.35?1:z<2.5?2:3;return z<1.35?1:z<2.3?2:z<3.8?3:4;}
  nodeLevel(node,view='WORLD'){const base=NODE_LEVEL[node?.type]||4;if(view==='COUNTRY')return Math.max(1,base-1);return base;}
  routeLevel(route,view='WORLD'){const base=ROUTE_LEVEL[route?.type]||3;if(view==='COUNTRY')return Math.max(1,base-1);return base;}
  filterNodes(nodes,{view='WORLD',zoom=1,selectedId=null}={}){const level=this.level(view,zoom);return nodes.filter(n=>n.id===selectedId||this.nodeLevel(n,view)<=level);}
  filterRoutes(routes,{view='WORLD',zoom=1,selectedRouteId=null}={}){const level=this.level(view,zoom);return routes.filter(r=>r.id===selectedRouteId||this.routeLevel(r,view)<=level);}
  vehicleLimit(view,zoom=1){const l=this.level(view,zoom);if(view==='COUNTRY')return [0,36,90,180][l]||180;return [0,28,70,130,220][l]||220;}
  clusterRadius(view,zoom=1){const l=this.level(view,zoom);if(view==='COUNTRY')return l===1?54:l===2?34:0;return l===1?58:l===2?42:l===3?26:0;}
}
