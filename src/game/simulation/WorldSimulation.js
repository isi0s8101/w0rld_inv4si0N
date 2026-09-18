import { SeededRandom } from "../SeededRandom.js";
import { createCountryState, validateCountryState } from "./CountryState.js";
import { CountrySimulator } from "./CountrySimulator.js";
import { ResourceEconomy } from "./ResourceEconomy.js";
import { RelationGraph } from "./RelationGraph.js";
import { GlobalFlowEngine } from "../flows/GlobalFlowEngine.js";
import { FlowEngine as LegacyFlowEngine } from "./FlowEngine.js";
import { WorldEventDirector } from "./WorldEventDirector.js";
import { DemographySystem } from "./DemographySystem.js";
import { IndicatorDeriver } from "../realworld/IndicatorDeriver.js";
import { BudgetSystem } from "../ai/BudgetSystem.js";
import { CountryPolicyAI } from "../ai/CountryPolicyAI.js";
import { CountryPolicySystem } from "../ai/CountryPolicySystem.js";
import { PropagationQueue } from "../events/PropagationQueue.js";
import { DecisionLedger } from "../history/DecisionLedger.js";
import { MarketSystem } from "../economy/MarketSystem.js";
import { ContractSystem } from "../economy/ContractSystem.js";
import { InfrastructureProjectSystem } from "../economy/InfrastructureProjectSystem.js";
import { StrategySystem } from "../economy/StrategySystem.js";
import { SpecializationSystem } from "../diplomacy/SpecializationSystem.js";
import { ForeignPolicySystem } from "../diplomacy/ForeignPolicySystem.js";
import { DiplomacySystem } from "../diplomacy/DiplomacySystem.js";
import { AllianceBlocSystem } from "../diplomacy/AllianceBlocSystem.js";
import { AgreementSystem } from "../diplomacy/AgreementSystem.js";
import { SanctionSystem } from "../diplomacy/SanctionSystem.js";
import { DependencySystem } from "../diplomacy/DependencySystem.js";
import { GlobalOpinionSystem } from "../diplomacy/GlobalOpinionSystem.js";
import { SimulationTimeEngine } from "../systems/SimulationTimeEngine.js";
import { InfrastructureRuntime } from "../systems/InfrastructureRuntime.js";
import { LogisticsEngine } from "../systems/LogisticsEngine.js";
import { InfrastructureFlowEngine } from "../systems/InfrastructureFlowEngine.js";
import { InfrastructureDependencyEngine } from "../systems/InfrastructureDependencyEngine.js";
import { EnergyEngineV1 } from "../systems/EnergyEngineV1.js";
import { EconomyEngineV1 } from "../systems/EconomyEngineV1.js";
import { PopulationEngineV1 } from "../systems/PopulationEngineV1.js";
import { MilitaryLogisticsEngine } from "../systems/MilitaryLogisticsEngine.js";
import { DerivedIndicatorEngine } from "../systems/DerivedIndicatorEngine.js";
import { StabilityEngine } from "../systems/StabilityEngine.js";
import { InfluenceEngine } from "../systems/InfluenceEngine.js";
import { IntelligenceEngine } from "../intelligence/IntelligenceEngine.js";
import { WorldMemory } from "../history/WorldMemory.js";
import { ScenarioEngine } from "../scenario/ScenarioEngine.js";
import { CausalEventEngine } from "./CausalEventEngine.js";
import { StrategicObjectiveEngine } from "../ai/StrategicObjectiveEngine.js";
import { FeedbackLoopEngine } from "../systems/FeedbackLoopEngine.js";

function mergeTransfers(base,extra){
  if(!extra)return base;
  for(const [code,row] of extra){
    if(!base.has(code))base.set(code,{});
    const target=base.get(code);
    for(const [resource,delta] of Object.entries(row||{})){
      if(!target[resource])target[resource]={imports:0,exports:0};
      target[resource].imports+=(delta.imports||0);target[resource].exports+=(delta.exports||0);
    }
  }
  return base;
}

