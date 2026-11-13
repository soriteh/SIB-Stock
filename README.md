# SIB Stock

Plateforme SaaS multi-entreprises de gestion de stock, achats, ventes, inventaires, finances et entrepôts.

## Stack officielle

- React + TypeScript + Vite
- Supabase Auth, PostgreSQL, RLS, Storage et fonctions serveur
- Vercel pour le déploiement frontend
- Aucun fournisseur PostgreSQL tiers n'est utilisé par l'application.

## Principes d'architecture

1. Isolation stricte des entreprises (multi-tenant).
2. Toute donnée métier appartient à un `tenant_id`.
3. Toute modification de stock passe par une fonction métier transactionnelle.
4. Les documents validés sont immuables; les corrections passent par des opérations compensatoires.
5. Aucune clé secrète ou clé `service_role` dans le frontend.
6. Les opérations sensibles sont vérifiées côté serveur et protégées par RLS.

## Configuration

Copier `.env.example` vers `.env.local` et renseigner :

- `VITE_SUPABASE_URL` : URL du projet Supabase SIB-Stock.
- `VITE_SUPABASE_PUBLISHABLE_KEY` : clé publique recommandée.
- `VITE_SUPABASE_ANON_KEY` : compatibilité avec les environnements existants uniquement.

Le client utilise la clé publishable en priorité et conserve la clé anon comme solution de compatibilité. Ne jamais utiliser une clé `service_role` ou une clé secrète dans le frontend, ni committer les valeurs des variables.

## État du projet

- Fondations multi-tenant, authentification, produits et entrepôts opérationnels.
- Moteur de mouvements de stock transactionnel : entrées, sorties, ajustements, soldes et historique.
- Base de production Supabase `sib-stock`.
- Frontend déployé sur Vercel : https://sib-stock-soritech.vercel.app

Les achats, ventes, transferts, inventaires physiques, finances et rapports avancés restent à développer. Une recette fonctionnelle avec des comptes utilisateurs réels est requise avant utilisation opérationnelle.
