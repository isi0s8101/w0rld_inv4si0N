import { THEME } from "./Theme.js";

export class ScanRenderer {
  render(ctx, events, projection, { alpha = 1, mode = "world", country = null } = {}) {
    for (const event of events) {
      if (event.type !== "SCAN_STARTED") continue;
      if (country && event.data.country !== country) continue;
      const p = projection.project(event.data.lat, event.data.lon);
      if (!p.visible) continue;
      const scale = mode === "country" ? 42 : mode === "globe" ? 23 : 30;
      const radius = 2 + event.progress * scale;
      ctx.save(); ctx.globalAlpha = alpha * (1-event.progress) * 0.45;
      ctx.strokeStyle = THEME.scan; ctx.lineWidth = 0.9; ctx.shadowColor = THEME.node; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
  }
}