export class WorldSimulation {
  constructor({ seed = 1849237, worldEngine, realWorldDataStore = null, flowDataStore = null, infrastructureGraph = null, routeEngineV1 = null, mode = "REAL_WORLD", startDate = "2025-01-01", scenarioConfig = null } = {}) {
    this.seed = Number(seed) >>> 0 || 1849237;
    this.worldEngine = worldEngine;
    this.realWorldDataStore = realWorldDataStore;
    this.flowDataStore = flowDataStore;
    this.infrastructureGraph = infrastructureGraph;
    this.routeEngineV1 = routeEngineV1;
    this.startDate = startDate;
    this.mode = mode === "SCENARIO" ? "SCENARIO" : "REAL_WORLD";
    this.random = new SeededRandom(this.seed);
    this.states = new Map();
    this.day = 0;
    this.countrySimulator = new CountrySimulator();
    this.resourceEconomy = new ResourceEconomy();
    this.demography = new DemographySystem();
    this.indicatorDeriver = new IndicatorDeriver();
    this.relations = new RelationGraph();
    this.flows = null;
    this.ledger = new DecisionLedger();
    this.budget = new BudgetSystem();
    this.market = new MarketSystem();
    this.contracts = new ContractSystem({ budgetSystem:this.budget, ledger:this.ledger });
    this.projects = new InfrastructureProjectSystem({ budgetSystem:this.budget, ledger:this.ledger });
    this.strategy = new StrategySystem({ ledger:this.ledger });
    this.specializations = new SpecializationSystem();
    this.foreignPolicy = new ForeignPolicySystem({ ledger:this.ledger });
    this.diplomacy = new DiplomacySystem({ ledger:this.ledger });
    this.blocs = new AllianceBlocSystem({ ledger:this.ledger });
    this.agreements = new AgreementSystem({ ledger:this.ledger });
    this.sanctions = new SanctionSystem({ ledger:this.ledger, random:this.random.fork("sanctions") });
    this.dependencies = new DependencySystem();
    this.opinion = new GlobalOpinionSystem({ ledger:this.ledger });
    this.policyAI = new CountryPolicyAI(this.random.fork("country-policy-ai"));
    this.policySystem = new CountryPolicySystem({ budgetSystem: this.budget, ledger: this.ledger, contractSystem:this.contracts, projectSystem:this.projects, marketSystem:this.market, agreementSystem:this.agreements, sanctionSystem:this.sanctions });
    this.propagation = new PropagationQueue();
    this.events = new WorldEventDirector(this.random.fork("world-events"));
    this.simTime = new SimulationTimeEngine({ startDate: `${String(startDate).slice(0,10)}T00:00:00Z` });
    this.worldMemory = new WorldMemory({ startDate:this.startDate });
    this.scenario = new ScenarioEngine({ seed:this.seed, mode:this.mode });
    if(scenarioConfig)this.scenario.configure(scenarioConfig);
    this.intelligence = new IntelligenceEngine({ random:this.random.fork("intelligence"), infrastructureGraph:this.infrastructureGraph });
    this.stabilityEngine = new StabilityEngine();
    this.influenceEngine = new InfluenceEngine();
    this.strategicObjectives = new StrategicObjectiveEngine();
    this.causalEvents = new CausalEventEngine({ random:this.random.fork("causal-events"), worldMemory:this.worldMemory });
    this.feedbackLoops = new FeedbackLoopEngine();
    this.infrastructureRuntime = null;
    this.logisticsV1 = null;
    this.infrastructureFlows = null;
    this.infrastructureDependencies = null;
    this.energyV1 = null;
    this.economyV1 = null;
    this.populationV1 = new PopulationEngineV1();
    this.militaryLogistics = null;
    this.derivedIndicators = new DerivedIndicatorEngine();
    this.lastCausalEvents = [];
    this.lastEvents = [];
    this.lastDecisions = [];
    this.lastPropagations = [];
    this.lastDeliveries = [];
    this.lastCompletedProjects = [];
  }

