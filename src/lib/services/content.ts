import type { Category, ItemType, LearningItem } from '$lib/domain/types';
import type { Repositories } from '$lib/repositories/interfaces';
import { SEED_CATEGORIES, SEED_ITEMS } from '$lib/data/seed';
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

const trimOrUndef = (s: string | undefined, max: number) => {
	const t = s?.trim();
	return t ? t.slice(0, max) : undefined;
};

export class ContentService {
	readonly categories: CategoryService;

	constructor(private readonly repos: Repositories) {
		this.categories = new CategoryService(repos.categories);
	}

	/** Loads the dev dataset the first time the app runs. */
	async seedIfEmpty(): Promise<boolean> {
		if (await this.repos.user.getFlag('seeded')) return false;
		const now = Date.now();
		const cats: Category[] = SEED_CATEGORIES.map((c, i) => ({ ...c, createdAt: new Date(now + i) }));
		await this.repos.categories.putMany(cats);
		await this.importRows(
			SEED_ITEMS.map((s) => ({ ...s, type: s.type ?? (isPhraseText(s.german) ? 'phrase' : 'word') })),
			false
		);
		await this.repos.user.setFlag('seeded', '1');
		return true;
	}

	listItems(): Promise<LearningItem[]> {
		return this.repos.items.all();
	}

	async saveItem(input: ItemInput, id?: string): Promise<LearningItem> {
		const german = input.german.trim().slice(0, 300);
		if (!german) throw new Error('empty');
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
		const existing = new Set((await this.repos.items.all()).map((i) => i.german.toLowerCase()));
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
				categoryId: cat.id,
				userCreated,
				createdAt: now,
				updatedAt: now
			});
		}
		await this.repos.items.putMany(items);
		return items.length;
	}
}
