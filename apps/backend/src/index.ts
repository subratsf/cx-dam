import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { db } from './db/client';

async function startServer() {
  try {
    // Test database connection (non-fatal in development)
    try {
      await db.query('SELECT NOW()');
      logger.info('Database connection established');
    } catch (dbError) {
      logger.warn('Database connection failed - server will start but database operations will fail', { error: dbError });
      if (config.NODE_ENV === 'production') {
        throw dbError; // In production, database is critical
      }
    }

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.API_PORT, () => {
      logger.info(`Server running on port ${config.API_PORT}`, {
        environment: config.NODE_ENV,
        apiUrl: config.API_BASE_URL,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await db.close();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