  init() {
    const countries = this.worldEngine.listCountries();
    for (const country of countries) {
      const meta = this.worldEngine.getCountryMeta(country.iso2);
      const random = this.random.fork(`country:${country.iso2}`);
      const realWorldRecord = this.mode === "REAL_WORLD" ? this.realWorldDataStore?.get(country.iso2) || null : null;
      const realWorldMetadata = this.mode === "REAL_WORLD" ? this.realWorldDataStore?.getMetadata(country.iso2) || null : null;
      const derived = realWorldRecord ? this.indicatorDeriver.derive(realWorldRecord) : null;
      const provenance = this.mode === "REAL_WORLD"
        ? this.realWorldDataStore?.getProvenance(country.iso2) || { mode: "SCENARIO_FALLBACK", coverage: 0, fields: {} }
        : { mode: "SCENARIO", coverage: 0, fields: {} };
      const state = createCountryState(country, meta, random, { realWorldRecord, realWorldMetadata, derived, mode: this.mode, provenance });
      if (this.mode === "SCENARIO") state.dataMode = "SCENARIO";
      this.budget.initialize(state, random.fork("budget"));
      this.states.set(country.iso2, state);
    }
    if(this.mode==="SCENARIO")this.scenario.applyStartingState(this.states);
    this.relations.build(countries, this.states, this.worldEngine, this.random.fork("relations"));
    this.specializations.initialize(this.states);
    this.foreignPolicy.initialize(this.states);
    this.diplomacy.initialize(this.relations);
    this.blocs.review(this.states,this.relations,this.worldEngine,0);
    this.agreements.review(this.states,this.relations,this.blocs,0);
    this.sanctions.review(this.states,this.relations,0);
    this.opinion.initialize(this.states);
    this.flowEngineKind = this.flowDataStore ? "GLOBAL_V05" : "LEGACY";
    this.flows = this.flowDataStore
      ? new GlobalFlowEngine({ dataStore: this.flowDataStore, resourceEconomy: this.resourceEconomy, random: this.random.fork("global-flows") })
      : new LegacyFlowEngine({ relationGraph: this.relations, resourceEconomy: this.resourceEconomy });
    if (this.flowEngineKind === "GLOBAL_V05") this.flows.prime(this.states);
    this.flows?.setDiplomacySystems?.({agreements:this.agreements,sanctions:this.sanctions,relations:this.relations,blocs:this.blocs});
    this.dependencies.update(this.states,{contracts:this.contracts,flowEngine:this.flows,day:0});
    this.opinion.update(this.states,{events:[],sanctions:this.sanctions,agreements:this.agreements,day:0});
    for(const state of this.states.values())this.resourceEconomy.prepareDay(state);
    this.market.update(this.states,0);this.market.applyLocalPrices(this.states,this.flows);
    if (this.infrastructureGraph && this.routeEngineV1) {
      this.infrastructureRuntime = new InfrastructureRuntime({ infrastructureGraph:this.infrastructureGraph }).init();
      this.logisticsV1 = new LogisticsEngine({ routeEngine:this.routeEngineV1, infrastructureRuntime:this.infrastructureRuntime });
      this.infrastructureFlows = new InfrastructureFlowEngine({ infrastructureGraph:this.infrastructureGraph, runtime:this.infrastructureRuntime, logistics:this.logisticsV1 });
      this.infrastructureDependencies = new InfrastructureDependencyEngine({ graph:this.infrastructureGraph, runtime:this.infrastructureRuntime });
      this.energyV1 = new EnergyEngineV1({ graph:this.infrastructureGraph, runtime:this.infrastructureRuntime });
      this.economyV1 = new EconomyEngineV1({ graph:this.infrastructureGraph, runtime:this.infrastructureRuntime, logistics:this.logisticsV1, infraFlows:this.infrastructureFlows });
      this.militaryLogistics = new MilitaryLogisticsEngine({ graph:this.infrastructureGraph, runtime:this.infrastructureRuntime });
      this.intelligence.graph = this.infrastructureGraph;
      this.intelligence.runtime = this.infrastructureRuntime;
      this.infrastructureDependencies.update();
      this.infrastructureFlows.stepHour(0);
      this.refreshDerivedSystems();
    }
    this.intelligence.update(this.states,this.relations,this.blocs,{day:0});
    this.influenceEngine.update(this.states,this.relations,{blocs:this.blocs,agreements:this.agreements});
    this.stabilityEngine.update(this.states,{worldMemory:this.worldMemory});
    this.strategicObjectives.review(this.states,1,{relations:this.relations,worldMemory:this.worldMemory,blocs:this.blocs});
    this.feedbackLoops.update(this.states,{day:1,events:this.causalEvents.active,worldMemory:this.worldMemory});
    return this;
  }

