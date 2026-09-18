# World Invasion V1.2 — Interactive Navigation & Traffic

Cette mise à jour couvre les lots 1 à 10 du chantier commun WORLD / TERRITORY et ajoute la visualisation de trafic physique sur GLOBE.

## 1. Map Camera Engine

`MapCameraEngine` est partagé par WORLD et TERRITORY :

- pan par clic/glisser ;
- zoom molette centré sous le curseur ;
- double clic zoom/focus ;
- Shift + double clic dézoom ;
- inertie contrôlée ;
- bornes empêchant de perdre la carte ;
- `fitBounds`, `reset`, `focus`, `follow`, `viewport` ;
- gestes tactiles/pinch via `WorldView` ;
- réduction des mouvements respectée.

Raccourcis : `Home` reset, `F` follow/focus, `Esc` quitte focus/sélection, `+/-` zoom, `Alt+←/→` historique.

## 2. Zoom sémantique / LOD / index spatial

`SemanticZoomEngine` choisit le niveau de détail à partir du zoom. `SpatialIndex` limite les infrastructures rendues au viewport. Les niveaux WORLD progressent des capitales/grands corridors vers ports, aéroports, bases, industries et infrastructures détaillées. TERRITORY augmente plus vite son niveau de détail.

## 3. Surcharge visuelle

- `LabelManager` : collisions, priorités et déplacements de labels ;
- `ClusterManager` : agrégation spatiale par catégorie ;
- `VisualPriorityManager` : priorité à la sélection, aux événements critiques, capitales et infrastructures stratégiques ;
- décomposition automatique des clusters au zoom.

## 4. Navigation contextuelle

`SelectionContext` mémorise :

- vue ;
- pays ;
- caméra WORLD / TERRITORY ;
- infrastructure / route / véhicule ;
- layers ;
- focus.

Les commandes BACK / FORWARD restaurent ce contexte. FIT / FOCUS / FOLLOW / RESET sont disponibles dans l'interface et l'API.

## 5. Layer Manager

Presets :

`ECONOMY / LOGISTICS / ENERGY / MILITARY / DIGITAL / INTELLIGENCE / CRISIS / TRAFFIC / ALL`.

Auto Layers adapte les couches à la sélection : navire → maritime/ports/chokepoints/cargo, train → rail/logistique/cargo, industrie → industrie/énergie/rail/route, etc.

## 6. Traffic & Logistics Engine visuel

La route représente désormais l'infrastructure disponible ; le véhicule représente le trafic actif.

Chaîne :

```text
InfrastructureFlowEngine
        ↓
TrafficPlanner
        ↓
VehicleSpawner
        ↓
VehicleMovement
        ↓
DeliveryResolver
```

Véhicules minimum :

- `SHIP` ;
- `PLANE` ;
- `TRAIN` ;
- `TRUCK`.

Chaque entité conserve route, plan de route, origine, destination, progression, vitesse, direction, cargaison, quantité agrégée, flux sources et état.

## 7. Densité adaptative

Le nombre d'unités visuelles est agrégé selon l'utilisation / le volume :

```text
0 %        -> 0
>0–20 %    -> 1
>20–40 %   -> 2
>40–60 %   -> 3
>60–80 %   -> 4
>80 %      -> 5
```

Un véhicule visible peut représenter plusieurs transports physiques. `dataClass = SIM_AGGREGATED_TRAFFIC` évite de le confondre avec un véhicule réel unitaire.

## 8. Routes complexes

Les routes utilisent des waypoints typés et ordonnés. Les véhicules interpolent réellement ces points. Un itinéraire maritime alternatif Marseille → Singapour via Gibraltar et le cap de Bonne-Espérance est inclus pour tester un reroutage hors Suez.

## 9. Perturbations / rerouting

États route :

`OPEN / CONGESTED / RESTRICTED / RISKY / BLOCKED / CLOSED`.

États véhicule :

`WAITING / MOVING / DELAYED / REROUTING / BLOCKED / ARRIVED / CANCELLED`.

Lorsqu'un segment devient BLOCKED/CLOSED, `VehicleMovement` demande un nouveau chemin au `RouteEngineV1`. Le coût tient compte de la distance, congestion, risque, statut et capacité disponible.

## 10. Focus Mode

`FocusModeEngine` conserve :

- sélection : 100 % ;
- véhicules liés : ~90 % ;
- routes liées : ~80 % ;
- éléments non liés : 15 %.

Le focus fonctionne pour infrastructure, route et véhicule.

## Rendu par vue

### GLOBE

Conserve une lecture macro et affiche les infrastructures/vehicules agrégés compatibles avec les couches actives.

### WORLD

Pan/zoom libre, zoom sémantique, clustering, routes atténuées et trafic dynamique.

### TERRITORY

Même navigation cartographique, niveau de détail supérieur, labels anti-collision, rail/route/logistique et véhicules locaux.

## Contrat de données

Les 45 infrastructures restent `DEMO_APPROX`. Les routes V1.2 restent `DEMO_APPROX_ROUTE`. Les véhicules sont `SIM_AGGREGATED_TRAFFIC` et sont générés à partir des flux physiques de la simulation.

### Limite comptable V1.2

Le moteur physique historique crédite encore les flux à la résolution du tick. `DeliveryResolver` fonctionne donc volontairement en mode `MIRROR` : l'arrivée visuelle est historisée mais ne crédite pas une seconde fois le stock.

Pour obtenir ultérieurement une comptabilité entièrement différée (`stock destination += cargo` uniquement à l'arrivée graphique/simulée), il faudra migrer `InfrastructureFlowEngine` vers des expéditions `IN_TRANSIT`. Cette limite est explicite afin de ne pas présenter le rendu visuel comme une comptabilité différée déjà implémentée.
