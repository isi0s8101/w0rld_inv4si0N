function formatInteger(value) {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function formatPopulation(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2).replace(".", ",")} Md`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 100_000_000 ? 0 : 1).replace(".", ",")} M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} k`;
  return formatInteger(value);
}

function activityLabel(score) {
  if (score >= 0.78) return "HIGH";
  if (score >= 0.52) return "ELEVATED";
  if (score >= 0.25) return "NOMINAL";
  return "LOW";
}

export class FocusPanel {
  constructor({ root, worldEngine, nodeNetwork, trafficEngine, eventEngine, gameEngine = null }) {
    this.root = root;
    this.worldEngine = worldEngine;
    this.nodeNetwork = nodeNetwork;
    this.trafficEngine = trafficEngine;
    this.eventEngine = eventEngine;
    this.gameEngine = gameEngine;
    this.title = root?.querySelector("[data-focus-title]") || null;
    this.mode = root?.querySelector("[data-focus-mode]") || null;
    this.rows = root?.querySelector("[data-focus-rows]") || null;
    this.source = root?.querySelector("[data-focus-source]") || null;
    this.lastSignature = "";
  }

  countryMetrics(code, state) {
    const nodes = this.nodeNetwork.getNodesForLOD(2, code);
    const activeNodes = nodes.filter((node) => node.state !== "idle").length;
    const routes = this.trafficEngine.getActive({ country: code });
    const events = this.eventEngine.events().filter((event) => {
      if (event.data?.country === code) return true;
      const nodeId = event.data?.nodeId;
      const node = nodeId ? this.nodeNetwork.get(nodeId) : null;
      return node?.location?.country === code;
    });
    const score = Math.min(1, state.network.intensity * 0.55 + Math.min(1, activeNodes / Math.max(1, nodes.length)) * 0.25 + Math.min(1, routes.length / 4) * 0.20);
    return { nodes, activeNodes, routes, events, score };
  }

