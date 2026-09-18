export const METRICS = [
  "population", "stability", "cohesion", "economy", "energy", "food",
  "infrastructure", "technology", "science", "militaryReadiness", "resilience",
  "diplomaticInfluence", "awareness", "resistancePotential"
];

export const BASE_METRICS = METRICS.filter((metric) => metric !== "resistancePotential");
export const RESOURCE_TYPES = ["food", "energy", "goods", "data"];
export const FLOW_TYPES = ["POPULATION", "FOOD", "ENERGY", "GOODS", "DATA"];
export const TRANSPORT_MODES = ["LAND", "SEA", "AIR", "DATA_TERRESTRIAL", "DATA_SUBMARINE", "DATA_SPACE"];

export function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }
export function clamp01(value) { return clamp(value, 0, 1); }
