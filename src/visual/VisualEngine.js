import { ParticleRenderer } from "./ParticleRenderer.js";
import { CoastlineRenderer } from "./CoastlineRenderer.js";
import { NodeRenderer } from "./NodeRenderer.js";
import { TrafficRenderer } from "./TrafficRenderer.js";
import { EventRenderer } from "./EventRenderer.js";
import { GlowRenderer } from "./GlowRenderer.js";
import { ScanRenderer } from "./ScanRenderer.js";
import { GridRenderer } from "./GridRenderer.js";
import { CountryFillRenderer } from "./CountryFillRenderer.js";
import { StrategicFlowRenderer } from "./StrategicFlowRenderer.js";
import { SatelliteRenderer } from "./SatelliteRenderer.js";
import { InfrastructureRenderer } from "./InfrastructureRenderer.js";
import { RouteNetworkRenderer } from "./RouteNetworkRenderer.js";
import { MobileEntityRenderer } from "./MobileEntityRenderer.js";
import { CausalityRenderer } from "./CausalityRenderer.js";
import { smoothstep } from "../world/geometry.js";
import { SemanticZoomEngine } from "../map/SemanticZoomEngine.js";
import { SpatialIndex } from "../map/SpatialIndex.js";
import { ClusterManager } from "../map/ClusterManager.js";
import { VisualPriorityManager } from "../map/VisualPriorityManager.js";

export class VisualEngine {
  constructor({ canvas, miniCanvas, worldEngine, nodeNetwork, trafficEngine, eventEngine, gameEngine = null, infrastructureGraph = null, routeEngineV1 = null, mobileEntityEngine = null, trafficLogisticsEngine = null, layerManagerV1 = null, semanticZoomEngine = null, spatialIndex = null, clusterManager = null, projections }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.miniCanvas = miniCanvas;
    this.miniCtx = miniCanvas.getContext("2d", { alpha: true });
    this.worldEngine = worldEngine;
    this.nodeNetwork = nodeNetwork;
    this.trafficEngine = trafficEngine;
    this.eventEngine = eventEngine;
    this.gameEngine = gameEngine;
    this.infrastructureGraph = infrastructureGraph;
    this.routeEngineV1 = routeEngineV1;
    this.mobileEntityEngine = mobileEntityEngine;
    this.trafficLogisticsEngine = trafficLogisticsEngine;
    this.layerManagerV1 = layerManagerV1;
    this.semanticZoom = semanticZoomEngine || new SemanticZoomEngine();
    this.spatialIndex = spatialIndex || new SpatialIndex();
    this.clusterManager = clusterManager || new ClusterManager();
    this.visualPriority = new VisualPriorityManager();
    this.projections = projections;
    this.particles = new ParticleRenderer();
    this.coastlines = new CoastlineRenderer();
    this.nodes = new NodeRenderer();
    this.traffic = new TrafficRenderer();
    this.events = new EventRenderer();
    this.glow = new GlowRenderer();
    this.scans = new ScanRenderer();
    this.grid = new GridRenderer();
    this.countryFill = new CountryFillRenderer();
    this.strategicFlows = new StrategicFlowRenderer();
    this.satellites = new SatelliteRenderer();
    this.infrastructure = new InfrastructureRenderer();
    this.routeNetwork = new RouteNetworkRenderer();
    this.mobileEntities = new MobileEntityRenderer();
    this.causalityRenderer = new CausalityRenderer();
    this.width = 1;
    this.height = 1;
    this.miniWidth = 1;
    this.miniHeight = 1;
    this.dpr = 1;
    this.quality = "HIGH";
    this.mainSafeArea = { left: 0, right: 0, top: 0, bottom: 0 };
    if (this.infrastructureGraph) this.spatialIndex.rebuild(this.infrastructureGraph.list());
  }

  setMainSafeArea(insets = {}) {
    this.mainSafeArea = {
      left: Math.max(0, Number(insets.left) || 0),
      right: Math.max(0, Number(insets.right) || 0),
      top: Math.max(0, Number(insets.top) || 0),
      bottom: Math.max(0, Number(insets.bottom) || 0)
    };
    this.projections.world.setSafeArea?.(this.mainSafeArea);
    this.projections.country.setSafeArea?.(this.mainSafeArea);
  }

