import type { Client } from '@libsql/client';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions, type AuthEnv } from './auth-options';

export interface SeedEnv extends AuthEnv {
	SEED_USER_EMAIL?: string;
	SEED_USER_NAME?: string;
	SEED_USER_PASSWORD?: string;
}

/**
 * Idempotent startup tasks, so a fresh Turso database works without running
 * scripts by hand: create/upgrade the auth tables, then create the single
 * user from SEED_USER_* if no user exists yet. Never overwrites a user.
 */
export async function bootstrap(env: SeedEnv, client: Client): Promise<void> {
	const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(authOptions(env, client));
	if (toBeCreated.length || toBeAdded.length) await runMigrations();

	const email = env.SEED_USER_EMAIL?.trim();
	const password = env.SEED_USER_PASSWORD;
	if (!email || !password || password.length < 8) return;
	const { rows } = await client.execute('SELECT COUNT(*) AS n FROM "user"');
	if (Number(rows[0]?.n ?? 0) > 0) return;

	// Sign-up is only enabled on this throwaway instance.
	const seeder = betterAuth(authOptions(env, client, { allowSignUp: true }));
	await seeder.api.signUpEmail({ body: { email, password, name: env.SEED_USER_NAME?.trim() || email.split('@')[0]! } });
	console.info('[bootstrap] initial user created');
}
