import type { Client } from '@libsql/client';
import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { authOptions, databaseToken, databaseUrl } from './auth-options';
import { bootstrap } from './bootstrap';

function createAuth(client: Parameters<typeof authOptions>[1]) {
	return betterAuth({
		...authOptions(env, client),
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Promise<Auth> | null = null;
let clientPromise: Promise<Client> | null = null;

/** libSQL client: remote (Turso) → HTTP client, no native module; local file → Node client. */
export function getClient(): Promise<Client> {
	clientPromise ??= (async () => {
		const url = databaseUrl(env);
		return url.startsWith('file:')
			? (await import('@libsql/client')).createClient({ url })
			: (await import('@libsql/client/web')).createClient({ url, authToken: databaseToken(env) });
	})();
	return clientPromise;
}

/**
 * Lazily connects, migrates/seeds (bootstrap) and only then creates the
 * BetterAuth instance, which validates the schema on creation. Retried
 * after a failure; shared by all requests of this server instance.
 */
export function getAuth(): Promise<Auth> {
	instance ??= (async () => {
		const client = await getClient();
		await bootstrap(env, client);
		return createAuth(client);
	})().catch((e) => {
		instance = null;
		throw e;
	});
	return instance;
}

/** Non-secret runtime facts for /api/health. */
export function runtimeInfo() {
	const url = databaseUrl(env);
	return {
		database: url.startsWith('file:') ? 'local-file' : 'remote',
		databaseHost: url.startsWith('file:') ? null : url.replace(/^[a-z]+:\/\//, '').split(/[/?]/)[0],
		hasToken: !!databaseToken(env),
		hasSecret: !!env.BETTER_AUTH_SECRET,
		seedUserConfigured: !!env.SEED_USER_EMAIL && (env.SEED_USER_PASSWORD?.length ?? 0) >= 8
	};
}
