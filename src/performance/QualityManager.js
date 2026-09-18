import { PERFORMANCE } from "../config/performance.js";
const ORDER = ["STATIC", "LOW", "MEDIUM", "HIGH"];
export class QualityManager {
  constructor(bus, initial = "HIGH") {
    this.bus = bus; this.level = initial; this.lastUpgrade = -Infinity;
  }
  get config() { return PERFORMANCE.quality[this.level]; }
  set(level, reason = "manual") {
    if (!PERFORMANCE.quality[level] || level === this.level) return false;
    const previous = this.level; this.level = level;
    if (ORDER.indexOf(level) > ORDER.indexOf(previous)) this.lastUpgrade = performance.now();
    this.bus.emit("quality:change", { previous, quality: level, reason, config: this.config });
    return true;
  }
  downgrade(reason = "performance") {
    const index = ORDER.indexOf(this.level); return this.set(ORDER[Math.max(1, index - 1)], reason);
  }
  upgrade() {
    const now = performance.now();
    if (now - this.lastUpgrade < PERFORMANCE.upgradeCooldownMs) return false;
    const index = ORDER.indexOf(this.level); return this.set(ORDER[Math.min(ORDER.length - 1, index + 1)], "recovery");
  }
}
