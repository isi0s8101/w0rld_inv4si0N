import { TrafficRoute } from "./TrafficRoute.js";

export class TrafficEngine {
  constructor({ routesUrl = "./src/data/routes.json", nodeNetwork }) {
    this.routesUrl = routesUrl;
    this.nodeNetwork = nodeNetwork;
    this.routes = [];
    this.byId = new Map();
    this.active = [];
  }

  async init() {
    const response = await fetch(this.routesUrl);
    if (!response.ok) throw new Error("TrafficEngine: routes indisponibles");
    this.routes = await response.json();
    this.byId = new Map(this.routes.map((route) => [route.id, route]));
    return this;
  }

  pickRoute(random = Math.random) {
    if (!this.routes.length) return null;
    const total = this.routes.reduce((sum, route) => sum + (route.weight || 1), 0);
    let r = random() * total;
    for (const route of this.routes) {
      r -= route.weight || 1;
      if (r <= 0) return route;
    }
    return this.routes[this.routes.length - 1];
  }

  startFromEvent(event) {
    const route = this.byId.get(event.data.routeId) || { id: event.data.routeId, from: event.data.from, to: event.data.to };
    if (!route || !this.nodeNetwork.get(route.from) || !this.nodeNetwork.get(route.to)) return null;
    const active = new TrafficRoute({
      id: `${event.id}:${route.id}`,
      from: route.from,
      to: route.to,
      startTime: event.startTime,
      duration: event.duration,
      intensity: event.data.intensity ?? 0.65
    });
    this.active.push(active);
    return active;
  }

  update(now) {
    for (const route of this.active) route.update(now);
    this.active = this.active.filter((route) => !route.completed);
  }

  getActive({ country = null } = {}) {
    if (!country) return this.active;
    return this.active.filter((route) => {
      const from = this.nodeNetwork.get(route.from), to = this.nodeNetwork.get(route.to);
      return from?.location.country === country || to?.location.country === country;
    });
  }

  destroy() { this.active.length = 0; this.routes.length = 0; this.byId.clear(); }
}
