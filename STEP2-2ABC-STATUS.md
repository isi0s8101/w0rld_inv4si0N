# World Invasion — Étape 2 — Bloc 2A/2B/2C

Référence gelée : `world-invasion-step1-frozen.zip`

SHA-256 : `0c633079ede992104b04fdf5defec1807fa629617a85f30913da5d5cc3d0a188`

Artifact du bloc : `world-invasion-step2-lot2abc.zip`

SHA-256 : `ed247f1751127e085862e4f12b65601ad9565bd5e38cd9738e79e4170b1dfa5e`

## Statut

- 2A instrumentation profiling : PASS statique / runtime Windows à capturer
- 2B découplage runtime : PASS statique
- 2C GPU batching/MultiMesh : PASS statique
- baseline JS : 260 fichiers, 0 manquant, 0 modifié
- données : 175 pays / 3394 nœuds / 4829 routes / 904 gateways / 175 profiles
- validation 2ABC : 69 checks PASS
- validation Étape 1 : PASS
- tests JS ciblés : 26/26 PASS
- runtime Godot dans environnement de construction : non exécuté (binaire absent)

## Architecture

```text
WorldDataStore
    ↓
WorldState
    ↓
SimulationState
    ↓
RenderState
    ↓
WorldRenderer
```

Le passage au bloc 2D/2E/2F reste conditionné à la validation runtime/profiling Windows 11.
