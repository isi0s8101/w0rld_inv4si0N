import { geometryRings, pointInFeature } from "./geometry.js";

function seeded(seed = 101) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }

export class WorldEngine {
  constructor({
    worldUrl = "./src/data/world.geojson",
    countriesUrl = "./src/data/countries.json",
    regionsUrl = "./src/data/regions.json",
    citiesUrl = "./src/data/cities.json",
    countryMetaUrl = "./src/data/country-meta.json"
  } = {}) {
    this.worldUrl = worldUrl;
    this.countriesUrl = countriesUrl;
    this.regionsUrl = regionsUrl;
    this.citiesUrl = citiesUrl;
    this.countryMetaUrl = countryMetaUrl;
    this.geojson = null;
    this.features = [];
    this.countries = [];
    this.regions = [];
    this.cities = [];
    this.countryMeta = [];
    this.byCode = new Map();
    this.regionById = new Map();
    this.metaByCode = new Map();
    this.citiesByCountry = new Map();
    this.terrainCache = new Map();
    this.neighborCache = new Map();
  }

  async init() {
    const responses = await Promise.all([
      fetch(this.worldUrl), fetch(this.countriesUrl), fetch(this.regionsUrl), fetch(this.citiesUrl), fetch(this.countryMetaUrl)
    ]);
    if (responses.some((response) => !response.ok)) throw new Error("WorldEngine: données géographiques indisponibles");
    const [worldResponse, countriesResponse, regionsResponse, citiesResponse, metaResponse] = responses;
    [this.geojson, this.countries, this.regions, this.cities, this.countryMeta] = await Promise.all([
      worldResponse.json(), countriesResponse.json(), regionsResponse.json(), citiesResponse.json(), metaResponse.json()
    ]);

    this.regionById = new Map(this.regions.map((region) => [region.id, region]));
    this.metaByCode = new Map(this.countryMeta.map((meta) => [meta.iso2, meta]));
    this.citiesByCountry.clear();
    for (const city of this.cities) {
      const list = this.citiesByCountry.get(city.country) || [];
      list.push(city);
      this.citiesByCountry.set(city.country, list);
    }

    this.features = this.geojson.features || [];
    this.byCode.clear();
    for (const feature of this.features) {
      const code = feature.properties?.iso2 || feature.id;
      feature.properties.iso2 = code;
      this.byCode.set(code, feature);
    }
    return this;
  }

  getCountry(code) { return code ? this.byCode.get(String(code).toUpperCase()) || null : null; }
  getCountryMeta(code) { return code ? this.metaByCode.get(String(code).toUpperCase()) || null : null; }
  getRegion(code) { return code ? this.regionById.get(String(code).toUpperCase()) || null : null; }
  listCountries() { return this.countries.slice().sort((a, b) => a.name.localeCompare(b.name)); }

