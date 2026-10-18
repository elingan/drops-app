import type { Category, ItemType, LearningItem } from '$lib/domain/types';
import type { Repositories } from '$lib/repositories/interfaces';
import { loadVocabulary, SEED_CATEGORIES, SEED_ITEMS, SEED_VERSION, type SeedItem } from '$lib/data/seed';
import { CategoryService } from './category';
import { isPhraseText } from './content-analysis';
import type { ImportRow } from './importer';

export interface ItemInput {
	german: string;
	translation?: string;
	alt?: string;
	context?: string;
	categoryId: string;
	type?: ItemType;
	imageId?: string | null;
	nativeAudioId?: string | null;
}

const typed = (s: SeedItem): ImportRow => ({ ...s, type: s.type ?? (isPhraseText(s.german) ? 'phrase' : 'word') });

const trimOrUndef = (s: string | undefined, max: number) => {
	const t = s?.trim();
	return t ? t.slice(0, max) : undefined;
};

/** Case/punctuation-insensitive comparison used to avoid duplicate entries. */
export function sameText(a: string, b: string): boolean {
	const n = (s: string) => s.trim().toLowerCase().replace(/[.!?¿¡,;:]+/g, '').replace(/\s+/g, ' ');
	return n(a) === n(b);
}

export class ContentService {
	readonly categories: CategoryService;

	constructor(private readonly repos: Repositories) {
		this.categories = new CategoryService(repos.categories);
	}

	/**
	 * Installs the built-in content on first run and upgrades it when
	 * SEED_VERSION grows: missing categories and items are added, existing
	 * items (and their progress) are left alone. Returns items added.
	 */
	async seedIfEmpty(): Promise<number> {
		const version = Number((await this.repos.user.getFlag('seedVersion')) ?? ((await this.repos.user.getFlag('seeded')) ? 1 : 0));
		if (version >= SEED_VERSION) return 0;
		const existing = await this.categories.list();
		const now = Date.now();
		const missing = SEED_CATEGORIES.filter(
			(c) => !existing.some((e) => e.id === c.id || e.name.toLowerCase() === c.name.toLowerCase())
		).map((c, i) => ({ ...c, createdAt: new Date(now + i) }) satisfies Category);
		await this.repos.categories.putMany(missing);
		const vocabulary = (await loadVocabulary()).map(typed);
		const added = await this.importRows([...(version === 0 ? SEED_ITEMS.map(typed) : []), ...vocabulary], false);
		await this.enrichSeeded(vocabulary);
		await this.repos.user.setFlag('seeded', '1');
		await this.repos.user.setFlag('seedVersion', String(SEED_VERSION));
		return added;
	}

	listItems(): Promise<LearningItem[]> {
		return this.repos.items.all();
	}

	async saveItem(input: ItemInput, id?: string): Promise<LearningItem> {
		const german = input.german.trim().slice(0, 300);
		if (!german) throw new Error('empty');
		const all = await this.repos.items.all();
		if (all.some((i) => i.id !== id && sameText(i.german, german))) throw new Error('duplicate');
		const now = new Date();
		const prev = id ? await this.repos.items.get(id) : undefined;
		const item: LearningItem = {
			...(prev ?? { id: crypto.randomUUID(), createdAt: now, userCreated: true }),
			type: input.type ?? (isPhraseText(german) ? 'phrase' : 'word'),
			german,
			translation: trimOrUndef(input.translation, 300),
			alt: trimOrUndef(input.alt, 300),
			context: trimOrUndef(input.context, 500),
			categoryId: input.categoryId,
			imageId: input.imageId === null ? undefined : (input.imageId ?? prev?.imageId),
			nativeAudioId: input.nativeAudioId === null ? undefined : (input.nativeAudioId ?? prev?.nativeAudioId),
			updatedAt: now
		} as LearningItem;
		// Generated audio belongs to the text it was made from.
		if (prev && prev.german !== item.german) delete item.audioUrl;
		if (prev && prev.translation !== item.translation) delete item.translationAudioUrl;
		// Drop replaced media.
		if (prev?.imageId && prev.imageId !== item.imageId) await this.repos.media.delete(prev.imageId);
		if (prev?.nativeAudioId && prev.nativeAudioId !== item.nativeAudioId) await this.repos.media.delete(prev.nativeAudioId);
		await this.repos.items.put(item);
		return item;
	}

	async deleteItem(id: string): Promise<void> {
		const item = await this.repos.items.get(id);
		if (item?.imageId) await this.repos.media.delete(item.imageId);
		if (item?.nativeAudioId) await this.repos.media.delete(item.nativeAudioId);
		await this.repos.items.delete(id);
		await this.repos.progress.delete(id);
	}

	/** Adds validated rows; skips German texts that already exist. Returns number added. */
	async importRows(rows: ImportRow[], userCreated = false): Promise<number> {
		const cats = await this.categories.list();
		const existing = new Set((await this.repos.items.all()).map((i) => i.german.trim().toLowerCase()));
		const now = new Date();
		const items: LearningItem[] = [];
		for (const r of rows) {
			if (existing.has(r.german.toLowerCase())) continue;
			existing.add(r.german.toLowerCase());
			const cat = await this.categories.ensure(r.category, cats);
			items.push({
				id: crypto.randomUUID(),
				type: r.type,
				german: r.german,
				translation: r.translation,
				alt: r.alt,
				context: r.context,
				example: r.example,
				exampleTranslation: r.exampleTranslation,
				audioUrl: r.audioUrl,
				translationAudioUrl: r.translationAudioUrl,
				exampleAudioUrl: r.exampleAudioUrl,
				categoryId: cat.id,
				userCreated,
				createdAt: now,
				updatedAt: now
			});
		}
		await this.repos.items.putMany(items);
		return items.length;
	}

	/**
	 * Gives the built-in items an install already has their example sentence
	 * and audio (new in the bundled dataset). Matching is by German text; items
	 * the user created or reworded are left alone, and an audio file is only
	 * linked when it was generated from the text the item still has.
	 */
	async enrichSeeded(rows: ImportRow[]): Promise<number> {
		const byGerman = new Map(rows.map((r) => [r.german.toLowerCase(), r]));
		const changed: LearningItem[] = [];
		for (const item of await this.repos.items.all()) {
			const row = byGerman.get(item.german.trim().toLowerCase());
			if (!row || item.userCreated) continue;
			const next: LearningItem = { ...item };
			if (!next.example && row.example) {
				next.example = row.example;
				next.exampleTranslation = row.exampleTranslation;
			}
			if (row.audioUrl && next.german === row.german) next.audioUrl = row.audioUrl;
			if (row.translationAudioUrl && next.translation === row.translation) next.translationAudioUrl = row.translationAudioUrl;
			if (row.exampleAudioUrl && next.example === row.example) next.exampleAudioUrl = row.exampleAudioUrl;
			if (JSON.stringify(next) !== JSON.stringify(item)) changed.push({ ...next, updatedAt: new Date() });
		}
		await this.repos.items.putMany(changed);
		return changed.length;
	}
}
