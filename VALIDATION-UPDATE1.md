# Validation — World Invasion v0.9 Update 1

Validation effectuée le 2026-09-13.

## Résultats

- Syntaxe JavaScript (`node --check`) : OK sur `src/**/*.js`.
- Imports locaux : OK, aucune cible manquante.
- `validate-infrastructure-v1.mjs` : `INFRASTRUCTURE_V1=OK`.
- Infrastructure Graph : 45 nœuds.
- Route Engine V1 : 17 routes.
- Graphes couverts : SEA, AIR, ROAD, RAIL, PIPELINE, DIGITAL, ORBITAL.
- Mobile Entities : 5 (SHIP, AIRCRAFT, TRUCK, DRONE, SUBMARINE).
- Catalogue : 28 icônes mappées depuis le pack fourni.
- Validateur REAL WORLD existant : OK, 175 pays couverts.
- Validateur Global Flow existant : OK, 637 hubs / 6212 corridors.
- Tests ciblés architecture + rendu + projections + transitions + satellites + Update 1 : 38/38 PASS.
- Arbres `src/game/diplomacy` et `src/game/simulation` : identiques à la baseline V0.8 strategic-blocs fournie.

## Politique de données de l'Update 1

Les nœuds d'infrastructure ajoutés pour démontrer et valider le moteur sont marqués `DEMO_APPROX`. Les coordonnées/capacités de cette couche ne doivent pas être présentées comme des données opérationnelles réelles ou autoritatives. Les données REAL WORLD déjà présentes conservent leur classification et leurs validateurs existants.

## Commandes

```bash
npm run data:validate-infrastructure
node --test tests/world-invasion-v0_9-update1-infrastructure.test.mjs
node --test tests/architecture.test.mjs tests/data-integrity.test.mjs tests/projections.test.mjs tests/runtime-clock.test.mjs tests/satellites.test.mjs tests/state-events-transitions.test.mjs tests/v1-contract.test.mjs tests/v1_1-visual-context.test.mjs tests/v1_1_1-display-polish.test.mjs tests/v1_1_2-left-dock.test.mjs tests/v1_1_3-safe-map-stage.test.mjs tests/world-invasion-v0_9-update1-infrastructure.test.mjs
```