  step(days = 1) { for (let i = 0; i < Math.max(0, Math.floor(days)); i++) this.stepDay(); return this; }
  stepHours(hours = 1) {
    const count=Math.max(0,Math.floor(Number(hours)||0));
    if (!count) return this;
    for(let i=0;i<count;i++){
      this.runPhysicalHours(1);
      if(this.simTime.hour%24===0)this.stepDay({physicalAlreadyAdvanced:true});
    }
    return this;
  }
  runPhysicalHours(hours=24){
    if(!this.infrastructureRuntime||!this.infrastructureFlows){this.simTime.advance(hours);return;}
    for(let i=0;i<hours;i++){
      this.simTime.advance(1);
      this.infrastructureDependencies?.update();
      this.infrastructureFlows.stepHour(this.simTime.hour);
    }
  }
  refreshDerivedSystems(){
    if(this.energyV1)this.energyV1.update(this.states);
    if(this.economyV1)this.economyV1.update(this.states,this.day);
    this.populationV1.update(this.states,this.economyV1?.byCountry || new Map());
    if(this.militaryLogistics)this.militaryLogistics.update(this.states);
    this.derivedIndicators.update(this.states,{energy:this.energyV1?.byCountry,economy:this.economyV1?.byCountry,military:this.militaryLogistics?.byCountry});
  }

  stepDay({physicalAlreadyAdvanced=false} = {}) {
    this.day++;
    if(!physicalAlreadyAdvanced)this.runPhysicalHours(24);
    for (const state of this.states.values()) {
      this.budget.accrueDay(state, this.day);
      this.demography.updateDay(state);
      this.resourceEconomy.prepareDay(state);
    }

    this.market.update(this.states,this.day);
    this.strategy.review(this.states,this.market,this.day);

    if (this.day === 1 || this.day % 30 === 0) {
      this.specializations.review(this.states,this.day);
      this.foreignPolicy.review(this.states,this.day);
      this.blocs.review(this.states,this.relations,this.worldEngine,this.day);
      this.agreements.review(this.states,this.relations,this.blocs,this.day);
      this.sanctions.review(this.states,this.relations,this.day);
      this.diplomacy.update(this.states,this.relations,{agreements:this.agreements,sanctions:this.sanctions,blocs:this.blocs,ledger:this.ledger,worldMemory:this.worldMemory,day:this.day});
      this.dependencies.update(this.states,{contracts:this.contracts,flowEngine:this.flows,day:this.day});
    }

    this.lastDecisions = [];
    if (this.day === 1 || this.day % 30 === 0) this.strategicObjectives.review(this.states,this.day,{relations:this.relations,worldMemory:this.worldMemory,blocs:this.blocs});
    if (this.day === 1 || this.day % 30 === 0) {
      for (const state of this.states.values()) this.budget.monthlyDebtService(state);
      const planned = this.policyAI.plan(this.states, { relations: this.relations, flowEngine: this.flows, contractSystem:this.contracts, projectSystem:this.projects, marketSystem:this.market, day: this.day });
      this.lastDecisions = this.policySystem.applyAll(planned, { states: this.states, flowEngine: this.flows, relations:this.relations, day: this.day });
    }

    this.lastCompletedProjects=this.projects.update(this.states,this.flows,this.day);

    const flowResult = this.flowEngineKind === "GLOBAL_V05"
      ? this.flows.step(this.states, this.day)
      : this.flows.routeDay(this.states, this.day);
    const transfers=flowResult.transfers;
    const contractResult=this.contracts.step(this.states,this.flows,this.market,this.day);
    mergeTransfers(transfers,contractResult.transfers);
    this.lastDeliveries=contractResult.deliveries;
    this.flows?.addSupplementalFlows?.(contractResult.flows);

    for (const state of this.states.values()) this.resourceEconomy.applyTransfers(state, transfers.get(state.code));
    this.market.applyLocalPrices(this.states,this.flows);
    this.refreshDerivedSystems();

    this.lastEvents = this.events.update(this.states, this.day, { flowEngine: this.flows, relations: this.relations, propagation: this.propagation, ledger: this.ledger });
    this.lastPropagations = this.propagation.process(this.states, this.day);
    for (const effect of this.lastPropagations) this.ledger.record({
      day: this.day, kind: "PROPAGATED_EFFECT", country: effect.target, source: effect.source,
      type: effect.cause, eventId: effect.eventId, effects: { metric: effect.metric, delta: effect.delta, confidence: effect.confidence }
    });

    this.opinion.update(this.states,{events:this.events.active,sanctions:this.sanctions,agreements:this.agreements,day:this.day});
    this.lastCausalEvents = this.causalEvents.evaluate(this.states,this.day,{relations:this.relations,sanctions:this.sanctions,agreements:this.agreements,blocs:this.blocs,flowEngine:this.flows});
    this.worldMemory.ingestLedger(this.ledger.records);
    this.feedbackLoops.update(this.states,{day:this.day,events:this.causalEvents.active,worldMemory:this.worldMemory});
    if(this.day===1||this.day%7===0){
      this.intelligence.update(this.states,this.relations,this.blocs,{day:this.day});
      this.stabilityEngine.update(this.states,{worldMemory:this.worldMemory});
      this.influenceEngine.update(this.states,this.relations,{blocs:this.blocs,agreements:this.agreements});
    }

    const next = new Map();
    for (const [code, state] of this.states) next.set(code, this.countrySimulator.computeNext(state));
    this.states = next;
    if (this.day % 30 === 0) this.captureHistory();
  }

