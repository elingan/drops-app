import { describe, expect, it } from 'vitest';
import { createMemoryRepositories } from '$lib/repositories/memory';
import { ContentService } from './content';

describe('ContentService', () => {
	it('seeds once and new items get categories', async () => {
		const repos = createMemoryRepositories();
		const svc = new ContentService(repos);
		expect(await svc.seedIfEmpty()).toBeGreaterThan(1000);
		expect(await svc.seedIfEmpty()).toBe(0);
		const items = await svc.listItems();
		expect(items.filter((i) => i.type === 'phrase').length).toBeGreaterThan(250);
		const cats = (await svc.categories.list()).map((c) => c.name);
		expect(cats).toEqual(expect.arrayContaining(['Korrespondenz', 'Behörden', 'Wohnen', 'Finanzen', 'Technik']));
		const added = await svc.importRows([{ type: 'word', german: 'das Einhorn', category: 'Reisen' }]);
		expect(added).toBe(1);
		expect((await svc.categories.list()).some((c) => c.name === 'Reisen')).toBe(true);
	});

	it('upgrades an existing v1 install without touching progress or user items', async () => {
		const repos = createMemoryRepositories();
		const svc = new ContentService(repos);
		// Simulate the original install: v1 flag, a user item with progress.
		await repos.user.setFlag('seeded', '1');
		await repos.categories.put({ id: 'alltag', name: 'Alltag', tone: 0, createdAt: new Date(0) });
		const mine = await svc.saveItem({ german: 'Servus!', categoryId: 'alltag' });
		const progress = { itemId: mine.id, level: 3, mastery: 0.5, difficulty: 0.2, reviewCount: 4, correctCount: 4, incorrectCount: 0 };
		await repos.progress.put(progress);
		const added = await svc.seedIfEmpty();
		expect(added).toBeGreaterThan(1000);
		expect(await repos.progress.get(mine.id)).toEqual(progress);
		const servus = (await svc.listItems()).filter((i) => i.german.toLowerCase().startsWith('servus'));
		expect(servus.map((i) => i.german)).toContain('Servus!');
		const cats = await svc.categories.list();
		expect(cats.filter((c) => c.name === 'Alltag')).toHaveLength(1);
		expect(await svc.seedIfEmpty()).toBe(0);
	});

	it('saves, edits and deletes items with their progress', async () => {
		const repos = createMemoryRepositories();
		const svc = new ContentService(repos);
		const it1 = await svc.saveItem({ german: '  Das können wir morgen besprechen. ', categoryId: 'arbeit' });
		expect(it1.type).toBe('phrase');
		expect(it1.german).toBe('Das können wir morgen besprechen.');
		const it2 = await svc.saveItem({ german: 'besprechen', categoryId: 'arbeit', translation: 'hablar' }, it1.id);
		expect(it2.id).toBe(it1.id);
		expect(it2.type).toBe('word');
		await repos.progress.put({ itemId: it1.id, level: 1, mastery: 0.2, difficulty: 0.3, reviewCount: 1, correctCount: 1, incorrectCount: 0 });
		await expect(svc.saveItem({ german: 'Besprechen!', categoryId: 'alltag' })).rejects.toThrow('duplicate');
		await svc.deleteItem(it1.id);
		expect(await repos.items.get(it1.id)).toBeUndefined();
		expect(await repos.progress.get(it1.id)).toBeUndefined();
	});
});
