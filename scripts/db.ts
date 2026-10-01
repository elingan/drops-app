import { createClient } from '@libsql/client';
import { databaseUrl, type AuthEnv } from '../src/lib/server/auth-options.ts';

export const dbClient = (env: AuthEnv) =>
	createClient({ url: databaseUrl(env), authToken: env.DATABASE_AUTH_TOKEN || undefined });
