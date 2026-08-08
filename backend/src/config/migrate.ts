import pool from './database';
import { runVersionedMigrations } from './migrations';

async function migrate(): Promise<void> {
  try {
    const result = await runVersionedMigrations();
    console.log(
      `Versioned migrations complete: ${result.applied.length} applied, ${result.skipped.length} unchanged.`
    );
  } catch (error) {
    console.error('Versioned migration failure:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void migrate();
