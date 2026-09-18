export class MobileEntityEngine {
  constructor({ routeEngine, dataUrl = './src/data/mobile-entities-v1.json' } = {}) {
    this.routeEngine = routeEngine; this.dataUrl = dataUrl; this.entities = []; this.byId = new Map();
  }
  async init() {
    const response = await fetch(this.dataUrl); if (!response.ok) throw new Error('MobileEntityEngine: données indisponibles');
    const payload = await response.json();
    this.entities = (payload.entities || []).map((entity) => ({ ...entity, progress: Math.max(0, Math.min(1, Number(entity.progress) || 0)), position: this.routeEngine.interpolate(entity.route, entity.progress) }));
    this.byId = new Map(this.entities.map((entity) => [entity.id, entity])); return this;
  }
  get(id) { return this.byId.get(id) || null; }
  visible({ country = null, layers = null } = {}) {
    const enabled = layers ? new Set(layers) : null;
    const layerFor = { SHIP:'MARITIME', SUBMARINE:'MARITIME', AIRCRAFT:'AVIATION', DRONE:'MILITARY', TRUCK:'LOGISTICS' };
    return this.entities.filter((entity) => {
      if (enabled && !enabled.has(layerFor[entity.type])) return false;
      if (!country) return true;
      const route = this.routeEngine.get(entity.route); return route?.country === country;
    });
  }
  update(dt) {
    const seconds = Math.max(0, Number(dt) || 0);
    for (const entity of this.entities) {
      if (entity.status !== 'MOVING') continue;
      const route = this.routeEngine.get(entity.route); if (!route) continue;
      const visualDuration = Math.max(8, Math.min(75, route.distanceKm / Math.max(1, entity.speedKph) * 2.4));
      entity.progress += seconds / visualDuration;
      if (entity.progress >= 1) entity.progress = entity.loop ? entity.progress % 1 : 1;
      entity.position = this.routeEngine.interpolate(route, entity.progress);
    }
  }
  destroy() { this.entities.length = 0; this.byId.clear(); }
}
