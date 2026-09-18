import { EventBus } from "./EventBus.js";
import { RuntimeClock } from "./RuntimeClock.js";
import { StateManager } from "./StateManager.js";
import { EventEngine } from "./EventEngine.js";
import { TransitionManager } from "./TransitionManager.js";
import { SiteInteractionAPI } from "./SiteInteractionAPI.js";
import { SceneManager } from "./SceneManager.js";
import { WorldEngine } from "../world/WorldEngine.js";
import { WorldProjection } from "../world/WorldProjection.js";
import { GlobeProjection } from "../world/GlobeProjection.js";
import { CountryProjection } from "../world/CountryProjection.js";
import { ProjectionAdapter } from "../world/ProjectionAdapter.js";
import { NodeNetwork } from "../network/NodeNetwork.js";
import { TrafficEngine } from "../network/TrafficEngine.js";
import { CameraEngine } from "../camera/CameraEngine.js";
import { MapCameraEngine } from "../camera/MapCameraEngine.js";
import { VisualEngine } from "../visual/VisualEngine.js";
import { GlobeView } from "../views/GlobeView.js";
import { WorldView } from "../views/WorldView.js";
import { CountryView } from "../views/CountryView.js";
import { QualityManager } from "../performance/QualityManager.js";
import { PerformanceManager } from "../performance/PerformanceManager.js";
import { FocusPanel } from "../ui/FocusPanel.js";
import { SimulationPanel } from "../ui/SimulationPanel.js";
import { FlowLayerPanel } from "../ui/FlowLayerPanel.js";
import { GameEngine } from "../game/GameEngine.js";
import { RealWorldDataStore } from "../game/realworld/RealWorldDataStore.js";
import { FlowDataStore } from "../game/flows/FlowDataStore.js";
import { InfrastructureGraph } from "../game/infrastructure/InfrastructureGraph.js";
import { CountryPhysicalProfileStore } from "../game/worldpopulation/CountryPhysicalProfileStore.js";
import { RouteEngineV1 } from "../game/infrastructure/RouteEngineV1.js";
import { WorldNetworkStore } from "../game/network/WorldNetworkStore.js";
import { InternationalGatewayEngine } from "../game/network/InternationalGatewayEngine.js";
import { LayerManagerV1 } from "../game/infrastructure/LayerManagerV1.js";
import { MobileEntityEngine } from "../game/infrastructure/MobileEntityEngine.js";
import { InfrastructureInteraction } from "../views/InfrastructureInteraction.js";
import { SemanticZoomEngine } from "../map/SemanticZoomEngine.js";
import { SpatialIndex } from "../map/SpatialIndex.js";
import { ClusterManager } from "../map/ClusterManager.js";
import { SelectionContext } from "../interaction/SelectionContext.js";
import { FocusModeEngine } from "../interaction/FocusModeEngine.js";
import { TrafficLogisticsEngine } from "../traffic/TrafficLogisticsEngine.js";
import { CausalityModeEngine } from "../analysis/CausalityModeEngine.js";
import { TimelineReplayEngine } from "../analysis/TimelineReplayEngine.js";
import { GlobalSearchEngine } from "../analysis/GlobalSearchEngine.js";
import { CausalityPanel } from "../ui/CausalityPanel.js";
import { TimelinePanel } from "../ui/TimelinePanel.js";
import { GlobalSearchPanel } from "../ui/GlobalSearchPanel.js";

export class CyberBackground {
  constructor({ container, config = {} } = {}) {
    this.container = typeof container === "string" ? document.querySelector(container) : container;
    if (!this.container) throw new Error("CyberBackground: container introuvable");
    this.config = config;
    this.bus = new EventBus();
    this.clock = new RuntimeClock();
    this.running = false; this.initialized = false; this.hidden = document.hidden; this.frameId = 0;
    this.width = 1; this.height = 1; this.dpr = 1;
    this.reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.reducedMotionQuery.matches;
    this.debugEnabled = config.debug ?? (new URLSearchParams(location.search).get("debug") === "1");
    this.handleResize = this.resize.bind(this); this.handleVisibility = this.onVisibility.bind(this); this.handleMotion = this.onMotionPreference.bind(this); this.handleKey = this.onKeyDown.bind(this); this.loop = this.loop.bind(this);
  }

