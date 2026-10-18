# Supabase database

A free Supabase project named `hanre-studio` has been provisioned in `ap-south-1` (Mumbai).
Project ref: `gnfgnwkxomwomgmyvzlq`. Migration `20261018042053_initial_hanre_schema` has been
applied. It contains the ten Hanre data
tables with Row Level Security enabled and no public policies.

## Important: app connection is not switched yet

The app runtime still uses `node:sqlite` and `data/hanre.db`. The Postgres schema is provisioned
and checked, but it is **not yet the app's live database**. Switching the primary database
requires an async PostgreSQL data-access migration across authentication, API routes, server
pages, transactions, seed/import flows, and tests, plus a data migration from any existing SQLite
workspace. Do not set a `DATABASE_URL` and expect the current SQLite adapter to use it.

When wiring the app, connect only from server-side code with a protected database connection
string (or a server-only secret key). Never expose a database password or Supabase secret key in
browser code, commit them to Git, or add them to Docker build arguments. RLS is intentionally
closed to anon/authenticated clients until user-scoped policies are designed; the trusted server
must enforce per-user ownership.

The SQL migration is in `migrations/20261018042053_initial_hanre_schema.sql` for review and future
local Supabase CLI use.
