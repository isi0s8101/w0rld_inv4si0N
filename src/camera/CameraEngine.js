export class CameraEngine {
  constructor(stateManager, worldEngine, nodeNetwork) {
    this.stateManager = stateManager;
    this.worldEngine = worldEngine;
    this.nodeNetwork = nodeNetwork;
    this.dragging = false;
    this.lastPointer = null;
    this.autoRotate = true;
    this.reducedMotion = false;
  }

  setReducedMotion(value) { this.reducedMotion = Boolean(value); }
  toGlobe() { this.autoRotate = !this.reducedMotion; return this; }
  toWorld() { this.autoRotate = false; return this; }
  reset() { this.stateManager.patch({ globe: { rotationX: -0.10, rotationY: -0.30, zoom: 1 }, world: { centerX: 0, centerY: 0, zoom: 1 }, country: { centerX: null, centerY: null, zoom: 1 } }, "camera:reset"); return this; }

  orientGlobe(lat, lon) {
    const state = this.stateManager.get();
    state.globe.rotationY = -lon * Math.PI / 180;
    state.globe.rotationX = Math.max(-1.05, Math.min(1.05, -lat * Math.PI / 180));
  }

  focusCountry(code) {
    const feature = this.worldEngine.getCountry(code);
    if (!feature) return false;
    const [lon, lat] = feature.properties.focusCenter || feature.properties.center;
    this.orientGlobe(lat, lon);
    this.stateManager.patch({ world: { centerX: lon, centerY: lat }, country: { code, centerX: null, centerY: null, zoom: 1 } }, "camera:focusCountry");
    return true;
  }

  focusRegion(code) {
    const region = this.worldEngine.getRegion(code);
    if (!region) return false;
    const [lon, lat] = region.center;
    this.orientGlobe(lat, lon);
    this.stateManager.patch({ world: { centerX: lon, centerY: lat }, focusRegion: code }, "camera:focusRegion");
    return true;
  }
  focusNode(id) {
    const node = this.nodeNetwork.get(id);
    if (!node) return false;
    this.orientGlobe(node.location.lat, node.location.lon);
    this.stateManager.patch({ world: { centerX: node.location.lon, centerY: node.location.lat } }, "camera:focusNode");
    return true;
  }

  zoomTo(value) {
    const state = this.stateManager.get();
    const zoom = Math.max(0.72, Math.min(1.55, Number(value) || 1));
    if (state.view === "GLOBE" || state.view.startsWith("TRANSITION")) state.globe.zoom = zoom;
    else if (state.view === "COUNTRY") state.country.zoom = zoom;
    else state.world.zoom = zoom;
    return zoom;
  }

  beginGlobeDrag(x, y) { this.dragging = true; this.lastPointer = { x, y }; this.autoRotate = false; }
  dragGlobe(x, y) {
    if (!this.dragging || !this.lastPointer) return;
    const state = this.stateManager.get();
    const dx = x - this.lastPointer.x, dy = y - this.lastPointer.y;
    state.globe.rotationY += dx * 0.006;
    state.globe.rotationX = Math.max(-1.1, Math.min(1.1, state.globe.rotationX + dy * 0.0045));
    this.lastPointer = { x, y };
  }
  endGlobeDrag() { this.dragging = false; this.lastPointer = null; if (!this.reducedMotion) this.autoRotate = true; }

  update(dt) {
    const state = this.stateManager.get();
    if (this.autoRotate && state.view === "GLOBE" && !this.reducedMotion) state.globe.rotationY += dt * 0.045;
  }
}
