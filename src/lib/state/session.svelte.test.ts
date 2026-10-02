import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRepositories } from '$lib/repositories/memory';
import { createServices } from './context';
import { LearningState } from './learning.svelte';
import { EXIT_MS, SessionState } from './session.svelte';

async function setup() {
	const services = createServices(createMemoryRepositories());
	const data = new LearningState(() => services);
	await data.load();
	return { data, s: new SessionState(data) };
}

describe('SessionState (state machine)', () => {
	beforeEach(() => vi.useFakeTimers());

	it('runs SHOW_CARD → RECALL → REVEAL/RATING → NEXT_CARD → SHOW_CARD', async () => {
		const { data, s } = await setup();
		expect(s.phase).toBe('IDLE');
		expect(s.start({ animate: false })).toBe(true);
		expect(s.phase).toBe('WAITING_FOR_RECALL');
		const first = s.card!.item.id;
		expect(s.revealed).toBe(false);

		// Countdown (default 5 s) reveals automatically.
		s.tick(4.9);
		expect(s.phase).toBe('WAITING_FOR_RECALL');
		s.tick(0.2);
		expect(s.phase).toBe('WAITING_FOR_RATING');

		s.answer('not_remembered');
		expect(s.phase).toBe('NEXT_CARD');
		expect(s.answered).toBe(1);
		await vi.advanceTimersByTimeAsync(EXIT_MS + 50);
		expect(['SHOW_CARD', 'WAITING_FOR_RECALL']).toContain(s.phase);
		expect(s.card!.item.id).not.toBe(first);

		// Result persisted with progress + session item.
		const p = data.progress.get(first)!;
		expect(p.incorrectCount).toBe(1);
		expect(data.sessionItems).toHaveLength(1);
		expect(data.sessions[0]!.notRemembered).toBe(1);
		s.dispose();
	});

	it('ignores ratings before reveal and supports manual reveal', async () => {
		const { s } = await setup();
		s.start({ animate: false });
		s.answer('remembered');
		expect(s.answered).toBe(0);
		s.reveal();
		expect(s.revealed).toBe(true);
		s.answer('remembered');
		expect(s.answered).toBe(1);
		s.dispose();
	});

	it('pauses time and completes after 10 minutes', async () => {
		const { data, s } = await setup();
		s.start({ animate: false });
		s.pause();
		s.tick(100);
		expect(s.elapsed).toBe(0);
		s.resume();
		s.reveal();
		s.answer('remembered');
		await vi.advanceTimersByTimeAsync(EXIT_MS + 50);
		for (let i = 0; i < 700 && s.phase !== 'SESSION_COMPLETE'; i++) s.tick(1);
		// Time ran out while a card was revealed: it waits for that last rating.
		if (s.phase !== 'SESSION_COMPLETE') {
			expect(s.revealed).toBe(true);
			s.answer('remembered');
			await vi.advanceTimersByTimeAsync(EXIT_MS + 50);
		}
		expect(s.phase).toBe('SESSION_COMPLETE');
		expect(s.summary!.session.duration).toBe(600);
		expect(s.summary!.session.completed).toBe(true);
		expect(data.sessions.at(-1)!.completed).toBe(true);
	});

	it('lets the user end early and returns a summary', async () => {
		const { s } = await setup();
		s.start({ animate: false });
		s.reveal();
		s.answer('remembered');
		await vi.advanceTimersByTimeAsync(EXIT_MS + 50);
		await s.complete();
		expect(s.phase).toBe('SESSION_COMPLETE');
		expect(s.summary!.session).toMatchObject({ itemsReviewed: 1, remembered: 1 });
	});

	it('practice by category only shows that category', async () => {
		const { data, s } = await setup();
		const cat = data.categories.find((c) => c.name === 'Verkehr')!;
		s.start({ categoryId: cat.id, animate: false });
		for (let i = 0; i < 5; i++) {
			expect(s.card!.item.categoryId).toBe(cat.id);
			s.reveal();
			s.answer(i % 2 ? 'remembered' : 'not_remembered');
			await vi.advanceTimersByTimeAsync(EXIT_MS + 50);
		}
		s.dispose();
	});

	it('a new item enters the next route', async () => {
		const { data, s } = await setup();
		const cat = data.categories[0]!;
		const added = await data.saveItem({ german: 'der Leuchtturm', translation: 'el faro', categoryId: 'verkehr' });
		const ids = data.route({ size: 200, categoryId: added.categoryId }).entries.map((e) => e.itemId);
		expect(ids).toContain(added.id);
		expect(cat).toBeDefined();
		s.dispose();
	});
});
