# Migration complète SIB Stock — Better Auth + Neon

## Décision validée
- Authentification : Better Auth, auto-hébergée dans les fonctions serveur Vercel.
- Base de données : Neon PostgreSQL pour les identités Better Auth et toutes les données métier.
- Frontend : React 18 + Vite.
- Backend : fonctions Node.js Vercel sous `/api`.
- Production actuelle : inchangée jusqu'à la validation de la migration.

## Architecture cible
Le navigateur utilise le client Better Auth pour les sessions et appelle les fonctions API Vercel pour les données métier. Les fonctions serveur vérifient la session Better Auth, résolvent l'utilisateur et son adhésion à l'entreprise dans Neon, contrôlent les permissions, puis exécutent des requêtes SQL paramétrées. Le navigateur ne reçoit jamais `DATABASE_URL`.

## Variables d'environnement
Client :
- `VITE_API_BASE_URL` (facultatif ; même origine par défaut).

Serveur uniquement :
- `DATABASE_URL` : URL Neon avec TLS.
- `BETTER_AUTH_SECRET` : secret aléatoire fort, généré par exemple avec `openssl rand -base64 32`.
- `BETTER_AUTH_URL` : URL de production uniquement (ex. domaine de production). Sur Preview, la laisser vide pour déduire l'origine de la requête.
- `BETTER_AUTH_TRUSTED_ORIGINS` : origines exactes autorisées, séparées par des virgules, si l'application utilise plusieurs origines.

Ne jamais préfixer les secrets avec `VITE_`, les commiter ou les transmettre dans le navigateur. Configurer des valeurs distinctes pour Development, Preview et Production.

## État de l'implémentation
Cette branche ajoute le socle Better Auth côté serveur et client. Elle ne remplace pas encore l'AuthGate historique ni les accès Supabase des modules métier. Ce maintien temporaire est volontaire : retirer Supabase maintenant couperait l'authentification et les écrans de production avant que les API Neon soient prêtes.

## Migration des données et des comptes
1. Faire un inventaire en lecture seule de Neon : schéma, tables, vues, fonctions, triggers, index, contraintes, extensions, volumes et échantillons anonymisés.
2. Comparer avec les migrations SQL historiques du dépôt et établir un mapping explicite de chaque table et champ.
3. Créer un snapshot/sauvegarde Neon vérifié et un plan de restauration avant toute écriture.
4. Générer puis examiner les migrations Better Auth avec la CLI, sur une base de développement Neon dédiée. Ne jamais exécuter la CLI de migration sur la production sans revue.
5. Conserver les identifiants métier existants et ajouter une table de correspondance entre l'identifiant Better Auth et l'ancien profil. Ne pas supposer que les UUID Supabase et les IDs Better Auth sont interchangeables.
6. Les mots de passe Supabase ne sont pas considérés comme transférables. Prévoir une procédure d'invitation/réinitialisation avec vérification d'adresse e-mail.
7. Migrer les utilisateurs et données métier par lots idempotents, avec comptage source/cible, contrôles de clés étrangères et journaux de reprise.
8. Migrer les modules progressivement vers des endpoints API sécurisés. Pas de SQL arbitraire depuis le client.
9. Préserver les rôles SIB et les adhésions multi-tenant dans Neon. Chaque endpoint vérifie le tenant côté serveur ; aucun `tenant_id` fourni par le navigateur n'est accepté sans contrôle d'appartenance.
10. Tester deux entreprises isolées, les rôles, les ventes, les mouvements de stock, les transactions et les accès concurrents.
11. Basculer les utilisateurs après tests d'acceptation, puis observer la production et conserver un plan de retour arrière.
12. Supprimer Supabase SDK, Auth, Storage, variables et migrations seulement après vérification complète et approbation de la bascule.

## Points spécifiques SIB Stock
- Le composant des ventes utilise `inventory_documents` avec `document_type = 'sale'`, et non une table `sales`. Ne pas créer de table `sales` sans inspection du schéma Neon.
- AuthGate actuel utilise Supabase Auth, `profiles`, `tenants`, RPC `create_tenant` et une surveillance d'inactivité qui écrit dans localStorage. Ces flux doivent être remplacés par des API et sessions serveur ; les données métier ne doivent pas être persistées localement.
- Plusieurs composants utilisent directement Supabase. Ils devront être migrés vers une couche API commune, pas remplacés par un simple changement d'import.
- Le stockage des avatars actuellement dans Supabase Storage nécessite une décision de stockage cible distincte avant suppression de Supabase.

## Sécurité et exploitation
- Better Auth utilise un secret serveur fort et une connexion Neon TLS.
- Configurer l'envoi d'e-mails (vérification, reset de mot de passe) avant l'ouverture publique de l'inscription.
- Ajouter une limitation de débit persistante adaptée à l'exécution serverless ; ne pas dépendre d'un compteur mémoire local.
- Journaliser les événements de sécurité sans mots de passe, cookies, tokens ni données sensibles.
- Garder l'inscription publique désactivée ou contrôlée pendant la phase de migration, afin d'éviter la création de tenants non autorisés.
- Prévoir une politique de rotation des secrets et une procédure de récupération du compte administrateur.

## Critères de validation avant production
- Build TypeScript et tests automatisés réussis.
- Inscription, connexion, déconnexion, récupération du mot de passe et vérification d'e-mail testées.
- Sessions persistantes et révocation vérifiées.
- Isolation multi-tenant testée avec deux comptes et deux entreprises.
- Aucun accès direct Neon depuis le navigateur.
- Aucun stockage local de données métier.
- Comptages et intégrité des données source/cible concordants.
- Tests fonctionnels sur produits, achats, ventes, stock, inventaires, finances et administration.
- Plan de retour arrière testé.
- Aucune bascule production tant que les secrets Neon et l'accès à la base de test ne sont pas configurés et les tests non exécutés.
