import { RESOURCE_TYPES, clamp01 } from "./constants.js";

const IMPACTS = {
  food: [["food", -1.45], ["cohesion", -0.65], ["stability", -0.52]],
  energy: [["energy", -1.35], ["economy", -0.70], ["infrastructure", -0.42]],
  goods: [["economy", -0.85], ["infrastructure", -0.28]],
  data: [["technology", -0.62], ["science", -0.48], ["economy", -0.24]]
};

export class ResourceEconomy {
  prepareDay(state) {
    const m = state.metrics;
    for (const type of RESOURCE_TYPES) {
      const r = state.resources[type];
      r.imports = 0; r.exports = 0;
      const economyFactor = 0.72 + m.economy.current / 180;
      const infraFactor = 0.72 + m.infrastructure.current / 190;
      const energyFactor = type === "energy" ? 1 : 0.70 + m.energy.current / 170;
      const productionFactor = Math.max(0.45, Math.min(1.18, economyFactor * infraFactor * energyFactor));
      r.production = Math.min(r.productionCapacity, r.productionCapacity * productionFactor);
      const popFactor = 0.78 + m.population.current / 230;
      const demandGrowth = 0.80 + m.economy.current / 250;
      r.consumption = Math.max(0.1, r.demandBase * popFactor * demandGrowth);
      r.utilization = clamp01(r.production / Math.max(0.01, r.productionCapacity));
    }
  }

  projectedBalance(state, type) {
    const r = state.resources[type];
    const targetRatio = state.policy?.reserveTargetRatio?.[type] ?? 0.52;
    const targetStock = r.stockCapacity * Math.max(0.30, Math.min(0.86, targetRatio));
    const replenishment = Math.max(0, targetStock - r.stock) * 0.025;
    return r.production - r.consumption - replenishment;
  }

  applyTransfers(state, transfers = {}) {
    for (const type of RESOURCE_TYPES) {
      const r = state.resources[type];
      const t = transfers[type] || { imports: 0, exports: 0 };
      r.imports = Math.max(0, t.imports || 0);
      r.exports = Math.max(0, t.exports || 0);
      r.stock += r.production + r.imports - r.consumption - r.exports;
      if (r.stock < 0) r.stock = 0;
      if (r.stock > r.stockCapacity) r.stock = r.stockCapacity;
      const coverageDays = r.stock / Math.max(0.01, r.consumption);
      r.shortage = clamp01((14 - coverageDays) / 14);
      r.priceIndex = Math.max(70, Math.min(190, 100 + r.shortage * 70 - Math.max(0, coverageDays - 45) * 0.08));
      for (const [metric, weight] of IMPACTS[type]) state.metrics[metric].pressure += r.shortage * weight;
      if (coverageDays > 50) state.metrics.resilience.pressure += Math.min(0.08, (coverageDays - 50) * 0.0012);
    }
  }
}
