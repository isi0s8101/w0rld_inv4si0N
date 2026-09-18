import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const requireFile = (p) => {
  const u = new URL(p, root);
  if (!fs.existsSync(u)) throw new Error(`missing ${p}`);
};
const requireContains = (p, values) => {
  const text = read(p);
  for (const value of values) if (!text.includes(value)) throw new Error(`${p} missing ${value}`);
};

for (const p of [
  'src/game/diplomacy/AllianceBlocSystem.js',
  'src/game/intelligence/IntelligenceEngine.js',
  'src/game/ai/StrategicObjectiveEngine.js',
  'src/game/ai/CountryPolicyAI.js',
  'src/game/ai/CountryPolicySystem.js',
  'src/game/simulation/CausalEventEngine.js',
  'src/game/systems/FeedbackLoopEngine.js',
  'src/game/systems/StabilityEngine.js',
  'src/game/systems/InfluenceEngine.js',
  'src/game/history/WorldMemory.js',
  'src/game/scenario/ScenarioEngine.js'
]) requireFile(p);

requireContains('src/game/diplomacy/AllianceBlocSystem.js', ['JOIN','LEAVE','SUSPEND','APPROACH','DISTANCE','REJOIN']);
requireContains('src/game/intelligence/IntelligenceEngine.js', ['UNKNOWN','ESTIMATED','PROBABLE','CONFIRMED','satellite','radar','reconnaissance','allies','cyber','openSources']);
requireContains('src/game/ai/StrategicObjectiveEngine.js', ['SURVIVAL','SECURITY','ECONOMIC_GROWTH','ENERGY_SECURITY','INFLUENCE','PRESTIGE','TECHNOLOGY','TERRITORIAL_CONTROL','threat','opportunity']);
requireContains('src/game/ai/CountryPolicySystem.js', ['REINFORCE_BASE','DEPLOY_UNITS','REINFORCE_ALLIANCE','OPEN_ROUTE','SIGN_AGREEMENT','IMPOSE_SANCTION']);
requireContains('src/game/simulation/CausalEventEngine.js', ['BLOCKADE','SANCTIONS','EMBARGO','DIPLOMATIC_BREAK','ALLIANCE','WAR','DROUGHT','ENERGY_CRISIS','FINANCIAL_CRISIS','INDUSTRIAL_ACCIDENT','NATURAL_DISASTER','REBELLION','GOVERNMENT_CHANGE','RIPPLE']);
requireContains('src/game/systems/FeedbackLoopEngine.js', ['WAR_BURDEN','BLOCKADE_COST','ENERGY_SCARCITY','INSTABILITY_TRAP','GROWTH_REINVESTMENT','SECURE_SUPPLY_GROWTH','COOPERATION_DIVIDEND']);
requireContains('src/game/history/WorldMemory.js', ['dateForDay','pathEffects','BLOC_TRANSITION','timeline']);
requireContains('src/game/scenario/ScenarioEngine.js', ['replayKey','configurationHash','determinismContract','decisionInputs']);
requireContains('src/game/GameAPI.js', ['getBlocMembership','getBlocTransitions','getObservedCountry','getFeedbackLoops','getFeedbackSummary','recordScenarioDecision']);

console.log('UPDATE_3_COMPLETE_VALIDATE=OK');
