# World Invasion — Méthodologie des données V0.5

## Principe

Le mode `REAL_WORLD` ne confond jamais observation et modélisation.

Les données pays de V0.4 restent classées `REAL`, `ESTIMATED_*`, `SPECIAL`, `DERIVED_*` ou `SIM`. V0.5 ajoute des classes spécifiques aux réseaux.

## TRADE

La baseline fournit PIB, commerce, importations et exportations pour les 175 pays. Quand ces champs proviennent d'une estimation V0.4, la relation bilatérale en hérite indirectement et reste estimée.

La matrice bilatérale V0.5 utilise :

- taille économique source/destination ;
- enveloppes annuelles d'import/export ;
- distance géographique ;
- continent ;
- voisinage terrestre ;
- accès maritime.

Une matrice de gravité sparse est construite, puis équilibrée par ajustement proportionnel itératif. Le total des flux est ainsi cohérent avec l'enveloppe export mondiale à l'erreur numérique près.

Classe : `ESTIMATED_GRAVITY_FROM_REAL_ANCHORS`.

Référence pour les futurs remplacements réels : World Bank WDI `NE.TRD.GNFS.ZS`, `NE.IMP.GNFS.ZS`, `NE.EXP.GNFS.ZS`, puis une source bilatérale de type UN Comtrade lorsque l'import complet sera intégré.

## ENERGY

V0.5 utilise un profil agrégé d'exportateurs/importateurs, la demande économique/démographique et la géographie. Les valeurs représentent une pression/capacité énergétique de simulation et non un volume officiel de pétrole, gaz ou électricité.

Classe : `ESTIMATED_ENERGY_BALANCE_MODEL`.

Les futurs imports pourront distinguer pétrole, gaz, charbon, électricité et renouvelables sans modifier l'interface du moteur.

## AIR

Les corridors aériens sont construits avec un modèle de gravité utilisant population, PIB, niveau d'infrastructure et distance. Ils représentent des corridors agrégés, pas des vols réels en temps réel.

Classe : `ESTIMATED_TRAFFIC_MODEL`.

## SEA

Les corridors maritimes utilisent accès maritime, intensité commerciale, taille économique et distance. Les hubs génériques `Primary Maritime Hub` ne correspondent pas à une installation physique précise.

Classe : `ESTIMATED_SHIPPING_MODEL`.

## LAND

Les couples terrestres proviennent de la proximité réelle des frontières du `world.geojson` embarqué. Les capacités sont ensuite dérivées de l'infrastructure et de l'intensité commerciale.

Classe : `DERIVED_GEOGRAPHIC_NETWORK`.

## DATA

Trois couches distinctes :

- `DATA_TERRESTRIAL` : voisinage terrestre + demande numérique ;
- `DATA_SUBMARINE` : économies côtières + taille économique + demande numérique ;
- `DATA_SPACE` : couche de secours agrégée régionale.

Les capacités DATA de V0.5 sont des équivalents de simulation, pas des capacités annoncées de câbles ou de satellites précis.

Référence conceptuelle pour les futurs imports : ITU DataHub / indicateurs d'usage Internet et de connectivité internationale.

## Capacités et perturbations

Chaque corridor possède une capacité et une fiabilité. Le runtime calcule une capacité effective :

`effectiveCapacity = capacity × reliability × (1 - disruption)`

Le routage pénalise les liaisons congestionnées ou perturbées. `CLOSED` retire le corridor du graphe de routage.

## Séparation simulation / rendu

La simulation peut conserver plusieurs milliers de flux. Le `StrategicLayerManager` sélectionne seulement les plus significatifs pour l'affichage.

Le filtre visuel n'altère jamais l'état de simulation.

## Limites V0.5

V0.5 est un **moteur mondial réaliste par structure et contraintes**, mais pas encore un miroir exhaustif des flux observés en temps réel.

Les données bilatérales, capacités aériennes/maritimes, énergie et data sont encore majoritairement estimées. Elles sont conçues pour être remplacées progressivement par des sources réelles sans reconstruire le moteur.
