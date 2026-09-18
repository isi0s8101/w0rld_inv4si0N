const VALID_FAMILIES = new Set(["TRADE","ENERGY","AIR","SEA","LAND","DATA"]);
const VALID_MODES = new Set(["AIR","SEA","LAND","DATA_TERRESTRIAL","DATA_SUBMARINE","DATA_SPACE"]);

function clone(value){ return value == null ? value : structuredClone(value); }

export class FlowDataStore {
  constructor({ url = new URL("../data/flow-world-start-snapshot.json", import.meta.url) } = {}) {
    this.url = url;
    this.snapshot = null;
    this.profileByCode = new Map();
    this.hubById = new Map();
    this.corridors = [];
    this.tradeDemands = [];
    this.energyDemands = [];
    this.dataDemands = [];
  }

  async init(){
    const response = await fetch(this.url);
    if(!response.ok) throw new Error(`FlowDataStore HTTP ${response.status}`);
    return this.load(await response.json());
  }

  load(snapshot){
    if(!snapshot || snapshot.schemaVersion !== 1 || snapshot.mode !== "REAL_WORLD_FLOW_START_SNAPSHOT" || snapshot.offlineReady !== true){
      throw new Error("Invalid global flow start snapshot");
    }
    this.snapshot = {
      schemaVersion:snapshot.schemaVersion, mode:snapshot.mode, snapshotId:snapshot.snapshotId, generatedAt:snapshot.generatedAt,
      simulationStartDate:snapshot.simulationStartDate, offlineReady:snapshot.offlineReady, coverage:clone(snapshot.coverage),
      methodology:clone(snapshot.methodology), sourceNotes:clone(snapshot.sourceNotes), integrity:clone(snapshot.integrity)
    };
    this.profileByCode = new Map((snapshot.profiles || []).map((p)=>[p.code,clone(p)]));
    this.hubById = new Map((snapshot.hubs || []).map((h)=>[h.id,clone(h)]));
    this.corridors = (snapshot.corridors || []).map(clone);
    this.tradeDemands = (snapshot.tradeDemands || []).map(clone);
    this.energyDemands = (snapshot.energyDemands || []).map(clone);
    this.dataDemands = (snapshot.dataDemands || []).map(clone);
    if(!this.validate()) throw new Error("Invalid global flow records");
    return this;
  }

  validate(){
    if(!this.snapshot?.generatedAt || this.profileByCode.size < 1) return false;
    for(const [code,p] of this.profileByCode){
      if(!/^[A-Z]{2}$/.test(code) || !Number.isFinite(p.population) || !Number.isFinite(p.gdpCurrentUsd)) return false;
    }
    for(const c of this.corridors){
      if(!VALID_FAMILIES.has(c.family) || !VALID_MODES.has(c.mode) || c.from === c.to) return false;
      if(!this.profileByCode.has(c.from) || !this.profileByCode.has(c.to)) return false;
      if(!Number.isFinite(c.capacity) || c.capacity <= 0 || !Number.isFinite(c.reliability)) return false;
    }
    for(const list of [this.tradeDemands,this.energyDemands,this.dataDemands]){
      for(const d of list){
        if(d.from === d.to || !this.profileByCode.has(d.from) || !this.profileByCode.has(d.to)) return false;
        if(!d.dataClass || !d.provenance) return false;
      }
    }
    return true;
  }

  getProfile(code){ return this.profileByCode.get(String(code || "").toUpperCase()) || null; }
  getHub(id){ return this.hubById.get(id) || null; }
  listProfiles(){ return [...this.profileByCode.values()]; }
  listHubs(){ return [...this.hubById.values()]; }
  getCoverage(){ return clone(this.snapshot?.coverage || {}); }
  getMethodology(){ return clone(this.snapshot?.methodology || {}); }
  getSourceNotes(){ return clone(this.snapshot?.sourceNotes || {}); }
}
