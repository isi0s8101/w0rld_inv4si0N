# Mise à jour 3 — Diplomatie, IA, événements et monde autonome — COMPLETE

Version : **1.1.1**

## Objectif

Transformer les moteurs physique, logistique et économique en un monde autonome où les États perçoivent imparfaitement leur environnement, poursuivent des objectifs, prennent des décisions, subissent des événements causaux et conservent la mémoire des conséquences.

```text
WORLD STATE
   ↓
Diplomacy + Intelligence
   ↓
Strategic evaluation
   ↓
AI decisions
   ↓
Conditional events
   ↓
Feedback loops
   ↓
Stability / Influence
   ↓
World Memory
   ↓
NEW WORLD STATE
```

## Diplomatie multidimensionnelle

Le moteur diplomatique V0.8 est conservé et enrichi. Une relation bilatérale peut simultanément exprimer :

`trust / trade / alliance / rivalry / influence / sanctions / energyDependency / militaryAccess / securityGuarantee`.

Il n'existe donc plus de dépendance à un score diplomatique unique pour décrire toute la relation.

## Strategic Blocs dynamiques

Les blocs possèdent un cycle de vie simulé. Les transitions historisées sont :

`JOIN / REJOIN / SWITCH / SUSPEND / APPROACH / LEAVE / DISTANCE`.

L'appartenance courante est consultable via `getBlocMembership(country)` et son historique via `getBlocTransitions()`.

## Intelligence Engine — information imparfaite

Quatre niveaux sont utilisés :

`UNKNOWN → ESTIMATED → PROBABLE → CONFIRMED`.

Six familles de sources contribuent indépendamment :

`satellite / radar / reconnaissance / allies / cyber / openSources`.

Tant qu'une information n'est pas confirmée, le moteur retourne une estimation simulée et bruitée au lieu d'exposer la valeur interne exacte de la cible. L'API `getObservedCountry(observer, target)` fournit la vue compatible fog-of-war.

`awareness` dépend des capacités de renseignement et des sources disponibles. Les estimations sont marquées `SIM_INTELLIGENCE_ESTIMATE` et ne doivent pas être confondues avec les données REAL WORLD.

## AI Decision Engine

Les huit objectifs sont :

`SURVIVAL / SECURITY / ECONOMIC_GROWTH / ENERGY_SECURITY / INFLUENCE / PRESTIGE / TECHNOLOGY / TERRITORIAL_CONTROL`.

L'évaluation stratégique tient compte de l'économie, de la logistique, de l'énergie, de la stabilité, de la capacité militaire, des ressources, de la menace, des opportunités, de la couverture alliée, de la cohésion de bloc et de la mémoire récente.

Les objectifs peuvent produire des décisions concrètes :

- investir dans infrastructure/énergie/technologie ;
- constituer des réserves ;
- renforcer une base ;
- déployer abstraitement des unités ;
- ouvrir une route ;
- signer un accord ;
- renforcer une alliance ;
- imposer une sanction ;
- diversifier ou acheter des ressources.

Les décisions restent des variables de simulation et ne prétendent pas prédire le comportement réel d'un État.

## Event Engine causal

Les événements suivent le modèle :

`conditions + probability + trigger + effects + delayed ripple effects`.

Événements internes pris en charge notamment :

`DROUGHT / ENERGY_CRISIS / LOGISTICS_SHOCK / FINANCIAL_CRISIS / INDUSTRIAL_ACCIDENT / NATURAL_DISASTER / POLITICAL_CRISIS / REBELLION / GOVERNMENT_CHANGE`.

Événements géopolitiques :

`BLOCKADE / SANCTIONS / EMBARGO / DIPLOMATIC_BREAK / ALLIANCE / WAR`.

Un événement peut modifier un corridor, déclencher des sanctions/accords, ajouter des pressions aux métriques puis inscrire chacune de ses conséquences différées dans la timeline sous forme de `RIPPLE`.

## Boucles de rétroaction

Boucles négatives explicites :

`WAR_BURDEN / BLOCKADE_COST / ENERGY_SCARCITY / INSTABILITY_TRAP`.

Boucles positives :

`GROWTH_REINVESTMENT / SECURE_SUPPLY_GROWTH / COOPERATION_DIVIDEND`.