  initialQuality() {
    if (this.config.quality) return this.config.quality;
    if (this.reducedMotion || innerWidth < 700) return "LOW";
    if (innerWidth < 1100 || (navigator.hardwareConcurrency || 4) <= 4) return "MEDIUM";
    return "HIGH";
  }

  async init() {
    if (this.initialized) return this;
    this.createSurfaces();
    try {
      this.qualityManager = new QualityManager(this.bus, this.initialQuality());
      this.performanceManager = new PerformanceManager(this.qualityManager);
      this.state = new StateManager(this.bus);
      this.worldEngine = new WorldEngine();
      this.nodeNetwork = new NodeNetwork();
      await Promise.all([this.worldEngine.init(), this.nodeNetwork.init()]);
      this.trafficEngine = new TrafficEngine({ nodeNetwork: this.nodeNetwork });
      await this.trafficEngine.init();
      this.infrastructureGraph = new InfrastructureGraph();
      this.countryPhysicalProfiles = new CountryPhysicalProfileStore();
      await Promise.all([this.infrastructureGraph.init(), this.countryPhysicalProfiles.init()]);
      this.worldNetwork = new WorldNetworkStore();
      await this.worldNetwork.init();
      this.routeEngineV1 = new RouteEngineV1({ infrastructureGraph: this.infrastructureGraph });
      await this.routeEngineV1.init();
      this.gatewayEngine = new InternationalGatewayEngine({ networkStore:this.worldNetwork, infrastructureGraph:this.infrastructureGraph, countryPhysicalProfiles:this.countryPhysicalProfiles });
      this.layerManagerV1 = new LayerManagerV1();
      this.layerManagerV1.setView("GLOBE");
      this.mobileEntityEngine = new MobileEntityEngine({ routeEngine: this.routeEngineV1 });
      await this.mobileEntityEngine.init();
      this.realWorldDataStore = new RealWorldDataStore();
      this.flowDataStore = new FlowDataStore();
      await Promise.all([this.realWorldDataStore.init(), this.flowDataStore.init()]);
      this.game = new GameEngine({
        worldEngine: this.worldEngine,
        realWorldDataStore: this.realWorldDataStore,
        flowDataStore: this.flowDataStore,
        infrastructureGraph: this.infrastructureGraph,
        routeEngineV1: this.routeEngineV1,
        countryPhysicalProfiles: this.countryPhysicalProfiles,
        mode: this.config.gameMode ?? "REAL_WORLD",
        seed: this.config.gameSeed ?? 1849237,
        scenarioConfig: this.config.scenarioConfig ?? null
      });

      this.projections = {
        world: new WorldProjection(),
        miniWorld: new WorldProjection(),
        globe: new GlobeProjection(),
        country: new CountryProjection()
      };
      this.projection = new ProjectionAdapter(this.projections);
      this.camera = new CameraEngine(this.state, this.worldEngine, this.nodeNetwork);
      this.semanticZoom = new SemanticZoomEngine();
      this.spatialIndex = new SpatialIndex().rebuild(this.infrastructureGraph.list());
      this.clusterManager = new ClusterManager();
      this.mapCamera = new MapCameraEngine({ stateManager:this.state, projections:this.projections, worldEngine:this.worldEngine, bus:this.bus });
      this.trafficLogistics = new TrafficLogisticsEngine({ routeEngine:this.routeEngineV1, simulation:this.game.simulation });
      this.trafficLogistics.syncFromSimulation(true);
      this.selectionContext = new SelectionContext({ stateManager:this.state, layerManager:this.layerManagerV1, mapCamera:this.mapCamera, bus:this.bus });
      this.focusMode = new FocusModeEngine({ stateManager:this.state, infrastructureGraph:this.infrastructureGraph, routeEngine:this.routeEngineV1, trafficEngine:this.trafficLogistics, bus:this.bus });
      this.causalityMode = new CausalityModeEngine({ stateManager:this.state, infrastructureGraph:this.infrastructureGraph, routeEngine:this.routeEngineV1, gameEngine:this.game, bus:this.bus });
      this.timelineReplay = new TimelineReplayEngine({ gameEngine:this.game, stateManager:this.state, bus:this.bus, causalityEngine:this.causalityMode });
      this.globalSearch = new GlobalSearchEngine({ worldEngine:this.worldEngine, infrastructureGraph:this.infrastructureGraph, routeEngine:this.routeEngineV1, trafficEngine:this.trafficLogistics, gameEngine:this.game, bus:this.bus });
      this.eventEngine = new EventEngine(this.bus, this.state, this.nodeNetwork, this.trafficEngine);
      this.transitions = new TransitionManager(this.bus, this.state, this.eventEngine, this.camera);
      this.visual = new VisualEngine({
        canvas: this.canvas, miniCanvas: this.miniCanvas,
        worldEngine: this.worldEngine, nodeNetwork: this.nodeNetwork,
        trafficEngine: this.trafficEngine, eventEngine: this.eventEngine, gameEngine: this.game,
        infrastructureGraph: this.infrastructureGraph, routeEngineV1: this.routeEngineV1,
        mobileEntityEngine: this.mobileEntityEngine, trafficLogisticsEngine: this.trafficLogistics, layerManagerV1: this.layerManagerV1,
        semanticZoomEngine:this.semanticZoom, spatialIndex:this.spatialIndex, clusterManager:this.clusterManager,
        projections: this.projections
      });
      this.globeView = new GlobeView({ canvas: this.canvas, stateManager: this.state, cameraEngine: this.camera, transitionManager: this.transitions, globeProjection: this.projections.globe });
      this.worldView = new WorldView({ canvas: this.canvas, stateManager: this.state, worldEngine: this.worldEngine, worldProjection: this.projections.world, transitionManager: this.transitions, mapCameraEngine:this.mapCamera });
      this.countryView = new CountryView({
        miniCanvas: this.miniCanvas,
        stateManager: this.state,
        transitionManager: this.transitions,
        worldEngine: this.worldEngine,
        miniWorldProjection: this.projections.miniWorld
      });
      this.infrastructureInteraction = new InfrastructureInteraction({
        canvas:this.canvas,stateManager:this.state,infrastructureGraph:this.infrastructureGraph,
        renderer:this.visual.infrastructure,routeRenderer:this.visual.routeNetwork,mobileRenderer:this.visual.mobileEntities,
        routeEngine:this.routeEngineV1,trafficEngine:this.trafficLogistics,layerManager:this.layerManagerV1,bus:this.bus,
        clusterManager:this.clusterManager,mapCamera:this.mapCamera,selectionContext:this.selectionContext,focusEngine:this.focusMode
      });
      this.scenes = new SceneManager(this.bus, document.querySelectorAll("[data-scene]"));
      this.api = new SiteInteractionAPI({ bus:this.bus,stateManager:this.state,transitionManager:this.transitions,cameraEngine:this.camera,mapCameraEngine:this.mapCamera,worldEngine:this.worldEngine,nodeNetwork:this.nodeNetwork,infrastructureGraph:this.infrastructureGraph,routeEngine:this.routeEngineV1,trafficLogisticsEngine:this.trafficLogistics,layerManager:this.layerManagerV1,selectionContext:this.selectionContext,focusMode:this.focusMode,causalityMode:this.causalityMode,timelineReplay:this.timelineReplay,globalSearch:this.globalSearch });
      this.globalSearch.setNavigator(this.api);
      this.focusPanel = new FocusPanel({ root: this.miniWrap, worldEngine: this.worldEngine, nodeNetwork: this.nodeNetwork, trafficEngine: this.trafficEngine, eventEngine: this.eventEngine, gameEngine: this.game });
      this.simulationPanel = new SimulationPanel({ root: this.miniWrap, gameEngine: this.game });
      this.flowLayerPanel = new FlowLayerPanel({ root: this.miniWrap, gameEngine: this.game });
      this.causalityPanel = new CausalityPanel({ root:document.querySelector("#wi-shell"), engine:this.causalityMode, stateManager:this.state, bus:this.bus });
      this.timelinePanel = new TimelinePanel({ root:document.querySelector("#wi-shell"), engine:this.timelineReplay, gameEngine:this.game, stateManager:this.state, bus:this.bus });
      this.searchPanel = new GlobalSearchPanel({ root:document.querySelector("#wi-shell"), engine:this.globalSearch, stateManager:this.state, bus:this.bus });

      this.setupEvents(); this.setupAccessibility(); this.setupDebug();
      this.globeView.init(); this.infrastructureInteraction.init(); this.worldView.init(); this.countryView.init(); this.scenes.init();
      this.applyReducedMotion(); this.resize();
      this.clock.start(); this.state.setRuntime(this.clock); this.state.setView("GLOBE"); this.camera.toGlobe();
      this.eventEngine.emit("VIEW_CHANGED", { duration: 0.25, data: { view: "GLOBE" } });
      this.initialized = true;
      this.container.classList.add("is-ready");
      this.container.dataset.quality = this.qualityManager.level;
      this.bus.emit("app:ready", { app: this, api: this.api });
      return this;
    } catch (error) {
      console.error("[CyberBackground] Initialisation impossible", error);
      this.container.classList.add("is-static");
      this.canvas?.remove(); this.miniWrap?.remove();
      throw error;
    }
  }

