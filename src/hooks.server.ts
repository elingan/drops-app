import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getAuth } from '$lib/server/auth';

const securityHeaders = (response: Response) => {
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	return response;
};

/** The server only serves /api/auth/*; every page is client-rendered (SPA). */
export const handle: Handle = async ({ event, resolve }) => {
	if (building || !event.url.pathname.startsWith('/api/auth')) return securityHeaders(await resolve(event));
	let auth;
	try {
		auth = await getAuth();
	} catch (e) {
		console.error('[auth] startup failed', e);
		return new Response(JSON.stringify({ message: 'Service unavailable' }), {
			status: 503,
			headers: { 'content-type': 'application/json' }
		});
	}
	return securityHeaders(await svelteKitHandler({ event, resolve, auth, building }));
};
