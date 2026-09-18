import { THEME } from "./Theme.js";

export class EventRenderer {
  render(ctx, events, worldEngine, projection, { alpha = 1, country = null } = {}) {
    for (const event of events) {
      if (event.type !== "COUNTRY_ACTIVITY") continue;
      const code=event.data.country;
      if (country && code !== country) continue;
      const feature=worldEngine.getCountry(code); if (!feature) continue;
      const [lon,lat]=feature.properties.center; const p=projection.project(lat,lon); if (!p.visible) continue;
      const radius=8+Math.sin(event.progress*Math.PI)*26;
      ctx.save(); ctx.globalAlpha=alpha*Math.sin(event.progress*Math.PI)*0.16*(event.data.strength||1);
      ctx.fillStyle=THEME.glow; ctx.shadowColor=THEME.node; ctx.shadowBlur=18;
      ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
  renderRegionHighlight(ctx, region, projection, { alpha = 1 } = {}) {
    if (!region) return;
    const [lon, lat] = region.center;
    const p = projection.project(lat, lon);
    if (!p.visible) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.18;
    ctx.strokeStyle = THEME.coast; ctx.shadowColor = THEME.node; ctx.shadowBlur = 12; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha * 0.08; ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
