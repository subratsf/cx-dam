import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

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
    return ConfigSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Invalid configuration');
  }
}

export const config = loadConfig();
