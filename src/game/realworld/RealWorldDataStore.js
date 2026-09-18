const REQUIRED_NUMERIC_FIELDS = ["value", "source", "confidence"];
const VALID_DATA_CLASSES = new Set([
  "REAL", "REAL_HISTORICAL", "ESTIMATED_FROM_METADATA", "ESTIMATED_FROM_REAL_ANCHOR",
  "ESTIMATED_MODEL", "ESTIMATED_MANUAL", "SPECIAL"
]);

function clone(value) { return value == null ? value : structuredClone(value); }
function isYear(value) { return value === null || Number.isFinite(value); }
function classGroup(dataClass = "REAL") {
  if (String(dataClass).startsWith("REAL")) return "real";
  if (dataClass === "SPECIAL") return "special";
  return "estimated";
}

export class RealWorldDataStore {
  constructor({
    snapshotUrl = new URL("../data/real-world-start-snapshot.json", import.meta.url),
    url = new URL("../data/real-world-baseline.json", import.meta.url),
    metadataUrl = new URL("../data/real-world-objective-metadata.json", import.meta.url)
  } = {}) {
    this.snapshotUrl = snapshotUrl;
    this.url = url;
    this.metadataUrl = metadataUrl;
    this.startSnapshot = null;
    this.dataset = null;
    this.metadataDataset = null;
    this.byCode = new Map();
    this.metadataByCode = new Map();
  }

  async init() {
    const snapshotResponse = await fetch(this.snapshotUrl);
    if (snapshotResponse.ok) {
      this.loadStartSnapshot(await snapshotResponse.json());
      return this;
    }
    const [baselineResponse, metadataResponse] = await Promise.all([fetch(this.url), fetch(this.metadataUrl)]);
    if (!baselineResponse.ok) throw new Error(`RealWorldDataStore baseline HTTP ${baselineResponse.status}`);
    if (!metadataResponse.ok) throw new Error(`RealWorldDataStore metadata HTTP ${metadataResponse.status}`);
    this.load(await baselineResponse.json(), await metadataResponse.json());
    return this;
  }

