import { createClient } from '@libsql/client';
import { betterAuth } from 'better-auth';
import { describe, expect, it } from 'vitest';
import { authOptions, trustedOrigins } from './auth-options';
import { bootstrap } from './bootstrap';

const env = {
	BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
	BETTER_AUTH_URL: 'http://localhost:5173',
	SEED_USER_EMAIL: 'eduardo@example.com',
	SEED_USER_PASSWORD: 'deutsch1234',
	SEED_USER_NAME: 'Eduardo'
};

describe('bootstrap', () => {
	it('migrates an empty DB, creates the single user once, and sign-up stays closed', async () => {
		const client = createClient({ url: ':memory:' });
		await bootstrap(env, client);
		await bootstrap({ ...env, SEED_USER_PASSWORD: 'another-password' }, client); // idempotent
		const { rows } = await client.execute('SELECT email FROM "user"');
		expect(rows.map((r) => r.email)).toEqual(['eduardo@example.com']);

		const auth = betterAuth(authOptions(env, client));
		const ok = await auth.api.signInEmail({ body: { email: env.SEED_USER_EMAIL, password: env.SEED_USER_PASSWORD } });
		expect(ok.user.email).toBe(env.SEED_USER_EMAIL);
		await expect(auth.api.signUpEmail({ body: { email: 'x@example.com', password: 'whatever123', name: 'x' } })).rejects.toThrow();
		const { rows: pw } = await client.execute('SELECT password FROM account');
		expect(String(pw[0]!.password)).not.toContain(env.SEED_USER_PASSWORD);
	});

	it('trusts the Vercel deployment URLs', () => {
		expect(trustedOrigins({ VERCEL_URL: 'drops-app-abc.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'drops-app.vercel.app' })).toEqual([
			'https://drops-app.vercel.app',
			'https://drops-app-abc.vercel.app'
		]);
	});
});
