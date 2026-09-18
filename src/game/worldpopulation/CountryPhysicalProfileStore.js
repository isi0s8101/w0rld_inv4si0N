export class CountryPhysicalProfileStore {
  constructor({ dataUrl = './src/game/data/country-physical-profiles.json' } = {}) {
    this.dataUrl = dataUrl;
    this.dataset = null;
    this.profiles = [];
    this.byCountry = new Map();
  }

  async init() {
    const response = await fetch(this.dataUrl);
    if (!response.ok) throw new Error('CountryPhysicalProfileStore: données indisponibles');
    this.dataset = await response.json();
    this.profiles = Array.isArray(this.dataset?.profiles) ? this.dataset.profiles : [];
    this.byCountry = new Map(this.profiles.map((profile) => [String(profile.countryId || '').toUpperCase(), profile]));
    return this;
  }

  get(code) {
    return this.byCountry.get(String(code || '').toUpperCase()) || null;
  }

  list() {
    return this.profiles.slice();
  }

  stats() {
    const archetypes = {};
    let landlocked = 0;
    let islands = 0;
    for (const profile of this.profiles) {
      if (profile?.geography?.landlocked) landlocked += 1;
      if (profile?.geography?.island) islands += 1;
      for (const archetype of profile.archetypes || []) archetypes[archetype] = (archetypes[archetype] || 0) + 1;
    }
    return { countries: this.profiles.length, landlocked, islands, archetypes };
  }
}
