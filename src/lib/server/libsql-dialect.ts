import type { Client, Transaction } from '@libsql/client';
import {
	SqliteAdapter,
	SqliteIntrospector,
	SqliteQueryCompiler,
	type CompiledQuery,
	type DatabaseConnection,
	type Dialect,
	type Driver,
	type Kysely,
	type QueryResult
} from 'kysely';

/**
 * Minimal Kysely dialect over an injected libSQL client (adapted from
 * @libsql/kysely-libsql, MIT). Taking the client as a parameter lets
 * production use the pure-HTTP `@libsql/client/web` build (no native
 * binary on serverless) while local dev uses a SQLite file.
 */
export class LibsqlDialect implements Dialect {
	private readonly client: Client;
	constructor(client: Client) {
		this.client = client;
	}
	createAdapter() {
		return new SqliteAdapter();
	}
	createDriver(): Driver {
		return new LibsqlDriver(this.client);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	createIntrospector(db: Kysely<any>) {
		return new SqliteIntrospector(db);
	}
	createQueryCompiler() {
		return new SqliteQueryCompiler();
	}
}

class LibsqlDriver implements Driver {
	private readonly client: Client;
	constructor(client: Client) {
		this.client = client;
	}
	async init() {}
	async acquireConnection(): Promise<DatabaseConnection> {
		return new LibsqlConnection(this.client);
	}
	async beginTransaction(c: DatabaseConnection) {
		await (c as LibsqlConnection).begin();
	}
	async commitTransaction(c: DatabaseConnection) {
		await (c as LibsqlConnection).commit();
	}
	async rollbackTransaction(c: DatabaseConnection) {
		await (c as LibsqlConnection).rollback();
	}
	async releaseConnection() {}
	async destroy() {}
}

class LibsqlConnection implements DatabaseConnection {
	private tx: Transaction | undefined;
	private readonly client: Client;
	constructor(client: Client) {
		this.client = client;
	}

	async executeQuery<R>(q: CompiledQuery): Promise<QueryResult<R>> {
		const result = await (this.tx ?? this.client).execute({
			sql: q.sql,
			args: q.parameters as never
		});
		return {
			insertId: result.lastInsertRowid,
			numAffectedRows: BigInt(result.rowsAffected),
			rows: result.rows as R[]
		};
	}

	async begin() {
		if (this.tx) throw new Error('Transaction already in progress');
		this.tx = await this.client.transaction('write');
	}
	async commit() {
		await this.tx?.commit();
		this.tx = undefined;
	}
	async rollback() {
		await this.tx?.rollback();
		this.tx = undefined;
	}
	// eslint-disable-next-line require-yield
	async *streamQuery(): AsyncIterableIterator<QueryResult<never>> {
		throw new Error('Streaming is not supported');
	}
}
