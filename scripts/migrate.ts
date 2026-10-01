import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from '../src/lib/server/auth-options.ts';
import { dbClient } from './db.ts';
import { loadEnv } from './env.ts';

const env = loadEnv();
const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(authOptions(env, dbClient(env)));
if (!toBeCreated.length && !toBeAdded.length) {
	console.log('Auth schema is up to date.');
} else {
	await runMigrations();
	console.log('Auth schema migrated:', toBeCreated.map((t) => t.table).join(', ') || 'columns added');
}
