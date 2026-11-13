# Inventaire de migration Supabase vers Better Auth + Neon

## État de référence

Cette feuille de route est basée sur l'inspection du code source de la branche `migration/better-auth-neon`. Elle décrit les dépendances repérées ; elle ne constitue pas une validation de la base Neon ni un test de production.

## Règles non négociables

- Better Auth gère les comptes, sessions et authentification.
- Neon PostgreSQL héberge les données d'identité et toutes les données métier.
- Le navigateur ne se connecte jamais directement à Neon.
- Les API serveur vérifient la session, l'appartenance au tenant et les permissions avant toute lecture ou écriture.
- Aucun cache métier dans localStorage, sessionStorage ou IndexedDB.
- Les préférences d'interface non sensibles peuvent rester locales.
- Supabase reste disponible en lecture/écriture pendant la transition tant que le basculement d'un module n'est pas validé.
- Aucune suppression de schéma, table ou donnée historique pendant la phase de préparation.

## Dépendances Supabase constatées

| Zone | Dépendances historiques | Reprise cible |
|---|---|---|
| AuthGate | Supabase Auth, profiles, tenants, RPC create_tenant, session | Better Auth + API serveur pour profil, tenant et création d'entreprise |
| App / shell | Auth, RPC is_platform_admin, profiles, Storage avatars, updateUser | API serveur pour profil et rôle plateforme ; définir le stockage avatar |
| Administration | Accès Supabase direct | API d'administration avec contrôle de rôle serveur |
| BusinessPartners | Accès Supabase direct | API partenaires commerciaux |
| Clients | Accès Supabase direct | API clients |
| CommercialDocuments | inventory_documents, inventory_document_lines, products, business_partners, warehouses, RPC post_inventory_document | API transactionnelle achats/ventes et mouvements de stock |
| DashboardOverview | Accès Supabase direct | API agrégats et indicateurs |
| Establishments | Accès Supabase direct | API établissements |
| Finance | Accès Supabase direct | API finances |
| InventoryCatalog | Accès Supabase direct | API produits et catalogue |
| PlatformAdmin | Accès Supabase direct | API plateforme réservée au rôle autorisé |
| ProfilePage | Accès Supabase direct | API profil et stockage avatar |
| Reports | Accès Supabase direct | API rapports |
| SettingsPage | Accès Supabase direct | API paramètres du tenant |
| StockAlerts | Accès Supabase direct | API alertes |
| StockInventories | Accès Supabase direct | API inventaires |
| StockMovements | Accès Supabase direct | API mouvements |
| StockTransfers | Accès Supabase direct | API transferts |
| SubscriptionPage | Accès Supabase direct | API abonnements et droits d'accès |

## Ordre d'implémentation

### Phase 1 — Socle serveur et identité
- Finaliser Better Auth sur une base Neon de développement dédiée.
- Générer puis relire le schéma Better Auth ; ne pas inventer les tables de l'application.
- Définir les endpoints de session, profil, tenant et sélection du tenant actif.
- Mettre en place validation d'entrée, erreurs normalisées, journalisation sans secrets et tests d'accès.
- Définir le flux d'invitation / vérification e-mail / réinitialisation de mot de passe avant d'ouvrir l'inscription.

### Phase 2 — Multi-tenant et autorisations
- Reprendre les profils, tenants, memberships et rôles à partir du schéma Supabase réel.
- Vérifier chaque accès côté serveur : session valide, membership actif, permission requise.
- Ne jamais accepter comme preuve un tenant_id fourni par le client.
- Ajouter des tests négatifs : utilisateur A ne peut ni lire ni modifier les données du tenant B.

### Phase 3 — Données métier
1. Référentiels : établissements, entrepôts, produits, partenaires et clients.
2. Stock : mouvements, inventaires, transferts et alertes.
3. Commerce : documents d'achat et de vente, lignes et validation transactionnelle.
4. Finance : caisse, paiements et opérations financières.
5. Rapports, paramètres, abonnements et administration.

Les achats et ventes sont actuellement représentés par `inventory_documents` avec `document_type` purchase/sale et leurs lignes dans `inventory_document_lines`. Ne pas créer une table `sales` sans analyse des migrations et données existantes.

### Phase 4 — Basculement contrôlé
- Export et sauvegarde vérifiée de la source.
- Comparaison des volumes, clés, relations et totaux métier.
- Import idempotent avec journal de correspondance des identifiants.
- Recette fonctionnelle et tests multi-tenant.
- Basculement progressif, surveillance et procédure de retour arrière.
- Retrait de Supabase uniquement après acceptation explicite et vérification qu'aucun composant ne l'utilise encore.

## Points bloquants avant exécution sur Neon

- Une base Neon de développement dédiée doit être créée et son accès configuré dans l'environnement serveur, sans transmettre les secrets dans le chat.
- Il faut confirmer le schéma Neon cible et générer le SQL Better Auth avec la CLI sur cette base de développement.
- Le schéma Supabase complet et les données réelles doivent être exportés pour construire une migration fidèle.
- La stratégie de stockage des avatars doit être décidée.
- Un fournisseur e-mail doit être configuré pour les vérifications et réinitialisations.
- Les contrôles de limitation de débit doivent être partagés/persistants avant la production ; une limitation uniquement en mémoire ne suffit pas dans un environnement serverless.

## État d'exécution

- Socle Better Auth/Neon et route serveur : préparés dans cette branche.
- Schéma Better Auth généré sur Neon : en attente d'une base de développement ; non exécuté.
- Migration des données : non exécutée.
- Remplacement des appels Supabase des composants : non commencé.
- Build, tests et recette : non exécutés dans cet environnement.
- Production : inchangée ; PR maintenue en brouillon.
