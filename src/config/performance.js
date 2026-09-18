export const PERFORMANCE = Object.freeze({
  fpsWindow: 120, downgradeBelow: 45, downgradeAfterMs: 3000,
  forceLowBelow: 30, forceLowAfterMs: 2000, upgradeCooldownMs: 15000,
  quality: {
    HIGH: { dpr: 2, desktop: 5500, tablet: 1500, mobile: 750, arcs: 4, pulses: 5, glow: 1, noise: 1, parallax: 1 },
    MEDIUM: { dpr: 1.5, desktop: 3200, tablet: 1150, mobile: 650, arcs: 3, pulses: 3, glow: 0.68, noise: 0.7, parallax: 0.72 },
    LOW: { dpr: 1.25, desktop: 2000, tablet: 850, mobile: 520, arcs: 2, pulses: 2, glow: 0.25, noise: 0, parallax: 0.3 },
    STATIC: { dpr: 1, desktop: 0, tablet: 0, mobile: 0, arcs: 0, pulses: 0, glow: 0, noise: 0, parallax: 0 }
  }
});