  resize(width, height, dpr = 1, miniSize = { width: 190, height: 190 }) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const miniWidth = typeof miniSize === "number" ? miniSize : miniSize.width;
    const miniHeight = typeof miniSize === "number" ? miniSize : miniSize.height;
    this.miniWidth = Math.max(1, miniWidth || 190);
    this.miniHeight = Math.max(1, miniHeight || this.miniWidth);
    this.miniCanvas.width = Math.round(this.miniWidth * dpr);
    this.miniCanvas.height = Math.round(this.miniHeight * dpr);
    this.miniCanvas.style.width = `${this.miniWidth}px`;
    this.miniCanvas.style.height = `${this.miniHeight}px`;
    this.miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.projections.world.resize(width, height);
    this.projections.miniWorld.resize(this.miniWidth, this.miniHeight);
    this.projections.globe.resize(width, height);
    this.projections.country.resize(width, height);
    this.setMainSafeArea(this.mainSafeArea);
  }

  setQuality(level) { this.quality = level; }

  terrainCount(mode) {
    if (this.quality === "LOW") return mode === "country" ? 2600 : mode === "globe" ? 2200 : 3300;
    if (this.quality === "MEDIUM") return mode === "country" ? 4700 : mode === "globe" ? 4100 : 6200;
    return mode === "country" ? 7000 : mode === "globe" ? 6500 : 9800;
  }

  clear(ctx = this.ctx, w = this.width, h = this.height) { ctx.clearRect(0, 0, w, h); }

  renderMain(state) {
    this.clear();
    this.glow.background(this.ctx, this.width, this.height, 1);
    const t = state.transition;

    if (t.active && t.type === "globe-world") {
      const p = smoothstep(t.progress);
      this.renderWorld(this.ctx, state, p);
      this.renderGlobe(this.ctx, state, 1 - p * 0.12, this.transitionGlobeViewport(p));
      return;
    }

    if (t.active && t.type === "world-globe") {
      const p = smoothstep(t.progress);
      this.renderWorld(this.ctx, state, 1 - p);
      this.renderGlobe(this.ctx, state, 0.88 + p * 0.12, this.transitionGlobeViewport(1 - p));
      return;
    }

    if(t.active&&t.type==="select-country"&&t.meta?.to){
      const p = smoothstep(t.progress);
      this.renderWorld(this.ctx, state, 1 - p * 0.82);
      this.renderCountry(this.ctx,state,t.meta.to,p);
      return;
    }

    if (t.active && t.type === "clear-country" && t.meta?.from) {
      const p = smoothstep(t.progress);
      this.renderWorld(this.ctx, state, 0.18 + p * 0.82);
      this.renderCountry(this.ctx, state, t.meta.from, 1 - p);
      return;
    }

    if (t.active && t.type === "switch-country" && t.meta) {
      const p = smoothstep(t.progress);
      this.renderCountry(this.ctx, state, t.meta.from, 1 - p);
      this.renderCountry(this.ctx,state,t.meta.to,p);
      return;
    }

    if(state.view==="GLOBE") this.renderGlobe(this.ctx,state,1,null);
    else if(state.view==="COUNTRY"&&state.selectedCountry) this.renderCountry(this.ctx,state,state.selectedCountry,1);
    else this.renderWorld(this.ctx,state,1);
  }

  transitionGlobeViewport(p) {
    const fullR = Math.min(this.width, this.height) * 0.34;
    const start = { x: this.width / 2, y: this.height / 2, r: fullR };
    const mainRect = this.canvas.getBoundingClientRect();
    const miniRect = this.miniCanvas.getBoundingClientRect();
    const hasLayout = miniRect.width > 1 && miniRect.height > 1;
    const end = hasLayout
      ? {
          x: miniRect.left - mainRect.left + miniRect.width / 2,
          y: miniRect.top - mainRect.top + miniRect.height / 2,
          r: Math.min(miniRect.width, miniRect.height) * 0.41
        }
      : {
          x: this.width - 130,
          y: this.height - 130,
          r: Math.min(this.miniWidth, this.miniHeight) * 0.41
        };
    return {
      centerX: start.x + (end.x - start.x) * p,
      centerY: start.y + (end.y - start.y) * p,
      radius: start.r + (end.r - start.r) * p
    };
  }

  renderPhysicalWorld(ctx, state, projection, { alpha = 1, mode = "world", country = null } = {}) {
    if (!this.infrastructureGraph || !this.routeEngineV1 || !this.layerManagerV1) return;
    const layers = this.layerManagerV1.listEnabled();
    const view = mode === "globe" ? "GLOBE" : mode === "country" ? "COUNTRY" : "WORLD";
    const zoom = view === "COUNTRY" ? (state.country.zoom || 1) : view === "WORLD" ? (state.world.zoom || 1) : 1;
    let routes = this.routeEngineV1.list({ country: view === "COUNTRY" ? country : null, layers });
    routes = this.semanticZoom.filterRoutes(routes, { view, zoom, selectedRouteId: state.selectedRoute });
    const causalFocus=state.causality?.active?{active:true,nodeIds:state.causality.nodeIds||[],routeIds:state.causality.routeIds||[],vehicleIds:[]}:state.focus;
    this.routeNetwork.render(ctx, routes, projection, { alpha, mode, selectedRouteId: state.selectedRoute, focus: causalFocus });

    let nodes = this.infrastructureGraph.visible({ view, country: view === "COUNTRY" ? country : null, enabledLayers: layers });
    if (view !== "GLOBE" && projection.geoBounds) {
      const ids = new Set(this.spatialIndex.query(projection.geoBounds()).map(n => n.id));
      nodes = nodes.filter(n => ids.has(n.id) || n.id === state.selectedInfrastructure);
    }
    nodes = this.semanticZoom.filterNodes(nodes, { view, zoom, selectedId: state.selectedInfrastructure });
    const radius = this.semanticZoom.clusterRadius(view, zoom);
    const clustered = this.clusterManager.cluster(nodes, projection, { radius, priorityManager: this.visualPriority, selectedId: state.selectedInfrastructure });
    const drawNodes = [...clustered.nodes, ...clustered.clusters];
    this.infrastructure.render(ctx, drawNodes, projection, { alpha, mode, selectedId: state.selectedInfrastructure, time: state.runtime.elapsed, zoom, focus: causalFocus, maxLabels: view === "COUNTRY" ? 80 : 65 });

    const engine = this.trafficLogisticsEngine || this.mobileEntityEngine;
    if (engine && this.layerManagerV1.isEnabled('TRAFFIC')) {
      const entities = engine.visible({ country: view === "COUNTRY" ? country : null, layers, limit: this.semanticZoom.vehicleLimit(view, zoom) });
      this.mobileEntities.render(ctx, entities, projection, { alpha, mode, selectedId: state.selectedVehicle, focus: causalFocus, routeEngine: this.routeEngineV1 });
    }
    if(state.causality?.active)this.causalityRenderer.render(ctx,state.causality,projection,{alpha});
  }

  renderGlobe(ctx, state, alpha = 1, viewport = null, mini = false) {
    const projection = this.projections.globe;
    const previous = { centerX: projection.centerX, centerY: projection.centerY, radius: projection.radius, camera: projection.camera };
    const camera = {
      ...state.globe,
      rotationY: state.globe.rotationY + (mini ? state.runtime.elapsed * 0.035 : 0),
      zoom: mini ? 0.94 : state.globe.zoom
    };
    projection.setCamera(camera);
    if (viewport) projection.setViewport(viewport);
    else if (mini) projection.setViewport({
      centerX: this.miniWidth / 2,
      centerY: this.miniHeight / 2,
      radius: Math.min(this.miniWidth, this.miniHeight) * 0.41
    });
    else projection.setViewport({ centerX: this.width / 2, centerY: this.height / 2, radius: Math.min(this.width, this.height) * 0.34 });

    this.glow.globeAtmosphere(ctx, projection, alpha);
    if (!mini) this.grid.render(ctx, projection, { alpha, mode: "globe", events: this.eventEngine.events(), time: state.runtime.elapsed, quality: this.quality });
    const points = this.worldEngine.terrainPoints(mini ? Math.min(1700, this.terrainCount("globe")) : this.terrainCount("globe"));
    this.particles.render(ctx, points, projection, { alpha, mode: "globe", quality: this.quality, time: state.runtime.elapsed });
    this.coastlines.render(ctx, this.worldEngine.features, projection, { alpha, mode: "globe" });
    if (!mini && this.gameEngine) this.strategicFlows.render(ctx, this.gameEngine.simulation.getVisualFlows({ view:"GLOBE", layer:this.gameEngine.simulation.getFlowLayer() }), this.worldEngine, projection, { alpha, mode:"globe", time:state.runtime.elapsed });
    this.satellites.render(ctx, projection, { alpha, time: state.runtime.elapsed, mini });
    if (!mini) this.renderPhysicalWorld(ctx, state, projection, { alpha, mode: "globe" });
    const nodes = this.nodeNetwork.getNodesForLOD(0);
    this.nodes.render(ctx, nodes, projection, { alpha, mode: "globe", networkIntensity: Math.min(1, state.network.intensity + (this.nodeNetwork.surgeRemaining > 0 ? 0.28 : 0)) });
    this.traffic.render(ctx, this.trafficEngine.getActive(), this.nodeNetwork, projection, { alpha, mode: "globe" });
    this.events.render(ctx, this.eventEngine.events(), this.worldEngine, projection, { alpha });
    this.events.renderRegionHighlight(ctx, this.worldEngine.getRegion(state.highlightedRegion), projection, { alpha });
    this.scans.render(ctx, this.eventEngine.events(), projection, { alpha, mode: "globe" });
    projection.centerX = previous.centerX;
    projection.centerY = previous.centerY;
    projection.radius = previous.radius;
    projection.camera = previous.camera;
  }

  renderWorld(ctx, state, alpha = 1, { mini = false } = {}) {
    const projection = mini ? this.projections.miniWorld : this.projections.world;
    projection.setCamera(mini ? { centerX: 0, centerY: 0, zoom: 1 } : state.world);
    const selected = state.selectedCountry;
    const neighbors = selected ? this.worldEngine.getNeighbors(selected) : null;
    const t = state.transition;
    const selectionProgress = t.active && t.type === "select-country" ? t.progress : t.active && t.type === "clear-country" ? 1 - t.progress : 1;
    const switchSelection = t.active && t.type === "switch-country" ? { from: t.meta.from, to: t.meta.to, progress: t.progress } : null;

    if (!mini) this.grid.render(ctx, projection, { alpha, mode: "world", events: this.eventEngine.events(), time: state.runtime.elapsed, quality: this.quality });

    if (switchSelection) {
      const fromFeature = this.worldEngine.getCountry(switchSelection.from);
      const toFeature = this.worldEngine.getCountry(switchSelection.to);
      if (fromFeature) this.countryFill.render(ctx, fromFeature, projection, { alpha, intensity: 1 - switchSelection.progress, mode: "world" });
      if (toFeature) this.countryFill.render(ctx, toFeature, projection, { alpha, intensity: switchSelection.progress, mode: "world" });
    } else if (selected) {
      const selectedFeature = this.worldEngine.getCountry(selected);
      if (selectedFeature) this.countryFill.render(ctx, selectedFeature, projection, { alpha, intensity: selectionProgress, mode: "world" });
    }

    const points = this.worldEngine.terrainPoints(mini ? Math.min(1900, this.terrainCount("world")) : this.terrainCount("world"));
    this.particles.render(ctx, points, projection, {
      alpha,
      selectedCountry: selected,
      hoveredCountry: mini ? null : state.hoveredCountry,
      neighbors,
      mode: "world",
      quality: mini && this.quality === "HIGH" ? "MEDIUM" : this.quality,
      selectionProgress,
      switchSelection,
      time: state.runtime.elapsed
    });
    this.coastlines.render(ctx, this.worldEngine.features, projection, {
      alpha,
      selectedCountry: selected,
      hoveredCountry: mini ? null : state.hoveredCountry,
      highlightedCountry: state.highlightedCountry,
      neighbors,
      mode: "world",
      selectionProgress,
      switchSelection
    });
    if (!mini && this.gameEngine && this.layerManagerV1?.isEnabled("TRADE") && !this.layerManagerV1?.isEnabled("TRAFFIC")) this.strategicFlows.render(ctx, this.gameEngine.simulation.getVisualFlows({ view:"WORLD", country:selected || null, layer:this.gameEngine.simulation.getFlowLayer() }), this.worldEngine, projection, { alpha: alpha * .55, mode:"world", country:selected || null, time:state.runtime.elapsed });
    if (!mini) this.renderPhysicalWorld(ctx, state, projection, { alpha, mode: "world" });
    this.nodes.render(ctx, this.nodeNetwork.getNodesForLOD(mini ? 0 : 1), projection, { alpha: alpha * (state.focus?.active ? .15 : 1), country: selected, mode: "world", networkIntensity: Math.min(1, state.network.intensity + (this.nodeNetwork.surgeRemaining > 0 ? 0.28 : 0)) });
    if (!this.layerManagerV1?.isEnabled("TRAFFIC")) this.traffic.render(ctx, this.trafficEngine.getActive(), this.nodeNetwork, projection, { alpha: alpha * .45, mode: "world" });
    this.events.render(ctx, this.eventEngine.events(), this.worldEngine, projection, { alpha: alpha * (state.focus?.active ? .35 : 1) });
    if (!mini) {
      this.events.renderRegionHighlight(ctx, this.worldEngine.getRegion(state.highlightedRegion), projection, { alpha });
      this.scans.render(ctx, this.eventEngine.events(), projection, { alpha, mode: "world" });
    }
  }

  renderCountry(ctx, state, code, alpha = 1) {
    const feature = this.worldEngine.getCountry(code);
    if (!feature) return;
    const projection = this.projections.country;
    projection.resize(this.width, this.height);
    projection.setFeature(feature);
    projection.setCamera(state.country);

    this.grid.render(ctx, projection, { alpha, mode: "country", feature, events: this.eventEngine.events(), time: state.runtime.elapsed, quality: this.quality });
    this.countryFill.render(ctx, feature, projection, { alpha, intensity: 1, mode: "country" });
    const points = this.worldEngine.terrainPoints(this.terrainCount("country"), code);
    this.particles.render(ctx, points, projection, { alpha, selectedCountry: code, mode: "country", quality: this.quality, time: state.runtime.elapsed });
    this.coastlines.render(ctx, [feature], projection, { alpha, selectedCountry: code, mode: "country" });
    if (this.gameEngine && this.layerManagerV1?.isEnabled("TRADE") && !this.layerManagerV1?.isEnabled("TRAFFIC")) this.strategicFlows.render(ctx, this.gameEngine.simulation.getVisualFlows({ view:"COUNTRY", country:code, layer:this.gameEngine.simulation.getFlowLayer() }), this.worldEngine, projection, { alpha: alpha * .45, mode:"country", country:code, time:state.runtime.elapsed });
    this.renderPhysicalWorld(ctx, state, projection, { alpha, mode: "country", country: code });
    this.nodes.render(ctx, this.nodeNetwork.getNodesForLOD(2, code), projection, { alpha: alpha * (state.focus?.active ? .15 : 1), country: code, mode: "country", networkIntensity: Math.min(1, state.network.intensity + (this.nodeNetwork.surgeRemaining > 0 ? 0.28 : 0)) });
    if (!this.layerManagerV1?.isEnabled("TRAFFIC")) this.traffic.render(ctx, this.trafficEngine.getActive({ country: code }), this.nodeNetwork, projection, { alpha: alpha * .35, mode: "country", country: code });
    this.events.render(ctx, this.eventEngine.events(), this.worldEngine, projection, { alpha: alpha * (state.focus?.active ? .35 : 1), country: code });
    this.scans.render(ctx, this.eventEngine.events(), projection, { alpha, mode: "country", country: code });
  }

  renderMini(state) {
    const ctx = this.miniCtx, w = this.miniWidth, h = this.miniHeight;
    this.clear(ctx, w, h);
    this.glow.background(ctx, w, h, 0.92);
    const t = state.transition;

    if (t.active && t.type === "select-country") {
      const p = smoothstep(t.progress);
      this.renderGlobe(ctx, state, 1 - p, null, true);
      this.renderWorld(ctx, state, p, { mini: true });
      return;
    }

    if (t.active && t.type === "clear-country") {
      const p = smoothstep(t.progress);
      this.renderWorld(ctx, state, 1 - p, { mini: true });
      this.renderGlobe(ctx, state, p, null, true);
      return;
    }

    if(state.selectedCountry||state.view==="COUNTRY") this.renderWorld(ctx,state,1,{mini:true});
    else this.renderGlobe(ctx,state,1,null,true);
  }

  destroy() { this.clear(); this.clear(this.miniCtx, this.miniWidth, this.miniHeight); }
}