  loadStartSnapshot(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.mode !== "REAL_WORLD_START_SNAPSHOT" || snapshot.offlineReady !== true) {
      throw new Error("Invalid real-world start snapshot");
    }
    if (!snapshot.baseline || !snapshot.metadata) throw new Error("Incomplete real-world start snapshot");
    this.startSnapshot = clone(snapshot);
    this.load(snapshot.baseline, snapshot.metadata);
    return this;
  }

  load(dataset, metadataDataset = null) {
    if (!dataset || ![1, 2, 3].includes(dataset.schemaVersion) || dataset.mode !== "REAL_WORLD") throw new Error("Invalid real-world dataset");
    this.dataset = clone(dataset);
    this.metadataDataset = metadataDataset ? clone(metadataDataset) : null;
    this.byCode.clear();
    this.metadataByCode.clear();
    for (const [code, record] of Object.entries(dataset.countries || {})) this.byCode.set(code.toUpperCase(), clone(record));
    for (const [code, record] of Object.entries(metadataDataset?.countries || {})) this.metadataByCode.set(code.toUpperCase(), clone(record));
    if (!this.validate()) throw new Error("Invalid real-world records");
    return this;
  }

  validate() {
    if (!this.dataset?.retrievedAt || !this.dataset?.sources) return false;
    for (const [code, record] of this.byCode) {
      if (!/^[A-Z]{2}$/.test(code) || !record || typeof record !== "object") return false;
      for (const entry of Object.values(record)) {
        if (!entry || typeof entry !== "object") return false;
        for (const field of REQUIRED_NUMERIC_FIELDS) if (!(field in entry)) return false;
        if (!Number.isFinite(entry.value)) return false;
        if (!isYear(entry.referenceYear)) return false;
        if (!Number.isFinite(entry.confidence) || entry.confidence < 0 || entry.confidence > 1) return false;
        if (!this.dataset.sources[entry.source]) return false;
        if (!VALID_DATA_CLASSES.has(entry.dataClass || "REAL")) return false;
      }
    }
    if (this.metadataDataset) {
      if (![1, 2].includes(this.metadataDataset.schemaVersion) || (!this.metadataDataset.source && !this.metadataDataset.sources)) return false;
      for (const [code, record] of this.metadataByCode) {
        if (!/^[A-Z]{2}$/.test(code) || !record || typeof record !== "object") return false;
        if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) return false;
      }
    }
    return true;
  }

  has(code) { return this.byCode.has(String(code || "").toUpperCase()); }
  hasMetadata(code) { return this.metadataByCode.has(String(code || "").toUpperCase()); }
  get(code) { return this.byCode.get(String(code || "").toUpperCase()) || null; }
  getMetadata(code) { return this.metadataByCode.get(String(code || "").toUpperCase()) || null; }
  getValue(code, key, fallback = null) { return this.get(code)?.[key]?.value ?? fallback; }

  getProvenance(code) {
    const upper = String(code || "").toUpperCase();
    const record = this.get(upper);
    const metadata = this.getMetadata(upper);
    const fields = {};
    let real = 0, estimated = 0, special = 0;
    for (const [key, entry] of Object.entries(record || {})) {
      const dataClass = entry.dataClass || "REAL";
      const group = classGroup(dataClass);
      if (group === "real") real++; else if (group === "special") special++; else estimated++;
      fields[key] = {
        source: entry.source,
        referenceYear: entry.referenceYear ?? null,
        confidence: entry.confidence,
        indicator: entry.indicator || null,
        method: entry.method || null,
        dataClass,
        group
      };
    }
    const metadataFields = metadata ? {
      areaKm2: Number.isFinite(metadata.areaKm2) ? (metadata.dataClass || "REAL_METADATA_UNDATED") : null,
      populationSnapshot: Number.isFinite(metadata.populationSnapshot) ? (metadata.dataClass || "REAL_METADATA_UNDATED") : null,
      capital: metadata.capital ? (metadata.dataClass || "REAL_METADATA_UNDATED") : null,
      timezones: metadata.ianaTimezones?.length ? (metadata.dataClass || "REAL_METADATA_UNDATED") : null
    } : {};
    let mode = "SCENARIO_FALLBACK";
    if (record) {
      if (real > 0 && estimated === 0 && special === 0) mode = "REAL_WORLD";
      else if (real > 0) mode = "REAL_WORLD_MIXED";
      else if (special > 0 && estimated === 0) mode = "REAL_WORLD_SPECIAL";
      else mode = "REAL_WORLD_ESTIMATED";
    } else if (metadata) mode = "REAL_WORLD_PARTIAL";
    return {
      mode,
      coverage: Object.keys(fields).length,
      classCounts: { real, estimated, special },
      fields,
      metadata: metadata ? {
        source: metadata.source,
        dataClass: metadata.dataClass || "REAL_METADATA_UNDATED",
        confidence: metadata.confidence,
        fields: Object.fromEntries(Object.entries(metadataFields).filter(([, value]) => value))
      } : null,
      retrievedAt: this.dataset?.retrievedAt || null
    };
  }

  fieldCoverage(totalCountries = 0) {
    const counts = {};
    for (const record of this.byCode.values()) {
      for (const [key, entry] of Object.entries(record)) {
        if (!counts[key]) counts[key] = { countries: 0, real: 0, estimated: 0, special: 0 };
        const item = counts[key]; item.countries++;
        item[classGroup(entry.dataClass || "REAL")]++;
      }
    }
    return Object.fromEntries(Object.entries(counts).map(([key, item]) => [key, {
      ...item,
      totalCountries,
      percent: totalCountries ? (item.countries / totalCountries) * 100 : 0,
      realPercent: totalCountries ? (item.real / totalCountries) * 100 : 0
    }]));
  }

  coverage(totalCountries = 0) {
    const timeSeriesCountries = this.byCode.size;
    const objectiveMetadataCountries = this.metadataByCode.size;
    let realFields = 0, estimatedFields = 0, specialFields = 0;
    let countriesWithRealFields = 0, countriesWithEstimatedFields = 0;
    for (const code of this.byCode.keys()) {
      const p = this.getProvenance(code);
      realFields += p.classCounts.real; estimatedFields += p.classCounts.estimated; specialFields += p.classCounts.special;
      if (p.classCounts.real) countriesWithRealFields++;
      if (p.classCounts.estimated) countriesWithEstimatedFields++;
    }
    return {
      mode: "REAL_WORLD",
      completeBaselineCountries: timeSeriesCountries,
      realWorldCountries: countriesWithRealFields,
      estimatedBaselineCountries: countriesWithEstimatedFields,
      timeSeriesCountries,
      objectiveMetadataCountries,
      totalCountries,
      percent: totalCountries ? (timeSeriesCountries / totalCountries) * 100 : 0,
      objectiveMetadataPercent: totalCountries ? (objectiveMetadataCountries / totalCountries) * 100 : 0,
      fieldClassCounts: { real: realFields, estimated: estimatedFields, special: specialFields },
      retrievedAt: this.dataset?.retrievedAt || null,
      sync: clone(this.dataset?.sync || null),
      fieldCoverage: this.fieldCoverage(totalCountries),
      sources: clone(this.dataset?.sources || {}),
      startSnapshot: this.getStartSnapshotInfo()
    };
  }

  getStartSnapshotInfo() {
    if (!this.startSnapshot) return null;
    return {
      snapshotId: this.startSnapshot.snapshotId || null,
      generatedAt: this.startSnapshot.generatedAt || null,
      simulationStartDate: this.startSnapshot.simulationStartDate || null,
      offlineReady: this.startSnapshot.offlineReady === true,
      coverage: clone(this.startSnapshot.coverage || null)
    };
  }

  getSimulationStartDate(fallback = "2025-01-01") { return this.startSnapshot?.simulationStartDate || fallback; }
}
