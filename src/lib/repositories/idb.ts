import { openDB, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type Settings } from '$lib/domain/types';
import type { Collection, MediaRepository, Repositories, UserRepository } from './interfaces';

const DB_NAME = 'deutsch10';
const DB_VERSION = 1;
const STORES = {
	categories: 'id',
	items: 'id',
	progress: 'itemId',
	sessions: 'id',
	sessionItems: 'id',
	media: null,
	kv: null
} as const;

type StoreName = keyof typeof STORES;

function open(name = DB_NAME) {
	return openDB(name, DB_VERSION, {
		upgrade(db) {
			for (const [store, keyPath] of Object.entries(STORES)) {
				if (!db.objectStoreNames.contains(store)) {
					db.createObjectStore(store, keyPath ? { keyPath } : undefined);
				}
			}
		}
	});
}

class IdbCollection<T> implements Collection<T> {
	constructor(
		private readonly db: Promise<IDBPDatabase>,
		private readonly store: StoreName
	) {}
	async all() {
		return (await this.db).getAll(this.store) as Promise<T[]>;
	}
	async get(id: string) {
		return (await this.db).get(this.store, id) as Promise<T | undefined>;
	}
	async put(v: T) {
		await (await this.db).put(this.store, v);
	}
	async putMany(vs: T[]) {
		const tx = (await this.db).transaction(this.store, 'readwrite');
		await Promise.all([...vs.map((v) => tx.store.put(v)), tx.done]);
	}
	async delete(id: string) {
		await (await this.db).delete(this.store, id);
	}
	async clear() {
		await (await this.db).clear(this.store);
	}
}

class IdbUser implements UserRepository {
	constructor(private readonly db: Promise<IDBPDatabase>) {}
	async getSettings(): Promise<Settings> {
		const s = (await (await this.db).get('kv', 'settings')) as Partial<Settings> | undefined;
		return { ...DEFAULT_SETTINGS, ...s };
	}
	async saveSettings(s: Settings) {
		await (await this.db).put('kv', { ...s }, 'settings');
	}
	async getFlag(k: string) {
		return (await (await this.db).get('kv', 'flag:' + k)) as string | undefined;
	}
	async setFlag(k: string, v: string) {
		await (await this.db).put('kv', v, 'flag:' + k);
	}
}

class IdbMedia implements MediaRepository {
	constructor(private readonly db: Promise<IDBPDatabase>) {}
	async put(blob: Blob, id = crypto.randomUUID()) {
		await (await this.db).put('media', blob, id);
		return id;
	}
	async get(id: string) {
		return (await (await this.db).get('media', id)) as Blob | undefined;
	}
	async delete(id: string) {
		await (await this.db).delete('media', id);
	}
}

export function createIdbRepositories(name?: string): Repositories {
	const db = open(name);
	return {
		categories: new IdbCollection(db, 'categories'),
		items: new IdbCollection(db, 'items'),
		progress: new IdbCollection(db, 'progress'),
		sessions: {
			sessions: new IdbCollection(db, 'sessions'),
			items: new IdbCollection(db, 'sessionItems')
		},
		user: new IdbUser(db),
		media: new IdbMedia(db)
	};
}
