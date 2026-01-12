import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './client';
import { logger } from '../utils/logger';

async function migrate() {
  try {
    logger.info('Starting database migration...');

    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

    await db.query(schemaSQL);

    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', { error });
    process.exit(1);
  }
}

migrate();
