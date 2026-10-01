import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { authOptions } from './auth-options';

const options = authOptions(env);

export const auth = betterAuth({
	...options,
	plugins: [sveltekitCookies(getRequestEvent)]
});
