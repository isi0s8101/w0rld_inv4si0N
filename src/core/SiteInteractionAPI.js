export class SiteInteractionAPI {
  constructor({bus,stateManager,transitionManager,cameraEngine,mapCameraEngine=null,worldEngine,nodeNetwork,infrastructureGraph=null,routeEngine=null,trafficLogisticsEngine=null,layerManager=null,selectionContext=null,focusMode=null,causalityMode=null,timelineReplay=null,globalSearch=null}){
    this.bus=bus;this.stateManager=stateManager;this.transitionManager=transitionManager;this.cameraEngine=cameraEngine;this.mapCamera=mapCameraEngine;this.worldEngine=worldEngine;this.nodeNetwork=nodeNetwork;this.infrastructureGraph=infrastructureGraph;this.routeEngine=routeEngine;this.traffic=trafficLogisticsEngine;this.layerManager=layerManager;this.selection=selectionContext;this.focusMode=focusMode;this.causality=causalityMode;this.timeline=timelineReplay;this.searchEngine=globalSearch;this.pendingCountry=null;this.pendingLocate=null;
    this.unsub=this.bus.on('view:changed',({view})=>{if(view==='WORLD'&&this.pendingCountry){const code=this.pendingCountry;this.pendingCountry=null;this.transitionManager.selectCountry(code);return;}if(view==='WORLD'&&this.pendingLocate)this.flushPendingLocate();});
    this.unsubCountry=this.bus.on('country:selected',()=>{if(this.pendingLocate)this.flushPendingLocate();});
  }
  toGlobe(){return this.transitionManager.toGlobe();}
  toWorld(){return this.transitionManager.toWorld();}
  flushPendingLocate(){const pending=this.pendingLocate;if(!pending)return false;this.pendingLocate=null;if(pending.kind==='INFRASTRUCTURE')return this.selectInfrastructure(pending.id);if(pending.kind==='ROUTE')return this.selectRoute(pending.id);if(pending.kind==='VEHICLE')return this.selectVehicle(pending.id);return false;}
  selectCountry(code){if(!this.worldEngine.getCountry(code))return false;const view=this.stateManager.get().view;if(view==='GLOBE'){this.pendingCountry=code;return this.transitionManager.toWorld();}return this.transitionManager.selectCountry(code);}
  clearCountry(){return this.transitionManager.clearCountry();}
  highlightCountry(code){this.stateManager.patch({highlightedCountry:this.worldEngine.getCountry(code)?code:null},'api:highlightCountry');return this;}
  highlightRegion(code){const region=this.worldEngine.getRegion(code);if(!region)return false;this.stateManager.patch({highlightedRegion:region.id},'api:highlightRegion');this.bus.emit('region:highlight',{code:region.id});return true;}
  focusRegion(code){return this.cameraEngine.focusRegion(code);}
  focusNode(id){const node=this.nodeNetwork.get(id);if(!node)return false;this.stateManager.setSelectedNode(id);this.cameraEngine.focusNode(id);return true;}
  selectInfrastructure(id){const node=this.infrastructureGraph?.get(id);if(!node)return false;const s=this.stateManager.get();if(s.view==='GLOBE'){this.pendingLocate={kind:'INFRASTRUCTURE',id};this.transitionManager.toWorld();return true;}if(s.view==='COUNTRY'&&s.selectedCountry&&node.country&&s.selectedCountry!==node.country){this.pendingLocate={kind:'INFRASTRUCTURE',id};this.transitionManager.selectCountry(node.country);return true;}this.layerManager?.enableAutoFor(node.type);this.selection?.select('INFRASTRUCTURE',id,{autoLayers:false});this.stateManager.setSelectedInfrastructure(id);this.mapCamera?.focus(node.position,{view:s.view==='COUNTRY'?'COUNTRY':'WORLD',zoom:s.view==='COUNTRY'?3:3.2});return true;}
  selectRoute(id){const route=this.routeEngine?.get(id);if(!route)return false;const s=this.stateManager.get();if(s.view==='GLOBE'){this.pendingLocate={kind:'ROUTE',id};this.transitionManager.toWorld();return true;}this.stateManager.setSelectedRoute(id);this.selection?.select('ROUTE',id,{autoLayers:false});const lons=route.points.map(p=>p.lon),lats=route.points.map(p=>p.lat);this.mapCamera?.fitBounds([Math.min(...lons),Math.min(...lats),Math.max(...lons),Math.max(...lats)],{view:s.view==='COUNTRY'?'COUNTRY':'WORLD',padding:.18});return true;}
  selectVehicle(id){const v=this.traffic?.get(id);if(!v)return false;const s=this.stateManager.get();if(s.view==='GLOBE'){this.pendingLocate={kind:'VEHICLE',id};this.transitionManager.toWorld();return true;}this.layerManager?.enableAutoFor(v.type);this.stateManager.setSelectedVehicle(id);this.selection?.select('VEHICLE',id,{autoLayers:false});if(v.position)this.mapCamera?.focus(v.position,{view:s.view==='COUNTRY'?'COUNTRY':'WORLD',zoom:s.view==='COUNTRY'?3.3:3.5});return true;}
  clearInfrastructure(){this.stateManager.setSelectedInfrastructure(null);return this;}
  clearSelection(){this.selection?.clear();this.focusMode?.clear();return this;}
  toggleInfrastructureLayer(layer,enabled){return this.layerManager?.toggle(layer,enabled)??false;}
  applyLayerPreset(name){return this.layerManager?.applyPreset(name)??false;}
  setAutoLayers(enabled){return this.layerManager?.setAuto(enabled)??false;}
  getInfrastructure(id){return this.infrastructureGraph?.get(id)||null;}
  getRoute(id){return this.routeEngine?.get(id)||null;}
  getVehicle(id){return this.traffic?.get(id)||null;}
  zoomAt(x,y,factor){return this.mapCamera?.zoomAt(x,y,factor)??false;}
  pan(dx,dy){return this.mapCamera?.panPixels(dx,dy)??false;}
  resetMap(){return this.mapCamera?.reset()??false;}
  back(){return this.selection?.back()??false;}
  forward(){return this.selection?.forward()??false;}
  focusSelection(){const s=this.stateManager.get();if(s.selectedInfrastructure)return this.focusMode?.set('INFRASTRUCTURE',s.selectedInfrastructure);if(s.selectedVehicle)return this.focusMode?.set('VEHICLE',s.selectedVehicle);if(s.selectedRoute)return this.focusMode?.set('ROUTE',s.selectedRoute);return false;}
  clearFocus(){this.focusMode?.clear();return this;}
  fitSelection(){const s=this.stateManager.get();if(s.selectedInfrastructure){const n=this.infrastructureGraph.get(s.selectedInfrastructure);return n?this.mapCamera?.focus(n.position,{zoom:s.view==='COUNTRY'?3:3.2}):false;}if(s.selectedVehicle){const v=this.traffic.get(s.selectedVehicle);return v?.position?this.mapCamera?.focus(v.position,{zoom:s.view==='COUNTRY'?3.3:3.5}):false;}if(s.selectedRoute){const r=this.routeEngine.get(s.selectedRoute);if(!r)return false;const lons=r.points.map(p=>p.lon),lats=r.points.map(p=>p.lat);return this.mapCamera?.fitBounds([Math.min(...lons),Math.min(...lats),Math.max(...lons),Math.max(...lats)],{padding:.18});}return false;}
  followSelection(){const s=this.stateManager.get();if(!s.selectedVehicle)return false;return this.mapCamera?.setFollowTarget({type:'VEHICLE',id:s.selectedVehicle},target=>this.traffic?.get(target.id)?.position||null)??false;}
  stopFollow(){this.mapCamera?.cancelFollow();return this;}

  why(id=null){return this.causality?.why(id)??false;}
  clearCausality(){return this.causality?.clear()??false;}
  setCausalityDirection(direction){return this.causality?.setDirection(direction)??false;}
  getCausality(){return this.causality?.snapshot?.()||null;}
  getTimeline(filter={}){return this.timeline?.records(filter)||[];}
  seekTimeline(day){return this.timeline?.setCursorDay(day)??false;}
  selectTimelineEvent(id){const row=this.timeline?.select(id);if(row?.country)this.highlightCountry(row.country);if(row)this.causality?.analyze('EVENT',row.eventId||row.id);return row||false;}
  replayEvent(id){return this.timeline?.replayEvent(id)??false;}
  toggleReplayPause(){return this.timeline?.toggleReplayPause()??false;}
  goLive(){return this.timeline?.live()??false;}
  createSnapshot(label='SNAPSHOT'){return this.timeline?.createSnapshot(label)??false;}
  listSnapshots(){return this.timeline?.listSnapshots?.()||[];}
  search(query,options={}){return this.searchEngine?.search(query,options)||[];}
  activateSearchResult(result){return this.searchEngine?.activate(result)??false;}
  setIntensity(v){const value=Math.max(0,Math.min(1,Number(v)));this.stateManager.patch({network:{intensity:Number.isFinite(value)?value:.34}},'api:intensity');return this;}
  setMode(mode){if(!['ambient','analysis','alert'].includes(mode))return false;this.stateManager.patch({mode},'api:mode');return true;}
  reset(){this.stateManager.patch({hoveredCountry:null,highlightedCountry:null,highlightedRegion:null,selectedNode:null,selectedInfrastructure:null,selectedRoute:null,selectedVehicle:null,hoveredInfrastructure:null,focus:{active:false,type:null,id:null,nodeIds:[],routeIds:[],vehicleIds:[]},causality:{active:false,rootType:null,rootId:null,direction:'BOTH',nodes:[],edges:[],nodeIds:[],routeIds:[],eventId:null},timeline:{mode:'LIVE',cursorDay:this.timeline?.range?.().current||0,selectedId:null,replayId:null,replayProgress:0},search:{open:false,query:'',selectedIndex:0},mode:'ambient',network:{intensity:.34}},'api:reset');this.transitionManager.clearCountry();this.cameraEngine.reset();this.mapCamera?.cancelFollow();return this;}
  on(name,handler){return this.bus.on(name,handler);}off(name,handler){return this.bus.off(name,handler);}getState(){return this.stateManager.snapshot();}destroy(){this.unsub?.();this.unsubCountry?.();}
}
