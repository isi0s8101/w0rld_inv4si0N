const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export class StateManager {
  constructor(bus) {
    this.bus = bus;
    this.state = {
      view: "BOOT",
      hoveredCountry: null,
      highlightedCountry: null,
      highlightedRegion: null,
      selectedCountry: null,
      previousCountry: null,
      selectedNode: null,
      hoveredInfrastructure: null,
      selectedInfrastructure: null,
      selectedRoute: null,
      selectedVehicle: null,
      focus: { active: false, type: null, id: null, nodeIds: [], routeIds: [], vehicleIds: [] },
      causality: { active: false, rootType: null, rootId: null, direction: "BOTH", nodes: [], edges: [], nodeIds: [], routeIds: [], eventId: null },
      timeline: { mode: "LIVE", cursorDay: 0, selectedId: null, replayId: null, replayProgress: 0 },
      search: { open: false, query: "", selectedIndex: 0 },
      mode: "ambient",
      globe: { rotationX: -0.10, rotationY: -0.30, zoom: 1 },
      world: { centerX: 0, centerY: 0, zoom: 1 },
      country: { code: null, centerX: null, centerY: null, zoom: 1 },
      network: { intensity: 0.34 },
      ui: { miniCountryMix: 0 },
      runtime: { time: 0, delta: 0, elapsed: 0 },
      transition: { active: false, type: null, progress: 0, from: null, to: null, meta: null }
    };
  }

  get() { return this.state; }

  snapshot() { return clone(this.state); }

  patch(partial, reason = "patch") {
    this.state = this.deepMerge(this.state, partial);
    this.bus.emit("state:changed", { state: this.state, reason });
    return this.state;
  }

  deepMerge(base, patch) {
    const out = { ...base };
    for (const [key, value] of Object.entries(patch || {})) {
      if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
        out[key] = this.deepMerge(base[key], value);
      } else out[key] = value;
    }
    return out;
  }

  setRuntime(clock) {
    this.state.runtime.time = clock.time;
    this.state.runtime.delta = clock.delta;
    this.state.runtime.elapsed = clock.elapsed;
  }

  setView(view) {
    if (view === this.state.view) return;
    const previous = this.state.view;
    this.state.view = view;
    this.bus.emit("view:changed", { view, previous });
  }

  setHoveredCountry(code) {
    if (code === this.state.hoveredCountry) return;
    this.state.hoveredCountry = code || null;
    this.bus.emit("country:hover", { code: this.state.hoveredCountry });
  }

  setSelectedCountry(code, previous = this.state.selectedCountry) {
    this.state.previousCountry = previous || null;
    this.state.selectedCountry = code || null;
    this.state.country.code = code || null;
  }

  setSelectedNode(id) {
    this.state.selectedNode = id || null;
    this.bus.emit("node:selected", { id: this.state.selectedNode });
  }

  setHoveredInfrastructure(id) {
    if (id === this.state.hoveredInfrastructure) return;
    this.state.hoveredInfrastructure = id || null;
    this.bus.emit("infrastructure:hover", { id: this.state.hoveredInfrastructure });
  }

  setSelectedInfrastructure(id) {
    this.state.selectedInfrastructure = id || null;
    this.bus.emit("infrastructure:selected", { id: this.state.selectedInfrastructure });
  }

  setSelectedRoute(id) {
    this.state.selectedRoute = id || null;
    this.bus.emit("route:selected", { id: this.state.selectedRoute });
  }

  setSelectedVehicle(id) {
    this.state.selectedVehicle = id || null;
    this.bus.emit("vehicle:selected", { id: this.state.selectedVehicle });
  }

  setTransition(value) {
    this.state.transition = {
      active: Boolean(value?.active),
      type: value?.type ?? null,
      progress: Math.max(0, Math.min(1, value?.progress ?? 0)),
      from: value?.from ?? null,
      to: value?.to ?? null,
      meta: value?.meta ?? null
    };
  }
}