  captureHistory() {
    for (const state of this.states.values()) {
      state.history.push({
        day: this.day,populationCount: state.populationCount,economy: state.metrics.economy.current,energy: state.metrics.energy.current,food: state.metrics.food.current,
        stability: state.metrics.stability.current,resilience: state.metrics.resilience.current,treasury: state.policy?.budget?.treasury ?? 0,decisions: state.policy?.decisionCount ?? 0,
        foodPrice:state.resources.food.priceIndex,energyPrice:state.resources.energy.priceIndex,goodsPrice:state.resources.goods.priceIndex,dataPrice:state.resources.data.priceIndex,
        activeContracts:this.contracts.activeFor(state.code).length,activeProjects:this.projects.active(state.code).length,foreignPolicy:state.foreignPolicy?.doctrine||"BALANCED",dependency:state.dependencies?.overall||0,publicOpinion:state.publicOpinion?.confidence||0
      });
      if (state.history.length > 120) state.history.shift();
    }
  }

  getCountry(code) { return this.states.get(String(code || "").toUpperCase()) || null; }
  getRelations(code) { return this.relations.outgoing(String(code || "").toUpperCase()); }
  getFlows(filter = {}) { return this.flows?.getFlows(filter) || []; }
  getVisualFlows(options = {}) { return this.flows?.getVisualFlows?.(options) || this.flows?.getFlows?.(options) || []; }
  setFlowLayer(layer) { return this.flows?.setLayer?.(layer) || false; }
  setDataFlowMode(mode) { return this.flows?.setDataMode?.(mode) || false; }
  getFlowLayer() { return this.flows?.getLayer?.() || "GLOBAL"; }
  getFlowNetworkSummary() { return this.flows?.getNetworkSummary?.() || {}; }
  getFlowCoverage() { return this.flows?.getCoverage?.() || {}; }
  setFlowCorridorState(id, state = {}) { return this.flows?.setCorridorState?.(id, state) || false; }
  getCountryProvenance(code) { return structuredClone(this.getCountry(code)?.provenance || null); }
  getCountryPolicy(code) { return structuredClone(this.getCountry(code)?.policy || null); }
  getDecisions(filter = {}) { return this.ledger.list(filter); }
  getCountryDecisions(code, limit = 50) { return this.ledger.list({ country: String(code || "").toUpperCase(), kind: "COUNTRY_DECISION", limit }); }
  getActiveWorldEvents() { return structuredClone(this.events.active); }
  getPendingPropagation(code = null) { return this.propagation.pending({ country: code ? String(code).toUpperCase() : null }); }
  getMarket(resource=null){return resource?this.market.get(resource):structuredClone(this.market.summary());}
  getContracts(filter={}){return this.contracts.list(filter);}
  getProjects(filter={}){return this.projects.list(filter);}
  getDiplomacy(code){return this.diplomacy.get(this.relations,String(code||"").toUpperCase());}
  getAlliances(code=null){return this.blocs.getAlliances(code?String(code).toUpperCase():null);}
  getBlocs(){return this.blocs.getBlocs();}
  getBlocMembership(code){return this.blocs.getMembership(String(code||"").toUpperCase());}
  getBlocTransitions(filter={}){return this.blocs.getTransitions(filter);}
  getBlocFor(code){return this.blocs.getBlocFor(String(code||"").toUpperCase());}
  getAgreements(filter={}){return this.agreements.list(filter);}
  getSanctions(filter={}){return this.sanctions.list(filter);}
  getDependencies(code){return this.dependencies.get(this.getCountry(code));}
  getSpecialization(code){return this.specializations.get(this.getCountry(code));}
  getForeignPolicy(code){return structuredClone(this.getCountry(code)?.foreignPolicy||null);}
  getWorldOpinion(){return this.opinion.snapshot();}
  getSimulationTime(){return this.simTime.snapshot();}
  getInfrastructureRuntime(id=null){if(!this.infrastructureRuntime)return id?null:[];return id?structuredClone(this.infrastructureRuntime.get(id)):structuredClone(this.infrastructureRuntime.list());}
  getInfrastructureFlows(filter={}){return this.infrastructureFlows?structuredClone(this.infrastructureFlows.getFlows(filter)):[];}
  getPhysicalLogistics(){return this.logisticsV1?structuredClone(this.logisticsV1.summarize()):null;}
  getDerivedIndicators(code){return structuredClone(this.derivedIndicators.get(String(code||'').toUpperCase())||null);}
  getMilitaryLogistics(code){return structuredClone(this.militaryLogistics?.get(String(code||'').toUpperCase())||null);}
  getIntelligence(observer,target=null){return structuredClone(this.intelligence.get(String(observer||'').toUpperCase(),target?String(target).toUpperCase():null));}
  getObservedCountry(observer,target){
    const observerCode=String(observer||'').toUpperCase(),targetCode=String(target||'').toUpperCase();const state=this.getCountry(targetCode);if(!state)return null;
    if(observerCode===targetCode)return {observer:observerCode,target:targetCode,level:'CONFIRMED',confidence:1,self:true,public:{name:state.name,continent:state.continent,populationCount:state.populationCount,dataMode:state.dataMode},estimate:{economy:state.metrics.economy.current,militaryReadiness:state.metrics.militaryReadiness.current,stability:state.metrics.stability.current,energySecurity:state.derivedSystems?.energy?.energySecurity??state.metrics.energy.current,infrastructure:state.metrics.infrastructure.current,uncertainty:0,dataClass:'SELF_KNOWLEDGE'},sources:{self:1},dataClass:'SIM_OBSERVED_COUNTRY'};
    const intel=this.intelligence.get(observerCode,targetCode);
    return {observer:observerCode,target:targetCode,level:intel.level,confidence:intel.confidence,self:false,public:{name:state.name,continent:state.continent,populationCount:state.realWorld?.population?.value??null,dataMode:state.dataMode},estimate:intel.estimate||null,sources:intel.sources||{},evidence:intel.evidence||[],lastObservedDay:intel.lastObservedDay??null,dataClass:'SIM_OBSERVED_COUNTRY'};
  }
  getStability(code){return structuredClone(this.stabilityEngine.get(String(code||'').toUpperCase())||null);}
  getInfluence(code){return structuredClone(this.influenceEngine.get(String(code||'').toUpperCase())||null);}
  getStrategicObjectives(code){return structuredClone(this.strategicObjectives.get(String(code||'').toUpperCase())||null);}
  getTimeline(filter={}){return this.worldMemory.timeline(filter);}
  getCausalEvents(filter={}){return this.causalEvents.list(filter);}
  getFeedbackLoops(code){return this.feedbackLoops.get(String(code||"").toUpperCase());}
  getFeedbackSummary(){return this.feedbackLoops.summary();}
  getScenario(){return this.scenario.descriptor();}
  configureScenario(config={}){if(this.mode!=="SCENARIO")return false;this.scenario.configure(config);return this.scenario.descriptor();}
  recordScenarioDecision(entry={}){if(this.mode!=="SCENARIO")return false;return this.scenario.recordDecisionInput(entry);}
  setInfrastructureDamage(id,damage={}){return this.infrastructureRuntime?.setDamage(id,damage)||false;}
  setPhysicalRouteStatus(id,status){return this.routeEngineV1?.setStatus(id,status)||false;}

