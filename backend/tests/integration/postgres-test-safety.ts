import { Pool } from 'pg';

export const CANONICAL_MIGRATION_TEST_DATABASE = 'pokemon_tracker_test';
export const DESTRUCTIVE_RESET_OPT_IN_ENV =
  'MIGRATION_TEST_ALLOW_DESTRUCTIVE_RESET';

type DatabaseQuery = Pick<Pool, 'query'>;

export async function assertDestructiveResetAllowed(
  databasePool: DatabaseQuery,
  allowDestructiveReset =
    process.env[DESTRUCTIVE_RESET_OPT_IN_ENV] === 'true'
): Promise<string> {
  const result = await databasePool.query<{ database_name: string }>(
    'SELECT current_database() AS database_name'
  );
  const databaseName = result.rows[0]?.database_name;

  if (!databaseName) {
    throw new Error(
      'Refusing destructive migration-test reset because PostgreSQL did not report current_database().'
    );
  }

  if (
    databaseName !== CANONICAL_MIGRATION_TEST_DATABASE &&
    !allowDestructiveReset
  ) {
    throw new Error(
      `Refusing destructive migration-test reset on database "${databaseName}". Expected "${CANONICAL_MIGRATION_TEST_DATABASE}". Set ${DESTRUCTIVE_RESET_OPT_IN_ENV}=true only for an explicitly disposable test database.`
    );
  }

  return databaseName;
}
