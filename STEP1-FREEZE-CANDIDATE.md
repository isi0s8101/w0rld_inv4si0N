# World Invasion — Étape 1 — Gel de référence

Date de gel : 2026-09-18

Baseline fonctionnelle : `world-invasion-v1.4-lot2-network-world(3).zip`

SHA-256 baseline : `8c328abd85d653c509ab601755e85c12fb62eb9d4db973e373ed4be6b55076d7`

Artifact candidate gelé : `world-invasion-step1-frozen-candidate.zip`

SHA-256 artifact : `0c633079ede992104b04fdf5defec1807fa629617a85f30913da5d5cc3d0a188`

## Contrat de non-régression

- fichiers baseline contrôlés : 260 ;
- fichiers baseline manquants : 0 ;
- fichiers baseline modifiés : 0 ;
- countries : 175 / 175 ;
- nodes : 3394 / 3394 ;
- routes : 4829 / 4829 ;
- gateways : 904 / 904 ;
- profiles : 175 / 175 ;
- endpoints routes : PASS ;
- tests JS ciblés : 26 / 26 PASS ;
- politique GDScript stricte : PASS ;
- validation statique Étape 1 : PASS.

## Statut

L’Étape 1 est gelée comme **candidate de référence**.

Aucune nouvelle fonctionnalité de l’Étape 1 ne doit être ajoutée hors correction de régression ou correction requise par la recette runtime.

Le statut `PASS FINAL / FROZEN` nécessite encore la recette runtime Godot sous Windows 11 conformément au contrat du projet.

Résultat attendu :

```text
WORLD_INVASION_STEP1_WINDOWS_VALIDATION=PASS
```

Après ce résultat et la recette visuelle interactive, ce snapshot peut être promu sans modification en `Étape 1 PASS FINAL / FROZEN`.
