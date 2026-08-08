# Database migrations

New Pokémon tracker schema changes use forward-only SQL migrations in
`backend/migrations`. Migration filenames must use the form
`NNNN_descriptive_name.sql`, with a unique positive four-digit version. Files
are applied in numeric order; malformed names and duplicate versions stop the
process.

The migration runner creates a `schema_migrations` ledger containing each
version, filename, SHA-256 checksum, application timestamp, and execution
duration. An applied file must never be edited: a checksum or filename mismatch
stops startup. Each unapplied file and its ledger row are committed in one
transaction, so a failure rolls back both.

Migrations are forward-only. Gaps are allowed, but after a version has been
applied, a newly introduced migration with a lower version is rejected as an
out-of-order backfill. Corrective work must use a new version greater than the
highest applied version.

The runner holds a session-level PostgreSQL advisory lock while it discovers,
checks, and applies migrations. This prevents multiple backend instances from
upgrading the same database concurrently, and the lock is released in a
`finally` block.

PostgreSQL integration tests reset the `public` schema. Before every reset they
query `current_database()` and require the database name
`pokemon_tracker_test`. A differently named disposable database is permitted
only when `MIGRATION_TEST_ALLOW_DESTRUCTIVE_RESET=true` is explicitly set;
setting only `MIGRATION_TEST_DATABASE_URL` never bypasses this safeguard.

Run migrations manually from the backend directory:

```sh
DATABASE_URL=postgresql://user:password@host:5432/database npm run db:migrate
```

The backend also runs versioned migrations during startup, after the existing
PriceGhost compatibility bootstrap and before the HTTP server listens. The
legacy inline startup DDL remains temporarily to support current PriceGhost
installations. It must not be expanded with new Pokémon objects. All future
Pokémon schema changes belong in new, immutable versioned migration files.
