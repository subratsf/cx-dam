import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Load .env from monorepo root
// Traverse up from backend/src to reach the monorepo root
const configPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: configPath });

console.log('Loading .env from:', configPath);

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
