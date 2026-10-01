import type { LearningItem, ItemType } from '$lib/domain/types';

let n = 0;
export function item(categoryId: string, type: ItemType = 'word', german?: string): LearningItem {
	n++;
	return {
		id: `i${n}`,
		type,
		german: german ?? `${type}-${n}`,
		categoryId,
		createdAt: new Date(0),
		updatedAt: new Date(0)
	};
}

/** Deterministic PRNG for route jitter. */
export function seeded(seed = 1) {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return (s - 1) / 2147483646;
	};
}
