# Validation — World Invasion V1.4 LOT 1 WORLD POPULATION

Date: 2026-09-14

## Résultat

`VALIDATION_V1_4_LOT1=OK`

## Couverture mondiale

- entités du dataset monde : 175
- entités habitées : 174
- territoire inhabité spécial : `AQ`
- profils physiques : 175/175
- capitales pour entités habitées : 174/174
- gateways aériens : 174/174
- hubs logistiques : 174/174
- nœuds générés LOT 1 : 3 347
- nœuds d'infrastructure totaux : 3 392

## Validations de cohérence

Toutes les listes suivantes sont vides :

- `landlockedWithPort`
- `islandsWithoutGateway`
- `factoriesWithoutLogistics`
- `minesWithoutOutbound`
- `majorCitiesWithoutBasicSupply`

Les nœuds synthétiques `wp-*` sont contrôlés pour ne jamais déclarer `dataMode=REAL`.

## Tests LOT 1

Commande :

```bash
node tests/world-invasion-v1_4-lot1-world-population.test.mjs
```

Résultat :

```text
LOT1_TESTS=OK countries=175 nodes=3392
```

Validateur dédié :

```text
VALIDATION_V1_4_LOT1=OK countries=175 infrastructureNodes=3392 generated=3347
```

## Non-régression ciblée

- V1.3.1 UI readability : 5/5 PASS
- V1.3 causality/timeline/search : 6/6 PASS
- V1.2 interactive navigation/traffic : 12/12 PASS
- V1.1.1 Update 3 complete : 9/9 PASS

Total ciblé exécuté : 32/32 PASS, plus le test dédié LOT 1.

Validateurs historiques :

```text
VALIDATION_V1_3_1_UI=OK
ANALYSIS_V1_3=OK
INTERACTION_V1_2=OK
UPDATE_3_COMPLETE_VALIDATE=OK
```

Le validateur V1.2 confirme toujours explicitement que le `deliveryAccounting=MIRROR`; ce comportement n'est pas modifié prématurément dans le LOT 1.

## Syntaxe

169 fichiers JavaScript/MJS contrôlés avec `node --check` :

```text
SYNTAX_OK=169
```

## Réserves

La validation porte sur cohérence structurelle, déterminisme, provenance et non-régression. Elle ne transforme pas les nœuds estimés en inventaire réel sourcé.

Le réseau de connexions détaillé entre les 3 392 nœuds n'est volontairement pas construit dans ce lot. Il appartient au LOT 2.