  gameCountryRows(code) {
    const game = this.gameEngine?.simulation?.getCountry(code);
    if (!game) return null;
    const stock = (type) => {
      const resource = game.resources[type];
      const days = resource.stock / Math.max(0.01, resource.consumption);
      return `${Math.round(days)}d · ${Math.round(resource.priceIndex)} idx`;
    };
    const formatCompact = (value) => {
      if (!Number.isFinite(value)) return "—";
      return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 2 }).format(value);
    };
    const tag = (field) => {
      const cls = game.provenance?.fields?.[field]?.dataClass || "SIM";
      if (String(cls).startsWith("REAL")) return "REAL";
      if (cls === "SPECIAL") return "SPECIAL";
      return "EST";
    };
    const rows = [["ISO", code]];
    const pop = game.realWorld?.population?.value;
    const gdp = game.realWorld?.gdpCurrentUsd?.value;
    if (Number.isFinite(pop)) rows.push([`POP · ${tag("population")}`, formatCompact(pop)]);
    if (Number.isFinite(gdp)) rows.push([`GDP · ${tag("gdpCurrentUsd")}`, `$${formatCompact(gdp)}`]);
    rows.push([`ECONOMY · ${String(game.metrics.economy.dataClass).includes("ESTIMATED") ? "DERIVED/EST" : "DERIVED"}`, game.metrics.economy.current.toFixed(1)]);
    rows.push(["STABILITY · SIM", `${game.metrics.stability.current.toFixed(1)} ${game.metrics.stability.trend >= 0 ? "↑" : "↓"}`]);
    rows.push(["ENERGY STOCK · SIM", stock("energy")]);
    rows.push(["FOOD STOCK · SIM", stock("food")]);
    const derived=this.gameEngine.simulation.getDerivedIndicators?.(code);
    if(derived){
      rows.push(["ENERGY SECURITY · DERIVED", `${derived.energySecurity.toFixed(1)}%`]);
      rows.push(["LOGISTICS · DERIVED", `${derived.logisticsCapacity.toFixed(1)}%`]);
      rows.push(["INDUSTRIAL · DERIVED", `${derived.industrialCapacity.toFixed(1)}%`]);
      rows.push(["DIGITAL · DERIVED", `${derived.digitalConnectivity.toFixed(1)}%`]);
    }
    const layer=this.gameEngine.simulation.getFlowLayer();
    const flowCount=this.gameEngine.simulation.getVisualFlows({ view:"COUNTRY", country:code, layer }).length;
    rows.push(["FLOW LAYER", layer]);
    rows.push(["VISIBLE FLOWS", String(flowCount)]);
    rows.push(["RESILIENCE · SIM", game.metrics.resilience.current.toFixed(1)]);
    rows.push(["RESISTANCE · SIM", game.metrics.resistancePotential.current.toFixed(1)]);
    rows.push(["POLICY · AI", game.policy?.strategy || "BALANCED"]);
    rows.push(["TREASURY · SIM", (game.policy?.budget?.treasury ?? 0).toFixed(1)]);
    const contracts=this.gameEngine.simulation.getContracts?.({country:code,status:"ACTIVE"}) || [];
    const projects=this.gameEngine.simulation.getProjects?.({country:code}) || [];
    rows.push(["CONTRACTS · SIM", String(contracts.length)]);
    rows.push(["PROJECTS · SIM", `${projects.filter(p=>["ACTIVE","STALLED"].includes(p.status)).length} active`]);
    const fp=this.gameEngine.simulation.getForeignPolicy?.(code);
    const spec=this.gameEngine.simulation.getSpecialization?.(code);
    const dep=this.gameEngine.simulation.getDependencies?.(code);
    const bloc=this.gameEngine.simulation.getBlocFor?.(code);
    const membership=this.gameEngine.simulation.getBlocMembership?.(code);
    rows.push(["FOREIGN POLICY · SIM", fp?.doctrine || "BALANCED"]);
    rows.push(["SPECIALIZATION · DERIVED", spec?.primary || "—"]);
    rows.push(["DEPENDENCY · DERIVED", `${Math.round((dep?.overall||0)*100)}%`]);
    rows.push(["BLOC · SIM", bloc?.name || membership?.blocId || "UNALIGNED"]);
    rows.push(["BLOC STATUS · SIM", membership?.status || "UNALIGNED"]);
    const agreements=this.gameEngine.simulation.getAgreements?.({country:code,status:"ACTIVE"}) || [];
    const sanctions=this.gameEngine.simulation.getSanctions?.({country:code,status:"ACTIVE"}) || [];
    rows.push(["AGREEMENTS · SIM", String(agreements.length)]);
    rows.push(["SANCTIONS · SIM", String(sanctions.length)]);
    rows.push(["PUBLIC CONFIDENCE · SIM", `${(game.publicOpinion?.confidence ?? 0).toFixed(1)}`]);
    rows.push(["AWARENESS · SIM", `${game.metrics.awareness.current.toFixed(1)}`]);
    const objective=this.gameEngine.simulation.getStrategicObjectives?.(code);
    if(objective) rows.push(["AI OBJECTIVE · SIM", objective.primary]);
    const intel=this.gameEngine.simulation.getIntelligence?.(code) || [];
    if(Array.isArray(intel)) rows.push(["INTEL CONFIRMED · SIM", String(intel.filter(x=>x.level==="CONFIRMED").length)]);
    const influence=this.gameEngine.simulation.getInfluence?.(code);
    if(influence) rows.push(["INFLUENCE · DERIVED", influence.value.toFixed(1)]);
    const feedback=this.gameEngine.simulation.getFeedbackLoops?.(code);
    if(feedback?.loops?.length){
      const pos=feedback.loops.filter(x=>x.polarity==="POSITIVE").length,neg=feedback.loops.length-pos;
      rows.push(["FEEDBACK LOOPS · SIM", `+${pos} / -${neg}`]);
    }
    const timeline=this.gameEngine.simulation.getTimeline?.({country:code,limit:1}) || [];
    if(timeline.length)rows.push(["LAST WORLD EVENT", `${timeline[0].date} · ${timeline[0].type||timeline[0].kind}`]);
    const decisions=this.gameEngine.simulation.getCountryDecisions?.(code,1) || [];
    if(decisions.length) rows.push(["LAST DECISION", decisions.at(-1).type || "—"]);
    return rows.slice(0, 36);
  }

  gameGlobalRows() {
    const summary = this.gameEngine?.simulation?.globalSummary();
    const coverage = this.gameEngine?.simulation?.dataCoverage();
    if (!summary) return null;
    const flowNet=this.gameEngine?.simulation?.getFlowNetworkSummary?.() || {};
    return [
      ["SCOPE", "GLOBAL"],
      ["MODE", summary.mode],
      ["DATE · SIM", this.gameEngine.clock.date()],
      ["COUNTRIES", String(summary.countries)],
      ["BASELINE", `${coverage?.completeBaselineCountries || coverage?.timeSeriesCountries || 0}/${coverage?.totalCountries || summary.countries}`],
      ["REAL FIELDS", String(coverage?.fieldClassCounts?.real || 0)],
      ["EST FIELDS", String(coverage?.fieldClassCounts?.estimated || 0)],
      ["AVG ECONOMY", summary.economy.toFixed(1)],
      ["SHORTAGES", String(summary.shortages)],
      ["FLOW LAYER", summary.flowLayer || "GLOBAL"],
      ["FLOWS", String(summary.flows)],
      ["CORRIDORS", String(flowNet.corridors || 0)],
      ["CONGESTED", String(flowNet.congested || 0)],
      ["ENERGY MARKET", `${(summary.markets?.energy?.priceIndex || 100).toFixed(0)} idx`],
      ["FOOD MARKET", `${(summary.markets?.food?.priceIndex || 100).toFixed(0)} idx`],
      ["CONTRACTS", String(summary.activeContracts || 0)],
      ["INFRA PROJECTS", String(summary.activeProjects || 0)],
      ["AI DECISIONS", String(summary.decisions || 0)],
      ["WORLD EVENTS", String(summary.events || 0)],
      ["ALLIANCES · SIM", String(summary.alliances || 0)],
      ["BLOCS · SIM", String(summary.blocs || 0)],
      ["BLOC TRANSITIONS · SIM", String(summary.blocTransitions || 0)],
      ["AGREEMENTS · SIM", String(summary.activeAgreements || 0)],
      ["SANCTIONS · SIM", String(summary.activeSanctions || 0)],
      ["WORLD AWARENESS · SIM", `${(summary.worldOpinion?.awareness || 0).toFixed(1)}`],
      ["PHYSICAL FLOWS · SIM", String(summary.physicalFlows?.active || 0)],
      ["BOTTLENECKS · SIM", String(summary.physicalLogistics?.bottlenecks?.length || 0)],
      ["CAUSAL EVENTS · SIM", String(summary.causalEvents || 0)],
      ["FEEDBACK LOOPS · SIM", `${summary.feedbackLoops?.positive || 0}+ / ${summary.feedbackLoops?.negative || 0}-`],
      ["WORLD MEMORY · SIM", String(summary.worldMemoryRecords || 0)],
      ["SIM TICK · HOUR", String(summary.simulationTime?.hour || 0)],
      ["PENDING RIPPLE", String(summary.pendingPropagation || 0)]
    ];
  }

  globalRows(state) {
    const allNodes = this.nodeNetwork.getNodesForLOD(2);
    const activeNodes = allNodes.filter((node) => node.state !== "idle").length;
    const flowNet=this.gameEngine?.simulation?.getFlowNetworkSummary?.() || {};
    return [
      ["SCOPE", "GLOBAL"],
      ["COUNTRIES", String(this.worldEngine.listCountries().length)],
      ["NODES", `${activeNodes}/${allNodes.length} active`],
      ["ROUTES", `${this.trafficEngine.getActive().length} active`],
      ["EVENTS", String(this.eventEngine.events().length)],
      ["NETWORK", `${Math.round(state.network.intensity * 100)}%`]
    ];
  }

  countryRows(code, state) {
    const meta = this.worldEngine.getCountryMeta(code);
    const feature = this.worldEngine.getCountry(code);
    const metrics = this.countryMetrics(code, state);
    const center = meta?.center || feature?.properties?.center;
    const rows = [];
    rows.push(["ISO", code]);
    if (meta?.capital) rows.push(["CAPITAL", meta.capital]);
    rows.push(["REGION", meta?.subregion || meta?.region || feature?.properties?.continent || "—"]);
    if (Number.isFinite(meta?.population)) rows.push(["POP. SNAPSHOT", formatPopulation(meta.population)]);
    if (Number.isFinite(meta?.areaKm2)) rows.push(["AREA", `${formatInteger(meta.areaKm2)} km²`]);
    const zones = meta?.ianaTimezones?.length ? meta.ianaTimezones : meta?.timezones || [];
    if (zones.length) rows.push(["TZ", zones.length > 2 ? `${zones[0]} +${zones.length - 1}` : zones.join(" / ")]);
    if (center?.length === 2) rows.push(["CENTER", `${Math.abs(center[1]).toFixed(1)}°${center[1] >= 0 ? "N" : "S"} · ${Math.abs(center[0]).toFixed(1)}°${center[0] >= 0 ? "E" : "W"}`]);
    rows.push(["ENGINE", `${metrics.activeNodes}/${metrics.nodes.length} nodes · ${metrics.routes.length} routes`]);
    rows.push(["ACTIVITY", activityLabel(metrics.score)]);
    return rows.slice(0, 8);
  }

  renderRows(rows) {
    if (!this.rows) return;
    this.rows.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement("div");
      row.className = "cyber-focus-row";
      row.dataset.key = label;
      if (label === "ENGINE" || label === "NETWORK" || label === "ACTIVITY" || label === "ROUTES" || label === "EVENTS") row.classList.add("is-engine");
      if (label === "ACTIVITY") row.classList.add(`is-activity-${String(value).toLowerCase()}`);
      const key = document.createElement("span");
      key.className = "cyber-focus-key";
      key.textContent = label;
      const val = document.createElement("span");
      val.className = "cyber-focus-value";
      val.textContent = value;
      row.append(key, val);
      return row;
    }));
  }

  update(state) {
    if (!this.root) return;
    const focusCode = state.selectedCountry || (state.view === "WORLD" ? state.hoveredCountry : null);
    const meta = focusCode ? this.worldEngine.getCountryMeta(focusCode) : null;
    const feature = focusCode ? this.worldEngine.getCountry(focusCode) : null;
    const title = focusCode ? (meta?.name || feature?.properties?.name || focusCode) : "Global Network";
    const mode = state.view === "COUNTRY" ? "COUNTRY" : state.view === "WORLD" ? "WORLD" : "GLOBE";
    const rows = this.gameEngine
      ? (focusCode ? this.gameCountryRows(focusCode) : this.gameGlobalRows())
      : (focusCode ? this.countryRows(focusCode, state) : this.globalRows(state));
    const signature = JSON.stringify([title, mode, rows]);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    if (this.title) this.title.textContent = title;
    if (this.mode) this.mode.textContent = mode;
    this.renderRows(rows);
    if (this.source) this.source.textContent = this.gameEngine
      ? "DATA · REAL / EST / DERIVED | LOGISTICS + ECONOMY + AI + DIPLOMACY · SIM"
      : (focusCode && meta?.source?.startsWith("CountryInfo") ? "GEO DATA · LOCAL SNAPSHOT | ENGINE · SIM" : "GEO DATA · BASELINE | ENGINE · SIM");
    this.root.classList.remove("is-refreshing");
    void this.root.offsetWidth;
    this.root.classList.add("is-refreshing");
  }

  destroy() {
    this.lastSignature = "";
  }
}
