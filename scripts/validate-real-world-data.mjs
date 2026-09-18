import { readFile } from "node:fs/promises";
import { RealWorldDataStore } from "../src/game/realworld/RealWorldDataStore.js";

const snapshot = JSON.parse(await readFile(new URL("../src/game/data/real-world-start-snapshot.json", import.meta.url), "utf8"));
const countries = JSON.parse(await readFile(new URL("../src/data/countries.json", import.meta.url), "utf8"));
const store = new RealWorldDataStore().loadStartSnapshot(snapshot);
if (!store.validate()) throw new Error("Real-world start snapshot validation failed");
const coverage = store.coverage(countries.length);
console.log(JSON.stringify(coverage, null, 2));
if (coverage.objectiveMetadataCountries !== countries.length) throw new Error(`Objective metadata coverage ${coverage.objectiveMetadataCountries}/${countries.length}`);
if (coverage.completeBaselineCountries !== countries.length) throw new Error(`Complete baseline coverage ${coverage.completeBaselineCountries}/${countries.length}`);
if (coverage.startSnapshot?.coverage?.hardcodedCountries !== countries.length) throw new Error(`Hardcoded snapshot coverage ${coverage.startSnapshot?.coverage?.hardcodedCountries}/${countries.length}`);
if (coverage.startSnapshot?.offlineReady !== true) throw new Error("Start snapshot is not offline-ready");
for (const [field, entry] of Object.entries(coverage.fieldCoverage)) {
  if (entry.countries !== countries.length) throw new Error(`Field ${field} incomplete: ${entry.countries}/${countries.length}`);
}
