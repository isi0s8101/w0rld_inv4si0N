# Validation — World Invasion V1.4 LOT 2 NETWORK WORLD

Date : 2026-09-14

## Résultat

`VALIDATION_V1_4_LOT2=OK`

Le LOT 2 est validé comme nouvelle baseline pour le LOT 3.

## Couverture réseau

- 175 profils pays/territoires ;
- 174 pays habités avec au moins une route physique ;
- 3 394 nœuds ;
- 4 829 routes ;
- 904 gateways ;
- 0 erreur de cohérence réseau ;
- 0 avertissement de cohérence réseau.

## Graphes présents

- ROAD : 1 848 ;
- RAIL : 1 027 ;
- ENERGY/POWER : 866 ;
- PIPELINE : 36 ;
- DIGITAL : 381 ;
- AIR : 370 ;
- SEA : 301.

## Scopes

- DOMESTIC : 3 431 ;
- INTERNATIONAL : 1 394 ;
- CORRIDOR : 4.

## Gateways

- SEA_GATEWAY : 143 ;
- AIR_GATEWAY : 205 ;
- ROAD_BORDER : 151 ;
- RAIL_BORDER : 151 ;
- PIPELINE_BORDER : 20 ;
- DIGITAL_GATEWAY : 234.

## Tests LOT 2

`tests/world-invasion-v1_4-lot2-network-world.test.mjs`

9/9 PASS :

1. tous les pays habités sont connectés ;
2. les sept types de graphes existent ;
3. les six catégories de gateway existent ;
4. aucun pays enclavé ne possède de gateway maritime ni de port ;
5. les routes terrestres internationales respectent l'adjacence pays ;
6. les routes maritimes terminent uniquement sur ports/chokepoints ;
7. sept chokepoints majeurs explicites ;
8. endpoints, distances, temps et capacités valides ;
9. rapport de couverture sans erreur ni avertissement.

## Non-régression ciblée

Tests exécutés séparément pour éviter les tests historiques longs :

- Update 1 infrastructure : 3/3 PASS ;
- Update 2 systems : 6/6 PASS ;
- Update 3 autonomous world : 5/5 PASS ;
- Update 3 complete : 9/9 PASS ;
- V1.2 Lots 1–10 : 12/12 PASS ;
- V1.3 Lots 11–13 : 6/6 PASS ;
- V1.3.1 UI readability : 5/5 PASS ;
- V1.4 LOT 1 : 1/1 PASS ;
- V1.4 LOT 2 : 9/9 PASS.

Total ciblé : 56/56 PASS.

Le lancement `npm test` complet a également progressé sans échec jusqu'aux tests longs de simulation ; l'exécution globale a été interrompue par la limite de temps de l'environnement, donc elle n'est pas revendiquée comme un run complet.

## Syntaxe

174 fichiers JS/MJS contrôlés avec `node --check` :

- 174 OK ;
- 0 erreur.

## Corrections de cohérence

Le LOT 2 a corrigé deux erreurs structurelles détectées dans les données issues du LOT 1 :

- `PY` Paraguay : enclavé, suppression du port estimé ;
- `SS` Soudan du Sud : enclavé, suppression du port estimé.

## Limites restantes

Le réseau est une topologie `ESTIMATED_NETWORK` destinée à la simulation. Il ne constitue pas encore une base exhaustive sourcée de chaque route, voie ferrée, ligne électrique ou corridor réel.

Le système de livraison reste `MIRROR`. Le passage aux stocks réellement `AVAILABLE → RESERVED → LOADED → IN_TRANSIT → DELIVERED` est réservé au LOT 3.
