export const WORLD_BANK_INDICATORS = Object.freeze({
  population: "SP.POP.TOTL",
  populationGrowthAnnualPct: "SP.POP.GROW",
  netMigration: "SM.POP.NETM",
  gdpCurrentUsd: "NY.GDP.MKTP.CD",
  gdpPerCapitaUsd: "NY.GDP.PCAP.CD",
  gdpGrowthAnnualPct: "NY.GDP.MKTP.KD.ZG",
  tradePctGdp: "NE.TRD.GNFS.ZS",
  importsPctGdp: "NE.IMP.GNFS.ZS",
  exportsPctGdp: "NE.EXP.GNFS.ZS",
  electricityAccessPct: "EG.ELC.ACCS.ZS"
});

const FIELD_BY_INDICATOR = new Map(Object.entries(WORLD_BANK_INDICATORS).map(([field, indicator]) => [indicator, field]));
const DEFAULT_CONFIDENCE = Object.freeze({
  population: 0.99,
  populationGrowthAnnualPct: 0.97,
  netMigration: 0.95,
  gdpCurrentUsd: 0.98,
  gdpPerCapitaUsd: 0.98,
  gdpGrowthAnnualPct: 0.97,
  tradePctGdp: 0.96,
  importsPctGdp: 0.96,
  exportsPctGdp: 0.96,
  electricityAccessPct: 0.97
});

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function normalizeApiResponse(payload) {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[1])) throw new Error("World Bank API response invalid");
  return { meta: payload[0] || {}, rows: payload[1] };
}

export class WorldBankImporter {
  constructor({ fetchImpl = globalThis.fetch, sourceId = "2", batchSize = 40, maxRetries = 3 } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("WorldBankImporter requires fetch");
    this.fetchImpl = fetchImpl;
    this.sourceId = sourceId;
    this.batchSize = Math.max(1, Math.min(60, batchSize));
    this.maxRetries = Math.max(1, maxRetries);
  }

  buildUrl(codes) {
    const countries = codes.map((code) => code.toLowerCase()).join(";");
    const indicators = Object.values(WORLD_BANK_INDICATORS).join(";");
    return `https://api.worldbank.org/v2/country/${countries}/indicator/${indicators}?source=${this.sourceId}&format=json&mrnev=1&per_page=20000`;
  }

  async fetchJson(url) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchImpl(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`World Bank HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
    throw lastError;
  }

  parse(payload, targetCodes) {
    const { meta, rows } = normalizeApiResponse(payload);
    const target = new Set(targetCodes.map((code) => code.toUpperCase()));
    const countries = {};
    for (const row of rows) {
      const indicator = row?.indicator?.id;
      const field = FIELD_BY_INDICATOR.get(indicator);
      const code = String(row?.country?.id || "").toUpperCase();
      const value = row?.value;
      if (!field || !target.has(code) || !Number.isFinite(value)) continue;
      const referenceYear = Number.parseInt(row.date, 10);
      if (!Number.isFinite(referenceYear)) continue;
      countries[code] ||= {};
      const current = countries[code][field];
      if (current && current.referenceYear >= referenceYear) continue;
      countries[code][field] = {
        value,
        referenceYear,
        source: "worldBank",
        indicator,
        confidence: DEFAULT_CONFIDENCE[field] ?? 0.95,
        dataClass: "REAL",
        obsStatus: row.obs_status || ""
      };
    }
    return { countries, sourceLastUpdated: meta.lastupdated || null };
  }

  async sync(codes) {
    const targetCodes = [...new Set(codes.map((code) => String(code).toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code)))];
    const merged = {};
    let sourceLastUpdated = null;
    for (const group of chunk(targetCodes, this.batchSize)) {
      const parsed = this.parse(await this.fetchJson(this.buildUrl(group)), group);
      sourceLastUpdated = parsed.sourceLastUpdated || sourceLastUpdated;
      for (const [code, record] of Object.entries(parsed.countries)) merged[code] = { ...(merged[code] || {}), ...record };
    }
    return { countries: merged, sourceLastUpdated };
  }

  buildDataset({ countries, sourceLastUpdated = null, retrievedAt = new Date().toISOString().slice(0, 10), targetCount = 0 } = {}) {
    return {
      schemaVersion: 2,
      mode: "REAL_WORLD",
      retrievedAt,
      sync: {
        status: "WORLD_BANK_SYNC",
        targetCountries: targetCount,
        syncedCountries: Object.keys(countries || {}).length,
        sourceLastUpdated
      },
      sources: {
        worldBank: {
          name: "World Bank Open Data / World Development Indicators",
          license: "CC BY 4.0",
          url: "https://data.worldbank.org/",
          apiDocumentation: "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392",
          sourceLastUpdated
        }
      },
      indicatorCatalog: Object.fromEntries(Object.entries(WORLD_BANK_INDICATORS).map(([field, indicator]) => [field, { indicator }])),
      countries: countries || {}
    };
  }
}
