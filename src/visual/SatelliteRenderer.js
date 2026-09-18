import satellites from "../data/satellites.json" with { type: "json" };
import { THEME } from "./Theme.js";

const TYPE_STYLE = Object.freeze({
  MILITARY: { color: THEME.warning, size: 3.4, orbit: "rgba(255,180,90,0.18)" },
  CIVIL: { color: THEME.node, size: 3.0, orbit: "rgba(0,234,255,0.15)" },
  INTERNATIONAL: { color: THEME.particleIce, size: 3.2, orbit: "rgba(223,252,255,0.18)" }
});

export class SatelliteRenderer {
  constructor() { this.satellites = satellites; }

  render(ctx, projection, { alpha = 1, time = 0, mini = false } = {}) {
    const radius = projection.radius * (projection.camera?.zoom || 1);
    const orbitScale = mini ? 1.035 : 1.075;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const sat of this.satellites) {
      const style = TYPE_STYLE[sat.type] || TYPE_STYLE.CIVIL;
      const phase = sat.phase + time * (sat.type === "INTERNATIONAL" ? 0.075 : 0.055);
      const lon = sat.lon + Math.sin(phase) * 7 + time * 1.8;
      const lat = Math.max(-78, Math.min(78, sat.lat + Math.sin(phase * 0.7) * sat.inclination * 0.16));
      const p = projection.project(lat, lon);
      if (!p.visible || p.depth < 0.22) continue;

      const orbit = projection.project(lat + Math.sin(phase) * sat.inclination * 0.30, lon - 24);
      if (orbit.visible) {
        ctx.beginPath();
        ctx.strokeStyle = style.orbit;
        ctx.lineWidth = mini ? 0.55 : 0.75;
        ctx.setLineDash([mini ? 2 : 4, mini ? 4 : 8]);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(orbit.x, orbit.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const glow = style.size * (mini ? 1.8 : 2.6) * (0.75 + p.depth * 0.35);
      ctx.shadowBlur = glow * 2.5;
      ctx.shadowColor = style.color;
      ctx.fillStyle = style.color;
      ctx.globalAlpha = alpha * (0.52 + p.depth * 0.48);
      ctx.beginPath();
      if (sat.type === "MILITARY") {
        ctx.moveTo(p.x, p.y - style.size); ctx.lineTo(p.x + style.size, p.y);
        ctx.lineTo(p.x, p.y + style.size); ctx.lineTo(p.x - style.size, p.y); ctx.closePath();
      } else {
        ctx.arc(p.x, p.y, style.size * (mini ? 0.72 : 1), 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }
}
