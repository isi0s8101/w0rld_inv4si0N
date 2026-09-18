# World Invasion V1.4 — LOT 2 NETWORK WORLD

Baseline validée après le LOT 2. Le monde contient désormais des graphes physiques nationaux et internationaux, des gateways typées et les principaux chokepoints. Voir `UPDATE-8-V1.4-LOT2-NETWORK-WORLD.md` et `VALIDATION-V1.4-LOT2.md`.

# World Invasion V1.4 — LOT 1 WORLD POPULATION

Baseline courante : V1.4 LOT 1. Les 175 entités du dataset monde disposent désormais d’un `CountryPhysicalProfile`; les 174 entités habitées disposent d’un socle d’infrastructures national déterministe et les nœuds synthétiques sont explicitement classés `ESTIMATED`. Voir `UPDATE-7-V1.4-LOT1-WORLD-POPULATION.md` et `VALIDATION-V1.4-LOT1.md`.

**Arrêt de séquence : LOT 2 non commencé.**

---

# World Invasion V1.3.1 — UI Readability

Cette baseline reprend la V1.3 et applique le lot P0 de correction d'affichage avant toute nouvelle évolution gameplay.

Principales corrections : typographie lisible, panneaux redimensionnés, contrôles plus grands, labels de carte renforcés, réglages `UI SCALE`, densité, contraste, réduction du bruit visuel et mode `MAP FIRST`.

Voir `UPDATE-6-UI-READABILITY.md` et `VALIDATION-V1.3.1.md`.

---

# World Invasion V1.3 — Causality, Timeline & Global Search

Version cumulative construite sur la V1.2, enrichie par les lots 11–13 de compréhension causale, navigation historique/replay et recherche globale.

```text
V0.9 Update 1  : monde physique
V1.0 Update 2  : flux, logistique, économie, dépendances
V1.1.1 Update 3: diplomatie dynamique, renseignement imparfait, IA, causalité, rétroactions, mémoire
V1.2 Lots 1–10 : map camera, zoom sémantique, LOD, clusters, layers, trafic visible, rerouting, focus
V1.3 Lots 11–13: Causality Mode, Timeline/Replay, Global Search
```

## Architecture cible active

```text
Infrastructure Graph
      ↓
Route Engine V1
      ↓
Infrastructure Runtime
      ↓
Physical Flow Engine
      ↓
Logistics / Dependencies
      ↓
Energy / Economy / Population / Military Logistics
      ↓
Transparent Derived Indicators
      ↓
Stability / Influence / Intelligence
      ↓
Diplomacy / Strategic Blocs / Country AI
      ↓
Causal Events / World Memory / Path Dependency
      ↓
New World State
```

Le `GlobalFlowEngine` historique reste actif pour les flux macro entre pays. Le nouveau `InfrastructureFlowEngine` ajoute le niveau physique local : ports, rail, routes, pipelines, infrastructures numériques, bases, énergie et stocks. Les deux niveaux sont complémentaires et non concurrents.



## V1.3 — Causality, Timeline & Global Search

- `CausalityModeEngine` : WHY?, dépendances amont/aval et chaînes d'événements `RIPPLE` ;
- `CausalityRenderer` : relations orientées directement sur WORLD/TERRITORY ;
- `TimelineReplayEngine` : historique, replay non destructif, retour LIVE et snapshots READ_ONLY ;
- `GlobalSearchEngine` : recherche pays/infrastructures/routes/véhicules/événements ;
- Command Palette : `Ctrl+K` ou `/` ;
- raccourci `W` : analyser les causes/effets de la sélection.

Voir `UPDATE-5-CAUSALITY-TIMELINE-SEARCH.md`.

## V1.2 — Navigation interactive et Traffic & Logistics

WORLD et TERRITORY utilisent désormais un `MapCameraEngine` commun avec pan/zoom type carte interactive, zoom centré sous le curseur, tactile, inertie, bornes, fit, focus, follow et reset. Le niveau de détail est piloté par `SemanticZoomEngine`, `SpatialIndex`, `ClusterManager`, `LabelManager` et `VisualPriorityManager`.

Le `TrafficLogisticsEngine` transforme les flux physiques de simulation en véhicules agrégés visibles (`SHIP / PLANE / TRAIN / TRUCK`). Les routes sont l'infrastructure ; les véhicules sont le trafic. Le nombre visible dépend de l'intensité et de la capacité. Les routes possèdent des waypoints et un itinéraire maritime alternatif via le cap de Bonne-Espérance permet le reroutage quand Suez est bloqué.

Presets de couches : `ECONOMY / LOGISTICS / ENERGY / MILITARY / DIGITAL / INTELLIGENCE / CRISIS / TRAFFIC / ALL`, avec Auto Layers contextuel.

Voir `UPDATE-4-INTERACTIVE-MAP-TRAFFIC.md`.

## Update 2 — Flux, logistique, économie, dépendances

Nouveaux composants principaux :

- `SimulationTimeEngine` : tick interne d'une heure ;
- `InfrastructureRuntime` : stocks, production, consommation, dommages et capacité effective ;
- `InfrastructureFlowEngine` : `goods`, `oil`, `gas`, `electricity`, `rawMaterials`, `food`, `militarySupplies`, `fuel`, `people`, `data` ;
- `LogisticsEngine` : capacité, usage, saturation, goulots et itinéraires alternatifs ;
- `InfrastructureDependencyEngine` : propagation des dépendances ;
- `EnergyEngineV1` ;
- `EconomyEngineV1` ;
- `PopulationEngineV1` ;
- `MilitaryLogisticsEngine` ;
- `DerivedIndicatorEngine`.

