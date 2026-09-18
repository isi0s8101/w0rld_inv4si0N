# Mise à jour 2 — Flux, logistique, économie et dépendances

## Résultat

La couche physique V0.9 n'est plus uniquement visuelle. Les infrastructures possèdent maintenant une capacité opérationnelle, des stocks, des entrées/sorties, des consommations, des dommages et des dépendances.

## Chaîne fonctionnelle

```text
Infrastructure
→ production / consommation
→ stocks
→ demande de transport
→ pathfinding capacité-aware
→ réservation de capacité
→ congestion
→ livraison
→ indicateurs nationaux
```

## Flux physiques

Types : `goods`, `oil`, `gas`, `electricity`, `rawMaterials`, `food`, `militarySupplies`, `fuel`, `people`, `data`.

Les flux sont distincts des flux macro du `GlobalFlowEngine` et portent `dataClass: SIM_PHYSICAL_FLOW`.

## Logistique

Chaque route expose `maxCapacity`, `currentUsage`, `availableCapacity` et `congestionRuntime`. Une route fermée est retirée du graphe. `minimumCostPath()` recherche un chemin alternatif ; `maximumFlow()` mesure la capacité résiduelle possible entre deux nœuds.

## Dépendances et dommages

Dommages séparés :

- `physicalDamage` ;
- `cyberDisruption` ;
- `energyFailure` ;
- `supplyFailure` ;
- `staffShortage`.

La capacité effective combine état de l'infrastructure, santé, dommages et dépendances.

## Indicateurs calculés

- Logistics Capacity ;
- Energy Security ;
- Industrial Capacity ;
- Digital Connectivity ;
- Resilience ;
- Trade Dependency ;
- Military Sustainment.

Les explications sont conservées dans `derivedIndicatorsV2.explanations`.
