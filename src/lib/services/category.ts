import type { Category, CategoryTone } from '$lib/domain/types';
import type { CategoryRepository } from '$lib/repositories/interfaces';

export function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.normalize('NFKD')
			.replace(/ß/g, 'ss')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'cat'
	);
}

export class CategoryService {
	constructor(private readonly repo: CategoryRepository) {}

	list(): Promise<Category[]> {
		return this.repo.all().then((cs) => cs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
	}

	async create(name: string, tone: CategoryTone, existing: Category[]): Promise<Category> {
		const clean = name.trim().slice(0, 60);
		if (!clean) throw new Error('empty_name');
		if (existing.some((c) => c.name.toLowerCase() === clean.toLowerCase())) throw new Error('duplicate');
		let id = slugify(clean);
		while (existing.some((c) => c.id === id)) id += '-1';
		const cat: Category = { id, name: clean, tone, createdAt: new Date() };
		await this.repo.put(cat);
		return cat;
	}

	/** Find by (case-insensitive) name or create it. Mutates `existing`. */
	async ensure(name: string, existing: Category[]): Promise<Category> {
		const found = existing.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
		if (found) return found;
		const cat = await this.create(name, (existing.length % 2) as CategoryTone, existing);
		existing.push(cat);
		return cat;
	}

	delete(id: string): Promise<void> {
		return this.repo.delete(id);
	}
}
