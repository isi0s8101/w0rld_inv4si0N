export const SCENES = Object.freeze({
  HERO: { world: 0.92, network: 0.24, hud: 0.05, parallax: 0 },
  GLOBAL: { world: 1.00, network: 0.40, hud: 0.10, parallax: 0 },
  THREAT_INTELLIGENCE: { world: 1.00, network: 0.72, hud: 0.30, parallax: 0 },
  MONITORING: { world: 1.00, network: 0.54, hud: 0.45, parallax: 0 },
  OUTRO: { world: 0.80, network: 0.18, hud: 0.05, parallax: 0 }
});
export const STATE_PRIORITIES = Object.freeze({ ALERT: 100, EXPLORE: 70, ANALYSIS: 50, AMBIENT: 20, IDLE: 0 });