  createSurfaces() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "cyber-canvas"; this.canvas.tabIndex = 0; this.canvas.setAttribute("role", "application");
    this.canvas.setAttribute("aria-label", "Carte cyber géographique interactive. Entrée pour déplier le globe, Échap pour revenir.");
    this.container.prepend(this.canvas);

    this.miniWrap = document.createElement("aside");
    this.miniWrap.className = "cyber-mini-nav";
    this.miniWrap.setAttribute("aria-hidden", "true");
    this.miniWrap.setAttribute("aria-live", "polite");
    this.miniWrap.dataset.mode = "globe";

    const header = document.createElement("div"); header.className = "cyber-mini-header";
    const headerLeft = document.createElement("div"); headerLeft.className = "cyber-mini-heading";
    const label = document.createElement("span"); label.className = "cyber-mini-label"; label.textContent = "NAVIGATOR";
    const title = document.createElement("strong"); title.className = "cyber-focus-title"; title.dataset.focusTitle = ""; title.textContent = "Global Network";
    headerLeft.append(label, title);
    const status = document.createElement("div"); status.className = "cyber-mini-status";
    const dot = document.createElement("i"); dot.setAttribute("aria-hidden", "true");
    const mode = document.createElement("span"); mode.dataset.focusMode = ""; mode.textContent = "GLOBE";
    status.append(dot, mode);
    header.append(headerLeft, status);

