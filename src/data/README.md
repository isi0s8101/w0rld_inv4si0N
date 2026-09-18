# Données géographiques V1

- `world.geojson` : 175 entités pays uniques utilisées par Globe, World et Country.
- `countries.json` : index pays, centres, bounds globaux et `focusBounds` pour le cadrage Country.
- `cities.json` : coordonnées de villes servant de source aux nœuds logiques.
- `nodes.json` : définition des nœuds et de leur LOD ; les coordonnées sont résolues depuis `cities.json`.
- `routes.json` : routes logiques entre nœuds.
- `regions.json` : macro-régions non administratives utilisées par l’API `highlightRegion/focusRegion`.

La géométrie de `world.geojson` est dérivée du jeu `naturalearth_lowres` présent dans l’environnement de génération. Les doublons géométriques partageant le même ISO (`Somalia/Somaliland`, `Cyprus/N. Cyprus`) ont été fusionnés afin de respecter la règle « un pays logique = une entrée ISO ».

Les données de trafic et de nœuds sont des données de démonstration visuelle locales. Elles ne représentent pas un flux SOC ou des menaces réelles.
