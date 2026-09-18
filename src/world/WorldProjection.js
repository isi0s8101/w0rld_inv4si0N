import { THEME } from "../visual/Theme.js";

function normalizeInsets(insets = {}) {
  return {
    left: Math.max(0, Number(insets.left) || 0),
    right: Math.max(0, Number(insets.right) || 0),
    top: Math.max(0, Number(insets.top) || 0),
    bottom: Math.max(0, Number(insets.bottom) || 0)
  };
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const wrapLon = (lon) => {
  let v = Number(lon) || 0;
  while (v > 180) v -= 360;
  while (v < -180) v += 360;
  return v;
};
const wrappedDelta = (lon, center) => {
  let d = wrapLon(lon) - wrapLon(center);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

export class WorldProjection {
  constructor() {
    this.camera = { centerX: 0, centerY: 0, zoom: 1 };
    this.safeArea = normalizeInsets();
    this.minZoom = 1;
    this.maxZoom = 8;
    this.resize(1, 1);
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.computeLayout();
  }

  setSafeArea(insets = {}) {
    this.safeArea = normalizeInsets(insets);
    this.computeLayout();
  }

  computeLayout() {
    const { left, right, top, bottom } = this.safeArea;
    const availableWidth = Math.max(1, this.width - left - right);
    const availableHeight = Math.max(1, this.height - top - bottom);
    const maxW = availableWidth * (1 - THEME.layout.mapPadding * 2);
    const maxH = availableHeight * THEME.layout.mapMaxHeight;
    const mapW = Math.max(1, Math.min(maxW, maxH * 2));
    const mapH = mapW / 2;
    this.layout = {
      x: left + (availableWidth - mapW) / 2,
      y: top + (availableHeight - mapH) / 2,
      width: mapW,
      height: mapH,
      safeArea: { ...this.safeArea }
    };
  }

  setCamera(camera = {}) {
    this.camera = this.clampCamera({ ...this.camera, ...camera });
    return this.camera;
  }

  clampCamera(camera = {}) {
    const zoom = clamp(Number(camera.zoom) || 1, this.minZoom, this.maxZoom);
    const maxCenterX = Math.max(0, 180 - 180 / zoom);
    const maxCenterY = Math.max(0, 90 - 90 / zoom);
    return {
      centerX: clamp(wrapLon(camera.centerX ?? 0), -maxCenterX, maxCenterX),
      centerY: clamp(Number(camera.centerY) || 0, -Math.min(82,maxCenterY), Math.min(82,maxCenterY)),
      zoom
    };
  }

  viewport() { return { ...this.layout }; }

  project(lat, lon) {
    const zoom = clamp(this.camera.zoom || 1, this.minZoom, this.maxZoom);
    const cx = this.layout.x + this.layout.width / 2;
    const cy = this.layout.y + this.layout.height / 2;
    const dx = wrappedDelta(lon, this.camera.centerX || 0);
    const dy = Number(lat) - (this.camera.centerY || 0);
    return {
      x: cx + (dx / 360) * this.layout.width * zoom,
      y: cy - (dy / 180) * this.layout.height * zoom,
      visible: true,
      depth: 1
    };
  }

  unproject(x, y, { allowOutside = false } = {}) {
    const zoom = clamp(this.camera.zoom || 1, this.minZoom, this.maxZoom);
    const cx = this.layout.x + this.layout.width / 2;
    const cy = this.layout.y + this.layout.height / 2;
    if (!allowOutside) {
      const padX = this.layout.width * 0.52;
      const padY = this.layout.height * 0.58;
      if (x < cx - padX || x > cx + padX || y < cy - padY || y > cy + padY) return null;
    }
    const lon = wrapLon((this.camera.centerX || 0) + ((x - cx) / (this.layout.width * zoom)) * 360);
    const lat = clamp((this.camera.centerY || 0) - ((y - cy) / (this.layout.height * zoom)) * 180, -90, 90);
    return { lon, lat };
  }

  geoBounds() {
    const v = this.viewport();
    const nw = this.unproject(v.x, v.y, { allowOutside: true });
    const se = this.unproject(v.x + v.width, v.y + v.height, { allowOutside: true });
    return { minLon: nw.lon, maxLon: se.lon, minLat: se.lat, maxLat: nw.lat, wraps: nw.lon > se.lon };
  }

  fitBounds(bounds, { padding = 0.14 } = {}) {
    if (!bounds) return this.camera;
    let [minLon, minLat, maxLon, maxLat] = Array.isArray(bounds)
      ? bounds
      : [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat];
    let spanLon = Math.max(0.5, Number(maxLon) - Number(minLon));
    if (spanLon > 180) spanLon = 360 - spanLon;
    const spanLat = Math.max(0.5, Number(maxLat) - Number(minLat));
    const usable = Math.max(0.35, 1 - padding * 2);
    const zoom = Math.min((360 / spanLon) * usable, (180 / spanLat) * usable, this.maxZoom);
    const centerX = wrapLon((Number(minLon) + Number(maxLon)) / 2);
    const centerY = clamp((Number(minLat) + Number(maxLat)) / 2, -82, 82);
    return this.setCamera({ centerX, centerY, zoom });
  }
}
