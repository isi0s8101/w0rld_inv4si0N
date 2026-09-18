export function geometryRings(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

export function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersects = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInFeature(lon, lat, feature) {
  const geometry = feature?.geometry;
  if (!geometry) return false;
  const polygonContains = (polygon) => {
    if (!polygon?.length || !pointInRing(lon, lat, polygon[0])) return false;
    for (let i = 1; i < polygon.length; i++) if (pointInRing(lon, lat, polygon[i])) return false;
    return true;
  };
  if (geometry.type === "Polygon") return polygonContains(geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some(polygonContains);
  return false;
}

export function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
