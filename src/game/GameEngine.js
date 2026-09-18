import { GameClock } from "./GameClock.js";
import { WorldSimulation } from "./simulation/WorldSimulation.js";
import { GameAPI } from "./GameAPI.js";

export class GameEngine {
  constructor({ worldEngine, realWorldDataStore = null, flowDataStore = null, infrastructureGraph = null, routeEngineV1 = null, countryPhysicalProfiles = null, mode = "REAL_WORLD", seed = 1849237, startDate = null, scenarioConfig = null } = {}) {
    this.worldEngine = worldEngine;
    this.realWorldDataStore = realWorldDataStore;
    this.flowDataStore = flowDataStore;
    this.countryPhysicalProfiles = countryPhysicalProfiles;
    this.mode = mode === "SCENARIO" ? "SCENARIO" : "REAL_WORLD";
    this.seed = seed;
    const effectiveStartDate = startDate || realWorldDataStore?.getSimulationStartDate?.("2025-01-01") || "2025-01-01";
    this.clock = new GameClock({ startDate: effectiveStartDate, speed: 1, daysPerSecond: 1 });
    this.simulation = new WorldSimulation({ seed, worldEngine, realWorldDataStore, flowDataStore, infrastructureGraph, routeEngineV1, mode: this.mode, startDate: effectiveStartDate, scenarioConfig }).init();
    this.api = new GameAPI(this);
    this.lastStepCount = 0;
  }

  update(realDeltaSeconds) {
    const days = this.clock.consume(realDeltaSeconds);
    this.lastStepCount = days;
    if (days > 0) { this.simulation.step(days); this.clock.advance(days); }
    return days;
  }

  snapshot() {
    return { version: 5, mode: this.mode, seed: this.seed, clock: this.clock.snapshot(), simulation: this.simulation.snapshot() };
  }

  destroy() {
    this.simulation.states.clear();
    this.simulation.relations.edges.clear();
    this.simulation.relations.out.clear();
    this.simulation.relations.in.clear();
  }
}
