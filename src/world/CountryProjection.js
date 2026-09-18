function normalizeInsets(insets = {}) {
  return {
    left: Math.max(0, Number(insets.left) || 0),
    right: Math.max(0, Number(insets.right) || 0),
    top: Math.max(0, Number(insets.top) || 0),
    bottom: Math.max(0, Number(insets.bottom) || 0)
  };
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class CountryProjection {
  constructor() {
    this.safeArea = normalizeInsets();
    this.resize(1, 1);
    this.feature = null;
    this.camera = { centerX: null, centerY: null, zoom: 1 };
    this.minZoom = 1;
    this.maxZoom = 10;
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.updateViewport();
  }

  setSafeArea(insets = {}) {
    this.safeArea = normalizeInsets(insets);
    this.updateViewport();
  }

  updateViewport() {
    const { left, right, top, bottom } = this.safeArea;
    this.viewportRect = {
      x: left,
      y: top,
      width: Math.max(1, this.width - left - right),
      height: Math.max(1, this.height - top - bottom)
    };
    if (this.feature) this.computeBounds(this.feature);
  }

  computeBounds(feature) {
    const raw = feature?.properties?.focusBounds || feature?.properties?.bounds || [-180, -90, 180, 90];
    let [minLon, minLat, maxLon, maxLat] = raw.map(Number);
    let w = Math.max(0.25, maxLon - minLon), h = Math.max(0.25, maxLat - minLat);
    minLon -= w * 0.15; maxLon += w * 0.15; minLat -= h * 0.15; maxLat += h * 0.15;
    w = Math.max(0.25, maxLon - minLon); h = Math.max(0.25, maxLat - minLat);
    const scale = Math.min(this.viewportRect.width / w, this.viewportRect.height / h) * 0.78;
    this.bounds = { minLon, minLat, maxLon, maxLat, scale, centerX:(minLon+maxLon)/2, centerY:(minLat+maxLat)/2 };
    if (this.camera.centerX == null || this.camera.centerY == null) {
      this.camera.centerX = this.bounds.centerX;
      this.camera.centerY = this.bounds.centerY;
    }
    this.camera = this.clampCamera(this.camera);
  }

  setFeature(feature) {
    const previousCode = this.feature?.properties?.iso2 || null;
    const nextCode = feature?.properties?.iso2 || null;
    this.feature = feature || null;
    if (previousCode !== nextCode) this.camera = { centerX: null, centerY: null, zoom: 1 };
    this.computeBounds(this.feature);
  }

  setCamera(camera = {}) {
    this.camera = this.clampCamera({ ...this.camera, ...camera });
    return this.camera;
  }

  clampCamera(camera = {}) {
    const b = this.bounds || { minLon:-180,minLat:-90,maxLon:180,maxLat:90,centerX:0,centerY:0 };
    const zoom = clamp(Number(camera.zoom) || 1, this.minZoom, this.maxZoom);
    const spanLon = Math.max(.1,b.maxLon-b.minLon), spanLat=Math.max(.1,b.maxLat-b.minLat);
    const maxShiftX = spanLon * .5 * Math.max(0,1-1/zoom);
    const maxShiftY = spanLat * .5 * Math.max(0,1-1/zoom);
    return {
      centerX: clamp(Number(camera.centerX ?? b.centerX), b.centerX-maxShiftX, b.centerX+maxShiftX),
      centerY: clamp(Number(camera.centerY ?? b.centerY), b.centerY-maxShiftY, b.centerY+maxShiftY),
      zoom
    };
  }

  viewport() { return { ...this.viewportRect }; }

  project(lat, lon) {
    const b = this.bounds || { scale: 1, centerX:0, centerY:0 };
    const viewport = this.viewportRect || { x: 0, y: 0, width: this.width, height: this.height };
    const scale = b.scale * (this.camera.zoom || 1);
    const cx = this.camera.centerX ?? b.centerX;
    const cy = this.camera.centerY ?? b.centerY;
    return {
      x: viewport.x + viewport.width / 2 + (Number(lon) - cx) * scale,
      y: viewport.y + viewport.height / 2 - (Number(lat) - cy) * scale,
      visible: true,
      depth: 1
    };
  }

  unproject(x, y, { allowOutside = false } = {}) {
    const b = this.bounds || { scale: 1, centerX:0, centerY:0 };
    const viewport = this.viewportRect || { x: 0, y: 0, width: this.width, height: this.height };
    if (!allowOutside && (x < viewport.x || y < viewport.y || x > viewport.x + viewport.width || y > viewport.y + viewport.height)) return null;
    const scale = Math.max(1e-9, b.scale * (this.camera.zoom || 1));
    const cx = this.camera.centerX ?? b.centerX;
    const cy = this.camera.centerY ?? b.centerY;
    return {
      lon: cx + (x - (viewport.x + viewport.width/2)) / scale,
      lat: cy - (y - (viewport.y + viewport.height/2)) / scale
    };
  }

  geoBounds() {
    const v = this.viewport();
    const nw = this.unproject(v.x, v.y, { allowOutside:true });
    const se = this.unproject(v.x+v.width, v.y+v.height, { allowOutside:true });
    return { minLon:nw.lon, maxLon:se.lon, minLat:se.lat, maxLat:nw.lat, wraps:false };
  }

  fitBounds(bounds, { padding = 0.14 } = {}) {
    if (!bounds || !this.bounds) return this.camera;
    const [minLon,minLat,maxLon,maxLat] = Array.isArray(bounds) ? bounds : [bounds.minLon,bounds.minLat,bounds.maxLon,bounds.maxLat];
    const spanLon=Math.max(.08,maxLon-minLon), spanLat=Math.max(.08,maxLat-minLat);
    const usable=Math.max(.35,1-padding*2);
    const desiredScale=Math.min((this.viewportRect.width/spanLon)*usable,(this.viewportRect.height/spanLat)*usable);
    const zoom=clamp(desiredScale/Math.max(1e-9,this.bounds.scale),this.minZoom,this.maxZoom);
    return this.setCamera({centerX:(minLon+maxLon)/2,centerY:(minLat+maxLat)/2,zoom});
  }
}
