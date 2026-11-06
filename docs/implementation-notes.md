# Notes d'implémentation — État au 6 novembre 2026

## Fondations livrées
- Application React + TypeScript + Vite.
- Authentification Supabase et session persistante.
- Onboarding entreprise et attribution du rôle owner.
- Modèle multi-tenant avec RLS.
- Référentiel produits, SKU, codes-barres et entrepôts.

## Moteur de stock livré
- Écran connecté des mouvements de stock.
- Entrées, sorties et ajustements positifs/négatifs.
- Appel de la fonction PostgreSQL transactionnelle `apply_stock_movement`.
- Verrouillage de la ligne de stock pour sérialiser les modifications concurrentes.
- Clé d'idempotence protégée par verrou transactionnel consultatif.
- Contrôle des signes selon le type de mouvement.
- Vérification que le produit et l'entrepôt appartiennent à l'entreprise active et sont actifs.
- Refus des quantités négatives et des coûts unitaires négatifs.
- Historique non modifiable et soldes par produit/entrepôt.

## Base et déploiement
- Projet Supabase `sib-stock` créé en région Europe (Paris).
- Migrations initiales et durcissement du moteur appliqués.
- Variables publiques Vite configurées dans Vercel pour production, preview et développement.
- Déploiement de production prêt.
- Dernière CI observée : TypeScript et build Vite réussis.

## Limites et tests restants
- Les autres modules métier restent à construire.
- Les données de démonstration du tableau de bord principal doivent être remplacées par des agrégats réels.
- La recette d'inscription, création entreprise et mouvements avec un utilisateur réel reste à effectuer.
- Tester l'isolation entre deux entreprises et les rôles.
- Tester les soumissions concurrentes, les reprises réseau et les limites de stock.
- Les transferts inter-entrepôts et inventaires physiques ne sont pas encore implémentés.
