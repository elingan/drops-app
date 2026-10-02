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

/**
 * Lazily connects, migrates/seeds (bootstrap) and only then creates the
 * BetterAuth instance, which validates the schema on creation. Retried
 * after a failure; shared by all requests of this server instance.
 */
export function getAuth(): Promise<Auth> {
	instance ??= (async () => {
		const url = databaseUrl(env);
		// Remote (Turso) → HTTP client, no native module; local file → Node client.
		const client = url.startsWith('file:')
			? (await import('@libsql/client')).createClient({ url })
			: (await import('@libsql/client/web')).createClient({ url, authToken: databaseToken(env) });
		await bootstrap(env, client);
		return createAuth(client);
	})().catch((e) => {
		instance = null;
		throw e;
	});
	return instance;
}