Le moteur expose les boucles actives par pays et leur polarité afin que leurs effets soient auditables.

## Stability Engine

La stabilité est dérivée de plusieurs dimensions : économie, emploi, énergie, alimentation, sécurité, conflits, services publics/infrastructures, pression démographique et mémoire des crises. Les événements historiques récents contribuent avec une pondération explicite.

## Influence Engine

L'influence reste une valeur dérivée de la capacité économique, des échanges, des alliances, de la présence militaire abstraite, de l'énergie, de la technologie, de la diplomatie et de la coopération/aide simulée.

## World Memory et path dependency

`WorldMemory` conserve les événements significatifs : conflits, sanctions, accords, transitions de blocs, crises, pertes d'infrastructure et décisions stratégiques. Les micro-variations routinières sont filtrées afin de ne pas saturer l'historique.

Chaque événement peut conserver des effets persistants :

```text
Alliance rompue
↓
trust ↓
cooperation ↓
hostility ↑
↓
probabilité de coopération future modifiée
```

## Historical Timeline

Chaque entrée est datée selon l'horloge simulée. Les chaînes causales produisent plusieurs étapes datées : événement initial, puis conséquences `RIPPLE` lorsque leurs délais sont atteints.

Exemple conceptuel :

```text
2032-04-18 BLOCKADE
2032-04-19 RIPPLE: shipping rerouting
2032-04-24 RIPPLE: transport cost pressure
2032-05-03 RIPPLE: industrial output pressure
```

## Scenario Engine et reproductibilité

Le mode `SCENARIO` utilise :

`seed / startingWorldState / rules / events / objectives / ordered decisions`.

Le descripteur expose :

- `configurationHash` ;
- `replayKey` ;
- `determinismContract`.

Contrat : avec la même version moteur, la même seed, le même état initial, les mêmes règles, événements, objectifs et décisions ordonnées, la simulation doit être reproductible.

## REAL WORLD / DERIVED / SIM

Les catégories restent strictement séparées :

- `REAL WORLD` : faits objectifs importés avec `source`, `referenceDate`, `retrievedAt`, `confidence` lorsque disponibles ;
- `ESTIMATED` : estimation explicitement identifiée ;
- `DERIVED` : métriques calculées et explicables ;
- `SIM/GAMEPLAY` : awareness, doctrine, objectifs IA, événements, mémoire, comportement autonome ;
- `DEMO_APPROX` : graphe physique V1 de démonstration tant qu'il n'est pas remplacé par un inventaire mondial sourcé.

## Exemple de cascade

```text
BLOCKADE / SUEZ CLOSED
      ↓
shipping route disrupted
      ↓
rerouting
      ↓
distance / fuel / transport cost ↑
      ↓
imports and industrial stocks under pressure
      ↓
production / employment ↓
      ↓
stability pressure ↑
      ↓
AI strategic priorities change
      ↓
reserve / route / agreement / alliance decision
      ↓
World Memory records the sequence
```

Le moteur est volontairement générique : une fermeture spécifique de Suez nécessite que le corridor Suez réel soit présent dans le jeu de données physique utilisé.

## API principales

```js
WorldInvasion.getBlocMembership("FR");
WorldInvasion.getBlocTransitions({ country: "FR" });
WorldInvasion.getObservedCountry("FR", "DE");
WorldInvasion.getIntelligence("FR", "DE");
WorldInvasion.getStrategicObjectives("FR");
WorldInvasion.getCausalEvents({ country: "FR" });
WorldInvasion.getFeedbackLoops("FR");
WorldInvasion.getFeedbackSummary();
WorldInvasion.getTimeline({ country: "FR" });
WorldInvasion.getScenario();
WorldInvasion.recordScenarioDecision({ day: 4, type: "INVEST", country: "FR" });
```

## Limites actuelles

Le moteur militaire reste stratégique/abstrait et ne simule pas encore les combats tactiques. Les événements géopolitiques sont des mécanismes de gameplay. Le fog-of-war est disponible via l'API observée mais l'interface n'impose pas encore un pays-joueur unique ; les écrans développeur/omniscients peuvent donc continuer à afficher l'état interne. Le graphe d'infrastructures reste `DEMO_APPROX` tant qu'un inventaire mondial sourcé ne l'a pas remplacé.
