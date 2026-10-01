import { describe, expect, it } from 'vitest';
import type { LearningItem, LearningProgress } from '$lib/domain/types';
import { LearningEngine } from './learning-engine';
import { item, seeded } from './fixtures.test-helpers';

const engine = new LearningEngine();
const now = new Date('2026-03-10T08:00:00Z');
const DAY = 86_400_000;

function maxRun<T>(xs: T[]): number {
	let best = 0;
	let run = 0;
	for (let i = 0; i < xs.length; i++) {
		run = i > 0 && xs[i] === xs[i - 1] ? run + 1 : 1;
		best = Math.max(best, run);
	}
	return best;
}

function library(): LearningItem[] {
	const cats = ['alltag', 'arbeit', 'familie', 'einkaufen', 'verkehr'];
	const out: LearningItem[] = [];
	for (const c of cats) {
		for (let i = 0; i < 12; i++) out.push(item(c, i % 3 === 0 ? 'phrase' : 'word'));
	}
	// One category much bigger than the rest.
	for (let i = 0; i < 50; i++) out.push(item('alltag'));
	return out;
}

describe('calculatePriority', () => {
	it('ranks due > new > not-due', () => {
		const fresh = engine.scheduler.initial('n');
		const due: LearningProgress = { ...engine.recordResult(engine.scheduler.initial('d'), 'remembered', new Date(now.getTime() - 2 * DAY)) };
		const notDue = engine.recordResult(engine.recordResult(engine.scheduler.initial('x'), 'remembered', now), 'remembered', now);
		const pDue = engine.calculatePriority(due, now);
		const pNew = engine.calculatePriority(fresh, now);
		const pNot = engine.calculatePriority(notDue, now);
		expect(pNew.reason).toBe('new');
		expect(pDue.priority).toBeGreaterThan(pNew.priority);
		expect(pNew.priority).toBeGreaterThan(pNot.priority);
	});

	it('boosts forgotten and low-accuracy items', () => {
		const base = engine.recordResult(engine.scheduler.initial('a'), 'remembered', new Date(now.getTime() - 3 * DAY));
		const forgotten = engine.recordResult(base, 'not_remembered', new Date(now.getTime() - DAY));
		const info = engine.calculatePriority(forgotten, now);
		expect(info.reason).toBe('forgotten');
		expect(info.priority).toBeGreaterThan(engine.calculatePriority(base, now).priority);
	});

	it('labels repeatedly failed items as difficult', () => {
		let p = engine.scheduler.initial('a');
		const old = new Date(now.getTime() - 10 * DAY);
		for (let i = 0; i < 3; i++) p = engine.recordResult(p, 'not_remembered', old);
		expect(engine.reasonFor(p, now)).toBe('difficult');
	});
});

describe('generateLearningRoute', () => {
	it('first session: balanced across categories, no long runs, mixes types', () => {
		const items = library();
		const byId = new Map(items.map((i) => [i.id, i]));
		const route = engine.generateLearningRoute(items, new Map(), { now, size: 30, maxNew: 30, random: seeded(3) });
		expect(route.entries).toHaveLength(30);
		const cats = route.entries.map((e) => byId.get(e.itemId)!.categoryId);
		expect(maxRun(cats)).toBe(1);
		expect(new Set(cats).size).toBeGreaterThanOrEqual(4);
		const alltagShare = cats.filter((c) => c === 'alltag').length / cats.length;
		expect(alltagShare).toBeLessThan(0.5);
		const types = route.entries.map((e) => byId.get(e.itemId)!.type);
		expect(types).toContain('phrase');
		expect(types).toContain('word');
		expect(new Set(route.entries.map((e) => e.itemId)).size).toBe(30);
	});

	it('caps new cards and puts due cards first', () => {
		const items = library();
		const progress = new Map<string, LearningProgress>();
		const past = new Date(now.getTime() - 5 * DAY);
		for (const it of items.slice(0, 10)) {
			progress.set(it.id, engine.recordResult(engine.scheduler.initial(it.id), 'remembered', past));
		}
		const route = engine.generateLearningRoute(items, progress, { now, size: 20, random: seeded(1) });
		const reasons = route.entries.map((e) => e.reason);
		expect(reasons.filter((r) => r === 'new').length).toBeLessThanOrEqual(12);
		const dueIds = new Set(items.slice(0, 10).map((i) => i.id));
		expect(route.entries.filter((e) => dueIds.has(e.itemId))).toHaveLength(10);
	});

	it('filters by category', () => {
		const items = library();
		const route = engine.generateLearningRoute(items, new Map(), { now, categoryId: 'verkehr', random: seeded(2) });
		expect(route.entries.length).toBe(12);
		const byId = new Map(items.map((i) => [i.id, i]));
		expect(route.entries.every((e) => byId.get(e.itemId)!.categoryId === 'verkehr')).toBe(true);
	});

	it('avoids starting with a given card', () => {
		const items = library().slice(0, 3);
		const route = engine.generateLearningRoute(items, new Map(), { now, avoidFirst: items[0]!.id, random: () => 0 });
		expect(route.entries[0]!.itemId).not.toBe(items[0]!.id);
	});

	it('handles empty content', () => {
		expect(engine.generateLearningRoute([], new Map(), { now }).entries).toEqual([]);
	});

	it('preview counts reasons', () => {
		const route = { createdAt: now, entries: [
			{ itemId: 'a', reason: 'new' as const },
			{ itemId: 'b', reason: 'forgotten' as const },
			{ itemId: 'c', reason: 'review' as const }
		] };
		expect(engine.routePreview(route)).toEqual({ new: 1, difficult: 1, review: 1 });
	});
});