  dataCoverage() {
    if (this.mode === "SCENARIO") return { mode: "SCENARIO", realWorldCountries: 0, timeSeriesCountries: 0, objectiveMetadataCountries: 0, totalCountries: this.states.size, percent: 0, objectiveMetadataPercent: 0, sources: {} };
    return this.realWorldDataStore?.coverage(this.states.size) || { mode: "REAL_WORLD", realWorldCountries: 0, totalCountries: this.states.size, percent: 0, sources: {} };
  }

  globalSummary() {
    const states = [...this.states.values()];
    const avg = (name) => states.reduce((sum, country) => sum + country.metrics[name].current, 0) / Math.max(1, states.length);
    const shortages = states.reduce((sum, country) => sum + Object.values(country.resources).filter((resource) => resource.shortage > 0.25).length, 0);
    const realWorldCountries = states.filter((country) => ["REAL_WORLD", "REAL_WORLD_MIXED"].includes(country.dataMode)).length;
    const estimatedRealWorldCountries = states.filter((country) => country.dataMode === "REAL_WORLD_ESTIMATED").length;
    const partialRealWorldCountries = states.filter((country) => country.dataMode === "REAL_WORLD_PARTIAL").length;
    const activeContracts=this.contracts.contracts.filter(c=>c.status==="ACTIVE").length;
    const activeProjects=this.projects.projects.filter(p=>["ACTIVE","STALLED"].includes(p.status)).length;
    const activeAgreements=this.agreements.agreements.filter(a=>a.status==="ACTIVE").length;
    const activeSanctions=this.sanctions.sanctions.filter(a=>a.status==="ACTIVE").length;
    return {
      mode: this.mode,day: this.day,countries: states.length,realWorldCountries,partialRealWorldCountries,estimatedRealWorldCountries,economy: avg("economy"),stability: avg("stability"),resilience: avg("resilience"),awareness: avg("awareness"),shortages,
      flows: this.getFlows().length,flowLayer: this.getFlowLayer(),flowNetwork: this.getFlowNetworkSummary(),events: this.events.active.length,decisions: this.ledger.records.filter(r => r.kind === "COUNTRY_DECISION").length,pendingPropagation: this.propagation.queue.length,
      avgTreasury: states.reduce((sum, country) => sum + (country.policy?.budget?.treasury || 0), 0) / Math.max(1, states.length),markets:this.market.summary(),activeContracts,activeProjects,inTransitShipments:this.contracts.shipments.filter(s=>s.status==="IN_TRANSIT").length,alliances:this.blocs.alliances.length,blocs:this.blocs.blocs.length,activeAgreements,activeSanctions,worldOpinion:structuredClone(this.opinion.state),
      simulationTime:this.simTime.snapshot(),physicalFlows:this.infrastructureFlows?.summary?.()||null,physicalLogistics:this.logisticsV1?.summarize?.()||null,causalEvents:this.causalEvents.active.length,worldMemoryRecords:this.worldMemory.records.length,feedbackLoops:this.feedbackLoops.summary(),blocTransitions:this.blocs.transitions.length
    };
  }

