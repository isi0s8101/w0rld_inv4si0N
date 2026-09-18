import { readFile, writeFile } from "node:fs/promises";
import { WorldBankImporter } from "../src/game/realworld/WorldBankImporter.js";

const countries = JSON.parse(await readFile(new URL("../src/data/countries.json", import.meta.url), "utf8"));
const codes = countries.map((country) => country.iso2);
const importer = new WorldBankImporter();
console.log(`[WorldInvasion] World Bank sync: ${codes.length} target countries`);
const result = await importer.sync(codes);
const dataset = importer.buildDataset({ ...result, targetCount: codes.length });
const output = new URL("../src/game/data/real-world-baseline.json", import.meta.url);
await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
const fieldCounts = {};
for (const record of Object.values(dataset.countries)) for (const field of Object.keys(record)) fieldCounts[field] = (fieldCounts[field] || 0) + 1;
console.log(`[WorldInvasion] synced ${Object.keys(dataset.countries).length}/${codes.length} countries`);
console.log(JSON.stringify(fieldCounts, null, 2));
