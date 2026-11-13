# Supabase — SIB Stock

Supabase est l'unique plateforme de données et d'authentification de SIB Stock.

## Projet

- Projet : `sib-stock`
- Région : `eu-west-3`
- Base : PostgreSQL managé par Supabase

## Configuration locale et Vercel

Renseigner les variables suivantes :

1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_PUBLISHABLE_KEY` (recommandée)
3. `VITE_SUPABASE_ANON_KEY` (compatibilité avec les environnements déjà configurés)

Le frontend privilégie la clé publishable. La clé anon reste acceptée pour ne pas interrompre les déploiements existants.

## Règles de sécurité

- Ne jamais exposer `service_role` ou une clé secrète dans le navigateur.
- Activer et vérifier RLS sur toutes les tables exposées.
- Les autorisations métier doivent être appliquées dans les politiques RLS et les fonctions SQL.
- Ne pas exécuter de migration destructive sur la base de production.
- Tester les nouvelles migrations sur un environnement distinct avant production.

Les migrations du dossier `migrations/` sont conçues pour PostgreSQL/Supabase. Les appliquer dans l'ordre après revue du schéma et sauvegarde.
