# Validation — World Invasion V1.2 Interactive Navigation & Traffic

Date de gel : 2026-09-13

## Périmètre validé

Lots 1–10 :

1. `MapCameraEngine` WORLD/TERRITORY ;
2. zoom sémantique, LOD, index spatial ;
3. labels, clusters, priorité visuelle ;
4. `SelectionContext` et historique ;
5. layers, presets, Auto Layers ;
6. `TrafficLogisticsEngine` ;
7. densité adaptative ;
8. waypoints ;
9. perturbations / rerouting ;
10. Focus Mode.

## Résultats

### Tests ciblés cumulés

Commande :

```bash
node --test \
  tests/projections.test.mjs \
  tests/v1-contract.test.mjs \
  tests/world-invasion-v0_9-update1-infrastructure.test.mjs \
  tests/world-invasion-v1_0-update2-systems.test.mjs \
  tests/world-invasion-v1_1-update3-autonomous-world.test.mjs \
  tests/world-invasion-v1_1_1-update3-complete.test.mjs \
  tests/world-invasion-v1_2-lots1-10.test.mjs
```

Résultat : **48 / 48 PASS**.

Le fichier V1.2 dédié contient **12 / 12 PASS**.

### Diplomatie V0.8

Les huit premiers scénarios historiques ont passé avant la limite de la commande groupée. Les deux scénarios restants ont ensuite été exécutés explicitement et passent :

- cycle V0.8 long : PASS ;
- API / Focus Panel V0.8 : PASS.

La régression V0.8 est donc couverte sur ses 10 scénarios, avec exécution fractionnée.

### Syntaxe

`node --check` : **128 fichiers JS/MJS OK** dans `src/` et `scripts/`.

### Validateurs

- `INTERACTION_V1_2=OK` ;
- `REAL_WORLD` : 175 pays couverts par la baseline ;
- Flow data : 175 pays, 6 212 corridors macro ;
- `UPDATE_2_3_VALIDATE=OK` ;
- `UPDATE_3_COMPLETE_VALIDATE=OK` ;
- Infrastructure V1 : 45 nœuds / 18 routes / 5 mobiles / 28 icônes.

## Tests de comportement V1.2 couverts

- zoom WORLD ancré sous le curseur ;
- pan borné ;
- zoom/pan/focus/fit/follow/reset TERRITORY ;
- niveaux sémantiques WORLD ;
- requête SpatialIndex ;
- clustering ;
- placement de labels sans collision ;
- restauration vue/pays/caméra/sélection ;
- presets et Auto Layers ;
- densité 1→5 selon intensité ;
- création SHIP / PLANE / TRAIN / TRUCK ;
- véhicules alimentés par des flux physiques simulés ;
- waypoints typés ;
- blocage Suez ;
- reroutage via cap de Bonne-Espérance ;
- état `REROUTING` d'un navire ;
- Focus Mode avec atténuation à 15 % ;
- contrôles souris/tactile et boutons UI.

## Note sur la suite complète

La commande monolithique `npm test` contient d'anciens tests de simulation longue sur 175 pays et dépasse la fenêtre de 300 s dans cet environnement. Aucun échec n'a été observé avant timeout ; les tests de régression pertinents ont donc été exécutés par groupes ciblés, et les scénarios diplomatiques longs ont été complétés séparément.

## Limites connues

1. Les infrastructures V1 restent `DEMO_APPROX`, pas un inventaire mondial exhaustif.
2. Les routes physiques sont un graphe de démonstration, maintenant porté à 18 routes avec un contournement maritime du Suez.
3. Les véhicules sont des représentations agrégées `SIM_AGGREGATED_TRAFFIC`.
4. La comptabilité des stocks du moteur physique historique est encore immédiate. `DeliveryResolver` fonctionne en `MIRROR` pour ne pas créditer deux fois une livraison. La migration vers de vraies expéditions `IN_TRANSIT` différées reste une évolution ultérieure.
5. La validation UI est automatisée au niveau logique/DOM/source ; elle ne remplace pas une recette visuelle humaine sur navigateur et tactile réel.
