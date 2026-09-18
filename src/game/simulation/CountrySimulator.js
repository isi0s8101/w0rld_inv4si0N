import { BASE_METRICS, clamp } from "./constants.js";
import { updateResistancePotential } from "./CountryState.js";

const COUPLINGS = {
  stability: [["cohesion", 0.010], ["economy", 0.006], ["food", 0.005], ["infrastructure", 0.004], ["resilience", 0.005]],
  cohesion: [["stability", 0.006], ["economy", 0.004], ["resilience", 0.005]],
  economy: [["energy", 0.009], ["infrastructure", 0.008], ["stability", 0.005]],
  energy: [["infrastructure", 0.005], ["economy", 0.003]],
  food: [["energy", 0.004], ["infrastructure", 0.005]],
  infrastructure: [["economy", 0.005], ["energy", 0.004]],
  technology: [["science", 0.007], ["economy", 0.004]],
  science: [["economy", 0.005], ["infrastructure", 0.004], ["technology", 0.005]],
  militaryReadiness: [["economy", 0.004], ["technology", 0.005], ["infrastructure", 0.003], ["awareness", 0.004]],
  resilience: [["infrastructure", 0.004], ["cohesion", 0.005], ["science", 0.003], ["stability", 0.004]],
  diplomaticInfluence: [["economy", 0.004], ["stability", 0.003]],
  population: [["food", 0.002], ["economy", 0.0015], ["stability", 0.0015]],
  awareness: []
};

function normalizedOffset(value) { return (value - 50) / 50; }

export class CountrySimulator {
  computeNext(state) {
    const next = {
      ...state,
      metrics: Object.fromEntries(Object.entries(state.metrics).map(([name, metric]) => [name, { ...metric, lastCauses: [...(metric.lastCauses || [])] }])),
      resources: state.resources,
      modifiers: state.modifiers,
      history: state.history,
      lastDiagnostics: {}
    };
    for (const name of BASE_METRICS) {
      const currentMetric = state.metrics[name];
      const target = next.metrics[name];
      const causes = [];
      const recovery = (currentMetric.baseline - currentMetric.current) * currentMetric.recoveryRate;
      if (Math.abs(recovery) > 0.0001) causes.push(["recovery", recovery]);
      const pressureEffect = currentMetric.pressure * currentMetric.sensitivity * 0.012;
      if (Math.abs(pressureEffect) > 0.0001) causes.push(["pressure", pressureEffect]);
      let endogenous = 0;
      for (const [source, weight] of COUPLINGS[name] || []) {
        const effect = normalizedOffset(state.metrics[source].current) * weight;
        endogenous += effect;
      }
      if (Math.abs(endogenous) > 0.0001) causes.push(["endogenous", endogenous]);
      const delta = recovery + pressureEffect + endogenous;
      target.current = clamp(currentMetric.current + delta);
      target.trend = delta;
      target.pressure = currentMetric.pressure * 0.965;
      target.lastCauses = causes.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4);
      next.lastDiagnostics[name] = target.lastCauses;
    }
    updateResistancePotential(next);
    return next;
  }
}
