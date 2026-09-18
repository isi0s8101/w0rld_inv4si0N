import fs from 'node:fs';
const req=(p)=>{if(!fs.existsSync(new URL(`../${p}`,import.meta.url)))throw new Error(`missing ${p}`);};
for(const p of [
 'src/game/systems/SimulationTimeEngine.js','src/game/systems/InfrastructureRuntime.js','src/game/systems/InfrastructureFlowEngine.js','src/game/systems/LogisticsEngine.js','src/game/systems/InfrastructureDependencyEngine.js','src/game/systems/EnergyEngineV1.js','src/game/systems/EconomyEngineV1.js','src/game/systems/PopulationEngineV1.js','src/game/systems/MilitaryLogisticsEngine.js','src/game/systems/DerivedIndicatorEngine.js','src/game/intelligence/IntelligenceEngine.js','src/game/history/WorldMemory.js','src/game/scenario/ScenarioEngine.js','src/game/simulation/CausalEventEngine.js','src/game/ai/StrategicObjectiveEngine.js'
])req(p);
const api=fs.readFileSync(new URL('../src/game/GameAPI.js',import.meta.url),'utf8');
for(const name of ['getSimulationTime','getInfrastructureRuntime','getInfrastructureFlows','getPhysicalLogistics','getDerivedIndicators','getMilitaryLogistics','getIntelligence','getStability','getInfluence','getStrategicObjectives','getTimeline','getCausalEvents','getScenario','configureScenario','setInfrastructureDamage','setPhysicalRouteStatus'])if(!api.includes(name))throw new Error(`API missing ${name}`);
const clock=fs.readFileSync(new URL('../src/game/GameClock.js',import.meta.url),'utf8');if(!clock.includes('50'))throw new Error('x50 speed missing');
const state=fs.readFileSync(new URL('../src/game/simulation/CountryState.js',import.meta.url),'utf8');for(const r of ['oil','gas','coal','uranium','electricity','steel','copper','lithium','food','water'])if(!state.includes(`${r}: strategicResource`))throw new Error(`strategic resource missing ${r}`);
console.log('UPDATE_2_3_VALIDATE=OK');
