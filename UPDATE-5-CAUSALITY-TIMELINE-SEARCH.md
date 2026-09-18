# World Invasion V1.3 — Lots 11 à 13

Cette mise à jour complète la navigation V1.2 avec trois fonctions communes aux vues ORBITAL, WORLD et TERRITORY : compréhension causale, exploration temporelle et recherche globale.

## LOT 11 — Causality Mode

`CausalityModeEngine` transforme une sélection en graphe explicatif temporaire.

Pour une infrastructure, le moteur distingue :

- causes / dépendances amont (`UPSTREAM`) ;
- effets / dépendants aval (`DOWNSTREAM`) ;
- vue combinée (`BOTH`) ;
- routes associées à la chaîne.

Exemple :

```text
Power Grid OFFLINE
      ↓
Data Center
      ↓
IXP
      ↓
Digital connectivity
```

Pour un événement, `WHY?` reconstruit la chaîne à partir de `WorldMemory` et des entrées `RIPPLE` datées : événement racine → effets différés → conséquence suivante.

Le rendu cartographique atténue les objets non concernés et superpose des liens orientés entre infrastructures disposant de coordonnées géographiques.

Raccourci : `W` sur une infrastructure, une route ou un événement sélectionné.

## LOT 12 — Timeline & Replay

La timeline mondiale est disponible au-dessus de la carte.

Fonctions :

- navigation historique par curseur ;
- événement précédent / suivant ;
- pause ;
- replay non destructif d'un événement et de ses `RIPPLE` ;
- retour `LIVE` ;
- snapshots d'observation en mémoire.

Le passage en historique ou replay met la simulation en pause. `LIVE` restaure la vitesse précédente.

Le replay est volontairement **non destructif** : il rejoue la chaîne causale enregistrée et la visualisation sans réécrire l'état courant du monde. Les snapshots V1.3 sont également `READ_ONLY`; ils capturent l'état pour analyse mais ne constituent pas encore un système de rollback complet de la simulation.

## LOT 13 — Global Search / Command Palette

Ouverture :

```text
Ctrl+K
/
```

La recherche indexe dynamiquement :

- pays ;
- infrastructures ;
- routes ;
- véhicules agrégés ;
- événements de la mémoire mondiale.

Exemples :

```text
France
Marseille
Suez
blocked routes
oil
SHIP-021
blockade
```

Une activation appelle la navigation existante : sélection, Auto Layers, cadrage/focus lorsque le type le permet, ou sélection d'un événement dans la timeline.

## Architecture ajoutée

```text
World State / Infrastructure Graph / World Memory
                │
                ├── CausalityModeEngine
                │       └── CausalityRenderer
                │
                ├── TimelineReplayEngine
                │       └── TimelinePanel
                │
                └── GlobalSearchEngine
                        └── GlobalSearchPanel
```

## Contrat de sûreté fonctionnelle

- Causality Mode n'altère pas les données de simulation.
- Timeline historique/replay ne modifie pas l'état courant du monde.
- La recherche ne crée aucune donnée ; elle indexe l'état courant.
- `REAL WORLD / ESTIMATED / DERIVED / SIM / DEMO_APPROX` restent séparés.
