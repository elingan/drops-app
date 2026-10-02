import { getAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Normally answered in hooks.server.ts; kept as an explicit endpoint fallback.
const handler: RequestHandler = async ({ request }) => (await getAuth()).handler(request);

export const GET = handler;
export const POST = handler;
