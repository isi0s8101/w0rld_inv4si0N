import { PERFORMANCE } from "../config/performance.js";
export class PerformanceManager {
  constructor(qualityManager) {
    this.qualityManager = qualityManager; this.samples = []; this.averageFps = 60; this.frameTime = 16.67;
    this.lowSince = 0; this.criticalSince = 0; this.stableSince = performance.now(); this.enabled = true;
  }
  update(dt) {
    if (!this.enabled || dt <= 0) return;
    const ms = dt * 1000; this.samples.push(ms);
    if (this.samples.length > PERFORMANCE.fpsWindow) this.samples.shift();
    this.frameTime = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    this.averageFps = 1000 / Math.max(0.1, this.frameTime);
    const now = performance.now();
    if (this.averageFps < PERFORMANCE.forceLowBelow) {
      this.criticalSince ||= now;
      if (now - this.criticalSince > PERFORMANCE.forceLowAfterMs) this.qualityManager.set("LOW", "critical-fps");
    } else this.criticalSince = 0;
    if (this.averageFps < PERFORMANCE.downgradeBelow) {
      this.lowSince ||= now; this.stableSince = now;
      if (now - this.lowSince > PERFORMANCE.downgradeAfterMs) { this.qualityManager.downgrade(); this.lowSince = now; }
    } else {
      this.lowSince = 0;
      if (this.averageFps >= 55 && now - this.stableSince > PERFORMANCE.upgradeCooldownMs) {
        if (this.qualityManager.upgrade()) this.stableSince = now;
      } else if (this.averageFps < 55) this.stableSince = now;
    }
  }
  setEnabled(value) { this.enabled = value; }
  destroy() { this.samples.length = 0; }
}
