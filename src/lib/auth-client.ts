import { createAuthClient } from 'better-auth/svelte';

/** Same-origin client; the server lives at /api/auth. */
export const authClient = createAuthClient();
