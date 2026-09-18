const VIEW_RANK = Object.freeze({ GLOBE: 0, WORLD: 1, COUNTRY: 2 });

export class InfrastructureGraph {
  constructor({ dataUrl = './src/data/infrastructure-v1.json', iconCatalogUrl = './src/data/infrastructure-icon-catalog.json' } = {}) {
    this.dataUrl = dataUrl;
    this.iconCatalogUrl = iconCatalogUrl;
    this.nodes = [];
    this.byId = new Map();
    this.byCountry = new Map();
    this.iconCatalog = {};
    this.metadata = null;
  }

  async init() {
    const [dataResponse, iconResponse] = await Promise.all([fetch(this.dataUrl), fetch(this.iconCatalogUrl)]);
    if (!dataResponse.ok) throw new Error('InfrastructureGraph: données indisponibles');
    if (!iconResponse.ok) throw new Error('InfrastructureGraph: catalogue icônes indisponible');
    const payload = await dataResponse.json();
    this.iconCatalog = await iconResponse.json();
    this.metadata = { schemaVersion: payload.schemaVersion, dataset: payload.dataset, dataPolicy: payload.dataPolicy };
    this.nodes = (payload.nodes || []).map((raw) => this.normalizeNode(raw));
    this.byId = new Map(this.nodes.map((node) => [node.id, node]));
    this.byCountry.clear();
    for (const node of this.nodes) {
      const list = this.byCountry.get(node.country) || [];
      list.push(node);
      this.byCountry.set(node.country, list);
    }
    return this;
  }

  normalizeNode(raw) {
    const status = String(raw.status || 'OPERATIONAL').toUpperCase();
    return {
      ...raw,
      status,
      capacity: Math.max(0, Math.min(100, Number(raw.capacity) || 0)),
      health: Math.max(0, Math.min(100, Number(raw.health) || 0)),
      strategicValue: Math.max(0, Math.min(1, Number(raw.strategicValue) || 0)),
      connections: [...new Set(raw.connections || [])],
      dependencies: [...new Set(raw.dependencies || [])],
      icon: this.iconCatalog[raw.type] || null
    };
  }

  get(id) { return this.byId.get(id) || null; }
  list() { return this.nodes.slice(); }
  forCountry(code) { return (this.byCountry.get(String(code || '').toUpperCase()) || []).slice(); }

  visible({ view = 'WORLD', country = null, enabledLayers = null } = {}) {
    const rank = VIEW_RANK[view] ?? 1;
    const layerSet = enabledLayers ? new Set(enabledLayers) : null;
    return this.nodes.filter((node) => {
      if (VIEW_RANK[node.minView] > rank) return false;
      if (view === 'COUNTRY' && country && node.country !== country) return false;
      if (layerSet && !layerSet.has(node.layer)) return false;
      return true;
    });
  }

  setStatus(id, status) {
    const node = this.get(id);
    if (!node) return false;
    const allowed = new Set(['OPERATIONAL','DEGRADED','DISRUPTED','CRITICAL','OFFLINE','DESTROYED']);
    const normalized = String(status || '').toUpperCase();
    if (!allowed.has(normalized)) return false;
    node.status = normalized;
    return true;
  }

  setHealth(id, health) {
    const node = this.get(id);
    if (!node) return false;
    node.health = Math.max(0, Math.min(100, Number(health) || 0));
    return true;
  }

  stats(country = null) {
    const nodes = country ? this.forCountry(country) : this.nodes;
    const byCategory = {};
    for (const node of nodes) byCategory[node.category] = (byCategory[node.category] || 0) + 1;
    return { total: nodes.length, byCategory };
  }

  destroy() {
    this.nodes.length = 0;
    this.byId.clear();
    this.byCountry.clear();
  }
}
