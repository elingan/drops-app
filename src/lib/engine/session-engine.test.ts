import { describe, expect, it } from 'vitest';
import type { RouteEntry } from '$lib/domain/types';
import { REINSERT_OFFSET, SessionEngine } from './session-engine';

const t0 = new Date('2026-01-01T09:00:00Z');
const at = (s: number) => new Date(t0.getTime() + s * 1000);
const route = (ids: string[]): RouteEntry[] => ids.map((itemId) => ({ itemId, reason: 'new' }));
const meta = (id: string) => ({ categoryId: 'cat-' + id, itemType: 'word' as const });

function make(ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
	let refills = 0;
	const engine = new SessionEngine(route(ids), meta, () => {
		refills++;
		return route(ids);
	}, t0, { id: 's1' });
	return { engine, refills: () => refills };
}

describe('SessionEngine', () => {
	it('records results with timing and metadata', () => {
		const { engine } = make();
		engine.markShown(at(1));
		const r = engine.submitResult('remembered', at(4))!;
		expect(r).toMatchObject({ sessionId: 's1', learningItemId: 'a', categoryId: 'cat-a', result: 'remembered', responseTime: 3000 });
		expect(engine.session.remembered).toBe(1);
		expect(engine.nextCard()?.itemId).toBe('b');
	});

	it('reinserts forgotten cards a few positions later, not immediately', () => {
		const { engine } = make();
		engine.submitResult('not_remembered', at(1));
		const seq: string[] = [];
		for (let i = 0; i < REINSERT_OFFSET + 1; i++) seq.push(engine.nextCard()!.itemId);
		expect(seq[0]).not.toBe('a');
		expect(seq[REINSERT_OFFSET]).toBe('a');
		expect(engine.session.notRemembered).toBe(1);
	});

	it('refills the route when it runs out without repeating the last card', () => {
		const { engine, refills } = make(['a', 'b']);
		engine.submitResult('remembered', at(1));
		engine.nextCard();
		engine.submitResult('remembered', at(2));
		const next = engine.nextCard();
		expect(refills()).toBe(1);
		expect(next?.itemId).not.toBe('b');
	});

	it('completes after the target duration', () => {
		const { engine } = make();
		for (let i = 0; i < 599; i++) engine.tick(1);
		expect(engine.isTimeUp).toBe(false);
		expect(engine.remaining).toBe(1);
		engine.tick(5);
		expect(engine.isTimeUp).toBe(true);
		expect(engine.elapsed).toBe(600);
	});

	it('can be ended early and summarizes', () => {
		const { engine } = make();
		engine.submitResult('remembered', at(1));
		engine.nextCard();
		engine.submitResult('not_remembered', at(2));
		engine.tick(120);
		const sum = engine.completeSession(at(130));
		expect(sum.session).toMatchObject({ completed: true, itemsReviewed: 2, remembered: 1, notRemembered: 1, duration: 120 });
		expect(sum.categoryIds).toEqual(['cat-a', 'cat-b']);
		expect(sum.toReview).toEqual(['b']);
		expect(engine.submitResult('remembered', at(200))).toBeUndefined();
	});
});
