# World Invasion V1.1 — Validation Updates 2 & 3

Date de validation : 2026-09-13

## Périmètre

Cette validation couvre l'intégration cumulative :

- V0.9 Update 1 — infrastructures, itinéraires et territoires ;
- V1.0 Update 2 — flux, logistique, économie et dépendances ;
- V1.1 Update 3 — diplomatie multidimensionnelle, renseignement, IA stratégique, événements causaux, mémoire et scénarios.

## Résultats

### Tests cumulés cœur + Updates 1–3

- 37/37 tests PASS sur l'architecture, les données, projections, horloge/runtime, transitions d'état, contrat V1 et les tests dédiés Updates 1–3.
- Tests dédiés Update 1 : 3/3 PASS.
- Tests dédiés Update 2 : 6/6 PASS.
- Tests dédiés Update 3 : 5/5 PASS.

### Régression diplomatie V0.8

Les 10 scénarios historiques ciblés observés ont été validés : initialisation, historique diplomatique, alliances/blocs, accords, sanctions, dépendances, politique étrangère, opinion globale, cycle V0.8 long et API/Focus Panel.

Résultat : 10/10 PASS sur les scénarios de non-régression ciblés.

### Syntaxe et données

- Syntaxe JavaScript de `src/` et `scripts/` : OK.
- Baseline pays : 175/175 pays présents.
- Graphe macro : 6 212 corridors.
- Graphe physique Update 1 : 45 infrastructures, 17 routes, 5 entités mobiles, 28 types d'icônes mappés.
- Familles de ressources stratégiques : 10.
- Types de flux physiques : 10.
- Validation `REAL WORLD` : OK.
- Validation des flux : OK.
- Validation Update 2/3 : OK.

### Intégration bout en bout

Une journée simulée complète a été exécutée avec le runtime intégré :

- `validate() = true` ;
- 175 pays ;
- passage de H0 à H24 ;
- flux physiques actifs ;
- indicateurs dérivés calculés ;
- logistique et dépendances actives ;
- objectifs IA actifs ;
- renseignement actif ;
- mémoire du monde alimentée.

Snapshot observé :

```json
{"valid":true,"countries":175,"day":1,"hour":24,"physicalFlows":54,"memory":100,"objective":"ENERGY_SECURITY","resourceFamilies":10,"diplomacyDimensions":17}
```

## Icônes

Le pack `world_invasion_icons_decoupes_classees(3).zip` a été comparé au pack embarqué dans la baseline :

- 31/31 PNG présents ;
- aucune image manquante ;
- aucune image supplémentaire ;
- aucun écart SHA-256 sur les PNG.

Le `manifest.json` et le `README.txt` du pack source sont conservés dans `src/assets/icons/` sous les noms `manifest-pack.json` et `README-SOURCE.txt`.

## Limites connues

Le jeu conserve une séparation stricte entre faits, indicateurs dérivés et variables de simulation.

Les 45 infrastructures physiques de la démonstration restent marquées `DEMO_APPROX`. Elles servent à valider le graphe, les routes, les flux et les dépendances ; elles ne constituent pas encore un inventaire exhaustif et vérifié des infrastructures mondiales réelles.

La suite historique complète `npm test` n'a pas été certifiée en une seule exécution ininterrompue dans la fenêtre d'exécution disponible. Aucun échec n'a été observé sur les tests exécutés ; les suites ciblées ci-dessus couvrant les zones modifiées et les régressions diplomatiques passent intégralement.
