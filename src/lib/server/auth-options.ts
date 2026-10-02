import type { BetterAuthOptions } from 'better-auth';
import type { Client } from '@libsql/client';
import { LibsqlDialect } from './libsql-dialect.ts';

export interface AuthEnv {
	BETTER_AUTH_SECRET?: string;
	BETTER_AUTH_URL?: string;
	DATABASE_URL?: string;
	DATABASE_AUTH_TOKEN?: string;
	/** Injected by the Turso integration on Vercel. */
	TURSO_DATABASE_URL?: string;
	TURSO_AUTH_TOKEN?: string;
	/** Vercel system variables. */
	VERCEL_URL?: string;
	VERCEL_BRANCH_URL?: string;
	VERCEL_PROJECT_PRODUCTION_URL?: string;
}

export const databaseUrl = (env: AuthEnv) => env.DATABASE_URL || env.TURSO_DATABASE_URL || 'file:local.db';
export const databaseToken = (env: AuthEnv) => env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || undefined;

const https = (host?: string) => (host ? `https://${host}` : undefined);

/** Origins allowed to call the auth API: explicit URL plus this Vercel deployment's URLs. */
export function trustedOrigins(env: AuthEnv): string[] {
	return [env.BETTER_AUTH_URL, https(env.VERCEL_PROJECT_PRODUCTION_URL), https(env.VERCEL_BRANCH_URL), https(env.VERCEL_URL)].filter(
		(o): o is string => !!o
	);
}

/**
 * Shared BetterAuth configuration (used by the app and by the CLI scripts).
 * Public sign-up is disabled: the single user is created from SEED_USER_* env.
 */
export function authOptions(env: AuthEnv, client: Client, { allowSignUp = false } = {}): BetterAuthOptions {
	return {
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL || https(env.VERCEL_PROJECT_PRODUCTION_URL),
		trustedOrigins: trustedOrigins(env),
		database: { dialect: new LibsqlDialect(client), type: 'sqlite' },
		emailAndPassword: {
			enabled: true,
			disableSignUp: !allowSignUp,
			minPasswordLength: 8
		},
		session: {
			expiresIn: 60 * 60 * 24 * 60, // 60 days: personal device
			updateAge: 60 * 60 * 24
		},
		rateLimit: { enabled: true, window: 60, max: 30 }
	};
}
