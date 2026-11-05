# SIB Stock

Plateforme SaaS multi-entreprises de gestion de stock, achats, ventes, inventaires, finances et entrepôts.

## Stack cible

- React + TypeScript + Vite
- Tailwind CSS
- Supabase Auth, PostgreSQL, RLS, Storage et Edge Functions
- PWA responsive (application connectée)
- Vercel pour le déploiement frontend

## Principes d'architecture

1. Isolation stricte des entreprises (multi-tenant).
2. Toute donnée métier appartient à un `tenant_id`.
3. Toute modification de stock passe par une fonction métier transactionnelle.
4. Les documents validés sont immuables; les corrections passent par des opérations compensatoires.
5. Aucune clé secrète ou clé `service_role` dans le frontend.
6. Les opérations sensibles sont vérifiées côté serveur et protégées par RLS.

## Démarrage

Le socle applicatif et les migrations Supabase seront ajoutés progressivement. Voir [docs/architecture.md](docs/architecture.md), [docs/roadmap.md](docs/roadmap.md) et [supabase/README.md](supabase/README.md).

## Configuration

Copier `.env.example` vers `.env.local` et renseigner les variables publiques Supabase. Ne jamais committer les secrets.

## État du projet

Phase 1 — initialisation du dépôt et fondations multi-tenant.