    this.miniFrame = document.createElement("div"); this.miniFrame.className = "cyber-mini-frame";
    this.miniCanvas = document.createElement("canvas"); this.miniCanvas.className = "cyber-mini-canvas"; this.miniFrame.append(this.miniCanvas);

    const focus = document.createElement("div"); focus.className = "cyber-focus-info";
    const rows = document.createElement("div"); rows.className = "cyber-focus-rows"; rows.dataset.focusRows = "";
    const source = document.createElement("div"); source.className = "cyber-focus-source"; source.dataset.focusSource = ""; source.textContent = "GEO DATA · BASELINE | ENGINE · SIM";
    focus.append(rows, source);

    this.miniWrap.append(header, this.miniFrame, focus);
    this.container.append(this.miniWrap);
  }

  setupEvents() {
    this.unsub = [
      this.bus.on("quality:change", ({ quality }) => { this.visual.setQuality(quality); this.container.dataset.quality = quality; this.resize(); }),
      this.bus.on("country:hover", ({ code }) => { this.container.dataset.hoveredCountry = code || ""; }),
      this.bus.on("country:selected", ({ code }) => { if (this.countrySelect) this.countrySelect.value = code || ""; this.selectionContext?.push("country-selected"); }),
      this.bus.on("country:cleared", () => { if (this.countrySelect) this.countrySelect.value = ""; this.selectionContext?.push("country-cleared"); }),
      this.bus.on("view:changed", ({ view, previous }) => { if (["GLOBE","WORLD","COUNTRY"].includes(view)) this.layerManagerV1?.setView(view,{preserve:(previous==="WORLD"&&view==="COUNTRY")||(previous==="COUNTRY"&&view==="WORLD")}); }),
      this.bus.on("selection:auto-layers", ({type,id}) => { const obj=type==="INFRASTRUCTURE"?this.infrastructureGraph.get(id):type==="VEHICLE"?this.trafficLogistics.get(id):this.routeEngineV1.get(id); if(obj)this.layerManagerV1?.enableAutoFor(obj.type||obj.layer); }),
      this.bus.on("selection:focus-request", () => { const s=this.state.get(); if(s.selectedInfrastructure)this.focusMode.set("INFRASTRUCTURE",s.selectedInfrastructure); else if(s.selectedVehicle)this.focusMode.set("VEHICLE",s.selectedVehicle); else if(s.selectedRoute)this.focusMode.set("ROUTE",s.selectedRoute); }),
      this.bus.on("selection:fit-request", () => this.api?.fitSelection?.()),
      this.bus.on("selection:follow-request", () => this.api?.followSelection?.())
    ];
    addEventListener("resize", this.handleResize, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibility);
    document.addEventListener("keydown", this.handleKey);
    this.reducedMotionQuery.addEventListener?.("change", this.handleMotion);
  }

  setupAccessibility() {
    const nav = document.querySelector("#cyber-a11y-nav");
    this.countrySelect = nav?.querySelector("[data-country-select]") || null;
    if (this.countrySelect) {
      const fragment = document.createDocumentFragment();
      for (const country of this.worldEngine.listCountries()) {
        const option = document.createElement("option"); option.value = country.iso2; option.textContent = country.name; fragment.append(option);
      }
      this.countrySelect.append(fragment);
      this.onCountrySelect = () => { const code = this.countrySelect.value; if (code) this.api.selectCountry(code); else this.api.clearCountry(); };
      this.countrySelect.addEventListener("change", this.onCountrySelect);
    }
    nav?.querySelector("[data-action='globe']")?.addEventListener("click", () => this.api.toGlobe());
    nav?.querySelector("[data-action='world']")?.addEventListener("click", () => this.api.toWorld());
    nav?.querySelector("[data-action='clear']")?.addEventListener("click", () => this.api.clearCountry());
  }

  setupDebug() {
    if (!this.debugEnabled) return;
    this.debug = document.createElement("pre"); this.debug.className = "cyber-debug"; this.debug.setAttribute("aria-hidden", "true"); this.container.append(this.debug);
  }

  applyReducedMotion() {
    this.container.classList.toggle("reduced-motion", this.reducedMotion);
    this.camera?.setReducedMotion(this.reducedMotion); this.mapCamera?.setReducedMotion(this.reducedMotion); this.transitions?.setReducedMotion(this.reducedMotion); this.eventEngine?.setReducedMotion(this.reducedMotion);
    if (this.reducedMotion && this.qualityManager?.level === "HIGH") this.qualityManager.set("LOW", "reduced-motion");
  }
  onMotionPreference(e){this.reducedMotion=e.matches;this.applyReducedMotion();}
  onVisibility(){this.hidden=document.hidden;if(this.hidden)cancelAnimationFrame(this.frameId);else if(this.running){this.clock.resume();this.frameId=requestAnimationFrame(this.loop);}}
  onKeyDown(e){
    const s=this.state.get();
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();this.searchPanel?.open();return;}
    if(e.key==="/"&&!e.ctrlKey&&!e.metaKey&&!["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)){e.preventDefault();this.searchPanel?.open();return;}
    if((e.key==="w"||e.key==="W")&&!e.ctrlKey&&!e.metaKey&&(s.selectedInfrastructure||s.selectedRoute||s.timeline?.selectedId)){e.preventDefault();this.causalityMode?.why();return;}
    if(e.altKey&&e.key==="ArrowLeft"){e.preventDefault();this.selectionContext?.back();return;}
    if(e.altKey&&e.key==="ArrowRight"){e.preventDefault();this.selectionContext?.forward();return;}
    if(e.key==="Home"&&(s.view==="WORLD"||s.view==="COUNTRY")){e.preventDefault();this.mapCamera?.reset();return;}
    if((e.key==="f"||e.key==="F")&&(s.view==="WORLD"||s.view==="COUNTRY")){e.preventDefault();if(s.selectedVehicle)this.api?.followSelection?.();else this.api?.focusSelection?.();return;}
    if((e.key==="+"||e.key==="=")&&(s.view==="WORLD"||s.view==="COUNTRY")){e.preventDefault();const vp=this.mapCamera?.viewport();if(vp)this.mapCamera.zoomAt(vp.x+vp.width/2,vp.y+vp.height/2,1.35);return;}
    if(e.key==="-"&&(s.view==="WORLD"||s.view==="COUNTRY")){e.preventDefault();const vp=this.mapCamera?.viewport();if(vp)this.mapCamera.zoomAt(vp.x+vp.width/2,vp.y+vp.height/2,.74);return;}
    if(e.key!=="Escape")return;
    if(s.search?.open){this.searchPanel?.close();return;}
    if(s.causality?.active){this.causalityMode?.clear();return;}
    if(s.timeline?.mode!=="LIVE"){this.timelineReplay?.live();return;}
    if(s.focus?.active){this.focusMode?.clear();return;}
    if(this.mapCamera?.followTarget){this.mapCamera.cancelFollow();return;}
    if(s.selectedInfrastructure||s.selectedRoute||s.selectedVehicle){this.api?.clearSelection?.();return;}
    if(s.selectedCountry)this.transitions.clearCountry(); else if(s.view==="WORLD")this.transitions.toGlobe();
  }

  miniSize() {
    if (this.width < 700) return { width: 176, height: 104 };
    if (this.width < 1100) return { width: 244, height: 142 };
    return { width: 304, height: 174 };
  }
  mainSafeArea() {
    if (!this.miniWrap || !this.container) return { left: 0, right: 0, top: 0, bottom: 0 };
    const containerRect = this.container.getBoundingClientRect();
    const panelRect = this.miniWrap.getBoundingClientRect();
    const leftRect = document.querySelector(".wi-left")?.getBoundingClientRect();
    const contextRect = document.querySelector(".wi-context")?.getBoundingClientRect();
    const topRect = document.querySelector(".wi-top-hud")?.getBoundingClientRect();
    const bottomRect = document.querySelector(".wi-bottom")?.getBoundingClientRect();
    if (this.width < 700) {
      return {
        left: 12,
        right: 12,
        top: Math.max(12, Math.ceil((leftRect?.bottom ?? panelRect.bottom) - containerRect.top + 16)),
        bottom: Math.max(12, Math.ceil(containerRect.bottom - (contextRect?.top ?? panelRect.bottom) + 12))
      };
    }
    return {
      left: Math.max(24, Math.ceil((leftRect?.right ?? panelRect.right) - containerRect.left + 18)),
      right: Math.max(24, Math.ceil(containerRect.right - (contextRect?.left ?? containerRect.right) + 18)),
      top: Math.max(24, Math.ceil((topRect?.bottom ?? containerRect.top) - containerRect.top + 14)),
      bottom: Math.max(24, Math.ceil(containerRect.bottom - (bottomRect?.top ?? containerRect.bottom) + 10))
    };
  }

  resize() {
    if(!this.visual)return;
    const rect=this.container.getBoundingClientRect(); this.width=Math.max(1,rect.width); this.height=Math.max(1,rect.height);
    this.dpr=Math.min(devicePixelRatio||1,this.qualityManager.config.dpr);
    this.visual.resize(this.width,this.height,this.dpr,this.miniSize());
    this.visual.setMainSafeArea(this.mainSafeArea());
    this.visual.setQuality(this.qualityManager.level);
  }

  start(){if(!this.initialized||this.running)return this;this.running=true;this.clock.start();if(!this.hidden)this.frameId=requestAnimationFrame(this.loop);return this;}
  stop(){this.running=false;cancelAnimationFrame(this.frameId);return this;}

  loop(now) {
    if(!this.running||this.hidden)return;
    this.clock.tick(now); this.state.setRuntime(this.clock);
    this.scenes.update(this.clock.delta);
    this.state.get().network.intensity = this.scenes.values.network;
    this.camera.update(this.clock.delta); this.mapCamera?.update(this.clock.delta); this.transitions.update(); this.eventEngine.update(); this.nodeNetwork.update(this.clock.delta); this.trafficEngine.update(this.clock.elapsed); this.mobileEntityEngine?.update(this.clock.delta);
    this.game?.update(this.clock.delta); this.timelineReplay?.update(this.clock.delta); this.trafficLogistics?.syncFromSimulation(); this.trafficLogistics?.update(this.clock.delta,{simulationSpeed:this.game?.clock?.speed||0}); this.simulationPanel?.update(); this.flowLayerPanel?.update(); this.timelinePanel?.update();
    this.visual.renderMain(this.state.get());
    this.updateMini(); this.performanceManager.update(this.clock.delta); this.updateDebug();
    this.frameId=requestAnimationFrame(this.loop);
  }

  updateMini() {
    const s=this.state.get(); const t=s.transition;
    const visible=(s.view==="WORLD"||s.view==="COUNTRY")&&!((t.active&&t.type==="world-globe")) || (t.active&&t.type==="globe-world"&&t.progress>0.96);
    this.miniWrap.classList.toggle("is-visible",visible);
    this.miniWrap.dataset.mode = s.selectedCountry ? "world" : "globe";
    if(visible)this.visual.renderMini(s);
    if(visible)this.focusPanel?.update(s);
  }

  updateDebug() {
    if(!this.debug)return;
    const s=this.state.get();
    this.debug.textContent=[
      `FPS             ${this.performanceManager.averageFps.toFixed(1)}`,
      `Frame Time      ${this.performanceManager.frameTime.toFixed(2)} ms`,
      `Quality         ${this.qualityManager.level}`,
      `View            ${s.view}`,
      `Country         ${s.selectedCountry||"-"}`,
      `Transition      ${s.transition.type||"-"} ${s.transition.progress.toFixed(2)}`,
      `Nodes LOD0/1/2  ${this.nodeNetwork.getNodesForLOD(0).length}/${this.nodeNetwork.getNodesForLOD(1).length}/${this.nodeNetwork.getNodesForLOD(2).length}`,
      `Traffic active  ${this.trafficEngine.active.length}`,
      `Infra nodes      ${this.infrastructureGraph?.nodes.length ?? 0}`,
      `Infra routes     ${this.routeEngineV1?.routes.length ?? 0}`,
      `Mobile entities  ${this.mobileEntityEngine?.entities.length ?? 0}`,
      `Traffic vehicles ${this.trafficLogistics?.entities.length ?? 0}`,
      `Map zoom        ${(s.view==="COUNTRY"?s.country.zoom:s.world.zoom).toFixed?.(2) ?? "-"}`,
      `Infra selected   ${s.selectedInfrastructure || "-"}`,
      `Events active   ${this.eventEngine.events().length}`,
      `Runtime         ${s.runtime.elapsed.toFixed(1)} s`,
      `Game Date       ${this.game?.clock.date() || "-"}`,
      `Game Speed      x${this.game?.clock.speed ?? 0}`,
      `Game Flows      ${this.game?.simulation.getFlows().length ?? 0}`,
      `Game Valid      ${this.game?.simulation.validate() ? "YES" : "NO"}`
    ].join("\n");
  }

  setScene(scene){this.scenes?.setScene(scene);return this;}
  setQuality(level){this.qualityManager?.set(level,"public-api");return this;}
  destroy(){
    this.stop(); this.unsub?.forEach(fn=>fn()); removeEventListener("resize",this.handleResize); document.removeEventListener("visibilitychange",this.handleVisibility); document.removeEventListener("keydown",this.handleKey); this.reducedMotionQuery.removeEventListener?.("change",this.handleMotion);
    this.countrySelect?.removeEventListener("change",this.onCountrySelect);
    this.globeView?.destroy(); this.infrastructureInteraction?.destroy(); this.worldView?.destroy(); this.countryView?.destroy(); this.focusPanel?.destroy(); this.simulationPanel?.destroy(); this.flowLayerPanel?.destroy(); this.causalityPanel?.destroy(); this.timelinePanel?.destroy(); this.searchPanel?.destroy(); this.api?.destroy(); this.scenes?.destroy(); this.game?.destroy(); this.eventEngine?.destroy(); this.trafficLogistics?.destroy(); this.mobileEntityEngine?.destroy(); this.routeEngineV1?.destroy(); this.infrastructureGraph?.destroy(); this.trafficEngine?.destroy(); this.nodeNetwork?.destroy(); this.worldEngine?.destroy(); this.visual?.destroy(); this.performanceManager?.destroy(); this.bus.clear();
    this.canvas?.remove(); this.miniWrap?.remove(); this.debug?.remove(); this.container.classList.remove("is-ready"); this.initialized=false;
  }
}
