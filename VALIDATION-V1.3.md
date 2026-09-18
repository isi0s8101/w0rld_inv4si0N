# Validation — World Invasion V1.3

## Périmètre

Lots 11–13 :

- Causality Mode ;
- Timeline / Replay / snapshots d'observation ;
- Global Search / Command Palette.

## Résultats

### Tests spécifiques V1.3

`tests/world-invasion-v1_3-lots11-13.test.mjs`

- 6/6 PASS ;
- dépendances amont/aval ;
- reconstruction de chaîne causale datée ;
- historique/LIVE ;
- replay déterministe des `RIPPLE` ;
- snapshots `READ_ONLY` ;
- recherche pays/infrastructures/routes/véhicules/événements.

### Non-régression cumulative ciblée

Suite combinée architecture/projections/Update 1/Update 2/Update 3/V1.2/V1.3 :

- 56/56 PASS.

### Syntaxe

- 126 fichiers JS/MJS sous `src/` ;
- 126/126 `node --check` OK.

### Validateurs

- `ANALYSIS_V1_3=OK` ;
- `INTERACTION_V1_2=OK` ;
- `UPDATE_2_3_VALIDATE=OK` ;
- `UPDATE_3_COMPLETE_VALIDATE=OK` ;
- données REAL WORLD : 175/175 pays couverts par la baseline ;
- flux macro : 6 212 corridors ;
- Infrastructure V1 : 45 nœuds, 18 routes, 5 entités mobiles, 28 icônes cataloguées.

### Régression V0.8 lourde

La commande groupée des 10 scénarios diplomatiques dépasse la fenêtre d'exécution de 120 s. Les deux scénarios d'intégration les plus coûteux ont été relancés séparément :

- cycle V0.8 diplomatie/économie/contrats/blocs/opinion : PASS (~28 s) ;
- API + Focus Panel V0.8 : PASS.

Les lots V1.3 ne modifient pas les moteurs diplomatiques.

## Contrats fonctionnels

### Causality Mode

Le mode causal est explicatif et non destructif. Il utilise les dépendances déclarées de l'Infrastructure Graph et les chaînes `WorldMemory/RIPPLE`. Il n'infère pas automatiquement une causalité factuelle absente du modèle.

### Timeline / Replay

Le replay V1.3 est non destructif : il rejoue visuellement et chronologiquement les événements mémorisés sans restaurer l'intégralité du World State à une date passée.

Les snapshots sont `READ_ONLY`. Un moteur de rollback/sauvegarde complète nécessiterait une restauration déterministe de chaque sous-système et n'est pas déclaré comme implémenté ici.

### Global Search

La recherche est locale et dynamique sur l'état courant. Elle est insensible aux accents/casse et utilise un scoring lexical ; elle n'utilise ni recherche sémantique externe ni IA.

## Verdict

`V1.3 LOTS 11–13 = VALIDATED`
