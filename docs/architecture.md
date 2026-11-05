# Architecture technique

## Vue d'ensemble

SIB Stock est une application SaaS multi-tenant. Le frontend React/TypeScript consomme Supabase (Auth, PostgreSQL, RLS, Storage et fonctions serveur). Le déploiement frontend cible Vercel.

## Isolation multi-tenant

- Chaque enregistrement métier porte un `tenant_id`.
- L'utilisateur est membre d'un tenant via `tenant_members`.
- Le tenant actif est transmis dans le claim JWT `active_tenant_id`, après vérification de l'appartenance.
- Les politiques RLS contrôlent chaque lecture et écriture.
- Le frontend ne décide jamais seul des droits d'accès.

## Moteur de stock

Le stock est matérialisé par `stock_levels` et audité dans `stock_movements`. Toute modification doit être exécutée dans une transaction SQL côté serveur. Les mouvements validés ne sont pas supprimés ni modifiés; les corrections utilisent des mouvements compensatoires.

## Principes de sécurité

- La clé Supabase `service_role` reste exclusivement côté serveur.
- Validation des droits et quantités côté serveur.
- Clés d'idempotence pour les opérations susceptibles d'être rejouées.
- Index sur tenant, produit, dépôt et dates.
- Journal d'audit pour les opérations sensibles.

## Découpage fonctionnel

Administration SaaS, onboarding, catalogue, dépôts, stock, achats, ventes, inventaires, transferts, finance, rapports, notifications et assistant IA.
