# Supabase

1. Créer un projet Supabase dédié à SIB Stock.
2. Copier l'URL et la clé publique anon dans `.env.local`.
3. Appliquer les migrations du dossier `migrations/` dans l'ordre.
4. Activer la confirmation e-mail dans Auth avant la mise en production.
5. Ne jamais placer la clé `service_role` dans le frontend.

Les migrations sont conçues pour PostgreSQL/Supabase. Tester d'abord dans un projet de développement.
