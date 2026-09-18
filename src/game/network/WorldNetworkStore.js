export class WorldNetworkStore {
  constructor({ url = './src/game/data/world-network-v1.json' } = {}) {
    this.url = url;
    this.metadata = null;
    this.routes = [];
    this.gateways = [];
    this.byRouteId = new Map();
    this.byGatewayId = new Map();
    this.routesByCountry = new Map();
    this.gatewaysByCountry = new Map();
  }

  async init() {
    const response = await fetch(this.url);
    if (!response.ok) throw new Error('WorldNetworkStore: données réseau indisponibles');
    const payload = await response.json();
    this.metadata = {
      schemaVersion: payload.schemaVersion,
      dataset: payload.dataset,
      generatedAt: payload.generatedAt,
      methodology: payload.methodology,
      stats: payload.stats
    };
    this.routes = Array.isArray(payload.routes) ? payload.routes : [];
    this.gateways = Array.isArray(payload.gateways) ? payload.gateways : [];
    this.byRouteId = new Map(this.routes.map((route) => [route.id, route]));
    this.byGatewayId = new Map(this.gateways.map((gateway) => [gateway.id, gateway]));
    this.routesByCountry.clear();
    this.gatewaysByCountry.clear();
    for (const route of this.routes) {
      for (const code of new Set(route.countries || (route.country ? [route.country] : []))) {
        const list = this.routesByCountry.get(code) || [];
        list.push(route);
        this.routesByCountry.set(code, list);
      }
    }
    for (const gateway of this.gateways) {
      const list = this.gatewaysByCountry.get(gateway.country) || [];
      list.push(gateway);
      this.gatewaysByCountry.set(gateway.country, list);
    }
    return this;
  }

  getRoute(id) { return this.byRouteId.get(id) || null; }
  getGateway(id) { return this.byGatewayId.get(id) || null; }
  routesForCountry(code) { return (this.routesByCountry.get(String(code || '').toUpperCase()) || []).slice(); }
  gatewaysForCountry(code, type = null) {
    return (this.gatewaysByCountry.get(String(code || '').toUpperCase()) || []).filter((g) => !type || g.type === type);
  }
  listRoutes({ type = null, scope = null } = {}) { return this.routes.filter((r) => (!type || r.type === type) && (!scope || r.scope === scope)); }
  listGateways({ type = null, country = null } = {}) { return this.gateways.filter((g) => (!type || g.type === type) && (!country || g.country === country)); }
}
