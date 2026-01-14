import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// In TypeScript compiled to CommonJS, __dirname is available globally
// Current file is at apps/backend/src/config/index.ts
// In compiled JS: apps/backend/dist/config/index.js
// Path from dist/config: ../ = dist, ../../ = backend, ../../../ = apps, ../../../../ = root
const rootPath = path.resolve(__dirname, '../../../../.env');

// For Heroku and production: also try process.cwd()/.env (where app is deployed)
// This handles both local development (monorepo) and production (single deployment)
const prodPath = path.resolve(process.cwd(), '.env');

// Load environment variables - try root first, then production location
let result = dotenv.config({ path: rootPath });

if (result.error) {
  // Try production/Heroku location
  result = dotenv.config({ path: prodPath });

  if (result.error) {
    console.warn('⚠️  Warning: Could not load .env file');
    console.warn('   Tried:', rootPath);
    console.warn('   Tried:', prodPath);
    console.warn('   Note: In production (Heroku), use Config Vars instead of .env file');
  } else {
    console.log('✓ Environment loaded from:', prodPath);
  }
} else {
  console.log('✓ Environment loaded from:', rootPath);
}

console.log('Environment check - Has GITHUB_CLIENT_ID:', !!process.env.GITHUB_CLIENT_ID);

const ConfigSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  API_BASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),
  GITHUB_ORG: z.string().default('salesforcedocs'),

  // Database
  DATABASE_URL: z.string().url(),

  // AWS S3
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_SESSION_TOKEN: z.string().optional(),
  S3_BUCKET_NAME: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('7d'),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  try {
    console.log('Loading configuration...');
    console.log('Environment variables present:', Object.keys(process.env).filter(k =>
      ['DATABASE_URL', 'GITHUB_CLIENT_ID', 'AWS_ACCESS_KEY_ID', 'JWT_SECRET', 'API_BASE_URL', 'FRONTEND_URL'].includes(k)
    ));
    return ConfigSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n❌ Configuration validation failed:');
      error.errors.forEach((err) => {
        const field = err.path.join('.');
        const value = process.env[field as string];
        console.error(`  - ${field}: ${err.message}`);
        console.error(`    Current value: ${value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : 'undefined'}`);
      });
      console.error('');
    }
    throw new Error('Invalid configuration - see errors above');
  }
}

export const config = loadConfig();
