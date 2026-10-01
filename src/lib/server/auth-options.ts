import type { BetterAuthOptions } from 'better-auth';
import { LibsqlDialect } from '@libsql/kysely-libsql';

export interface AuthEnv {
	BETTER_AUTH_SECRET?: string;
	BETTER_AUTH_URL?: string;
	DATABASE_URL?: string;
	DATABASE_AUTH_TOKEN?: string;
}

/**
 * Shared BetterAuth configuration (used by the app and by the CLI scripts).
 * Public sign-up is disabled: the single user is created with `npm run seed:user`.
 */
export function authOptions(env: AuthEnv, { allowSignUp = false } = {}): BetterAuthOptions {
	return {
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		database: {
			dialect: new LibsqlDialect({
				url: env.DATABASE_URL || 'file:local.db',
				authToken: env.DATABASE_AUTH_TOKEN || undefined
			}),
			type: 'sqlite'
		},
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
