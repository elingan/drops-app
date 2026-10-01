import { SvelteMap } from 'svelte/reactivity';
import {
	DEFAULT_SETTINGS,
	type Category,
	type CategoryTone,
	type LearningItem,
	type LearningProgress,
	type LearningRoute,
	type ReviewResult,
	type Session,
	type SessionItem,
	type Settings
} from '$lib/domain/types';
import type { ItemInput } from '$lib/services/content';
import { parseImport, type ImportResult } from '$lib/services/importer';
import { getServices, type AppServices } from './context';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Reactive learning data (content, progress, history, settings).
 * Business rules stay in the engine/services; this only orchestrates
 * persistence and exposes runes-based state to the UI.
 */
export class LearningState {
	status = $state<LoadStatus>('idle');
	items = $state<LearningItem[]>([]);
	categories = $state<Category[]>([]);
	progress = new SvelteMap<string, LearningProgress>();
	sessions = $state<Session[]>([]);
	sessionItems = $state<SessionItem[]>([]);
	settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	/** Bumped on every change that affects routes. */
	version = $state(0);

	itemsById = $derived(new Map(this.items.map((i) => [i.id, i])));
	categoriesById = $derived(new Map(this.categories.map((c) => [c.id, c])));

	private loading: Promise<void> | null = null;

	constructor(private readonly svc: () => AppServices = getServices) {}

	get services(): AppServices {
		return this.svc();
	}

	load(force = false): Promise<void> {
		if (this.loading && !force) return this.loading;
		this.status = 'loading';
		this.loading = (async () => {
			try {
				const { repos, content } = this.services;
				await content.seedIfEmpty();
				const [items, categories, progress, sessions, sessionItems, settings] = await Promise.all([
					repos.items.all(),
					content.categories.list(),
					repos.progress.all(),
					repos.sessions.sessions.all(),
					repos.sessions.items.all(),
					repos.user.getSettings()
				]);
				this.items = items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
				this.categories = categories;
				this.progress.clear();
				for (const p of progress) this.progress.set(p.itemId, p);
				this.sessions = sessions.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
				this.sessionItems = sessionItems;
				this.settings = settings;
				this.status = 'ready';
				this.version++;
			} catch (e) {
				console.error(e);
				this.status = 'error';
				this.loading = null;
			}
		})();
		return this.loading;
	}

	// ── Routes & results ──────────────────────────────────────────────

	route(opts: { categoryId?: string; avoidFirst?: string; size?: number } = {}): LearningRoute {
		return this.services.engine.generateLearningRoute(this.items, this.progress, { now: new Date(), ...opts });
	}

	async recordResult(itemId: string, result: ReviewResult, record: SessionItem): Promise<void> {
		const { engine, repos } = this.services;
		const updated = engine.recordResult(engine.progressFor(itemId, this.progress), result, record.answeredAt);
		this.progress.set(itemId, updated);
		this.sessionItems.push(record);
		await Promise.all([repos.progress.put(updated), repos.sessions.items.put(record)]);
	}

	async saveSession(session: Session): Promise<void> {
		const i = this.sessions.findIndex((s) => s.id === session.id);
		if (i >= 0) this.sessions[i] = session;
		else this.sessions.push(session);
		await this.services.repos.sessions.sessions.put($state.snapshot(session) as Session);
		this.version++;
	}

	// ── Content ────────────────────────────────────────────────────────

	async saveItem(input: ItemInput, id?: string): Promise<LearningItem> {
		const item = await this.services.content.saveItem(input, id);
		const i = this.items.findIndex((x) => x.id === item.id);
		if (i >= 0) this.items[i] = item;
		else this.items.push(item);
		this.version++;
		return item;
	}

	async deleteItem(id: string): Promise<void> {
		await this.services.content.deleteItem(id);
		this.items = this.items.filter((i) => i.id !== id);
		this.progress.delete(id);
		this.version++;
	}

	async createCategory(name: string, tone: CategoryTone): Promise<Category> {
		const cat = await this.services.content.categories.create(name, tone, this.categories);
		this.categories.push(cat);
		return cat;
	}

	async importText(fileName: string, text: string): Promise<ImportResult & { added: number }> {
		const result = parseImport(fileName, text);
		const added = result.rows.length ? await this.services.content.importRows(result.rows, true) : 0;
		if (added) await this.load(true);
		return { ...result, added };
	}

	async saveSettings(patch: Partial<Settings>): Promise<void> {
		this.settings = { ...this.settings, ...patch };
		await this.services.repos.user.saveSettings($state.snapshot(this.settings));
	}

	// ── Read helpers ────────────────────────────────────────────────────

	categoryName = (id: string): string | undefined => this.categoriesById.get(id)?.name;
}

export const learning = new LearningState();
