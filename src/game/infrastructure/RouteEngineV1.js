const EARTH_RADIUS_KM = 6371;
const rad = (value) => value * Math.PI / 180;

function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const la1 = rad(a.lat), la2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export class RouteEngineV1 {
  constructor({ infrastructureGraph, routesUrl = './src/game/data/world-network-v1.json' } = {}) {
    this.infrastructure = infrastructureGraph;
    this.routesUrl = routesUrl;
    this.routes = [];
    this.byId = new Map();
    this.adjacency = new Map();
  }

  async init() {
    const response = await fetch(this.routesUrl);
    if (!response.ok) throw new Error('RouteEngineV1: routes indisponibles');
    const payload = await response.json();
    this.routes = (payload.routes || []).map((route) => this.normalizeRoute(route));
    this.byId = new Map(this.routes.map((route) => [route.id, route]));
    this.rebuildGraph();
    return this;
  }

  normalizeRoute(raw) {
    const from = this.infrastructure.get(raw.from), to = this.infrastructure.get(raw.to);
    if (!from || !to) throw new Error(`RouteEngineV1: nœud introuvable pour ${raw.id}`);
    const points = [{...from.position, kind:'ORIGIN', nodeId:from.id}, ...(raw.waypoints || []), {...to.position, kind:'DESTINATION', nodeId:to.id}].map((p) => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) }));
    const segmentDistances = [];
    let computedDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const d = haversine(points[i - 1], points[i]);
      segmentDistances.push(d); computedDistance += d;
    }
    return {
      ...raw,
      status: String(raw.status || 'OPEN').toUpperCase(),
      points,
      segmentDistances,
      computedDistanceKm: computedDistance,
      distanceKm: Number(raw.distanceKm) > 0 ? Number(raw.distanceKm) : computedDistance,
      capacity: Math.max(0, Number(raw.capacity) || 0),
      maxCapacity: Math.max(0, Number(raw.maxCapacity ?? raw.capacity) || 0),
      currentUsage: Math.max(0, Number(raw.currentUsage) || 0),
      availableCapacity: Math.max(0, Number(raw.maxCapacity ?? raw.capacity) || 0),
      congestionRuntime: Math.max(0, Math.min(1, Number(raw.congestion) || 0)),
      congestion: Math.max(0, Math.min(1, Number(raw.congestion) || 0)),
      risk: Math.max(0, Math.min(1, Number(raw.risk) || 0))
    };
  }

  rebuildGraph() {
    this.adjacency.clear();
    const push = (from, edge) => { const list = this.adjacency.get(from) || []; list.push(edge); this.adjacency.set(from, list); };
    for (const route of this.routes) {
      if (['CLOSED','BLOCKED'].includes(route.status)) continue;
      const congestion = route.congestionRuntime ?? route.congestion;
      const availability = (route.maxCapacity || route.capacity) > 0 ? (route.availableCapacity ?? route.capacity) / (route.maxCapacity || route.capacity) : 0;
      const saturationPenalty = availability <= 0 ? 9 : Math.max(0, 1 - availability) * 1.6;
      const statusPenalty = route.status === 'RESTRICTED' ? 0.55 : route.status === 'RISKY' ? 0.35 : route.status === 'CONGESTED' ? 0.28 : 0;
      const cost = route.distanceKm * (1 + congestion * 0.45 + route.risk * 0.75 + saturationPenalty + statusPenalty);
      push(route.from, { to: route.to, routeId: route.id, cost });
      push(route.to, { to: route.from, routeId: route.id, cost });
    }
  }

  get(id) { return this.byId.get(id) || null; }
  list({ type = null, country = null, layers = null } = {}) {
    const layerSet = layers ? new Set(layers) : null;
    return this.routes.filter((route) => (!type || route.type === type) && (!country || route.country === country) && (!layerSet || layerSet.has(route.layer)));
  }

  graphs() {
    const out = {};
    for (const route of this.routes) (out[route.type] ||= []).push(route);
    return out;
  }

  setStatus(id, status) {
    const route = this.get(id);
    if (!route) return false;
    const normalized=String(status || 'OPEN').toUpperCase();
    const allowed=new Set(['OPEN','CONGESTED','RESTRICTED','RISKY','BLOCKED','CLOSED']);
    if(!allowed.has(normalized)) return false;
    route.status = normalized;
    this.rebuildGraph();
    return true;
  }

  beginUsageCycle() {
    for (const route of this.routes) {
      route.currentUsage = 0;
      const base=(route.maxCapacity || route.capacity || 0);
      const factor=['CLOSED','BLOCKED'].includes(route.status)?0:route.status==='RESTRICTED'?.55:route.status==='CONGESTED'?.78:1;
      route.availableCapacity = base * factor;
      route.congestionRuntime = route.congestion;
    }
    this.rebuildGraph();
  }

  reserveCapacity(id, amount) {
    const route = this.get(id);
    if (!route || ['CLOSED','BLOCKED'].includes(route.status)) return 0;
    const requested = Math.max(0, Number(amount) || 0);
    const available = Math.max(0, route.availableCapacity ?? route.maxCapacity ?? route.capacity ?? 0);
    const reserved = Math.min(requested, available);
    route.currentUsage = (route.currentUsage || 0) + reserved;
    route.availableCapacity = Math.max(0, available - reserved);
    const max = Math.max(1, route.maxCapacity || route.capacity || 1);
    const utilization = route.currentUsage / max;
    route.congestionRuntime = Math.max(route.congestion, Math.min(1, route.congestion + utilization * 0.72));
    return reserved;
  }

  shortestPath(fromId, toId, { allowedTypes = null, capacityAware = false } = {}) {
    if (fromId === toId) return { nodes: [fromId], routes: [], cost: 0 };
    const dist = new Map([[fromId, 0]]), prev = new Map(), queue = new Set([fromId]);
    while (queue.size) {
      let current = null, best = Infinity;
      for (const id of queue) { const d = dist.get(id) ?? Infinity; if (d < best) { best = d; current = id; } }
      queue.delete(current);
      if (current === toId) break;
      for (const edge of this.adjacency.get(current) || []) {
        const route = this.get(edge.routeId);
        if (!route) continue;
        if (allowedTypes && !allowedTypes.includes(route.type)) continue;
        if (capacityAware && (route.availableCapacity ?? route.capacity) <= 0) continue;
        const congestion = route.congestionRuntime ?? route.congestion;
        const availability = Math.max(0.001, (route.availableCapacity ?? route.capacity) / Math.max(1, route.maxCapacity || route.capacity));
        const dynamicCost = route.distanceKm * (1 + congestion * 0.55 + route.risk * 0.75 + (capacityAware ? (1 - availability) * 1.8 : 0));
        const alt = best + dynamicCost;
        if (alt < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, alt); prev.set(edge.to, { from: current, routeId: edge.routeId }); queue.add(edge.to);
        }
      }
    }
    if (!prev.has(toId)) return null;
    const nodes = [toId], routes = []; let cursor = toId;
    while (cursor !== fromId) { const step = prev.get(cursor); if (!step) return null; routes.unshift(step.routeId); cursor = step.from; nodes.unshift(cursor); }
    return { nodes, routes, cost: dist.get(toId) };
  }

  minimumCostPath(fromId, toId, options = {}) { return this.shortestPath(fromId, toId, { ...options, capacityAware: true }); }

  maximumFlow(fromId, toId, { allowedTypes = null } = {}) {
    if (fromId === toId) return Infinity;
    const residual = new Map();
    const neighbors = new Map();
    const key = (a,b) => `${a}>${b}`;
    const addNeighbor = (a,b) => { const set=neighbors.get(a)||new Set(); set.add(b); neighbors.set(a,set); };
    for (const route of this.routes) {
      if (['CLOSED','BLOCKED'].includes(route.status) || (allowedTypes && !allowedTypes.includes(route.type))) continue;
      const cap=Math.max(0, route.availableCapacity ?? route.maxCapacity ?? route.capacity ?? 0);
      if (cap <= 0) continue;
      residual.set(key(route.from,route.to),(residual.get(key(route.from,route.to))||0)+cap);
      residual.set(key(route.to,route.from),(residual.get(key(route.to,route.from))||0)+cap);
      addNeighbor(route.from,route.to); addNeighbor(route.to,route.from);
    }
    let total=0;
    while (true) {
      const parent=new Map([[fromId,null]]), queue=[fromId];
      while(queue.length && !parent.has(toId)){const u=queue.shift();for(const v of neighbors.get(u)||[]){if(parent.has(v))continue;if((residual.get(key(u,v))||0)<=1e-9)continue;parent.set(v,u);queue.push(v);if(v===toId)break;}}
      if(!parent.has(toId))break;
      let aug=Infinity,cursor=toId;
      while(cursor!==fromId){const u=parent.get(cursor);aug=Math.min(aug,residual.get(key(u,cursor))||0);cursor=u;}
      if(!Number.isFinite(aug)||aug<=1e-9)break;
      cursor=toId;while(cursor!==fromId){const u=parent.get(cursor);residual.set(key(u,cursor),(residual.get(key(u,cursor))||0)-aug);residual.set(key(cursor,u),(residual.get(key(cursor,u))||0)+aug);cursor=u;}
      total+=aug;
    }
    return total;
  }

  interpolate(routeOrId, progress) {
    const route = typeof routeOrId === 'string' ? this.get(routeOrId) : routeOrId;
    if (!route) return null;
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    const total = route.segmentDistances.reduce((a, b) => a + b, 0) || 1;
    let target = total * p;
    for (let i = 0; i < route.segmentDistances.length; i++) {
      const d = route.segmentDistances[i];
      if (target <= d || i === route.segmentDistances.length - 1) {
        const local = d > 0 ? target / d : 0;
        const a = route.points[i], b = route.points[i + 1];
        return { lat: a.lat + (b.lat - a.lat) * local, lon: a.lon + (b.lon - a.lon) * local };
      }
      target -= d;
    }
    return route.points.at(-1);
  }

  destroy() { this.routes.length = 0; this.byId.clear(); this.adjacency.clear(); }
}
