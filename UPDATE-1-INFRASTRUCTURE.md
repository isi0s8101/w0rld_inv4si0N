# World Invasion v0.9 — Update 1: Infrastructures, itinéraires et territoires

Cette version conserve le moteur V0.8 (simulation, diplomatie, flux stratégiques et satellites) et ajoute le squelette géographique de la mise à jour 1.

## Ajouts

- `InfrastructureGraph` : nœuds physiques, catégories, état, capacité, santé, valeur stratégique, connexions et dépendances.
- `RouteEngineV1` : graphes maritime, aérien, routier, ferroviaire, pipeline, numérique et orbital ; waypoints ; interpolation ; Dijkstra pondéré via `shortestPath()`.
- `MobileEntityEngine` : navire, avion, camion, drone et sous-marin se déplacent sur les routes déclarées.
- `LayerManagerV1` : couches par profondeur Globe / World / Country et activation automatique selon l’objet.
- Rendu Canvas : routes réelles à waypoints, icônes du pack fourni, états opérationnels et sélection d’infrastructure.
- Vue Country : densité d’infrastructures plus forte, routes internes et panneau d’information contextuel.
- Données d’exemple séparées des données objectives existantes par `dataMode: DEMO_APPROX` afin de ne pas présenter les capacités/positions de démonstration comme une source réelle autoritative.

## États supportés

`OPERATIONAL`, `DEGRADED`, `DISRUPTED`, `CRITICAL`, `OFFLINE`, `DESTROYED`.

## Validation

```bash
npm test
npm run data:validate-infrastructure
npm run check
```

La prochaine mise à jour peut brancher le `Flow Engine` et la logistique fonctionnelle sur ce graphe sans remplacer les objets V1.
