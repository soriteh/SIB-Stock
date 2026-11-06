# Feuille de route SIB-Stock

## Phase 1 — Fondations multi-tenant
- [x] Initialiser React, TypeScript et Vite
- [x] Client Supabase et authentification persistante
- [x] Créer les espaces entreprise et attribuer le rôle owner
- [x] Tables multi-tenant et politiques RLS initiales
- [x] Déployer le frontend sur Vercel

## Phase 2 — Référentiels et entrepôts
- [x] Produits, références SKU et codes-barres
- [x] Entrepôts
- [x] Prix d'achat/vente et seuil minimum
- [ ] Catégories hiérarchiques et unités normalisées
- [ ] Emplacements internes et permissions par dépôt

## Phase 3 — Moteur de stock
- [x] Entrées, sorties et ajustements transactionnels
- [x] Contrôle du stock négatif
- [x] Historique des mouvements immuable
- [x] Protection idempotente contre les doubles soumissions concurrentes
- [x] Soldes par produit et entrepôt
- [ ] Transferts inter-entrepôts avec stock en transit
- [ ] Inventaires physiques et écarts
- [ ] Lots, numéros de série et péremptions

## Phase 4 — Achats et ventes
- [ ] Fournisseurs et clients
- [ ] Commandes fournisseurs et réceptions
- [ ] Ventes, livraisons et retours
- [ ] Factures, bons et documents PDF

## Phase 5 — Finance et SaaS
- [ ] Caisse, banque, paiements et dépenses
- [ ] Valorisation comptable et marges
- [ ] Plans, abonnements et facturation SaaS

## Phase 6 — Mobile et IA
- [ ] PWA et scan caméra
- [ ] Notifications et alertes
- [ ] Assistant IA avec actions soumises à validation

## Phase 7 — Qualité et production
- [x] CI TypeScript et build Vite validés
- [x] Déploiement Vercel de production
- [ ] Tests d'intégration avec comptes réels et deux entreprises
- [ ] Tests de concurrence et d'isolation tenant
- [ ] Sauvegarde/restauration et supervision
- [ ] Recette fonctionnelle complète avant exploitation
