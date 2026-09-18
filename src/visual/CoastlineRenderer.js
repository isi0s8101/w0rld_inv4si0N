import { THEME } from "./Theme.js";
import { geometryRings } from "../world/geometry.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export class CoastlineRenderer {
  drawFeature(ctx, feature, projection, { mode, alpha, lineWidth, strokeStyle, shadowBlur }) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = THEME.node;
    ctx.shadowBlur = shadowBlur;
    ctx.globalAlpha = alpha;
    for (const ring of geometryRings(feature)) {
      ctx.beginPath();
      let drawing = false;
      let last = null;
      for (const coord of ring) {
        const p = projection.project(coord[1], coord[0]);
        const jump = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
        if (!p.visible || (mode === "globe" && jump > projection.radius * 0.55)) { drawing = false; last = p; continue; }
        if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; }
        else ctx.lineTo(p.x, p.y);
        last = p;
      }
      ctx.stroke();
    }
  }

  render(ctx, features, projection, { alpha = 1, selectedCountry = null, hoveredCountry = null, highlightedCountry = null, mode = "world", neighbors = null, selectionProgress = 1, switchSelection = null } = {}) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const feature of features) {
      const code = feature.properties.iso2;
      let local = 1;
      let selectedMix = 0;
      if (switchSelection) {
        const progress = clamp(switchSelection.progress);
        if (code === switchSelection.from) { local = 1.52 - progress * 0.88; selectedMix = 1 - progress; }
        else if (code === switchSelection.to) { local = 0.64 + progress * 0.88; selectedMix = progress; }
        else if (neighbors?.has(code)) local = 0.74;
        else local = 0.52;
      } else if (selectedCountry) {
        const progress = clamp(selectionProgress);
        if (code === selectedCountry) { local = 1 + progress * 0.48; selectedMix = progress; }
        else if (neighbors?.has(code)) local = 1 - progress * 0.24;
        else local = 1 - progress * 0.44;
      }
      if (code === hoveredCountry) local *= 1.15;
      if (code === highlightedCountry) local *= 1.20;

      const baseAlpha = alpha * local * (mode === "globe" ? 0.52 : 0.46);
      const isSelected = code === selectedCountry || (mode === "country" && features.length === 1);
      if (isSelected) {
        const strength = mode === "country" ? 1 : Math.max(0.18, selectedMix);
        this.drawFeature(ctx, feature, projection, {
          mode,
          alpha: baseAlpha * 0.30 * strength,
          lineWidth: mode === "country" ? 4.0 : 3.1,
          strokeStyle: THEME.coast,
          shadowBlur: mode === "country" ? 15 : 12
        });
        this.drawFeature(ctx, feature, projection, {
          mode,
          alpha: baseAlpha * (0.92 + strength * 0.12),
          lineWidth: mode === "country" ? 1.35 : 1.18,
          strokeStyle: THEME.coastStrong,
          shadowBlur: mode === "country" ? 7 : 6
        });
      } else {
        this.drawFeature(ctx, feature, projection, {
          mode,
          alpha: baseAlpha,
          lineWidth: mode === "country" ? 0.95 : 0.58,
          strokeStyle: THEME.coast,
          shadowBlur: 2.2
        });
      }
    }
    ctx.restore();
  }
}
