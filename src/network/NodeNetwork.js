export class NodeNetwork {
  constructor({ nodesUrl = "./src/data/nodes.json", citiesUrl = "./src/data/cities.json" } = {}) {
    this.nodesUrl = nodesUrl;
    this.citiesUrl = citiesUrl;
    this.nodes = [];
    this.byId = new Map();
    this.cityById = new Map();
    this.surgeUntil = 0;
  }

  async init() {
    const [nr, cr] = await Promise.all([fetch(this.nodesUrl), fetch(this.citiesUrl)]);
    if (!nr.ok || !cr.ok) throw new Error("NodeNetwork: données indisponibles");
    const [rawNodes, cities] = await Promise.all([nr.json(), cr.json()]);
    this.cityById = new Map(cities.map((city) => [city.id, city]));
    this.nodes = rawNodes.map((node) => {
      const city = this.cityById.get(node.cityId);
      if (!city) throw new Error(`NodeNetwork: ville inconnue ${node.cityId}`);
      return {
        ...node,
        location: { country: city.country, city: city.name, lat: city.lat, lon: city.lon },
        phase: (node.id.length * 0.71) % (Math.PI * 2),
        stateRemaining: 0
      };
    });
    this.byId = new Map(this.nodes.map((node) => [node.id, node]));
    return this;
  }

  get(id) { return this.byId.get(id) || null; }

  getNodesForLOD(lod = 1, countryCode = null) {
    return this.nodes.filter((node) => node.minLod <= lod && (!countryCode || node.location.country === countryCode));
  }

  pickNode(random = Math.random, lod = 1) {
    const list = this.getNodesForLOD(lod);
    return list.length ? list[Math.floor(random() * list.length)] : null;
  }

  setState(id, state, duration = 1) {
    const node = this.get(id);
    if (!node) return false;
    node.state = state;
    node.stateRemaining = Math.max(node.stateRemaining || 0, duration);
    return true;
  }

  surge(duration = 2) { this.surgeRemaining = Math.max(this.surgeRemaining || 0, duration); }

  update(dt) {
    this.surgeRemaining = Math.max(0, (this.surgeRemaining || 0) - dt);
    for (const node of this.nodes) {
      node.phase += dt * (0.75 + node.activity * 1.4);
      node.stateRemaining = Math.max(0, (node.stateRemaining || 0) - dt);
      if (node.state !== "idle" && node.stateRemaining <= 0) node.state = "idle";
    }
  }

  destroy() { this.nodes.length = 0; this.byId.clear(); this.cityById.clear(); }
}
