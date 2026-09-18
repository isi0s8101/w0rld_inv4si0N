import { readFile, writeFile } from "node:fs/promises";

const baselineUrl = new URL("../src/game/data/real-world-baseline.json", import.meta.url);
const metadataUrl = new URL("../src/game/data/real-world-objective-metadata.json", import.meta.url);
const outputUrl = new URL("../src/game/data/real-world-start-snapshot.json", import.meta.url);

const [baseline, metadata] = await Promise.all([
  readFile(baselineUrl, "utf8").then(JSON.parse),
  readFile(metadataUrl, "utf8").then(JSON.parse)
]);

const metadataCountries = Object.values(metadata.countries || {});
const records = Object.values(baseline.countries || {});
const classes = { real: 0, estimated: 0, special: 0 };
for (const record of records) for (const entry of Object.values(record)) {
  const dataClass = entry.dataClass || "REAL";
  if (String(dataClass).startsWith("REAL")) classes.real++;
  else if (dataClass === "SPECIAL") classes.special++;
  else classes.estimated++;
}
const snapshot = {
  schemaVersion: 1,
  mode: "REAL_WORLD_START_SNAPSHOT",
  snapshotId: `world-invasion-real-world-start-v0.4-${new Date().toISOString().slice(0, 10)}`,
  generatedAt: new Date().toISOString(),
  simulationStartDate: "2025-01-01",
  offlineReady: true,
  description: "Snapshot local complet pour 175 pays. Chaque champ distingue REAL, ESTIMATED et SPECIAL; aucune estimation n’est présentée comme une mesure réelle.",
  coverage: {
    hardcodedCountries: metadataCountries.length,
    objectiveMetadataCountries: metadataCountries.length,
    timeSeriesCountries: Object.keys(baseline.countries || {}).length,
    completeBaselineCountries: records.length,
    populationSnapshotCountries: metadataCountries.filter((entry) => Number.isFinite(entry.populationSnapshot)).length,
    areaSnapshotCountries: metadataCountries.filter((entry) => Number.isFinite(entry.areaKm2)).length,
    fieldClassCounts: classes
  },
  baseline,
  metadata
};

await writeFile(outputUrl, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`[WorldInvasion] start snapshot frozen: ${snapshot.coverage.hardcodedCountries} countries`);
console.log(`[WorldInvasion] complete baseline: ${snapshot.coverage.completeBaselineCountries}`);
console.log(`[WorldInvasion] fields REAL=${classes.real} EST=${classes.estimated} SPECIAL=${classes.special}`);
