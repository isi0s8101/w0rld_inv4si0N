# Méthodologie diplomatique — V0.8

## Principe de provenance

La V0.8 n'ajoute aucune prétention de donnée géopolitique réelle. Les systèmes diplomatiques sont bâtis sur l'état de simulation et portent explicitement les classes `SIM_*` ou `DERIVED_SIMULATION`.

Les données objectives déjà présentes dans le projet peuvent influencer indirectement l'économie ou les capacités, mais elles ne sont pas transformées en jugement politique factuel.

## Relations

Les relations initiales sont des relations de simulation dérivées de la géographie, de la proximité et d'un seed déterministe. La V0.8 ajoute une mémoire temporelle : la valeur historique reste séparée de la relation courante.

## Alliances et blocs

Une alliance V0.8 est un objet de gameplay dérivé des relations mutuelles. Un bloc est une composante connectée d'alliances suffisamment fortes. Aucun bloc généré ne doit être interprété comme une organisation internationale réelle.

## Accords

Les accords `TRADE / ENERGY / DATA / LOGISTICS` sont des multiplicateurs macro de simulation. Ils modifient l'attractivité d'un partenaire et certaines conditions de marché sans inventer de texte juridique réel.

## Sanctions

Les sanctions sont des politiques abstraites. Le modèle peut réduire l'accès à une ressource ou augmenter un coût simulé, mais ne décrit ni méthode opérationnelle de contournement ni cible d'infrastructure précise.

## Dépendances

La dépendance stratégique est calculée à partir de l'autonomie de production et de la concentration simulée des fournisseurs. Elle n'est pas un classement politique réel.

## Opinion / awareness

`awareness`, `cooperation`, `tension` et `confidence` sont des variables de gameplay agrégées. Elles ne sont pas des sondages, des mesures sociologiques ou des évaluations réelles de populations.

## Déterminisme

À seed et données initiales identiques, les décisions diplomatiques restent reproductibles. Toute future source réelle devra être horodatée, sourcée et classée séparément avant d'entrer dans la simulation.
