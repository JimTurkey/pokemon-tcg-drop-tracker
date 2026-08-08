import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { PoolClient } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  discoverMigrations,
  MigrationPool,
  runVersionedMigrations,
} from '../../src/config/migrations';

const temporaryDirectories: string[] = [];

async function createMigrationDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'tracker-migrations-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe('discoverMigrations', () => {
  it('sorts valid migration files by numeric version', async () => {
    const directory = await createMigrationDirectory();
    await writeFile(path.join(directory, '0002_second.sql'), 'SELECT 2;\n');
    await writeFile(path.join(directory, '0001_first.sql'), 'SELECT 1;\n');
    await writeFile(path.join(directory, 'README.md'), 'Documentation');

    const migrations = await discoverMigrations(directory);

    expect(
      migrations.map(({ version, filename }) => ({ version, filename }))
    ).toEqual([
      { version: 1, filename: '0001_first.sql' },
      { version: 2, filename: '0002_second.sql' },
    ]);
    expect(migrations[0].checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects malformed SQL migration filenames', async () => {
    const directory = await createMigrationDirectory();
    await writeFile(path.join(directory, 'first_migration.sql'), 'SELECT 1;\n');

    await expect(discoverMigrations(directory)).rejects.toThrow(
      'Malformed migration filename'
    );
  });

  it('rejects duplicate numeric versions', async () => {
    const directory = await createMigrationDirectory();
    await writeFile(path.join(directory, '0001_first.sql'), 'SELECT 1;\n');
    await writeFile(path.join(directory, '0001_alternate.sql'), 'SELECT 2;\n');

    await expect(discoverMigrations(directory)).rejects.toThrow(
      'Duplicate migration version 0001'
    );
  });

  it('fails clearly when the migration directory is missing', async () => {
    const directory = path.join(tmpdir(), `missing-migrations-${Date.now()}`);

    await expect(discoverMigrations(directory)).rejects.toThrow(
      'Unable to read migrations directory'
    );
  });

  it('rejects an empty migrations directory', async () => {
    const directory = await createMigrationDirectory();

    await expect(discoverMigrations(directory)).rejects.toThrow(
      'No SQL migration files found'
    );
  });

  it('rejects an empty migration file', async () => {
    const directory = await createMigrationDirectory();
    await writeFile(path.join(directory, '0001_empty.sql'), '  \n');

    await expect(discoverMigrations(directory)).rejects.toThrow(
      'Migration "0001_empty.sql" is empty'
    );
  });
});

describe('runVersionedMigrations', () => {
  it('releases its session advisory lock when discovery fails', async () => {
    const directory = await createMigrationDirectory();
    await writeFile(path.join(directory, 'bad.sql'), 'SELECT 1;\n');

    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_lock')) {
        return { rows: [{}] };
      }
      if (sql.includes('pg_advisory_unlock')) {
        return { rows: [{ unlocked: true }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const databasePool: MigrationPool = {
      connect: vi.fn(async () => client),
    };

    await expect(
      runVersionedMigrations({ databasePool, migrationsDirectory: directory })
    ).rejects.toThrow('Malformed migration filename');

    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_lock($1, $2)', [
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1, $2) AS unlocked',
      [expect.any(Number), expect.any(Number)]
    );
    expect(release).toHaveBeenCalledOnce();
  });
});
