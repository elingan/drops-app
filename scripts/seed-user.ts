import { betterAuth } from 'better-auth';
import { authOptions } from '../src/lib/server/auth-options.ts';
import { loadEnv } from './env.ts';

/**
 * Creates the single user. Sign-up is only enabled inside this script.
 * Usage: SEED_USER_EMAIL=… SEED_USER_NAME=… SEED_USER_PASSWORD=… npm run seed:user
 */
const env = loadEnv();
const email = env.SEED_USER_EMAIL;
const name = env.SEED_USER_NAME || 'Eduardo';
const password = env.SEED_USER_PASSWORD;
if (!email || !password || password.length < 8) {
	console.error('Set SEED_USER_EMAIL and SEED_USER_PASSWORD (min. 8 chars).');
	process.exit(1);
}
const auth = betterAuth(authOptions(env, { allowSignUp: true }));
try {
	await auth.api.signUpEmail({ body: { email, password, name } });
	console.log(`User ${email} created.`);
} catch (e) {
	console.error('Could not create user:', (e as Error).message);
	process.exit(1);
}
