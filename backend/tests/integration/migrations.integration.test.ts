import { appendFile, copyFile, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_MIGRATIONS_DIRECTORY,
  runVersionedMigrations,
} from '../../src/config/migrations';

const connectionString = process.env.MIGRATION_TEST_DATABASE_URL;
const describeWithPostgres = connectionString ? describe : describe.skip;
const pool = new Pool({ connectionString });
const temporaryDirectories: string[] = [];
const silentLogger = { info: () => undefined };

async function resetPublicSchema(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public');
}

async function expectConstraintViolation(
  sql: string,
  values: readonly unknown[],
  constraint: string
): Promise<void> {
  try {
    await pool.query(sql, [...values]);
    throw new Error(`Expected constraint ${constraint} to reject the query.`);
  } catch (error) {
    expect(error).toMatchObject({ constraint });
  }
}

describeWithPostgres('versioned migrations with PostgreSQL 16', () => {
  beforeEach(async () => {
    await resetPublicSchema();
  });

  afterAll(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    );
    await pool.end();
  });

  it('applies 0001 once, creates all tables, records the ledger, and seeds ZIP 29631', async () => {
    const serverVersion = await pool.query<{ server_version_num: string }>(
      'SHOW server_version_num'
    );
    expect(serverVersion.rows[0].server_version_num).toMatch(/^16/);

    const firstRun = await runVersionedMigrations({
      databasePool: pool,
      logger: silentLogger,
    });
    const secondRun = await runVersionedMigrations({
      databasePool: pool,
      logger: silentLogger,
    });

    expect(firstRun.applied.map((migration) => migration.version)).toEqual([1]);
    expect(firstRun.skipped).toHaveLength(0);
    expect(secondRun.applied).toHaveLength(0);
    expect(secondRun.skipped.map((migration) => migration.version)).toEqual([1]);

    const tables = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        'opportunities',
        'pokemon_products',
        'readiness_snapshots',
        'release_events',
        'retailer_listings',
        'schema_migrations',
        'scrape_runs',
        'signals',
        'source_profiles',
        'tracked_locations',
        'value_scores',
      ])
    );

    const ledger = await pool.query(
      'SELECT version::TEXT, filename, checksum FROM schema_migrations'
    );
    expect(ledger.rows).toEqual([
      expect.objectContaining({
        version: '1',
        filename: '0001_pokemon_tracker_schema_foundation.sql',
        checksum: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    ]);

    const location = await pool.query(
      `SELECT location_key, country_code, postal_code
       FROM tracked_locations
       WHERE location_key = 'us:29631'`
    );
    expect(location.rows).toEqual([
      { location_key: 'us:29631', country_code: 'US', postal_code: '29631' },
    ]);
  });

  it('rejects a checksum mismatch for an applied migration', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'tracker-integration-'));
    temporaryDirectories.push(directory);
    const filename = '0001_pokemon_tracker_schema_foundation.sql';
    const copiedMigration = path.join(directory, filename);
    await copyFile(path.join(DEFAULT_MIGRATIONS_DIRECTORY, filename), copiedMigration);

    await runVersionedMigrations({
      databasePool: pool,
      migrationsDirectory: directory,
      logger: silentLogger,
    });
    await appendFile(copiedMigration, '\n-- forbidden edit\n');

    await expect(
      runVersionedMigrations({
        databasePool: pool,
        migrationsDirectory: directory,
        logger: silentLogger,
      })
    ).rejects.toThrow('Checksum mismatch for applied migration 1');
  });

  it('rolls back a failed migration and does not ledger it', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'tracker-integration-'));
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, '0001_intentional_failure.sql'),
      `
        CREATE TABLE rollback_probe (id BIGINT PRIMARY KEY);
        INSERT INTO table_that_does_not_exist (id) VALUES (1);
      `
    );

    await expect(
      runVersionedMigrations({
        databasePool: pool,
        migrationsDirectory: directory,
        logger: silentLogger,
      })
    ).rejects.toThrow('Failed to apply migration 0001_intentional_failure.sql');

    const probe = await pool.query<{ table_name: string | null }>(
      `SELECT TO_REGCLASS('public.rollback_probe')::TEXT AS table_name`
    );
    expect(probe.rows[0].table_name).toBeNull();

    const ledger = await pool.query('SELECT version FROM schema_migrations');
    expect(ledger.rows).toHaveLength(0);
  });

  it('enforces representative numeric and rating constraints', async () => {
    await runVersionedMigrations({ databasePool: pool, logger: silentLogger });
    const product = await pool.query<{ id: string }>(`
      INSERT INTO pokemon_products (canonical_key, name, product_type, pack_count)
      VALUES ('product:valid', 'Valid ETB', 'etb', 9)
      RETURNING id::TEXT
    `);
    const productId = product.rows[0].id;

    await expectConstraintViolation(
      `INSERT INTO pokemon_products (canonical_key, name, product_type, pack_count)
       VALUES ($1, 'Bad packs', 'etb', 0)`,
      ['product:bad-packs'],
      'pokemon_products_pack_count_positive'
    );
    await expectConstraintViolation(
      `INSERT INTO source_profiles
         (source_key, source_type, display_name, independence_group, reliability_score)
       VALUES ('source:bad', 'reddit', 'Bad source', 'bad-group', 101)`,
      [],
      'source_profiles_reliability_range'
    );
    await expectConstraintViolation(
      `INSERT INTO retailer_listings
         (pokemon_product_id, retailer_id, canonical_url, seller_classification,
          availability_state, access_state, price)
       VALUES ($1, 'target', 'https://target.example/bad', 'first_party',
               'add_to_cart', 'public', -0.01)`,
      [productId],
      'retailer_listings_price_nonnegative'
    );
    await expectConstraintViolation(
      `INSERT INTO readiness_snapshots
         (calculation_key, pokemon_product_id, policy_version, readiness_score,
          readiness_band, independent_source_count)
       VALUES ('readiness:bad', $1, 'v1', 101, 'high_probability', 1)`,
      [productId],
      'readiness_snapshots_score_range'
    );
    await expectConstraintViolation(
      `INSERT INTO value_scores
         (calculation_key, pokemon_product_id, policy_version, rated, price,
          pack_count, price_per_pack, value_score, star_rating, value_tag)
       VALUES ('value:bad-star', $1, 'v1', TRUE, 49.99, 9, 5.5544,
               80, 6, 'strong_value')`,
      [productId],
      'value_scores_star_range'
    );
  });

  it('enforces important uniqueness and foreign-key behavior', async () => {
    await runVersionedMigrations({ databasePool: pool, logger: silentLogger });
    const product = await pool.query<{ id: string }>(`
      INSERT INTO pokemon_products (canonical_key, name, product_type)
      VALUES ('product:unique', 'Unique Product', 'booster_bundle')
      RETURNING id::TEXT
    `);
    const productId = product.rows[0].id;

    await expectConstraintViolation(
      `INSERT INTO pokemon_products (canonical_key, name, product_type)
       VALUES ('product:unique', 'Duplicate Product', 'booster_bundle')`,
      [],
      'pokemon_products_canonical_key_key'
    );
    await expectConstraintViolation(
      `INSERT INTO retailer_listings
         (pokemon_product_id, retailer_id, canonical_url, seller_classification,
          availability_state, access_state)
       VALUES (999999, 'target', 'https://target.example/missing',
               'first_party', 'unknown', 'public')`,
      [],
      'retailer_listings_pokemon_product_id_fkey'
    );

    await pool.query(
      `INSERT INTO retailer_listings
         (pokemon_product_id, retailer_id, retailer_sku, canonical_url,
          seller_classification, availability_state, access_state)
       VALUES ($1, 'target', 'SKU-1', 'https://target.example/one',
               'first_party', 'add_to_cart', 'public')`,
      [productId]
    );
    await expectConstraintViolation(
      `INSERT INTO retailer_listings
         (pokemon_product_id, retailer_id, retailer_sku, canonical_url,
          seller_classification, availability_state, access_state)
       VALUES ($1, 'target', 'SKU-1', 'https://target.example/two',
               'first_party', 'out_of_stock', 'public')`,
      [productId],
      'uq_retailer_listings_retailer_sku'
    );
    await expectConstraintViolation(
      'DELETE FROM pokemon_products WHERE id = $1',
      [productId],
      'retailer_listings_pokemon_product_id_fkey'
    );
  });
});
