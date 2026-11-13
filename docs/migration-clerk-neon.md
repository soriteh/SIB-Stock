# Migration SIB Stock — Clerk + Neon

## Décision d'architecture
- Frontend existant : React + Vite.
- Authentification cible : Clerk (@clerk/react).
- Base métier cible : Neon PostgreSQL.
- Accès aux données : API serveur Vercel uniquement, jamais de connexion Neon depuis le navigateur.
- Driver cible : @neondatabase/serverless, utilisé exclusivement dans les fonctions serveur.
- Hébergement : Vercel.
- Supabase : conservé temporairement pendant la migration, puis retiré après validation et bascule explicite.

## Variables d'environnement
Frontend Vite : VITE_CLERK_PUBLISHABLE_KEY (clé publique uniquement).
Serveur Vercel : CLERK_SECRET_KEY (secret Clerk) et DATABASE_URL (connexion Neon).
CLERK_JWT_KEY est facultatif, seulement si la vérification locale des JWT est configurée et validée.
Aucune valeur secrète ne doit être commise dans Git, affichée dans les logs ou envoyée au client.

## Modèle d'identité et multi-tenant
- Clerk est la source d'identité et de session.
- Stocker l'identifiant Clerk comme identifiant externe stable dans la table des profils (colonne dédiée de type texte, selon le schéma retenu).
- Les entreprises, rôles applicatifs, adhésions, établissements et données métier restent dans Neon.
- Ne pas remplacer automatiquement le modèle de rôles SIB par les rôles Clerk.
- Ne jamais faire confiance à un tenant_id fourni par le navigateur : l'API vérifie l'appartenance de l'utilisateur et son rôle pour chaque requête.
- Chaque requête SQL métier doit être limitée au tenant autorisé. Les opérations d'écriture et de validation doivent être transactionnelles.
- Les fonctions d'administration plateforme appliquent un contrôle d'accès distinct et audité.

## API serveur
Créer des fonctions Vercel dans api/ :
1. Extraire le Bearer token de la requête.
2. Vérifier le jeton Clerk côté serveur avec le SDK backend officiel.
3. Obtenir le sujet Clerk vérifié.
4. Résoudre le profil et les adhésions dans Neon.
5. Vérifier tenant, rôle et permissions.
6. Exécuter des requêtes SQL paramétrées.
7. Retourner des réponses JSON avec codes HTTP cohérents.
Ne pas accepter des requêtes SQL arbitraires depuis le client. Ne pas transmettre DATABASE_URL au frontend.

## Ordre de migration
1. Créer l'application Clerk et récupérer les clés de développement.
2. Inspecter le schéma réel Neon (tables, colonnes, contraintes, index, extensions, fonctions, triggers, données et volumes) en lecture seule.
3. Comparer ce schéma aux migrations SQL versionnées dans supabase/migrations/.
4. Préparer des migrations Neon idempotentes et une stratégie de reprise ; ne pas exécuter de DROP ni de migration destructive.
5. Ajouter le provider Clerk et une page d'authentification de test sans supprimer l'ancien AuthGate.
6. Ajouter une API protégée de test et valider Clerk → API → Neon.
7. Migrer les modules un par un, en commençant par lecture seule, puis écritures et transactions.
8. Migrer les utilisateurs avec une stratégie explicite : identifiants externes, vérification d'e-mail, réinitialisation de mot de passe ou invitation. Ne jamais supposer que les mots de passe Supabase peuvent être transférés.
9. Tester les rôles, l'isolation multi-tenant, les erreurs, les limites et les accès concurrents.
10. Configurer les variables Vercel Preview, puis Production.
11. Basculer après tests d'acceptation et plan de retour arrière.
12. Retirer Supabase Auth, SDK, variables et migrations uniquement après confirmation de la bascule et vérification des données.

## Priorité immédiate : erreur de chargement des ventes
Le composant src/components/CommercialDocuments.tsx lit déjà les ventes dans inventory_documents avec document_type = 'sale', et non dans une table sales. Il faut diagnostiquer le schéma Neon réel avant de créer une table sales ou de modifier les requêtes.
Vérifier : existence et colonnes des tables inventory_documents, inventory_document_lines, business_partners, warehouses et products ; fonctions current_tenant_id, has_tenant_role et post_inventory_document ; contraintes, relations, droits et politiques ; configuration réellement utilisée par Vercel.

## Critères de validation
- Connexion / déconnexion Clerk et renouvellement de session.
- Aucun accès direct à Neon depuis le navigateur.
- Aucune donnée métier persistée dans localStorage, sessionStorage ou IndexedDB.
- Toutes les données sont lues et écrites côté serveur dans Neon.
- Deux tenants ne peuvent ni lire ni modifier les données de l'autre.
- Les ventes validées débitent le stock dans une transaction atomique.
- Build TypeScript, tests API et tests fonctionnels réussis avant déploiement.
- L'ancien système reste disponible jusqu'à la bascule contrôlée.