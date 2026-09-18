const ALL = ['CITIES','CAPITALS','PORTS','AVIATION','MARITIME','RAIL','ROAD','MILITARY','INDUSTRY','ENERGY','LOGISTICS','DIGITAL','SPACE','HEALTH','TRADE','TRAFFIC','CHOKEPOINTS','CARGO'];
const DEFAULTS = {
  GLOBE: ['CAPITALS','PORTS','MARITIME','SPACE','TRADE','TRAFFIC'],
  WORLD: ['CAPITALS','CITIES','PORTS','AVIATION','MARITIME','MILITARY','INDUSTRY','ENERGY','DIGITAL','SPACE','TRADE','TRAFFIC'],
  COUNTRY: ['CAPITALS','CITIES','PORTS','AVIATION','MARITIME','RAIL','ROAD','MILITARY','INDUSTRY','ENERGY','LOGISTICS','DIGITAL','SPACE','HEALTH','TRADE','TRAFFIC']
};
const PRESETS={
  ECONOMY:['CAPITALS','CITIES','PORTS','INDUSTRY','ENERGY','LOGISTICS','TRADE','TRAFFIC'],
  LOGISTICS:['PORTS','MARITIME','AVIATION','RAIL','ROAD','LOGISTICS','CHOKEPOINTS','TRAFFIC','CARGO'],
  ENERGY:['ENERGY','PORTS','MARITIME','LOGISTICS','TRAFFIC'],
  MILITARY:['MILITARY','AVIATION','MARITIME','LOGISTICS','TRAFFIC'],
  DIGITAL:['DIGITAL','ENERGY','SPACE'],
  INTELLIGENCE:['MILITARY','DIGITAL','SPACE','AVIATION'],
  CRISIS:['CAPITALS','CITIES','PORTS','MILITARY','ENERGY','LOGISTICS','HEALTH','TRAFFIC'],
  TRAFFIC:['PORTS','AVIATION','MARITIME','RAIL','ROAD','LOGISTICS','TRAFFIC','CHOKEPOINTS','CARGO'],
  ALL:[...ALL]
};
const AUTO = {
  SHIP:['MARITIME','PORTS','TRAFFIC','CHOKEPOINTS','CARGO'], SUBMARINE:['MARITIME','PORTS','MILITARY','TRAFFIC'], AIRCRAFT:['AVIATION','TRAFFIC'], PLANE:['AVIATION','TRAFFIC'], TRAIN:['RAIL','LOGISTICS','TRAFFIC','CARGO'], DRONE:['AVIATION','MILITARY','TRAFFIC'], TRUCK:['ROAD','LOGISTICS','TRAFFIC','CARGO'],
  INDUSTRY:['INDUSTRY','ENERGY','LOGISTICS','RAIL','ROAD'], DATACENTER:['DIGITAL','ENERGY'], SATELLITE:['SPACE'], PORT:['PORTS','MARITIME','LOGISTICS','TRAFFIC'], AIRPORT:['AVIATION','LOGISTICS','TRAFFIC'],
  AIRBASE:['AVIATION','MILITARY'], NAVAL_BASE:['MARITIME','MILITARY'], POWER_PLANT:['ENERGY'], IXP:['DIGITAL'], CABLE_LANDING:['DIGITAL'], CHOKEPOINT:['CHOKEPOINTS','MARITIME','TRAFFIC'], RAIL_HUB:['RAIL','LOGISTICS','TRAFFIC']
};
export class LayerManagerV1 {
  constructor(){this.enabled=new Set(DEFAULTS.WORLD);this.view='WORLD';this.autoMode=true;this.activePreset=null;this.manualOverrides=new Map();}
  setView(view,{preserve=false}={}){if(!DEFAULTS[view])return false;this.view=view;if(!preserve&&!this.activePreset)this.enabled=new Set(DEFAULTS[view]);return true;}
  isEnabled(layer){return this.enabled.has(layer);}
  toggle(layer,enabled=!this.enabled.has(layer)){if(!ALL.includes(layer))return false;enabled?this.enabled.add(layer):this.enabled.delete(layer);this.manualOverrides.set(layer,Boolean(enabled));this.activePreset=null;return true;}
  setOnly(layers){this.enabled=new Set((layers||[]).filter(layer=>ALL.includes(layer)));this.activePreset=null;return this.listEnabled();}
  applyPreset(name){const key=String(name||'').toUpperCase();const preset=PRESETS[key];if(!preset)return false;this.enabled=new Set(preset);this.activePreset=key;this.manualOverrides.clear();return this.listEnabled();}
  enableAutoFor(type){if(!this.autoMode)return;const target=AUTO[String(type||'').toUpperCase()];if(!target)return;for(const layer of target)this.enabled.add(layer);}
  setAuto(enabled){this.autoMode=Boolean(enabled);return this.autoMode;}
  listEnabled(){return [...this.enabled];}
  defaults(view=this.view){return [...(DEFAULTS[view]||DEFAULTS.WORLD)];}
  presets(){return Object.fromEntries(Object.entries(PRESETS).map(([k,v])=>[k,[...v]]));}
  snapshot(){return {view:this.view,enabled:this.listEnabled(),autoMode:this.autoMode,activePreset:this.activePreset};}
  restore(snapshot={}){if(snapshot.view&&DEFAULTS[snapshot.view])this.view=snapshot.view;this.enabled=new Set((snapshot.enabled||DEFAULTS[this.view]).filter(l=>ALL.includes(l)));this.autoMode=snapshot.autoMode!==false;this.activePreset=snapshot.activePreset||null;return this.snapshot();}
}
