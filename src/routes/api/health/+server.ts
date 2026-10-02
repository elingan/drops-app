import { json } from '@sveltejs/kit';
import { getAuth, getClient, runtimeInfo } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Deployment diagnostics (no secrets): runs the auth bootstrap if needed and
 * reports database reachability, auth tables and whether the user exists.
 */
export const GET: RequestHandler = async () => {
	const info = runtimeInfo();
	let stage = 'connect';
	try {
		const client = await getClient();
		await client.execute('SELECT 1');
		stage = 'bootstrap';
		await getAuth();
		stage = 'inspect';
		const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).rows.map((r) =>
			String(r.name)
		);
		const users = tables.includes('user') ? Number((await client.execute('SELECT COUNT(*) AS n FROM "user"')).rows[0]?.n ?? 0) : 0;
		return json({ ok: true, ...info, tables, users }, { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
		return json({ ok: false, ...info, stage, error: message }, { status: 500, headers: { 'cache-control': 'no-store' } });
	}
};