Le `RouteEngineV1` possède maintenant :

- `maxCapacity` ;
- `currentUsage` ;
- `availableCapacity` ;
- `congestionRuntime` ;
- routage tenant compte de la capacité ;
- `minimumCostPath()` ;
- `maximumFlow()` ;
- recalcul lorsqu'une route est fermée.

Ressources stratégiques nationales ajoutées :

`oil / gas / coal / uranium / electricity / steel / copper / lithium / food / water`.

Chaque ressource conserve : production, consommation, importations, exportations, stock, capacité de stockage, prix et dépendance.

## Update 3 — Monde autonome

La diplomatie V0.8 est conservée et enrichie au lieu d'être remplacée.

Une relation expose désormais notamment :

`trust / trade / alliance / rivalry / influence / sanctions / energyDependency / militaryAccess / securityGuarantee`.

Nouveaux composants :

- `IntelligenceEngine` : `UNKNOWN / ESTIMATED / PROBABLE / CONFIRMED`, six sources et estimations non omniscientes ;
- `StrategicObjectiveEngine` : huit objectifs autonomes ;
- `StabilityEngine` ;
- `InfluenceEngine` ;
- `CausalEventEngine` avec événements géopolitiques et conséquences différées `RIPPLE` ;
- `FeedbackLoopEngine` ;
- `WorldMemory` datée avec path dependency et filtrage du bruit ;
- `ScenarioEngine` seedé, configurable et doté d’une `replayKey`.

Objectifs IA :

`SURVIVAL / SECURITY / ECONOMIC_GROWTH / ENERGY_SECURITY / INFLUENCE / PRESTIGE / TECHNOLOGY / TERRITORIAL_CONTROL`.

Le monde mémorise les décisions, événements, sanctions, accords, propagations et changements diplomatiques. Les effets historiques peuvent ensuite modifier la confiance, la coopération et l'hostilité futures.

## Horloge

Le moteur physique fonctionne en ticks horaires.

```text
1 tick = 1 heure
24 ticks = traitement quotidien
7 jours = traitements hebdomadaires
30 jours / changement de mois = traitements stratégiques périodiques
```

Contrôles UI : `PAUSE / ×1 / ×2 / ×5 / ×10 / ×50`.

## API principale ajoutée

```js
WorldInvasion.getSimulationTime();
WorldInvasion.getInfrastructureRuntime("fr-port-marseille");
WorldInvasion.getInfrastructureFlows({ country: "FR" });
WorldInvasion.getPhysicalLogistics();
WorldInvasion.getDerivedIndicators("FR");
WorldInvasion.getMilitaryLogistics("FR");
WorldInvasion.getIntelligence("FR", "DE");
WorldInvasion.getStability("FR");
WorldInvasion.getInfluence("FR");
WorldInvasion.getStrategicObjectives("FR");
WorldInvasion.getTimeline({ country: "FR" });
WorldInvasion.getCausalEvents({ country: "FR" });
WorldInvasion.getScenario();
WorldInvasion.getBlocMembership("FR");
WorldInvasion.getBlocTransitions({ country: "FR" });
WorldInvasion.getObservedCountry("FR", "DE");
WorldInvasion.getFeedbackLoops("FR");
WorldInvasion.setInfrastructureDamage("fr-port-marseille", { physicalDamage: 0.4 });
WorldInvasion.setPhysicalRouteStatus("sea-mrs-suez", "CLOSED");
```

En mode `SCENARIO` :

```js
WorldInvasion.configureScenario({
  seed: 8152042,
  startingWorldState: { countries: {} },
  rules: { fogOfWar: true },
  events: [],
  objectives: ["SURVIVAL"]
});
```

## Politique de données

Les couches restent séparées :

- `REAL WORLD` : données objectives sourcées déjà présentes dans la baseline ;
- `ESTIMATED` : champs explicitement estimés ;
- `DERIVED` : indicateurs calculés et explicables ;
- `SIM` / `GAMEPLAY` : état dynamique, IA, diplomatie, événements, mémoire ;
- `DEMO_APPROX` : infrastructures physiques de démonstration de la V0.9.

Les nouvelles ressources physiques et géopolitiques ne doivent pas être interprétées comme une description factuelle en temps réel du monde réel.

## Limites actuelles

Le graphe physique V1 reste un jeu de données de démonstration de 45 infrastructures et 18 routes ; il n'est pas encore une base mondiale exhaustive. Le moteur militaire représente le soutien et la disponibilité mais ne constitue pas encore un moteur de combat tactique complet. Les événements géopolitiques restent abstraits et simulés. La future alimentation REAL WORLD des infrastructures devra fournir source, date de référence, date de récupération et confiance.

Voir `UPDATE-1-INFRASTRUCTURE.md`, `UPDATE-2-SYSTEMS.md`, `UPDATE-3-AUTONOMOUS-WORLD.md`, `UPDATE-4-INTERACTIVE-MAP-TRAFFIC.md`, `UPDATE-5-CAUSALITY-TIMELINE-SEARCH.md`, `VALIDATION-UPDATE3-COMPLETE.md`, `VALIDATION-V1.2.md` et `VALIDATION-V1.3.md`.
