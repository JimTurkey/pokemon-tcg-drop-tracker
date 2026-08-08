import { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertDestructiveResetAllowed,
  DESTRUCTIVE_RESET_OPT_IN_ENV,
} from '../integration/postgres-test-safety';

const originalDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const originalDestructiveResetOptIn =
  process.env[DESTRUCTIVE_RESET_OPT_IN_ENV];

function databaseReporting(name: string): Pick<Pool, 'query'> {
  return {
    query: vi.fn(async () => ({ rows: [{ database_name: name }] })),
  } as unknown as Pick<Pool, 'query'>;
}

afterEach(() => {
  if (originalDestructiveResetOptIn === undefined) {
    delete process.env[DESTRUCTIVE_RESET_OPT_IN_ENV];
  } else {
    process.env[DESTRUCTIVE_RESET_OPT_IN_ENV] = originalDestructiveResetOptIn;
  }

  if (originalDatabaseUrl === undefined) {
    delete process.env.MIGRATION_TEST_DATABASE_URL;
  } else {
    process.env.MIGRATION_TEST_DATABASE_URL = originalDatabaseUrl;
  }
});

describe('assertDestructiveResetAllowed', () => {
  it('allows the canonical migration test database', async () => {
    const database = databaseReporting('pokemon_tracker_test');

    await expect(assertDestructiveResetAllowed(database)).resolves.toBe(
      'pokemon_tracker_test'
    );
    expect(database.query).toHaveBeenCalledWith(
      'SELECT current_database() AS database_name'
    );
  });

  it('rejects a non-test database even when a database URL is configured', async () => {
    process.env.MIGRATION_TEST_DATABASE_URL =
      'postgresql://postgres:postgres@localhost/production';
    const database = databaseReporting('production');

    await expect(assertDestructiveResetAllowed(database)).rejects.toThrow(
      'Refusing destructive migration-test reset on database "production"'
    );
  });

  it('allows a differently named database only with explicit destructive opt-in', async () => {
    process.env[DESTRUCTIVE_RESET_OPT_IN_ENV] = 'true';
    const database = databaseReporting('disposable_migration_test');

    await expect(assertDestructiveResetAllowed(database)).resolves.toBe(
      'disposable_migration_test'
    );
  });
});
