import { describe, expect, it } from 'vitest';
import { INTERVALS, RETRY_DELAY, SimpleScheduler, masteryDots } from './review-scheduler';

const s = new SimpleScheduler();
const now = new Date('2026-01-01T10:00:00Z');

describe('SimpleScheduler', () => {
	it('starts new items at level 0, not due', () => {
		const p = s.initial('a');
		expect(p.level).toBe(0);
		expect(p.mastery).toBe(0);
		expect(s.isDue(p, now)).toBe(false);
		expect(masteryDots(p)).toBe(-1);
	});

	it('remembered increases mastery and interval', () => {
		let p = s.initial('a');
		p = s.review(p, 'remembered', now);
		expect(p.level).toBe(1);
		expect(p.correctCount).toBe(1);
		const first = p.nextReviewAt!.getTime() - now.getTime();
		p = s.review(p, 'remembered', now);
		const second = p.nextReviewAt!.getTime() - now.getTime();
		expect(p.level).toBe(2);
		expect(p.mastery).toBeGreaterThan(0);
		expect(second).toBeGreaterThan(first);
		expect(second).toBeGreaterThan(INTERVALS[1]);
		expect(p.learnedAt).toEqual(now);
	});

	it('not remembered lowers mastery and schedules a quick retry', () => {
		let p = s.initial('a');
		for (let i = 0; i < 4; i++) p = s.review(p, 'remembered', now);
		const before = p;
		p = s.review(p, 'not_remembered', now);
		expect(p.level).toBe(before.level - 2);
		expect(p.mastery).toBeLessThan(before.mastery);
		expect(p.difficulty).toBeGreaterThan(before.difficulty);
		expect(p.incorrectCount).toBe(1);
		expect(p.nextReviewAt!.getTime() - now.getTime()).toBe(RETRY_DELAY);
	});

	it('never goes below 0 or above max', () => {
		let p = s.initial('a');
		p = s.review(p, 'not_remembered', now);
		expect(p.level).toBe(0);
		for (let i = 0; i < 20; i++) p = s.review(p, 'remembered', now);
		expect(p.level).toBe(s.maxLevel);
		expect(p.mastery).toBe(1);
		expect(masteryDots(p)).toBe(3);
	});

	it('is due once nextReviewAt has passed', () => {
		const p = s.review(s.initial('a'), 'remembered', now);
		expect(s.isDue(p, now)).toBe(false);
		expect(s.isDue(p, new Date(now.getTime() + INTERVALS[1] * 2))).toBe(true);
	});
});
