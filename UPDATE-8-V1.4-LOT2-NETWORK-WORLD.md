# World Invasion V1.4 — LOT 2 NETWORK WORLD

## Objectif

Transformer les infrastructures du LOT 1 en graphes physiques nationaux et internationaux exploitables, sans démarrer le modèle de cargaison physique du LOT 3.

## Implémentation

### World Network Store

Ajout de `src/game/network/WorldNetworkStore.js`.

Le store charge `src/game/data/world-network-v1.json` et indexe :

- routes par identifiant ;
- routes par pays ;
- gateways par identifiant ;
- gateways par pays ;
- graphes par type et scope.

### International Gateway Engine

Ajout de `src/game/network/InternationalGatewayEngine.js`.

Types de gateway disponibles :

- `SEA_GATEWAY` ;
- `AIR_GATEWAY` ;
- `ROAD_BORDER` ;
- `RAIL_BORDER` ;
- `PIPELINE_BORDER` ;
- `DIGITAL_GATEWAY`.

Les pays enclavés n'obtiennent aucun `SEA_GATEWAY` national. Le moteur expose aussi des options de transit via pays voisins, qui seront filtrées politiquement au LOT 5.

### Graphes physiques

Le dataset mondial contient :

- `ROAD_ROUTE` ;
- `RAIL_ROUTE` ;
- `POWER_ROUTE` ;
- `PIPELINE_ROUTE` ;
- `DIGITAL_ROUTE` ;
- `AIR_ROUTE` ;
- `SEA_ROUTE`.

Les routes sont réparties en scopes `DOMESTIC`, `INTERNATIONAL` et `CORRIDOR`.

Les routes terrestres internationales sont générées uniquement entre pays adjacents selon `CountryPhysicalProfile.geography.borders`.

### Chokepoints

Les chokepoints explicites du graphe couvrent désormais :

- Suez ;
- Panama ;
- Hormuz ;
- Malacca ;
- Bosporus ;
- Bab-el-Mandeb ;
- Gibraltar.

### Corrections structurelles détectées

Le validateur réseau a révélé deux mauvaises classifications côtières héritées du LOT 1 : Paraguay (`PY`) et Soudan du Sud (`SS`).

Les deux profils sont corrigés en `landlocked=true`, `coastlineAccess=false`, leurs ports estimés sont supprimés, et la provenance de la correction est enregistrée comme géographie réelle structurale.

### Intégration runtime

`RouteEngineV1` charge maintenant par défaut `src/game/data/world-network-v1.json`.

`App` initialise :

- `WorldNetworkStore` ;
- `RouteEngineV1` sur le réseau mondial ;
- `InternationalGatewayEngine`.

Les systèmes V1.2 de trafic/rerouting restent compatibles. Le LOT 2 ne modifie pas encore l'économie de livraison `MIRROR`.

## Méthode de génération

Le générateur `scripts/build-world-network.mjs` :

1. charge les profils et infrastructures du LOT 1 ;
2. applique les corrections structurelles ;
3. ajoute les chokepoints manquants ;
4. construit les graphes nationaux par type d'infrastructure ;
5. construit les liaisons terrestres internationales selon l'adjacence pays ;
6. construit une connectivité aérienne internationale bornée ;
7. construit une connectivité maritime internationale bornée ;
8. connecte les principaux chokepoints ;
9. construit les liens numériques internationaux ;
10. produit le catalogue de gateways ;
11. reconstruit les connexions des nœuds ;
12. exécute les contrôles de cohérence.

Les liaisons générées sont classées `ESTIMATED_NETWORK`. Elles constituent une topologie physique plausible et exploitable, mais ne prétendent pas reproduire exhaustivement les infrastructures réelles du monde.

## Statistiques

- pays/profils : 175 ;
- pays habités : 174 ;
- nœuds : 3 394 ;
- routes réseau : 4 829 ;
- gateways : 904 ;
- routes domestiques : 3 431 ;
- routes internationales : 1 394 ;
- corridors chokepoint locaux : 4.

Par type :

- ROAD_ROUTE : 1 848 ;
- RAIL_ROUTE : 1 027 ;
- POWER_ROUTE : 866 ;
- DIGITAL_ROUTE : 381 ;
- AIR_ROUTE : 370 ;
- SEA_ROUTE : 301 ;
- PIPELINE_ROUTE : 36.

## Limites volontaires

Ce LOT ne doit pas anticiper les lots suivants.

Non implémenté ici :

- vraies cargaisons `IN_TRANSIT` ;
- `TransportPlan` multimodal ;
- droits de transit diplomatiques ;
- sanctions sectorielles appliquées au routing ;
- `actualRouteState` / `perceivedRouteState` ;
- score stratégique complet de route ;
- trafic visuel basé sur cargo physique.

Ces points appartiennent aux LOTS 3 à 6.
