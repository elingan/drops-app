import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { authOptions, databaseUrl } from './auth-options';

const url = databaseUrl(env);
// Remote (Turso) → HTTP client, no native module; local file → Node client.
const client = url.startsWith('file:')
	? (await import('@libsql/client')).createClient({ url })
	: (await import('@libsql/client/web')).createClient({ url, authToken: env.DATABASE_AUTH_TOKEN || undefined });

export const auth = betterAuth({
	...authOptions(env, client),
	plugins: [sveltekitCookies(getRequestEvent)]
});
