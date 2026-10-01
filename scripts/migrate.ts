import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from '../src/lib/server/auth-options.ts';
import { loadEnv } from './env.ts';

const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(authOptions(loadEnv()));
if (!toBeCreated.length && !toBeAdded.length) {
	console.log('Auth schema is up to date.');
} else {
	await runMigrations();
	console.log('Auth schema migrated:', toBeCreated.map((t) => t.table).join(', ') || 'columns added');
}
