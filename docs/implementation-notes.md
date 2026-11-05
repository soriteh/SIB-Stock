# Notes d'implémentation — Phase 1

## État livré dans le dépôt

- Application React + TypeScript + Vite initialisée.
- Tableau de bord responsive de première intégration.
- Client Supabase initialisé sans secret côté navigateur.
- Première migration multi-tenant : entreprises, profils, membres, catégories, produits, codes-barres, entrepôts, niveaux et mouvements de stock.
- Fonction SQL de création d'entreprise et de sélection de l'espace actif.
- Fonction SQL transactionnelle de mouvement de stock.
- Protection RLS et historique des mouvements immuable.
- Workflow GitHub Actions pour le contrôle TypeScript et le build.

## À faire avant de connecter une base

1. Créer un projet Supabase de développement.
2. Appliquer la migration avec Supabase CLI.
3. Vérifier les politiques RLS avec deux utilisateurs appartenant à deux entreprises différentes.
4. Tester les appels concurrents à `apply_stock_movement`, y compris les clés d'idempotence.
5. Configurer les variables Vercel depuis le tableau de bord, jamais dans Git.

## Limites actuelles

Le tableau de bord contient encore des données de démonstration. Les pages de navigation secondaires, les écrans d'authentification, les achats, ventes, inventaires, finances, abonnements et fonctionnalités IA ne sont pas encore implémentés. La migration doit être testée dans un projet Supabase isolé avant toute utilisation en production.
