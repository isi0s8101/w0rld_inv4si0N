const TYPE_BY_MODE = Object.freeze({
  SEA: 'SEA_GATEWAY',
  AIR: 'AIR_GATEWAY',
  ROAD: 'ROAD_BORDER',
  RAIL: 'RAIL_BORDER',
  PIPELINE: 'PIPELINE_BORDER',
  DIGITAL: 'DIGITAL_GATEWAY'
});

export class InternationalGatewayEngine {
  constructor({ networkStore, infrastructureGraph, countryPhysicalProfiles } = {}) {
    this.network = networkStore;
    this.infrastructure = infrastructureGraph;
    this.profiles = countryPhysicalProfiles;
  }

  forCountry(country, { mode = null, operationalOnly = true } = {}) {
    const code = String(country || '').toUpperCase();
    const type = mode ? TYPE_BY_MODE[String(mode).toUpperCase()] || null : null;
    return this.network.gatewaysForCountry(code, type).filter((gateway) => {
      if (!operationalOnly) return true;
      const node = this.infrastructure?.get?.(gateway.nodeId);
      return node && !['OFFLINE', 'DESTROYED'].includes(node.status);
    });
  }

  canUseMaritimeGateway(country) {
    const profile = this.profiles?.get?.(country);
    if (profile?.geography?.landlocked) return false;
    return this.forCountry(country, { mode: 'SEA' }).length > 0;
  }

  findForeignGateway(country, mode, { excludeCountries = [] } = {}) {
    const excluded = new Set([String(country || '').toUpperCase(), ...excludeCountries.map((c) => String(c).toUpperCase())]);
    const type = TYPE_BY_MODE[String(mode || '').toUpperCase()];
    if (!type) return [];
    return this.network.gateways
      .filter((g) => g.type === type && !excluded.has(g.country))
      .map((g) => ({ ...g, node: this.infrastructure?.get?.(g.nodeId) || null }))
      .filter((g) => g.node);
  }

  transitOptions(country, mode) {
    const profile = this.profiles?.get?.(country);
    if (!profile) return [];
    const own = this.forCountry(country, { mode });
    if (own.length) return own;
    if (String(mode).toUpperCase() !== 'SEA' || !profile.geography?.landlocked) return [];
    const neighbors = profile.geography?.borders || [];
    return neighbors.flatMap((neighbor) => this.forCountry(neighbor, { mode: 'SEA' }).map((g) => ({ ...g, transitCountry: neighbor })));
  }
}
