import { DEFAULT_SETTINGS, type Settings } from '$lib/domain/types';
import type { Collection, MediaRepository, Repositories, UserRepository } from './interfaces';

/** In-memory implementation, used by tests and as a fallback when IndexedDB is unavailable. */
export class MemoryCollection<T> implements Collection<T> {
	private map = new Map<string, T>();
	constructor(private readonly key: (v: T) => string) {}
	async all() {
		return [...this.map.values()].map((v) => structuredClone(v));
	}
	async get(id: string) {
		const v = this.map.get(id);
		return v === undefined ? undefined : structuredClone(v);
	}
	async put(v: T) {
		this.map.set(this.key(v), structuredClone(v));
	}
	async putMany(vs: T[]) {
		for (const v of vs) await this.put(v);
	}
	async delete(id: string) {
		this.map.delete(id);
	}
	async clear() {
		this.map.clear();
	}
}

class MemoryUser implements UserRepository {
	private settings: Settings = { ...DEFAULT_SETTINGS };
	private flags = new Map<string, string>();
	async getSettings() {
		return { ...this.settings };
	}
	async saveSettings(s: Settings) {
		this.settings = { ...s };
	}
	async getFlag(k: string) {
		return this.flags.get(k);
	}
	async setFlag(k: string, v: string) {
		this.flags.set(k, v);
	}
}

class MemoryMedia implements MediaRepository {
	private map = new Map<string, Blob>();
	async put(blob: Blob, id = crypto.randomUUID()) {
		this.map.set(id, blob);
		return id;
	}
	async get(id: string) {
		return this.map.get(id);
	}
	async delete(id: string) {
		this.map.delete(id);
	}
}

export function createMemoryRepositories(): Repositories {
	return {
		categories: new MemoryCollection((c) => c.id),
		items: new MemoryCollection((i) => i.id),
		progress: new MemoryCollection((p) => p.itemId),
		sessions: {
			sessions: new MemoryCollection((s) => s.id),
			items: new MemoryCollection((s) => s.id)
		},
		user: new MemoryUser(),
		media: new MemoryMedia()
	};
}
