const clone=(v)=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
export class SelectionContext {
  constructor({stateManager,layerManager,mapCamera,bus=null}={}){this.state=stateManager;this.layers=layerManager;this.mapCamera=mapCamera;this.bus=bus;this.history=[];this.index=-1;this.restoring=false;}
  current(){const s=this.state.get();return {view:s.view,selectedCountry:s.selectedCountry,selectedInfrastructure:s.selectedInfrastructure,selectedRoute:s.selectedRoute||null,selectedVehicle:s.selectedVehicle||null,camera:{world:clone(s.world),country:clone(s.country)},layers:this.layers?.snapshot?.()||null,focus:clone(s.focus||null)};}
  push(reason='selection'){if(this.restoring)return;const snap=this.current();this.history=this.history.slice(0,this.index+1);this.history.push(snap);if(this.history.length>80)this.history.shift();this.index=this.history.length-1;this.bus?.emit?.('selection:history',{reason,index:this.index});}
  select(type,id,{autoLayers=true,record=true}={}){const key=String(type||'').toUpperCase();if(record)this.push('before-select');const patch={selectedInfrastructure:null,selectedRoute:null,selectedVehicle:null};if(key==='INFRASTRUCTURE')patch.selectedInfrastructure=id||null;if(key==='ROUTE')patch.selectedRoute=id||null;if(key==='VEHICLE')patch.selectedVehicle=id||null;this.state.patch(patch,'selection:select');if(autoLayers&&id)this.bus?.emit?.('selection:auto-layers',{type:key,id});this.bus?.emit?.('selection:changed',{type:key,id});if(record)this.push('after-select');return true;}
  clear({record=true}={}){if(record)this.push('before-clear');this.state.patch({selectedInfrastructure:null,selectedRoute:null,selectedVehicle:null,focus:{active:false,type:null,id:null}},'selection:clear');if(record)this.push('after-clear');}
  restore(snapshot){if(!snapshot)return false;this.restoring=true;try{
    const targetView=['GLOBE','WORLD','COUNTRY'].includes(snapshot.view)?snapshot.view:this.state.get().view;
    if(targetView==='COUNTRY'&&snapshot.selectedCountry)this.state.setSelectedCountry(snapshot.selectedCountry,this.state.get().selectedCountry);
    else if(targetView!=='COUNTRY'&&this.state.get().selectedCountry)this.state.setSelectedCountry(null,this.state.get().selectedCountry);
    if(['GLOBE','WORLD','COUNTRY'].includes(targetView))this.state.setView(targetView);
    this.state.patch({world:snapshot.camera?.world||{},country:snapshot.camera?.country||{},selectedInfrastructure:snapshot.selectedInfrastructure||null,selectedRoute:snapshot.selectedRoute||null,selectedVehicle:snapshot.selectedVehicle||null,focus:snapshot.focus||{active:false,type:null,id:null,nodeIds:[],routeIds:[],vehicleIds:[]}},'selection:restore');
    if(snapshot.layers)this.layers?.restore?.(snapshot.layers);this.bus?.emit?.('selection:restored',snapshot);return true;
  }finally{this.restoring=false;}}
  back(){if(this.index<=0)return false;this.index--;return this.restore(this.history[this.index]);}
  forward(){if(this.index<0||this.index>=this.history.length-1)return false;this.index++;return this.restore(this.history[this.index]);}
  focus(){this.bus?.emit?.('selection:focus-request',this.current());}
  fit(){this.bus?.emit?.('selection:fit-request',this.current());}
  follow(){this.bus?.emit?.('selection:follow-request',this.current());}
  reset(){this.mapCamera?.reset?.();this.clear({record:false});this.layers?.setView?.(this.state.get().view==='COUNTRY'?'COUNTRY':'WORLD');this.push('reset');}
}
