const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const percent = (value) => `${Math.round(clamp(value))}%`;
const number = (value) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);

const VIEW_COPY = {
  GLOBE: { kicker: "ORBITAL OBSERVATION", title: "EARTH / GLOBAL MODEL", meta: "REAL WORLD BASELINE · LIVE SIMULATION", objective: "MAP THE GLOBAL NETWORK" },
  WORLD: { kicker: "GLOBAL SURFACE INTELLIGENCE", title: "EARTH / WORLD MAP", meta: "COUNTRIES · NETWORKS · STRATEGIC FLOWS", objective: "SELECT A TERRITORY" },
  COUNTRY: { kicker: "TERRITORY INTELLIGENCE", title: "SELECTED TERRITORY", meta: "LOCAL NETWORK · ECONOMY · DIPLOMACY", objective: "ANALYZE THE TERRITORY" }
};

export class GameShell {
  constructor({ app }) {
    this.app = app; this.root = $("#wi-shell"); this.lastView = null; this.lastCountry = null;
    this.bind();
    this.unsub = [app.bus.on("view:changed", () => this.update(true)), app.bus.on("country:selected", () => this.update(true)), app.bus.on("country:cleared", () => this.update(true)), app.bus.on("node:selected", () => this.update(true)), app.bus.on("infrastructure:selected", () => this.update(true)), app.bus.on("route:selected", () => this.update(true)), app.bus.on("vehicle:selected", () => this.update(true)), app.bus.on("focus:changed", () => this.update(true))];
    this.timer = setInterval(() => this.update(false), 350); this.update(true);
  }

  bind() {
    $$('[data-wi-view]', this.root).forEach((button) => button.addEventListener("click", () => {
      const view = button.dataset.wiView;
      if (view === "GLOBE") this.app.api.toGlobe();
      if (view === "WORLD") { const state = this.app.state.get(); if (state.selectedCountry) this.app.api.clearCountry(); else this.app.api.toWorld(); }
      if (view === "COUNTRY") this.app.api.selectCountry(this.app.state.get().selectedCountry || "FR");
    }));
    $$('[data-wi-speed]', this.root).forEach((button) => button.addEventListener("click", () => { const speed = Number(button.dataset.wiSpeed); this.app.game.api.setSpeed(speed); this.setPressed("[data-wi-speed]", button); this.toast(speed === 0 ? "SIMULATION PAUSED" : `SIMULATION SPEED ×${speed}`); }));
    $$('[data-wi-layer]', this.root).forEach((button) => button.addEventListener("click", () => { const layer = button.dataset.wiLayer; if (!this.app.game.api.setFlowLayer(layer)) return; this.setPressed("[data-wi-layer]", button); this.toast(`${layer} LAYER ACTIVE`); }));
    $$('[data-wi-infra-layer]', this.root).forEach((button) => button.addEventListener("click", () => {
      const layer = button.dataset.wiInfraLayer; const enabled = !button.classList.contains("is-active");
      if (!this.app.api.toggleInfrastructureLayer(layer, enabled)) return;
      button.classList.toggle("is-active", enabled); button.setAttribute("aria-pressed", String(enabled));
      this.toast(`${layer} ${enabled ? "ENABLED" : "HIDDEN"}`);
    }));
    $$('[data-wi-preset]', this.root).forEach((button) => button.addEventListener("click", () => {
      const preset=button.dataset.wiPreset;if(!this.app.api.applyLayerPreset(preset))return;
      $$('[data-wi-preset]',this.root).forEach(b=>b.classList.toggle('is-active',b===button));this.toast(`${preset} PRESET ACTIVE`);this.update(true);
    }));
    $('[data-wi-auto-layers]',this.root)?.addEventListener('click',(event)=>{const button=event.currentTarget;const next=!this.app.layerManagerV1.autoMode;this.app.api.setAutoLayers(next);button.classList.toggle('is-active',next);button.setAttribute('aria-pressed',String(next));button.querySelector('b').textContent=next?'ON':'OFF';this.toast(`AUTO LAYERS ${next?'ON':'OFF'}`);});
    $$('[data-wi-map]',this.root).forEach((button)=>button.addEventListener('click',()=>{
      const action=button.dataset.wiMap,state=this.app.state.get();if(!(state.view==='WORLD'||state.view==='COUNTRY'))return;
      const vp=this.app.mapCamera?.viewport();
      if(action==='back')this.app.api.back(); else if(action==='forward')this.app.api.forward(); else if(action==='zoom-in'&&vp)this.app.mapCamera.zoomAt(vp.x+vp.width/2,vp.y+vp.height/2,1.35); else if(action==='zoom-out'&&vp)this.app.mapCamera.zoomAt(vp.x+vp.width/2,vp.y+vp.height/2,.74); else if(action==='fit')this.app.api.fitSelection(); else if(action==='focus')this.app.api.focusSelection(); else if(action==='follow')this.app.api.followSelection(); else if(action==='reset')this.app.api.resetMap();
      this.update(true);
    }));
    $$('[data-wi-action]', this.root).forEach((button) => button.addEventListener("click", () => { this.setPressed("[data-wi-action]", button); this.app.api.setMode(button.dataset.wiAction === "analyze" ? "analysis" : "ambient"); this.toast(`${button.dataset.wiAction.toUpperCase()} MODE ACTIVE`); }));
    $("#wi-primary-action", this.root).addEventListener("click", () => { const state = this.app.state.get(); if (state.selectedInfrastructure || state.selectedRoute || state.selectedVehicle) this.app.api.clearSelection(); else if (state.selectedCountry) this.app.api.clearCountry(); else if (state.view === "GLOBE" || state.view.startsWith("TRANSITION")) this.app.api.toWorld(); else this.app.api.selectCountry("FR"); });
  }

