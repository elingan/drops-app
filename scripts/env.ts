import { readFileSync } from 'node:fs';

/** Tiny .env loader for CLI scripts (Vite loads it for the app). */
export function loadEnv(file = '.env'): Record<string, string | undefined> {
	try {
		for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
			const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
			if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
		}
	} catch {
		/* no .env: rely on the environment */
	}
	return process.env;
}
