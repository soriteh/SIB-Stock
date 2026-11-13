# Audit de la base Neon existante et stratégie sans perte

## Portée et limite de l'audit

Le dépôt contient les migrations SQL Supabase de référence, mais l'équipe n'a pas encore de connexion à la base Neon de l'utilisateur. **Le contenu réel de Neon n'a donc pas été lu.** Il est impossible de confirmer à ce stade si Neon contient déjà des données SIB Stock, un schéma partiel, des tables Better Auth, ou des objets provenant d'un autre projet.

Le fichier `db/audit/neon-existing-database-readonly.sql` est un inventaire de catalogues PostgreSQL en lecture seule. Il ne modifie aucune donnée. Exécuter ce script avant toute migration et conserver les résultats dans un emplacement privé ; ne pas publier d'adresses de connexion, de secrets, d'e-mails ou de données personnelles.

## Schéma métier de référence trouvé dans le dépôt

Les migrations de référence sont dans `supabase/migrations/` sur `main`. Elles décrivent un modèle multi-tenant qui s'est enrichi progressivement, notamment avec les établissements, les quotas et les règles d'accès.

Familles de données identifiées dans le SQL versionné :

- Identité et organisation : `profiles`, `tenants`, `tenant_members`.
- Catalogue : `categories`, `products`, `product_barcodes`.
- Stock : `warehouses`, `stock_levels`, `stock_movements`, `stock_counts`, `stock_transfers`.
- Commerce : `business_partners`, `inventory_documents`, `inventory_document_lines`.
- Finances : `financial_accounts`, `financial_transactions`, `financial_transfers`.
- Multi-sites : `establishments` et rattachements établissement des entrepôts, comptes financiers et membres.
- Abonnements : `subscription_plans`, `tenant_subscriptions` et historique associé selon les migrations.
- Paramètres et médias : paramètres du tenant, chemins d'avatars privés et logo d'entreprise.

Les migrations sont la définition attendue du produit, pas une preuve que ces objets existent déjà dans Neon. Le schéma réel doit être comparé objet par objet.

## Risques de migration à traiter

### 1. Base Neon déjà peuplée
Ne jamais appliquer à l'aveugle un schéma initial ou une migration générée. Les noms de tables, contraintes et index peuvent déjà exister, avec des définitions différentes. Le script d'audit doit précéder toute écriture.

### 2. Authentification et identifiants
Le schéma historique relie `profiles.id` et plusieurs colonnes `created_by` / `user_id` aux UUID de `auth.users` Supabase. Better Auth possède son propre modèle utilisateur et ses propres sessions. Il faut établir une table de correspondance explicite entre l'ancien identifiant Supabase et le nouvel identifiant Better Auth, puis migrer les références de manière contrôlée. Ne pas supposer que les identifiants générés par les deux systèmes ont le même format ou la même valeur. Les mots de passe ne sont pas présumés migrables.

### 3. Intégrité métier
Les clés étrangères composites tenant-scoped, les contraintes uniques, les triggers et les fonctions stock/finance portent des règles métier. Les remplacer par de simples endpoints CRUD serait une régression. Les opérations de validation de documents, de mouvements de stock et de transactions financières doivent rester atomiques et idempotentes.

### 4. Isolation multi-tenant et multi-établissement
Les politiques RLS Supabase ne sont pas automatiquement transposées dans Neon. Les API serveur doivent vérifier session, tenant actif, membership, rôle et établissement à chaque opération. Les identifiants de tenant/établissement envoyés par le navigateur ne sont jamais une preuve d'autorisation.

### 5. Fichiers
Les avatars et logos stockés dans Supabase Storage nécessitent une stratégie de copie, de contrôle d'accès et de validation des chemins. Les métadonnées seules ne suffisent pas à préserver les fichiers.

## Protocole de migration sans perte

1. **Inventaire** : exécuter le script read-only sur Neon et relever les schémas, tables, colonnes, contraintes, index, triggers, fonctions et volumétrie.
2. **Sauvegarde** : créer un snapshot/backup Neon vérifié et un export logique chiffré. Tester la restauration dans une base isolée.
3. **Comparaison** : comparer l'inventaire réel aux migrations versionnées et classifier chaque objet : identique, absent, divergent, spécifique à l'utilisateur ou obsolète.
4. **Plan d'évolution** : produire des migrations incrémentales, idempotentes lorsque possible, avec préconditions explicites. Pas de `DROP`, `TRUNCATE`, recréation de table ni renommage destructif.
5. **Préparation identité** : définir la stratégie d'ID Better Auth et la table de correspondance ; gérer réinitialisation/invitation des mots de passe.
6. **Migration pilote** : travailler sur une copie restaurée, importer par lots et conserver les IDs métier lorsque cela ne crée pas de collision.
7. **Réconciliation** : comparer le nombre de lignes, les totaux financiers, les quantités de stock, les références, les clés étrangères orphelines et les memberships.
8. **Recette** : tests login, permissions, accès croisés entre tenants, établissements, achats/ventes, inventaires, transferts, finance et rapports.
9. **Basculement** : fenêtre planifiée, gel des écritures ou mécanisme de réplication final, sauvegarde fraîche, basculement réversible.
10. **Retrait** : désactiver Supabase uniquement après validation formelle et période d'observation.

## Requêtes de réconciliation minimales

Après import, pour chaque table métier :
- comparer les nombres de lignes source/cible ;
- comparer les identifiants distincts et détecter doublons ;
- vérifier les clés étrangères orphelines ;
- comparer les totaux de stock par tenant, établissement, entrepôt et produit ;
- comparer les soldes de comptes aux soldes calculés à partir du ledger ;
- comparer les totaux et statuts des documents d'achat/vente ;
- vérifier le nombre de memberships actifs et le tenant actif de chaque profil.

Pour les tables financières et de stock, un simple nombre de lignes égal ne prouve pas l'équivalence : il faut comparer les agrégats et les liens métier.

## Ce qui est interdit avant validation
- Ne pas exécuter `db/migrations/0001_create_better_auth_schema.sql` sur la base existante sans avoir vérifié que le schéma `better_auth` est libre ou compatible.
- Ne pas lancer le générateur Better Auth contre la base de production.
- Ne pas importer les données Supabase dans des tables Neon déjà occupées sans mapping et règles de conflit.
- Ne pas supprimer Supabase, ses comptes ou ses fichiers.
- Ne pas basculer Vercel vers Better Auth tant que les tests d'intégration et le rollback ne sont pas prêts.

## État
- Référence SQL du dépôt : examinée partiellement pour les domaines principaux.
- Audit réel de Neon : en attente des résultats du script read-only.
- Backup Neon et restauration testée : non vérifiés.
- Migration de données : non exécutée.
- Production : inchangée.
