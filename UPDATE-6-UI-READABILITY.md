# World Invasion V1.3.1 — P0 UI Readability

## Objectif
Corriger en priorité la lisibilité et les proportions de l'interface avant toute nouvelle fonction de gameplay.

## Changements principaux

- typographie minimale renforcée : aucun texte stratégique permanent ne doit dépendre de polices 6–9 px ;
- tailles de contrôle et hitboxes augmentées (cible ~40 px minimum) ;
- panneaux gauche/droit redimensionnés et scrollables ;
- hiérarchie visuelle plus claire entre titres, métriques, secondaires et actions ;
- scène centrale protégée : les panneaux peuvent être repliés via le mode `MAP FIRST` ;
- `UI SCALE` utilisateur : 100 %, 110 %, 125 %, 150 % ;
- densité : `COMPACT`, `STANDARD`, `COMFORT` sans réduire la taille minimale des caractères ;
- taille des labels de carte indépendante : `NORMAL` / `LARGE` ;
- mode `HIGH CONTRAST` ;
- mode `REDUCE VISUAL NOISE` ;
- préférences persistées en `localStorage` ;
- raccourci `Alt+U` pour ouvrir les réglages d'affichage ;
- `Ctrl++` / `Ctrl+-` pour changer l'échelle UI dans les paliers prévus ;
- support `prefers-reduced-motion` ;
- viewport modernisé avec `viewport-fit=cover`.

## Labels cartographiques

Le `LabelManager` a été revu :

- plancher de lisibilité >= 11 px CSS équivalent ;
- échelle configurable séparément du HUD ;
- collision/placement conservés ;
- contour sombre (`strokeText`) derrière les labels ;
- contraste et léger halo pour préserver la lecture au-dessus des routes et particules.

Les icônes d'infrastructure et véhicules ont également été agrandies afin d'éviter qu'un zoom ou un écran haute définition ne les rende minuscules.

## Principe de conception

Ne jamais réduire la police pour faire tenir plus d'informations.

Ordre de repli :

1. réorganiser ;
2. empiler ;
3. scroller ;
4. masquer le secondaire ;
5. replier les panneaux ;
6. adapter le niveau de détail ;
7. conserver la taille minimale des textes essentiels.

## Compatibilité

Le lot ne modifie pas les moteurs de simulation, diplomatie, économie, logistique, causalité, timeline ou recherche. Il ne change que l'interface, le rendu de labels et les tailles des symboles.
