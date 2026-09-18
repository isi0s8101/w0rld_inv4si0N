import { THEME } from "./Theme.js";
import { geometryRings } from "../world/geometry.js";

export class CountryFillRenderer {
  render(ctx, feature, projection, { alpha = 1, intensity = 1, mode = "world" } = {}) {
    if (!feature || intensity <= 0) return;
    const projected = [];
    ctx.save();
    ctx.beginPath();
    for (const ring of geometryRings(feature)) {
      let drawing = false;
      for (const coord of ring) {
        const p = projection.project(coord[1], coord[0]);
        if (!p.visible) { drawing = false; continue; }
        projected.push(p);
        if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; }
        else ctx.lineTo(p.x, p.y);
      }
      if (drawing) ctx.closePath();
    }
    if (!projected.length) { ctx.restore(); return; }

    const xs = projected.map((p) => p.x), ys = projected.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const centerGeo = feature.properties.focusCenter || feature.properties.center;
    const center = projection.project(centerGeo[1], centerGeo[0]);
    const cx = center.visible ? center.x : (minX + maxX) / 2;
    const cy = center.visible ? center.y : (minY + maxY) / 2;
    const radius = Math.max(36, Math.hypot(maxX - minX, maxY - minY) * 0.62);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const core = mode === "country" ? 0.105 : 0.072;
    gradient.addColorStop(0, `rgba(0,234,255,${core * intensity})`);
    gradient.addColorStop(0.52, `rgba(0,180,215,${core * 0.48 * intensity})`);
    gradient.addColorStop(1, "rgba(0,90,120,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.shadowColor = THEME.node;
    ctx.shadowBlur = mode === "country" ? 24 : 16;
    try { ctx.fill("evenodd"); } catch { ctx.fill(); }
    ctx.restore();
  }
}