  setPressed(selector, active) { $$(selector, this.root).forEach((button) => { const selected = button === active; button.classList.toggle("is-active", selected); button.setAttribute("aria-pressed", String(selected)); }); }
  currentView(state) { if (state.selectedCountry || state.view === "COUNTRY") return "COUNTRY"; if (state.view === "WORLD" || state.view.includes("WORLD")) return "WORLD"; return "GLOBE"; }

  update(force) {
    const state = this.app.state.get(), view = this.currentView(state), countryCode = state.selectedCountry;
    const clock = this.app.game.api.getClock(), global = this.app.game.api.getGlobal(), date = new Date(`${clock.date}T00:00:00Z`);
    const year = Math.max(1, date.getUTCFullYear() - 2047), start = Date.UTC(date.getUTCFullYear(), 0, 0), day = Math.floor((date.getTime() - start) / 86400000);
    $("#wi-year").textContent = `YEAR ${String(year).padStart(2, "0")}`; $("#wi-day").textContent = `DAY ${String(day).padStart(3, "0")}`; $("#wi-awareness").textContent = percent(global.awareness); $("#wi-mode").textContent = String(global.mode || "REAL_WORLD").replaceAll("_", " ");
    $$('[data-wi-speed]', this.root).forEach((button) => { const active = Number(button.dataset.wiSpeed) === clock.speed; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    $$('[data-wi-infra-layer]', this.root).forEach((button) => { const active = this.app.layerManagerV1?.isEnabled(button.dataset.wiInfraLayer) ?? false; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    this.root.dataset.view=view;
    $$(`[data-wi-preset]`,this.root).forEach(button=>button.classList.toggle("is-active",button.dataset.wiPreset===this.app.layerManagerV1?.activePreset));
    const autoButton=$("[data-wi-auto-layers]",this.root);if(autoButton){autoButton.classList.toggle("is-active",this.app.layerManagerV1?.autoMode!==false);autoButton.querySelector("b").textContent=this.app.layerManagerV1?.autoMode!==false?"ON":"OFF";}
    if (force || view !== this.lastView || countryCode !== this.lastCountry || state.selectedInfrastructure || state.selectedRoute || state.selectedVehicle) { this.lastView = view; this.lastCountry = countryCode; this.renderView(view, state, global); }
    else if (view !== "COUNTRY") this.renderMetrics(view, state, global);
  }

  renderView(view, state, global) {
    const copy = VIEW_COPY[view]; $("#wi-scene-kicker").textContent = copy.kicker;
    $("#wi-scene-title").textContent = view === "COUNTRY" && state.selectedCountry ? `${this.app.worldEngine.getCountry(state.selectedCountry)?.name || state.selectedCountry} / TERRITORY` : copy.title;
    $("#wi-scene-meta").textContent = copy.meta; $("#wi-objective").textContent = copy.objective;
    $$('[data-wi-view]', this.root).forEach((button) => button.classList.toggle("is-active", button.dataset.wiView === view)); this.renderMetrics(view, state, global);
  }

  renderMetrics(view, state, global) {
    const type = $("#wi-context-type"), status = $("#wi-context-state"), icon = $("#wi-context-icon"), title = $("#wi-context-title"), subtitle = $("#wi-context-subtitle"), data = $("#wi-context-data"), action = $("#wi-primary-action");
    if (state.selectedVehicle) {
      const vehicle=this.app.trafficLogistics?.get(state.selectedVehicle);
      if(vehicle){const route=this.app.routeEngineV1?.get(vehicle.routeId);type.textContent=`TRAFFIC / ${vehicle.type}`;status.textContent=vehicle.state||vehicle.status||"MOVING";icon.textContent=vehicle.type.slice(0,4);title.textContent=vehicle.name.toUpperCase();subtitle.textContent=`${vehicle.cargo||"CARGO"} · AGGREGATED FLOW`;data.innerHTML=this.rows([["ORIGIN",vehicle.origin],["DESTINATION",vehicle.destination],["CARGO",String(vehicle.cargo||"—").toUpperCase()],["QUANTITY",number(vehicle.quantity)],["AGGREGATED",number(vehicle.aggregatedTransports||1)],["PROGRESS",percent((vehicle.progress||0)*100)],["SPEED",`${Math.round(vehicle.speedKph||0)} km/h`],["ROUTE",route?.status||"—"]]);action.innerHTML="<span>CLOSE VEHICLE</span><small>MAP</small>";return;}
    }
    if (state.selectedRoute) {
      const route=this.app.routeEngineV1?.get(state.selectedRoute);
      if(route){type.textContent=`ROUTE / ${route.type}`;status.textContent=route.status;icon.textContent=route.type.slice(0,4);title.textContent=route.id.toUpperCase();subtitle.textContent=`${route.from} → ${route.to}`;data.innerHTML=this.rows([["DISTANCE",`${Math.round(route.distanceKm||0)} km`],["TRAVEL TIME",`${Math.round(route.travelTimeHours||0)} h`],["CAPACITY",number(route.maxCapacity||route.capacity)],["USAGE",number(route.currentUsage||0)],["AVAILABLE",number(route.availableCapacity||0)],["CONGESTION",percent((route.congestionRuntime??route.congestion??0)*100)],["RISK",percent((route.risk||0)*100)]]);action.innerHTML="<span>CLOSE ROUTE</span><small>MAP</small>";return;}
    }
    if (state.selectedInfrastructure) {
      const node = this.app.infrastructureGraph?.get(state.selectedInfrastructure);
      if (node) {
        type.textContent = `${node.category} / ${node.type}`; status.textContent = node.status; icon.textContent = node.type.slice(0, 4); title.textContent = node.name.toUpperCase(); subtitle.textContent = `${node.country} · ${node.dataMode}`;
        const runtime=this.app.game.api.getInfrastructureRuntime?.(node.id);
        const damage=runtime?Math.max(...Object.values(runtime.damage||{}))*100:0;
        data.innerHTML = this.rows([["CAPACITY", percent(node.capacity)],["EFFECTIVE", percent(runtime?.effectiveCapacity ?? node.capacity)],["HEALTH", percent(node.health)],["DAMAGE", percent(damage)],["STRATEGIC VALUE", percent(node.strategicValue * 100)],["CONNECTIONS", number(node.connections.length)],["DEPENDENCIES", number(node.dependencies.length)]]);
        action.innerHTML = "<span>CLOSE OBJECT</span><small>MAP</small>"; return;
      }
    }
    if (view === "COUNTRY" && state.selectedCountry) {
      const country = this.app.game.api.getCountry(state.selectedCountry); if (!country) return;
      type.textContent = "SELECTED TERRITORY"; status.textContent = "MAPPED"; icon.textContent = country.code; title.textContent = country.name.toUpperCase(); subtitle.textContent = `${country.continent.toUpperCase()} · ${country.dataMode.replaceAll("_", " ")}`;
      const d=this.app.game.api.getDerivedIndicators?.(country.code);const objective=this.app.game.api.getStrategicObjectives?.(country.code);
      data.innerHTML = this.rows([["POPULATION", number(country.populationCount)],["ECONOMY", percent(country.metrics.economy.current)],["ENERGY SECURITY", percent(d?.energySecurity ?? country.metrics.energy.current)],["LOGISTICS", percent(d?.logisticsCapacity ?? country.metrics.infrastructure.current)],["INDUSTRY", percent(d?.industrialCapacity ?? country.metrics.infrastructure.current)],["DIGITAL", percent(d?.digitalConnectivity ?? country.metrics.technology.current)],["AI OBJECTIVE", objective?.primary || "BALANCED"],["AWARENESS", percent(country.metrics.awareness.current), "warn"]]);
      action.innerHTML = "<span>RETURN TO WORLD</span><small>LEVEL 02</small>"; return;
    }
    if (view === "WORLD") {
      type.textContent = "GLOBAL NETWORK"; status.textContent = "LIVE"; icon.textContent = "MAP"; title.textContent = "WORLD SYSTEM"; subtitle.textContent = `${global.countries} COUNTRIES · ${global.flowLayer} LAYER`;
      data.innerHTML = this.rows([["GLOBAL FLOWS", number(global.flows)],["PHYSICAL FLOWS", number(global.physicalFlows?.active || 0)],["BOTTLENECKS", number(global.physicalLogistics?.bottlenecks?.length || 0)],["ALLIANCES", number(global.alliances)],["CAUSAL EVENTS", number(global.causalEvents || 0)],["AWARENESS", percent(global.awareness), "warn"]]);
      action.innerHTML = "<span>OPEN FRANCE</span><small>LEVEL 03</small>"; return;
    }
    type.textContent = "WORLD OBJECT"; status.textContent = "TRACKING"; icon.textContent = "EARTH"; title.textContent = "PLANETARY MODEL"; subtitle.textContent = "V1.2 INTERACTIVE MAP + TRAFFIC";
    data.innerHTML = this.rows([["COUNTRIES", number(global.countries)],["GLOBAL FLOWS", number(global.flows)],["ACTIVE EVENTS", number(global.events)],["ECONOMY", percent(global.economy)],["AWARENESS", percent(global.awareness), "warn"]]);
    action.innerHTML = "<span>DEPLOY WORLD MAP</span><small>LEVEL 02</small>";
  }

  rows(entries) { return entries.map(([key, value, cls = ""]) => `<div class="wi-data-row ${cls}"><span>${key}</span><b>${value}</b></div>`).join(""); }
  toast(message) { const toast = $("#wi-toast"); toast.textContent = message; toast.classList.add("is-visible"); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800); }
  destroy() { clearInterval(this.timer); clearTimeout(this.toastTimer); this.unsub?.forEach((unsubscribe) => unsubscribe()); }
}
