# Neon migrations

## Safety rules
- Never point migration commands at production during development.
- Take and verify a Neon backup/restore point before applying any production migration.
- Review every generated SQL diff before applying it.
- Do not rename, drop, truncate, or rewrite existing SIB business tables as part of Better Auth setup.

## Development sequence
1. Configure `DATABASE_URL` to a dedicated Neon development database.
2. Apply `0001_create_better_auth_schema.sql` to that development database only.
3. Run `npm run auth:schema:diff` to generate `0002_better_auth.sql` from the installed Better Auth configuration and the connected development schema.
4. Review the generated SQL and confirm it only creates/updates objects in `better_auth`.
5. Apply the reviewed SQL to development, then run `npm run auth:schema:check`.
6. Add the reviewed migration to version control. Production application requires a separately approved deployment window and verified backup.

The generated migration is intentionally not committed in advance: the CLI compares the actual schema and installed Better Auth configuration, and Neon credentials are not available in this repository workflow.
