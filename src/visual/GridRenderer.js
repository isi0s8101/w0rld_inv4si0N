import { THEME } from "./Theme.js";

function seeded(seed = 303) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export class GridRenderer {
  constructor() {
    this.worldFragments = this.createWorldFragments();
    this.countryCache = new Map();
  }

  createWorldFragments() {
    const random = seeded(0xC1B3);
    const fragments = [];
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let start = -180; start < 180;) {
        const gap = 18 + random() * 34;
        const length = 22 + random() * 58;
        start += gap;
        if (start >= 180) break;
        fragments.push({ kind: "lat", value: lat, from: start, to: Math.min(180, start + length), phase: random() * 7 });
        start += length;
      }
    }
    for (let lon = -160; lon <= 160; lon += 20) {
      for (let start = -82; start < 82;) {
        const gap = 10 + random() * 21;
        const length = 12 + random() * 34;
        start += gap;
        if (start >= 82) break;
        fragments.push({ kind: "lon", value: lon, from: start, to: Math.min(82, start + length), phase: random() * 7 });
        start += length;
      }
    }
    return fragments;
  }

  createCountryFragments(feature) {
    const code = feature?.properties?.iso2;
    if (!feature || !code) return [];
    if (this.countryCache.has(code)) return this.countryCache.get(code);
    const random = seeded(code.charCodeAt(0) * 101 + (code.charCodeAt(1) || 0) * 37);
    const bounds = feature.properties.focusBounds || feature.properties.bounds;
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const lonSpan = Math.max(0.5, maxLon - minLon);
    const latSpan = Math.max(0.5, maxLat - minLat);
    const lonStep = Math.max(0.8, lonSpan / 7);
    const latStep = Math.max(0.8, latSpan / 6);
    const fragments = [];

    for (let lat = minLat; lat <= maxLat; lat += latStep) {
      const from = minLon + random() * lonSpan * 0.14;
      const length = lonSpan * (0.18 + random() * 0.28);
      fragments.push({ kind: "lat", value: lat, from, to: Math.min(maxLon, from + length), phase: random() * 7 });
    }
    for (let lon = minLon; lon <= maxLon; lon += lonStep) {
      const from = minLat + random() * latSpan * 0.14;
      const length = latSpan * (0.18 + random() * 0.30);
      fragments.push({ kind: "lon", value: lon, from, to: Math.min(maxLat, from + length), phase: random() * 7 });
    }
    this.countryCache.set(code, fragments);
    return fragments;
  }

  scanBoost(fragment, projection, scans, mode) {
    if (!scans?.length) return 0;
    const mid = fragment.kind === "lat"
      ? { lat: fragment.value, lon: (fragment.from + fragment.to) / 2 }
      : { lat: (fragment.from + fragment.to) / 2, lon: fragment.value };
    const p = projection.project(mid.lat, mid.lon);
    if (!p.visible) return 0;
    let boost = 0;
    for (const event of scans) {
      const center = projection.project(event.data.lat, event.data.lon);
      if (!center.visible) continue;
      const scale = mode === "country" ? 42 : mode === "globe" ? 23 : 30;
      const radius = 2 + event.progress * scale;
      const distance = Math.hypot(p.x - center.x, p.y - center.y);
      const proximity = 1 - Math.min(1, Math.abs(distance - radius) / Math.max(8, radius * 0.45));
      boost = Math.max(boost, proximity * (1 - event.progress));
    }
    return clamp(boost);
  }

  render(ctx, projection, {
    alpha = 1,
    mode = "world",
    feature = null,
    events = [],
    time = 0,
    quality = "HIGH"
  } = {}) {
    const scans = events.filter((event) => event.type === "SCAN_STARTED" && (!feature || event.data.country === feature.properties.iso2));
    const fragments = mode === "country" ? this.createCountryFragments(feature) : this.worldFragments;
    const stride = quality === "LOW" ? 2 : 1;
    ctx.save();
    ctx.lineWidth = mode === "country" ? 0.52 : 0.44;
    ctx.lineCap = "round";
    ctx.strokeStyle = THEME.grid;

    for (let i = 0; i < fragments.length; i += stride) {
      const fragment = fragments[i];
      const boost = this.scanBoost(fragment, projection, scans, mode);
      const idle = 0.035 + (Math.sin(time * 0.12 + fragment.phase) + 1) * 0.010;
      const opacity = idle + boost * 0.115;
      if (opacity < 0.01) continue;
      ctx.globalAlpha = alpha * opacity;
      ctx.shadowColor = THEME.node;
      ctx.shadowBlur = boost > 0.05 ? 3 + boost * 5 : 0;
      ctx.beginPath();
      let drawing = false;
      let last = null;
      const samples = mode === "globe" ? 14 : 8;
      for (let s = 0; s <= samples; s++) {
        const t = s / samples;
        const lat = fragment.kind === "lat" ? fragment.value : fragment.from + (fragment.to - fragment.from) * t;
        const lon = fragment.kind === "lat" ? fragment.from + (fragment.to - fragment.from) * t : fragment.value;
        const p = projection.project(lat, lon);
        const jump = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
        if (!p.visible || (mode === "globe" && jump > projection.radius * 0.40)) { drawing = false; last = p; continue; }
        if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; }
        else ctx.lineTo(p.x, p.y);
        last = p;
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
