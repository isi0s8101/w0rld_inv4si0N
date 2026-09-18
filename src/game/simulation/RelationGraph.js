const DEG = Math.PI / 180;
function distanceKm(a, b) {
  const [lon1, lat1] = a; const [lon2, lat2] = b;
  const p1 = lat1 * DEG, p2 = lat2 * DEG;
  const dLat = (lat2 - lat1) * DEG, dLon = (lon2 - lon1) * DEG;
  const h = Math.sin(dLat/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}

const LANDLOCKED = new Set(["AF","AD","AM","AT","AZ","BY","BT","BO","BW","BF","BI","CF","TD","CZ","ET","HU","KZ","KG","LA","LS","LI","LU","MW","ML","MD","MN","NP","NE","MK","PY","RW","SM","RS","SK","SS","SZ","CH","TJ","TM","UG","UZ","VA","ZM","ZW"]);

export class RelationGraph {
  constructor() { this.edges = new Map(); this.out = new Map(); this.in = new Map(); this.routeCache = new Map(); }

  build(countries, states, worldEngine, random) {
    this.edges.clear(); this.out.clear(); this.in.clear(); this.routeCache.clear();
    const byCode = new Map(countries.map((c) => [c.iso2, c]));
    for (const source of countries) {
      const neighbors = worldEngine.getNeighbors(source.iso2);
      const ranked = countries.filter((c) => c.iso2 !== source.iso2).map((target) => ({
        target,
        distance: distanceKm(source.center, target.center),
        neighbor: neighbors.has(target.iso2),
        sameContinent: source.continent === target.continent
      })).sort((a,b) => (b.neighbor - a.neighbor) || (a.distance - b.distance));
      const chosen = new Map();
      for (const item of ranked.filter((x) => x.neighbor).slice(0, 8)) chosen.set(item.target.iso2, item);
      for (const item of ranked.filter((x) => x.sameContinent).slice(0, 7)) chosen.set(item.target.iso2, item);
      for (const item of ranked.slice(0, 5)) chosen.set(item.target.iso2, item);
      const longRange = ranked.filter((x) => x.distance > 2500);
      for (let i=0; i<Math.min(3,longRange.length); i++) {
        const item = longRange[Math.floor(random.next() * longRange.length)];
        chosen.set(item.target.iso2, item);
      }
      for (const item of chosen.values()) this.addSyntheticEdge(source, item.target, states, item, random.fork(`${source.iso2}:${item.target.iso2}`));
    }
    return this;
  }

  addSyntheticEdge(source, target, states, info, random) {
    const s = states.get(source.iso2), t = states.get(target.iso2);
    const proximity = Math.max(0, 1 - info.distance / 12000);
    const affinity = (info.neighbor ? 0.20 : 0) + (info.sameContinent ? 0.12 : 0) + proximity * 0.30;
    const base = 30 + affinity * 55 + random.range(-12, 12);
    const transport = Math.max(8, Math.min(100, base + (s.metrics.infrastructure.current + t.metrics.infrastructure.current - 100) * 0.16));
    const modes = new Set(["AIR", "DATA_SPACE"]);
    if (info.neighbor) { modes.add("LAND"); modes.add("DATA_TERRESTRIAL"); }
    else if (info.sameContinent && info.distance < 3000) modes.add("DATA_TERRESTRIAL");
    if (!LANDLOCKED.has(source.iso2) && !LANDLOCKED.has(target.iso2) && info.distance > 500) { modes.add("SEA"); modes.add("DATA_SUBMARINE"); }
    const capacities = {};
    for (const mode of modes) {
      const scale = mode === "SEA" ? 1.8 : mode === "LAND" ? 1.25 : mode.startsWith("DATA_") ? 1.55 : 0.75;
      capacities[mode] = Math.max(3, transport * scale * random.range(0.65, 1.25));
    }
    const edge = {
      id: `${source.iso2}>${target.iso2}`,
      from: source.iso2, to: target.iso2, distanceKm: info.distance,
      trade: Math.max(0, Math.min(100, base + random.range(-10, 10))),
      energyDependency: Math.max(0, Math.min(100, 22 + affinity * 45 + random.range(-16, 20))),
      diplomaticRelation: Math.max(0, Math.min(100, 46 + affinity * 36 + random.range(-12, 12))),
      alliance: Math.max(0, Math.min(100, 34 + affinity * 42 + random.range(-18, 18))),
      technologyDependency: Math.max(0, Math.min(100, 24 + affinity * 44 + random.range(-12, 18))),
      transport,
      trust: Math.max(0, Math.min(100, 44 + affinity * 38 + random.range(-10, 10))),
      modes: [...modes], capacities, scenarioData: true, dataClass: "DERIVED_SIMULATION"
    };
    this.edges.set(edge.id, edge);
    const list = this.out.get(edge.from) || []; list.push(edge); this.out.set(edge.from, list);
    const incoming = this.in.get(edge.to) || []; incoming.push(edge); this.in.set(edge.to, incoming);
  }

  outgoing(code) { return this.out.get(code) || []; }
  incoming(code) { return this.in.get(code) || []; }
  get(from, to) { return this.edges.get(`${from}>${to}`) || null; }
  all() { return [...this.edges.values()]; }

  allowedModes(resource) {
    if (resource === "data") return new Set(["DATA_TERRESTRIAL","DATA_SUBMARINE","DATA_SPACE"]);
    if (resource === "energy") return new Set(["LAND","SEA","AIR"]);
    return new Set(["LAND","SEA","AIR"]);
  }

  bestMode(edge, resource) {
    const allowed = this.allowedModes(resource);
    const candidates = edge.modes.filter((m) => allowed.has(m));
    if (!candidates.length) return null;
    const preference = resource === "data"
      ? { DATA_TERRESTRIAL: 1, DATA_SUBMARINE: 1.05, DATA_SPACE: 1.8 }
      : { LAND: 1, SEA: 1.08, AIR: 2.6 };
    return candidates.sort((a,b) => (preference[a]||2) - (preference[b]||2))[0];
  }

  findRoute(from, to, resource, maxHops = 5) {
    if (from === to) return { nodes: [from], edges: [], modes: [], capacity: Infinity, cost: 0 };
    const key = `${from}>${to}:${resource}`;
    if (this.routeCache.has(key)) return this.routeCache.get(key);
    const dist = new Map([[from,0]]), hops = new Map([[from,0]]), prev = new Map();
    const queue = [{ code: from, cost: 0 }];
    while (queue.length) {
      queue.sort((a,b)=>a.cost-b.cost);
      const cur = queue.shift();
      if (cur.cost !== dist.get(cur.code)) continue;
      if (cur.code === to) break;
      const hop = hops.get(cur.code) || 0;
      if (hop >= maxHops) continue;
      for (const edge of this.outgoing(cur.code)) {
        const mode = this.bestMode(edge, resource); if (!mode) continue;
        const capacity = edge.capacities[mode] || 0; if (capacity <= 0) continue;
        const modePenalty = mode === "AIR" || mode === "DATA_SPACE" ? 1.7 : 1;
        const edgeCost = (edge.distanceKm / 1800 + 0.35) * modePenalty + (100-edge.transport)/170;
        const nextCost = cur.cost + edgeCost;
        if (nextCost < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to,nextCost); hops.set(edge.to,hop+1); prev.set(edge.to,{ edge, mode }); queue.push({code:edge.to,cost:nextCost});
        }
      }
    }
    if (!prev.has(to)) { this.routeCache.set(key, null); return null; }
    const edges=[], modes=[], nodes=[to]; let cursor=to, capacity=Infinity;
    while (cursor !== from) {
      const step=prev.get(cursor); if(!step) return null;
      edges.push(step.edge); modes.push(step.mode); capacity=Math.min(capacity, step.edge.capacities[step.mode]||0); cursor=step.edge.from; nodes.push(cursor);
    }
    edges.reverse(); modes.reverse(); nodes.reverse();
    const route={nodes,edges,modes,capacity,cost:dist.get(to)}; this.routeCache.set(key,route); return route;
  }
}