  validate() { return [...this.states.values()].every(validateCountryState); }

  snapshot() {
    return {
      version: 5,mode: this.mode,seed: this.seed,day: this.day,coverage: this.dataCoverage(),states: [...this.states.values()].map((state) => structuredClone(state)),relations: this.relations.all().map((edge) => structuredClone(edge)),flows: this.flows?.snapshot() || null,
      simulationTime:this.simTime.snapshot(),scenario:this.scenario.descriptor(),infrastructureRuntime:this.infrastructureRuntime?.snapshot?.()||null,physicalFlows:this.infrastructureFlows?.summary?.()||null,physicalLogistics:this.logisticsV1?.summarize?.()||null,causalEvents:this.causalEvents.list(),feedbackLoops:this.feedbackLoops.summary(),worldMemory:this.worldMemory.snapshot(),
      markets:this.market.snapshot(),contracts:this.contracts.snapshot(),projects:this.projects.snapshot(),events: structuredClone(this.events.active),decisions: this.ledger.latest(1000),propagation: this.propagation.snapshot(),diplomacy:{alliances:this.blocs.getAlliances(),blocs:this.blocs.getBlocs(),blocTransitions:this.blocs.getTransitions({limit:1000}),agreements:this.agreements.list(),sanctions:this.sanctions.list(),opinion:this.opinion.snapshot()}
    };
  }
}
