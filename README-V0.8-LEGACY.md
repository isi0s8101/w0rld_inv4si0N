# World Invasion V0.8 — Diplomacy & Strategic Blocs

Évolution incrémentale de `world-invasion-v0.7-dynamic-world-economy`.

## Objectif

Ajouter une couche géopolitique de **simulation** au monde autonome existant sans créer de moteur parallèle :

`relations → politique extérieure → alliances/blocs → accords/sanctions → accès commercial → contrats/flux/prix → dépendances → opinion/awareness → nouvelles décisions`

La V0.8 reste offline au runtime et conserve les fondations V0.7 : 175 pays, économie dynamique, IA nationale, événements, marchés, contrats, projets, Global Flow Engine et séparation stricte `REAL / ESTIMATED / DERIVED / SIM`.

## 1. Diplomatie dynamique

`DiplomacySystem` fait évoluer les relations dirigées existantes à partir de :

- relation historique de référence ;
- confiance ;
- commerce ;
- accords actifs ;
- sanctions actives ;
- appartenance à un même bloc simulé ;
- ouverture de politique extérieure.

Chaque relation conserve :

- `historicalRelation` ;
- `relationTrend` ;
- `relationHistory` ;
- `agreementBonus` ;
- `sanctionPressure` ;
- `blocAffinity`.

Classe : `SIM_RELATION_HISTORY`.

## 2. Alliances et blocs

`AllianceBlocSystem` dérive des alliances **de gameplay** à partir des relations mutuelles, de la confiance et du niveau d'alliance simulé.

Les alliances suffisamment fortes forment des composantes connectées qui deviennent des blocs stratégiques dynamiques.

Classes :

- `SIM_ALLIANCE` ;
- `SIM_DYNAMIC_BLOC`.

Les noms, memberships et niveaux de cohésion produits par ce système ne sont jamais présentés comme des alliances politiques réelles.

## 3. Accords commerciaux et sectoriels

`AgreementSystem` peut créer quatre scopes :

- `TRADE` ;
- `ENERGY` ;
- `DATA` ;
- `LOGISTICS`.

Les accords modifient le choix des partenaires, les multiplicateurs de prix simulés et certaines capacités logistiques. Ils sont branchés directement sur `GlobalFlowEngine.tradeAccess()` et donc sur les contrats et le routage économique.

Classe : `SIM_DIPLOMATIC_AGREEMENT`.

## 4. Spécialisations économiques nationales

`SpecializationSystem` dérive une spécialisation primaire et secondaire à partir des capacités déjà présentes :

- `AGRICULTURE` ;
- `ENERGY` ;
- `INDUSTRY` ;
- `TECHNOLOGY` ;
- `LOGISTICS` ;
- `SERVICES`.

La spécialisation est réévaluée trimestriellement. Elle influence les biais d'exportation du moteur de flux mais reste `DERIVED_SIMULATION`.

## 5. Dépendances stratégiques

`DependencySystem` calcule pour `food / energy / goods / data` :

- dépendance aux importations ;
- concentration des fournisseurs ;
- dépendance stratégique synthétique ;
- principaux fournisseurs de simulation.

Le calcul distingue la dépendance structurelle au besoin d'importation et la concentration des fournisseurs.

Classe : `DERIVED_SIMULATION`.

## 6. Sanctions et embargos abstraits

`SanctionSystem` crée uniquement des mécanismes de gameplay macro :

- `SANCTION` ;
- `EMBARGO`.

Ils peuvent dégrader le poids d'un partenaire, augmenter un coût commercial simulé ou bloquer un couple pays/ressource. Ils ne ferment pas automatiquement les corridors physiques du réseau.

Classe : `SIM_ABSTRACT_POLICY`.

## 7. Politique extérieure

`ForeignPolicySystem` réévalue trimestriellement six doctrines :

- `OPEN_TRADE` ;
- `REGIONAL_COOPERATION` ;
- `STRATEGIC_AUTONOMY` ;
- `TECHNOLOGY_FIRST` ;
- `SECURITY_FIRST` ;
- `BALANCED`.

Chaque pays conserve un historique de doctrine depuis le jour 0.

## 8. Opinion et awareness globales

`GlobalOpinionSystem` maintient quatre indicateurs mondiaux de simulation :

- `awareness` ;
- `cooperation` ;
- `tension` ;
- `confidence`.

Ils dépendent des pénuries, événements, sanctions, accords et de la stabilité agrégée. Chaque pays reçoit aussi une opinion publique de simulation avec confiance, tension et internationalisme.

Ces valeurs servent uniquement au gameplay ; elles ne décrivent pas l'opinion réelle d'une population.

## 9. Intégration avec la V0.7

La diplomatie influence directement l'économie existante :

```text
ForeignPolicySystem
        ↓
DiplomacySystem ──→ AllianceBlocSystem
        ↓                  ↓
AgreementSystem      SanctionSystem
        └──────┬───────────┘
               ↓
       GlobalFlowEngine
               ↓
       ContractSystem
               ↓
 markets / shipments / stocks
               ↓
      DependencySystem
               ↓
     CountryPolicyAI
```

Les lookups accords, sanctions et blocs sont indexés par couple/pays afin de ne pas dégrader le coût des milliers d'évaluations quotidiennes du moteur de flux.

## API V0.8

```js
WorldInvasion.getDiplomacy("FR");
WorldInvasion.getAlliances("FR");
WorldInvasion.getBlocs();
WorldInvasion.getBlocFor("FR");
WorldInvasion.getAgreements({ country: "FR", status: "ACTIVE" });
WorldInvasion.getSanctions({ country: "FR", status: "ACTIVE" });
WorldInvasion.getDependencies("FR");
WorldInvasion.getSpecialization("FR");
WorldInvasion.getForeignPolicy("FR");
WorldInvasion.getWorldOpinion();
```

## UI

Le Focus Panel expose notamment :

- politique extérieure ;
- spécialisation ;
- dépendance ;
- bloc ;
- accords ;
- sanctions ;
- confiance publique ;
- awareness ;
- awareness mondiale dans la vue globale.

Les labels `SIM` et `DERIVED` restent visibles.

## Validation

Voir `VALIDATION.md`.

Résultat V0.8 dédié : **10/10 tests PASS**. Les 84 tests historiques V0.7 et antérieurs ont également été observés PASS durant la non-régression. Données pays, réseaux, syntaxe JS et JSON sont validés séparément.

## Limites

- aucune alliance, sanction, doctrine ou opinion V0.8 n'est une affirmation sur la politique réelle actuelle d'un pays ;
- les relations de départ restent majoritairement synthétiques/estimées ;
- la diplomatie ne modélise pas encore des organisations réelles ou des traités juridiques détaillés ;
- les sanctions restent des abstractions économiques de gameplay ;
- la négociation multi-tour et les objectifs diplomatiques du joueur viendront plus tard.
