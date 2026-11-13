-- SIB Stock — audit READ-ONLY de la base Neon existante
-- Exécuter dans Neon SQL Editor avec un rôle ayant accès aux catalogues.
-- Ce script ne crée, ne modifie et ne supprime aucun objet ou aucune donnée.
-- Les nombres de lignes proviennent de statistiques PostgreSQL (estimations).
BEGIN TRANSACTION READ ONLY;

-- 1. Identité de la base et version du moteur
SELECT current_database() AS database_name,
       current_user AS audit_role,
       current_schema() AS current_schema,
       version() AS postgres_version,
       now() AS audited_at;

-- 2. Schémas applicatifs existants
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog','information_schema')
  AND schema_name NOT LIKE 'pg_toast%'
ORDER BY schema_name;

-- 3. Tables, vues et estimation de volumétrie
SELECT schemaname AS schema_name,
       relname AS object_name,
       CASE WHEN relkind='r' THEN 'table'
            WHEN relkind='p' THEN 'partitioned table'
            WHEN relkind='v' THEN 'view'
            WHEN relkind='m' THEN 'materialized view'
            ELSE relkind::text END AS object_type,
       n_live_tup AS estimated_live_rows,
       n_dead_tup AS estimated_dead_rows,
       last_analyze,
       last_autoanalyze
FROM pg_stat_user_tables
ORDER BY schemaname, relname;

-- 4. Colonnes et types réels (utile pour détecter les divergences de schéma)
SELECT table_schema, table_name, ordinal_position, column_name,
       data_type, udt_schema, udt_name, is_nullable,
       column_default, character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
  AND table_schema NOT LIKE 'pg_toast%'
ORDER BY table_schema, table_name, ordinal_position;

-- 5. Clés primaires, uniques, étrangères et CHECK
SELECT ns.nspname AS schema_name,
       tbl.relname AS table_name,
       con.conname AS constraint_name,
       CASE con.contype WHEN 'p' THEN 'PRIMARY KEY'
                        WHEN 'u' THEN 'UNIQUE'
                        WHEN 'f' THEN 'FOREIGN KEY'
                        WHEN 'c' THEN 'CHECK'
                        WHEN 'x' THEN 'EXCLUSION'
                        ELSE con.contype::text END AS constraint_type,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class tbl ON tbl.oid=con.conrelid
JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
WHERE ns.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY ns.nspname, tbl.relname, con.contype, con.conname;

-- 6. Index et état de validité
SELECT schemaname AS schema_name, tablename AS table_name,
       indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, indexname;

-- 7. Triggers applicatifs
SELECT event_object_schema AS schema_name,
       event_object_table AS table_name,
       trigger_name, event_manipulation, action_timing,
       action_orientation, action_statement
FROM information_schema.triggers
WHERE trigger_schema NOT IN ('pg_catalog','information_schema')
ORDER BY event_object_schema, event_object_table, trigger_name;

-- 8. Fonctions applicatives (noms + signatures uniquement)
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname, p.proname;

-- 9. Extensions installées
SELECT e.extname, e.extversion, n.nspname AS extension_schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid=e.extnamespace
ORDER BY e.extname;

-- 10. Tables de suivi de migrations courantes, si elles existent
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog','information_schema')
  AND (table_name ILIKE '%migration%' OR table_name ILIKE '%drizzle%'
       OR table_name ILIKE '%prisma%' OR table_name ILIKE '%knex%'
       OR table_name ILIKE '%schema%')
ORDER BY table_schema, table_name;

ROLLBACK;
