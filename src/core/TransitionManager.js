const ease = (t) => 1 - Math.pow(1 - t, 3);

export class TransitionManager {
  constructor(bus, stateManager, eventEngine, cameraEngine) {
    this.bus = bus;
    this.stateManager = stateManager;
    this.eventEngine = eventEngine;
    this.cameraEngine = cameraEngine;
    this.current = null;
    this.reducedMotion = false;
  }

  setReducedMotion(value) { this.reducedMotion = Boolean(value); }
  duration(normal, reduced = 0.28) { return this.reducedMotion ? reduced : normal; }

  begin(type, duration, from, to, meta = null, onFinish = null) {
    const now = this.stateManager.get().runtime.elapsed;
    this.current = { type, duration: this.duration(duration), startTime: now, from, to, meta, onFinish };
    this.stateManager.setTransition({ active: true, type, progress: 0, from, to, meta });
    this.bus.emit("transition:started", this.current);
  }

  toWorld() {
    const state = this.stateManager.get();
    if (this.current || state.view === "WORLD" || state.view === "COUNTRY") return false;
    this.cameraEngine.toWorld();
    this.stateManager.setView("TRANSITION_GLOBE_WORLD");
    this.begin("globe-world", 1.35, "GLOBE", "WORLD", null, () => {
      this.stateManager.setView("WORLD");
      this.eventEngine.emit("VIEW_CHANGED", { duration: 0.25, data: { view: "WORLD" } });
    });
    return true;
  }

  toGlobe() {
    const state = this.stateManager.get();
    if (this.current || state.view === "GLOBE") return false;
    if (state.selectedCountry) {
      const previous = state.selectedCountry;
      this.stateManager.setSelectedCountry(null, previous);
      state.ui.miniCountryMix = 0;
      this.eventEngine.emit("COUNTRY_UNSELECTED", { scope: "country", duration: 0.25, data: { country: previous } });
    }
    this.cameraEngine.toGlobe();
    this.stateManager.setView("TRANSITION_WORLD_GLOBE");
    this.begin("world-globe", 1.25, "WORLD", "GLOBE", null, () => {
      this.stateManager.setView("GLOBE");
      this.eventEngine.emit("VIEW_CHANGED", { duration: 0.25, data: { view: "GLOBE" } });
    });
    return true;
  }

  selectCountry(code) {
    if (!code || this.current?.type === "globe-world" || this.current?.type === "world-globe") return false;
    const state = this.stateManager.get();
    if (state.selectedCountry === code) return true;
    if (state.selectedCountry) return this.switchCountry(state.selectedCountry, code);
    this.stateManager.setSelectedCountry(code, null);
    this.cameraEngine.focusCountry(code);
    this.stateManager.setView("COUNTRY");
    this.begin("select-country", 0.48, "WORLD", "COUNTRY", { to: code }, () => {
      this.stateManager.get().ui.miniCountryMix = 1;
      this.eventEngine.emit("COUNTRY_SELECTED", { scope: "country", duration: 0.35, data: { country: code } });
      this.eventEngine.emit("VIEW_CHANGED", { duration: 0.25, data: { view: "COUNTRY" } });
      this.bus.emit("country:selected", { code });
    });
    return true;
  }

  clearCountry() {
    const state = this.stateManager.get();
    const code = state.selectedCountry;
    if (!code || this.current) return false;
    this.begin("clear-country", 0.42, "COUNTRY", "WORLD", { from: code }, () => {
      this.stateManager.setSelectedCountry(null, code);
      this.stateManager.get().ui.miniCountryMix = 0;
      this.stateManager.setView("WORLD");
      this.eventEngine.emit("COUNTRY_UNSELECTED", { scope: "country", duration: 0.3, data: { country: code } });
      this.eventEngine.emit("VIEW_CHANGED", { duration: 0.25, data: { view: "WORLD" } });
      this.bus.emit("country:cleared", { code });
    });
    return true;
  }

  switchCountry(from, to) {
    if (!from || !to || from === to || this.current) return false;
    this.stateManager.setSelectedCountry(to, from);
    this.cameraEngine.focusCountry(to);
    this.begin("switch-country", 0.58, "COUNTRY", "COUNTRY", { from, to }, () => {
      this.stateManager.get().previousCountry = null;
      this.eventEngine.emit("COUNTRY_SELECTED", { scope: "country", duration: 0.3, data: { country: to } });
      this.bus.emit("country:selected", { code: to, previous: from });
    });
    return true;
  }

  update() {
    if (!this.current) return;
    const now = this.stateManager.get().runtime.elapsed;
    const raw = Math.max(0, Math.min(1, (now - this.current.startTime) / this.current.duration));
    const progress = ease(raw);
    this.stateManager.setTransition({
      active: true, type: this.current.type, progress,
      from: this.current.from, to: this.current.to, meta: this.current.meta
    });
    if (this.current.type === "select-country") this.stateManager.get().ui.miniCountryMix = progress;
    if (this.current.type === "clear-country") this.stateManager.get().ui.miniCountryMix = 1 - progress;
    if (raw >= 1) {
      const finished = this.current;
      this.current = null;
      this.stateManager.setTransition({ active: false, type: null, progress: 0 });
      finished.onFinish?.();
      this.bus.emit("transition:completed", finished);
    }
  }
}
