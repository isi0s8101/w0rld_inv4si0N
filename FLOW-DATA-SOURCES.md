# Sources et statut des flux — V0.5

Ce fichier distingue les sources effectivement utilisées des sources prévues pour remplacer les estimations.

## Utilisées comme ancres dans la baseline pays

### World Bank — World Development Indicators

Indicateurs de référence déjà supportés par le pipeline du projet :

- `SP.POP.TOTL` — population ;
- `NY.GDP.MKTP.CD` — PIB courant USD ;
- `NE.TRD.GNFS.ZS` — commerce en % du PIB ;
- `NE.IMP.GNFS.ZS` — importations en % du PIB ;
- `NE.EXP.GNFS.ZS` — exportations en % du PIB ;
- `EG.ELC.ACCS.ZS` — accès à l'électricité.

API : `https://api.worldbank.org/v2/`

Le runtime V0.5 ne contacte pas cette API : le snapshot est embarqué localement.

### Géographie locale

`src/data/world.geojson`, `countries.json`, `country-meta.json`, `cities.json`.

La couche LAND est dérivée de la géométrie réelle des frontières du GeoJSON embarqué.

## Référence conceptuelle DATA

ITU DataHub / statistiques de connectivité et d'utilisation d'Internet.

V0.5 n'affirme pas disposer d'une capacité réelle par câble. Les capacités `DATA_*` sont explicitement des équivalents de simulation.

## Données encore modélisées en V0.5

- commerce **bilatéral** précis ;
- volumes énergétiques bilatéraux ;
- passagers/fret aérien par route ;
- tonnage maritime par route ;
- capacité routière/ferroviaire transfrontalière ;
- capacité et topologie exacte des câbles sous-marins ;
- capacité des liaisons spatiales.

Ces valeurs utilisent des modèles agrégés documentés dans `DATA-METHODOLOGY.md`.

## Remplacements futurs recommandés

1. commerce bilatéral : source officielle de type UN Comtrade ;
2. énergie : statistiques publiques internationales par produit et pays ;
3. aviation : données ouvertes/compatibles de trafic et d'aéroports ;
4. maritime : registre public de ports + statistiques de trafic agrégées ;
5. terrestre : corridors routiers/ferroviaires publics et commerce frontalier ;
6. DATA : statistiques ITU et jeux de données de connectivité dont la licence autorise l'embarquement.

Tout nouvel import doit conserver `source`, `referenceYear`, `retrievedAt`, `confidence` et `dataClass`.
