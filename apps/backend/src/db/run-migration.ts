import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './client';
import { logger } from '../utils/logger';

async function runMigration() {
  try {
    logger.info('Running migration 001_add_state_and_metadata...');

    const migrationSQL = readFileSync(
      join(__dirname, 'migrations/001_add_state_and_metadata.sql'),
      'utf-8'
    );

    await db.query(migrationSQL);

    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exit(1);
  }
}

runMigration();
