export class GameAPI {
  constructor(engine) { this.engine = engine; }
  pause() { this.engine.clock.pause(); return this; }
  play() { this.engine.clock.play(); return this; }
  setSpeed(speed) { return this.engine.clock.setSpeed(speed); }
  step(days = 1) { this.engine.simulation.step(days); this.engine.clock.advance(days); return this; }
  stepHours(hours = 1) { this.engine.simulation.stepHours(hours); const days=Math.floor(Math.max(0,Number(hours)||0)/24); if(days)this.engine.clock.advance(days); return this; }
  getMode() { return this.engine.mode; }
  getClock() { return this.engine.clock.snapshot(); }
  getCountry(code) { return structuredClone(this.engine.simulation.getCountry(code)); }
  getCountryProvenance(code) { return this.engine.simulation.getCountryProvenance(code); }
  getCountryPhysicalProfile(code) { return structuredClone(this.engine.countryPhysicalProfiles?.get(code) || null); }
  getCountryPhysicalProfiles() { return structuredClone(this.engine.countryPhysicalProfiles?.list() || []); }
  getCountryPolicy(code) { return this.engine.simulation.getCountryPolicy(code); }
  getCountryDecisions(code, limit = 50) { return structuredClone(this.engine.simulation.getCountryDecisions(code, limit)); }
  getDecisions(filter = {}) { return structuredClone(this.engine.simulation.getDecisions(filter)); }
  getActiveWorldEvents() { return this.engine.simulation.getActiveWorldEvents(); }
  getPendingPropagation(code = null) { return this.engine.simulation.getPendingPropagation(code); }
  getMarket(resource = null) { return structuredClone(this.engine.simulation.getMarket(resource)); }
  getContracts(filter = {}) { return structuredClone(this.engine.simulation.getContracts(filter)); }
  getProjects(filter = {}) { return structuredClone(this.engine.simulation.getProjects(filter)); }
  getDiplomacy(code) { return structuredClone(this.engine.simulation.getDiplomacy(code)); }
  getAlliances(code = null) { return structuredClone(this.engine.simulation.getAlliances(code)); }
  getBlocs() { return structuredClone(this.engine.simulation.getBlocs()); }
  getBlocMembership(code) { return structuredClone(this.engine.simulation.getBlocMembership(code)); }
  getBlocTransitions(filter = {}) { return structuredClone(this.engine.simulation.getBlocTransitions(filter)); }
  getBlocFor(code) { return structuredClone(this.engine.simulation.getBlocFor(code)); }
  getAgreements(filter = {}) { return structuredClone(this.engine.simulation.getAgreements(filter)); }
  getSanctions(filter = {}) { return structuredClone(this.engine.simulation.getSanctions(filter)); }
  getDependencies(code) { return structuredClone(this.engine.simulation.getDependencies(code)); }
  getSpecialization(code) { return structuredClone(this.engine.simulation.getSpecialization(code)); }
  getForeignPolicy(code) { return structuredClone(this.engine.simulation.getForeignPolicy(code)); }
  getWorldOpinion() { return structuredClone(this.engine.simulation.getWorldOpinion()); }
  getSimulationTime() { return structuredClone(this.engine.simulation.getSimulationTime()); }
  getInfrastructureRuntime(id = null) { return structuredClone(this.engine.simulation.getInfrastructureRuntime(id)); }
  getInfrastructureFlows(filter = {}) { return structuredClone(this.engine.simulation.getInfrastructureFlows(filter)); }
  getPhysicalLogistics() { return structuredClone(this.engine.simulation.getPhysicalLogistics()); }
  getDerivedIndicators(code) { return structuredClone(this.engine.simulation.getDerivedIndicators(code)); }
  getMilitaryLogistics(code) { return structuredClone(this.engine.simulation.getMilitaryLogistics(code)); }
  getIntelligence(observer, target = null) { return structuredClone(this.engine.simulation.getIntelligence(observer, target)); }
  getObservedCountry(observer, target) { return structuredClone(this.engine.simulation.getObservedCountry(observer, target)); }
  getStability(code) { return structuredClone(this.engine.simulation.getStability(code)); }
  getInfluence(code) { return structuredClone(this.engine.simulation.getInfluence(code)); }
  getStrategicObjectives(code) { return structuredClone(this.engine.simulation.getStrategicObjectives(code)); }
  getTimeline(filter = {}) { return structuredClone(this.engine.simulation.getTimeline(filter)); }
  getCausalEvents(filter = {}) { return structuredClone(this.engine.simulation.getCausalEvents(filter)); }
  getFeedbackLoops(code) { return structuredClone(this.engine.simulation.getFeedbackLoops(code)); }
  getFeedbackSummary() { return structuredClone(this.engine.simulation.getFeedbackSummary()); }
  getScenario() { return structuredClone(this.engine.simulation.getScenario()); }
  configureScenario(config = {}) { return structuredClone(this.engine.simulation.configureScenario(config)); }
  recordScenarioDecision(entry = {}) { return structuredClone(this.engine.simulation.recordScenarioDecision(entry)); }
  setInfrastructureDamage(id, damage = {}) { return this.engine.simulation.setInfrastructureDamage(id, damage); }
  setPhysicalRouteStatus(id, status) { return this.engine.simulation.setPhysicalRouteStatus(id, status); }
  getRelations(code) { return structuredClone(this.engine.simulation.getRelations(code)); }
  getFlows(filter = {}) { return structuredClone(this.engine.simulation.getFlows(filter)); }
  getVisualFlows(options = {}) { return structuredClone(this.engine.simulation.getVisualFlows(options)); }
  setFlowLayer(layer) { return this.engine.simulation.setFlowLayer(layer); }
  setDataFlowMode(mode) { return this.engine.simulation.setDataFlowMode(mode); }
  getFlowLayer() { return this.engine.simulation.getFlowLayer(); }
  getFlowNetworkSummary() { return structuredClone(this.engine.simulation.getFlowNetworkSummary()); }
  getFlowCoverage() { return structuredClone(this.engine.simulation.getFlowCoverage()); }
  setFlowCorridorState(id, state = {}) { return this.engine.simulation.setFlowCorridorState(id, state); }
  getGlobal() { return structuredClone(this.engine.simulation.globalSummary()); }
  getDataCoverage() { return structuredClone(this.engine.simulation.dataCoverage()); }
  snapshot() { return this.engine.snapshot(); }
}