  findCountry(lon, lat) {
    for (const feature of this.features) {
      const b = feature.properties.bounds;
      if (b && (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3])) continue;
      if (pointInFeature(lon, lat, feature)) return feature;
    }
    return null;
  }

  getNeighbors(code) {
    if (this.neighborCache.has(code)) return this.neighborCache.get(code);
    const feature = this.getCountry(code);
    if (!feature) return new Set();
    const a = feature.properties.bounds;
    const margin = 4;
    const neighbors = new Set();
    for (const other of this.features) {
      const otherCode = other.properties.iso2;
      if (otherCode === code) continue;
      const b = other.properties.bounds;
      const separated = b[2] < a[0] - margin || b[0] > a[2] + margin || b[3] < a[1] - margin || b[1] > a[3] + margin;
      if (!separated) neighbors.add(otherCode);
    }
    this.neighborCache.set(code, neighbors);
    return neighbors;
  }

  rings(code = null) {
    if (code) {
      const feature = this.getCountry(code);
      return feature ? geometryRings(feature) : [];
    }
    return this.features.flatMap((feature) => geometryRings(feature).map((ring) => ({ ring, feature })));
  }

  decorateTerrainPoint(point, random) {
    const r = random();
    let layer;
    if (point.edge > 0.72) layer = r < 0.34 ? "primary" : r < 0.70 ? "secondary" : "dust";
    else if (point.urban > 0.35) layer = r < 0.28 ? "primary" : r < 0.66 ? "secondary" : "dust";
    else layer = r < 0.20 ? "primary" : r < 0.50 ? "secondary" : "dust";

    const profile = layer === "primary"
      ? { baseAlpha: 0.52, amplitude: 0.08, speed: [0.18, 0.36] }
      : layer === "secondary"
        ? { baseAlpha: 0.29, amplitude: 0.07, speed: [0.16, 0.42] }
        : { baseAlpha: 0.11, amplitude: 0.045, speed: [0.12, 0.32] };

    return {
      ...point,
      layer,
      phase: random() * Math.PI * 2,
      speed: profile.speed[0] + random() * (profile.speed[1] - profile.speed[0]),
      baseAlpha: clamp(profile.baseAlpha * (0.86 + random() * 0.28), 0.03, 0.72),
      amplitude: profile.amplitude * (0.70 + random() * 0.55),
      noiseOffset: random() * Math.PI * 4,
      reveal: random()
    };
  }

  terrainPoints(count = 3000, countryCode = null) {
    const key = `${count}:${countryCode || "world"}:v11`;
    if (this.terrainCache.has(key)) return this.terrainCache.get(key);
    const random = seeded(0x101 + count + (countryCode ? countryCode.charCodeAt(0) * 13 : 0));
    const features = countryCode ? [this.getCountry(countryCode)].filter(Boolean) : this.features;
    const featureByCode = new Map(features.map((feature) => [feature.properties.iso2, feature]));
    const weighted = features.map((feature) => {
      const samplingBounds = countryCode ? (feature.properties.focusBounds || feature.properties.bounds) : feature.properties.bounds;
      const [minLon, minLat, maxLon, maxLat] = samplingBounds;
      const midLat = (minLat + maxLat) / 2;
      const weight = Math.max(0.02, (maxLon - minLon) * (maxLat - minLat) * Math.max(0.15, Math.cos(midLat * Math.PI / 180)));
      return { feature, weight, samplingBounds };
    });
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cumulative = 0;
    for (const item of weighted) { cumulative += item.weight / total; item.cumulative = cumulative; }

    const points = [];
    const coastPool = [];
    for (const feature of features) {
      for (const ring of geometryRings(feature)) {
        const stride = Math.max(1, Math.floor(ring.length / 52));
        for (let i = 0; i < ring.length; i += stride) {
          coastPool.push({ lon: ring[i][0], lat: ring[i][1], country: feature.properties.iso2, edge: 1, urban: 0 });
        }
      }
    }

    // 1) Matière côtière : présence renforcée sans créer une bande continue.
    const coastTarget = Math.min(Math.floor(count * 0.30), coastPool.length * 3);
    for (let i = 0; i < coastTarget && coastPool.length; i++) {
      const base = coastPool[Math.floor(random() * coastPool.length)];
      points.push({
        ...base,
        lon: base.lon + (random() - 0.5) * (countryCode ? 0.20 : 0.32),
        lat: base.lat + (random() - 0.5) * (countryCode ? 0.20 : 0.32),
        depth: 0.68 + random() * 0.32,
        edge: 0.72 + random() * 0.28
      });
    }

    // 2) Hubs urbains connus : densité locale subtile et stable.
    const cityPool = this.cities.filter((city) => featureByCode.has(city.country));
    const urbanTarget = Math.min(Math.floor(count * 0.14), cityPool.length * (countryCode ? 70 : 42));
    let urbanGuard = 0;
    while (points.length < coastTarget + urbanTarget && cityPool.length && urbanGuard < urbanTarget * 12) {
      urbanGuard++;
      const city = cityPool[Math.floor(random() * cityPool.length)];
      const feature = featureByCode.get(city.country);
      const radius = countryCode ? 0.38 : 0.72;
      const angle = random() * Math.PI * 2;
      const distance = Math.pow(random(), 1.65) * radius;
      const lon = city.lon + Math.cos(angle) * distance / Math.max(0.25, Math.cos(city.lat * Math.PI / 180));
      const lat = city.lat + Math.sin(angle) * distance;
      if (!pointInFeature(lon, lat, feature)) continue;
      points.push({ lon, lat, country: city.country, edge: 0.08 + random() * 0.20, urban: 0.55 + random() * 0.45, depth: 0.52 + random() * 0.48 });
    }

    // 3) Corps du continent.
    let guard = 0;
    while (points.length < count && guard < count * 100) {
      guard++;
      const r = random();
      const item = weighted.find((candidate) => r <= candidate.cumulative) || weighted[weighted.length - 1];
      if (!item) break;
      const feature = item.feature;
      const [minLon, minLat, maxLon, maxLat] = item.samplingBounds;
      const lon = minLon + random() * (maxLon - minLon);
      const lat = minLat + random() * (maxLat - minLat);
      if (!pointInFeature(lon, lat, feature)) continue;
      points.push({ lon, lat, country: feature.properties.iso2, edge: 0, urban: 0, depth: random() });
    }

    const decorated = points.slice(0, count).map((point) => this.decorateTerrainPoint(point, random));
    this.terrainCache.set(key, decorated);
    return decorated;
  }

  destroy() {
    this.byCode.clear(); this.regionById.clear(); this.metaByCode.clear(); this.citiesByCountry.clear();
    this.terrainCache.clear(); this.neighborCache.clear(); this.features = []; this.geojson = null; this.regions = []; this.cities = []; this.countryMeta = [];
  }
}
