# World Invasion V1.4 — LOT 1: WORLD POPULATION

Date: 2026-09-14

## Objet

Le LOT 1 peuple la totalité des 175 entités géographiques actuellement présentes dans le dataset monde de World Invasion avec un profil physique cohérent et un socle d'infrastructures utilisable par les moteurs ultérieurs.

Le lot respecte la séparation `REAL / ESTIMATED / DERIVED / SIMULATED`. Les infrastructures synthétiques ajoutées par ce lot sont explicitement `ESTIMATED`; aucune position ou capacité générée n'est présentée comme donnée opérationnelle réelle.

## Nouveaux composants

- `src/game/worldpopulation/CountryPhysicalProfileStore.js`
- `src/game/data/country-physical-profiles.json`
- `src/game/data/world-population-coverage-report.json`
- `scripts/build-world-population.mjs`
- `scripts/validate-v1.4-lot1-world-population.mjs`
- `tests/world-invasion-v1_4-lot1-world-population.test.mjs`

## CountryPhysicalProfile

Chaque entité dispose maintenant de :

- géographie : superficie, accès côtier, enclavement, insularité, difficulté terrain, frontières approximativement dérivées du GeoJSON ;
- démographie : population, densité, urbanisation dérivée, capitale lorsqu'applicable ;
- économie : PIB, PIB/habitant, parts industrie/agriculture/services dérivées, intensité commerciale ;
- transport : indices route, rail, aviation, maritime ;
- énergie, ressources, numérique, militaire ;
- archétypes combinables ;
- provenance et niveau de confiance.

Antarctique (`AQ`) est traité comme territoire inhabité et ne reçoit pas de capitale fictive : une station scientifique estimée est utilisée comme unique nœud structurel.

## Peuplement physique

La baseline V1.3.1 contenait 45 nœuds validés. Ils sont conservés. Le LOT 1 ajoute 3 347 nœuds déterministes pour un total de 3 392 nœuds.

Pour les 174 entités habitées :

- capitale : 174/174 ;
- aéroport : 174/174 ;
- hub logistique : 174/174 ;
- production électrique : 174/174 ;
- zone industrielle : 174/174 ;
- port maritime uniquement lorsque l'entité n'est pas enclavée ;
- rail selon développement estimé ;
- hubs routiers et frontaliers ;
- énergie, ressources, numérique, civil et militaire selon profil.

Les nœuds secondaires sont majoritairement `COUNTRY` afin d'éviter de saturer la vue WORLD. Les capitales, principaux ports et aéroports peuvent apparaître à des niveaux plus globaux.

## Archétypes

Le moteur de génération utilise des archétypes combinables comme fallback :

- `COASTAL_INDUSTRIAL`
- `LANDLOCKED`
- `ISLAND`
- `RESOURCE_EXPORTER`
- `ENERGY_EXPORTER`
- `MANUFACTURING_HUB`
- `AGRICULTURAL`
- `REGIONAL_TRANSIT`
- `LOW_INFRASTRUCTURE`
- `SERVICE_ECONOMY`
- `MIXED_ECONOMY`
- `UNINHABITED_TERRITORY`

Ils ne remplacent pas les indicateurs réels existants : ils servent à compléter une couverture mondiale incomplète.

## Intégration moteur

`CountryPhysicalProfileStore` est chargé au démarrage de l'application et transmis au `GameEngine`.

`GameAPI` expose :

- `getCountryPhysicalProfile(code)`
- `getCountryPhysicalProfiles()`

Le LOT 2 pourra donc construire ses réseaux nationaux/internationaux à partir d'un socle commun sans recréer un second modèle pays.

## Invariants LOT 1

- aucune entité enclavée ne reçoit de port maritime ;
- toutes les entités habitées disposent d'un gateway aérien ;
- toutes les entités habitées disposent d'un hub logistique ;
- une industrie n'est pas créée sans capacité logistique nationale minimale ;
- une mine n'est pas créée sans capacité de sortie nationale minimale ;
- les nœuds synthétiques ne sont jamais marqués `REAL` ;
- les anciens IDs d'infrastructure sont conservés ;
- génération idempotente : les nœuds `wp-*` sont reconstruits, pas dupliqués.

## Limites explicites

Ce lot ne prétend pas disposer d'un inventaire réel mondial des ports, centrales, mines, bases, data centers ou villes secondaires.

Les coordonnées des nœuds `wp-*` sont des positions géographiques déterministes et approximatives placées dans les géométries nationales ou sur leur contour. Les capacités sont des estimations dérivées du profil pays.

Les noms de type `France Urban Hub 1` ou `Brazil Industrial Zone` sont des nœuds synthétiques, pas des installations réelles identifiées.

Le LOT 1 ne construit pas encore les routes physiques entre ces nœuds. Cette responsabilité appartient strictement au LOT 2 — NETWORK WORLD.

Le LOT 1 ne modifie pas non plus le modèle `MIRROR` de livraison actuel. La migration vers les cargaisons physiques `IN_TRANSIT` appartient strictement au LOT 3.
