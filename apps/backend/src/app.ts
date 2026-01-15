import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import router from './routes';
import { errorHandler } from './middleware/error.middleware';

export function createApp() {
  const app = express();

  // CORS - allow credentials from frontend
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    })
  );

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP in development
    })
  );

  // Request logging
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // API routes
  app.use('/api', router);

  // Serve frontend static files in production
  if (config.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    logger.info('Serving frontend static files from:', { frontendPath });

    // Serve static files
    app.use(express.static(frontendPath));

    // Handle client-side routing - send all non-API requests to index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  // Error handling
  app.use(errorHandler);

  return app;
}
