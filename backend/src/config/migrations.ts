import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { PoolClient } from 'pg';

import pool from './database';

const MIGRATION_FILENAME_PATTERN = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const ADVISORY_LOCK_NAMESPACE = 1_347_372_869;
const ADVISORY_LOCK_KEY = 1_414_686_567;

export const DEFAULT_MIGRATIONS_DIRECTORY = path.resolve(
  __dirname,
  '..',
  '..',
  'migrations'
);

export interface SqlMigration {
  version: number;
  filename: string;
  name: string;
  checksum: string;
  sql: string;
}

export interface MigrationPool {
  connect(): Promise<PoolClient>;
}

export interface RunVersionedMigrationsOptions {
  databasePool?: MigrationPool;
  migrationsDirectory?: string;
  logger?: Pick<Console, 'info'>;
}

export interface MigrationRunResult {
  applied: readonly SqlMigration[];
  skipped: readonly SqlMigration[];
}

interface AppliedMigrationRow {
  version: string;
  filename: string;
  checksum: string;
}

function checksumSql(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export async function discoverMigrations(
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY
): Promise<SqlMigration[]> {
  let entries;

  try {
    entries = await readdir(migrationsDirectory, { withFileTypes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read migrations directory "${migrationsDirectory}": ${message}`
    );
  }

  const sqlEntries = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql')
  );
  if (sqlEntries.length === 0) {
    throw new Error(
      `No SQL migration files found in migrations directory "${migrationsDirectory}".`
    );
  }
  const migrations: SqlMigration[] = [];
  const versions = new Map<number, string>();

  for (const entry of sqlEntries) {
    const match = MIGRATION_FILENAME_PATTERN.exec(entry.name);

    if (!match) {
      throw new Error(
        `Malformed migration filename "${entry.name}". Expected NNNN_descriptive_name.sql.`
      );
    }

    const version = Number(match[1]);
    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new Error(`Invalid migration version in filename "${entry.name}".`);
    }

    const duplicate = versions.get(version);
    if (duplicate) {
      throw new Error(
        `Duplicate migration version ${match[1]} in "${duplicate}" and "${entry.name}".`
      );
    }
    versions.set(version, entry.name);

    const migrationPath = path.join(migrationsDirectory, entry.name);
    let sql: string;
    try {
      sql = await readFile(migrationPath, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to read migration "${migrationPath}": ${message}`);
    }

    if (sql.trim().length === 0) {
      throw new Error(`Migration "${entry.name}" is empty.`);
    }

    migrations.push({
      version,
      filename: entry.name,
      name: match[2],
      checksum: checksumSql(sql),
      sql,
    });
  }

  return migrations.sort(
    (left, right) =>
      left.version - right.version || left.filename.localeCompare(right.filename)
  );
}

async function ensureMigrationLedger(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version BIGINT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_duration_ms INTEGER NOT NULL,
      CONSTRAINT schema_migrations_version_positive CHECK (version > 0),
      CONSTRAINT schema_migrations_checksum_sha256 CHECK (checksum ~ '^[0-9a-f]{64}$'),
      CONSTRAINT schema_migrations_duration_nonnegative CHECK (execution_duration_ms >= 0)
    )
  `);
}

function validateAppliedMigrations(
  migrations: readonly SqlMigration[],
  appliedRows: readonly AppliedMigrationRow[]
): Set<number> {
  const migrationsByVersion = new Map(
    migrations.map((migration) => [migration.version, migration])
  );
  const appliedVersions = new Set<number>();

  for (const row of appliedRows) {
    const version = Number(row.version);
    if (!Number.isSafeInteger(version)) {
      throw new Error(`Migration ledger contains invalid version "${row.version}".`);
    }

    const migration = migrationsByVersion.get(version);
    if (!migration) {
      throw new Error(
        `Applied migration ${row.version} (${row.filename}) is missing from the migrations directory.`
      );
    }
    if (migration.filename !== row.filename) {
      throw new Error(
        `Applied migration ${row.version} filename mismatch: ledger has "${row.filename}", file is "${migration.filename}".`
      );
    }
    if (migration.checksum !== row.checksum) {
      throw new Error(
        `Checksum mismatch for applied migration ${row.version} (${row.filename}). Applied migrations must never be edited.`
      );
    }

    appliedVersions.add(version);
  }

  return appliedVersions;
}

export async function runVersionedMigrations(
  options: RunVersionedMigrationsOptions = {}
): Promise<MigrationRunResult> {
  const databasePool: MigrationPool = options.databasePool ?? pool;
  const migrationsDirectory =
    options.migrationsDirectory ?? DEFAULT_MIGRATIONS_DIRECTORY;
  const logger = options.logger ?? console;
  const client = await databasePool.connect();
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [
      ADVISORY_LOCK_NAMESPACE,
      ADVISORY_LOCK_KEY,
    ]);
    lockAcquired = true;

    const migrations = await discoverMigrations(migrationsDirectory);
    await ensureMigrationLedger(client);

    const ledgerResult = await client.query<AppliedMigrationRow>(`
      SELECT version::TEXT AS version, filename, checksum
      FROM schema_migrations
      ORDER BY version
    `);
    const appliedVersions = validateAppliedMigrations(
      migrations,
      ledgerResult.rows
    );
    const unappliedMigrations = migrations.filter(
      (migration) => !appliedVersions.has(migration.version)
    );
    const highestAppliedVersion =
      appliedVersions.size > 0 ? Math.max(...appliedVersions) : undefined;

    if (highestAppliedVersion !== undefined) {
      const historicalMigration = unappliedMigrations.find(
        (migration) => migration.version < highestAppliedVersion
      );
      if (historicalMigration) {
        throw new Error(
          `Out-of-order/backfill migration ${historicalMigration.filename} cannot be applied because migration version ${highestAppliedVersion} is already applied. Add a new migration with a version greater than ${highestAppliedVersion}.`
        );
      }
    }

    const applied: SqlMigration[] = [];
    const skipped = migrations.filter((migration) =>
      appliedVersions.has(migration.version)
    );

    for (const migration of unappliedMigrations) {
      const startedAt = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        const executionDurationMs = Math.max(0, Date.now() - startedAt);
        await client.query(
          `
            INSERT INTO schema_migrations (
              version,
              filename,
              checksum,
              execution_duration_ms
            ) VALUES ($1, $2, $3, $4)
          `,
          [
            migration.version,
            migration.filename,
            migration.checksum,
            executionDurationMs,
          ]
        );
        await client.query('COMMIT');
        applied.push(migration);
        logger.info(
          `Applied migration ${migration.filename} in ${executionDurationMs}ms`
        );
      } catch (error) {
        await client.query('ROLLBACK');
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to apply migration ${migration.filename}: ${message}`,
          { cause: error }
        );
      }
    }

    return { applied, skipped };
  } finally {
    try {
      if (lockAcquired) {
        const unlockResult = await client.query<{ unlocked: boolean }>(
          'SELECT pg_advisory_unlock($1, $2) AS unlocked',
          [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]
        );
        if (unlockResult.rows[0]?.unlocked !== true) {
          throw new Error('PostgreSQL migration advisory lock was not released.');
        }
      }
    } finally {
      client.release();
    }
  }
}
