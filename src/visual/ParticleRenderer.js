import { THEME } from "./Theme.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const LAYER = Object.freeze({
  primary: { size: 1.00, glow: 1.00, worldDetail: 1.00, globeDetail: 0.88, countryDetail: 1.00 },
  secondary: { size: 0.70, glow: 0.46, worldDetail: 0.78, globeDetail: 0.52, countryDetail: 0.96 },
  dust: { size: 0.40, glow: 0.08, worldDetail: 0.44, globeDetail: 0.18, countryDetail: 0.84 }
});

export class ParticleRenderer {
  render(ctx, points, projection, {
    alpha = 1,
    selectedCountry = null,
    hoveredCountry = null,
    neighbors = null,
    mode = "world",
    quality = "HIGH",
    selectionProgress = 1,
    switchSelection = null,
    time = 0
  } = {}) {
    const stride = quality === "LOW" ? 2 : 1;
    const now = Number.isFinite(time) ? time : 0;

    for (let i = 0; i < points.length; i += stride) {
      const point = points[i];
      const projected = projection.project(point.lat, point.lon);
      if (!projected.visible) continue;

      let local = 1;
      let selectedMix = 0;
      if (switchSelection) {
        const progress = clamp(switchSelection.progress);
        if (point.country === switchSelection.from) { local = 1.34 - progress * 0.73; selectedMix = 1 - progress; }
        else if (point.country === switchSelection.to) { local = 0.62 + progress * 0.72; selectedMix = progress; }
        else if (neighbors?.has(point.country)) local = 0.72;
        else local = 0.52;
      } else if (selectedCountry) {
        const progress = clamp(selectionProgress);
        if (point.country === selectedCountry) { local = 1 + progress * 0.34; selectedMix = progress; }
        else if (neighbors?.has(point.country)) local = 1 - progress * 0.26;
        else local = 1 - progress * 0.46;
      }
      if (point.country === hoveredCountry) local *= 1.15;
      if (mode === "globe") local *= 0.54 + Math.max(0, projected.depth) * 0.58;

      const layer = LAYER[point.layer] || LAYER.secondary;
      const baseDetail = mode === "country" ? layer.countryDetail : mode === "globe" ? layer.globeDetail : layer.worldDetail;
      const selectionReveal = selectedMix * (point.layer === "dust" ? 0.46 : point.layer === "secondary" ? 0.20 : 0.04);
      const hoverReveal = point.country === hoveredCountry ? (point.layer === "dust" ? 0.14 : 0.07) : 0;
      const detailLevel = clamp(baseDetail + selectionReveal + hoverReveal);
      const revealAlpha = clamp((detailLevel - point.reveal + 0.16) / 0.16);
      if (revealAlpha <= 0.015) continue;

      const pulse = Math.sin(now * point.speed * Math.PI * 2 + point.phase) * point.amplitude;
      const microNoise = Math.sin(now * 0.37 + point.noiseOffset) * point.amplitude * 0.32;
      const individualAlpha = clamp(point.baseAlpha + pulse + microNoise, 0.025, 0.82);

      const modeSize = mode === "country" ? 1.28 : mode === "globe" ? 0.92 : 1.00;
      const depthSize = 0.72 + point.depth * 0.52;
      const edgeSize = 1 + point.edge * 0.15;
      const urbanSize = 1 + point.urban * 0.08;
      const radius = Math.max(0.18, modeSize * layer.size * depthSize * edgeSize * urbanSize);

      const edgeBoost = 1 + point.edge * 0.22;
      const urbanBoost = 1 + point.urban * 0.18;
      ctx.globalAlpha = alpha * local * individualAlpha * revealAlpha * edgeBoost * urbanBoost;
      ctx.fillStyle = point.edge > 0.76 || (point.layer === "primary" && point.urban > 0.55) ? THEME.particleIce : THEME.particle;
      if (layer.glow > 0.4 && quality === "HIGH") {
        ctx.shadowColor = THEME.node;
        ctx.shadowBlur = 1.5 * layer.glow;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}
