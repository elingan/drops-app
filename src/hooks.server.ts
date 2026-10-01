import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';

/** The server only serves /api/auth/*; every page is client-rendered (SPA). */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await svelteKitHandler({ event, resolve, auth, building });
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	return response;
};
