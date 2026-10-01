import type { LearningProgress, ReviewResult } from '$lib/domain/types';

/**
 * Replaceable scheduling strategy. The LearningEngine only talks to this
 * interface, so an SM-2/FSRS implementation can be dropped in later.
 */
export interface ReviewScheduler {
	initial(itemId: string): LearningProgress;
	review(progress: LearningProgress, result: ReviewResult, now: Date): LearningProgress;
	isDue(progress: LearningProgress, now: Date): boolean;
	/** Level at which an item counts as "learned". */
	readonly learnedLevel: number;
	readonly maxLevel: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Interval after reaching each level (index = level). */
export const INTERVALS = [0, 1 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY] as const;
export const RETRY_DELAY = 10 * MIN;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Simple Leitner-like scheduler:
 * - remembered → level +1, longer interval, difficulty eases
 * - not remembered → level −2, retry in 10 min, difficulty grows
 */
export class SimpleScheduler implements ReviewScheduler {
	readonly maxLevel = INTERVALS.length - 1;
	readonly learnedLevel = 2;

	initial(itemId: string): LearningProgress {
		return {
			itemId,
			level: 0,
			mastery: 0,
			difficulty: 0.3,
			reviewCount: 0,
			correctCount: 0,
			incorrectCount: 0
		};
	}

	review(p: LearningProgress, result: ReviewResult, now: Date): LearningProgress {
		const ok = result === 'remembered';
		const level = ok ? Math.min(p.level + 1, this.maxLevel) : Math.max(p.level - 2, 0);
		const difficulty = clamp(ok ? p.difficulty - 0.05 : p.difficulty + 0.15, 0, 1);
		// Harder items come back a bit sooner.
		const interval = ok ? (INTERVALS[level] ?? 0) * (1.15 - difficulty * 0.3) : RETRY_DELAY;
		return {
			...p,
			level,
			mastery: level / this.maxLevel,
			difficulty,
			reviewCount: p.reviewCount + 1,
			correctCount: p.correctCount + (ok ? 1 : 0),
			incorrectCount: p.incorrectCount + (ok ? 0 : 1),
			lastResult: result,
			lastReviewedAt: now,
			nextReviewAt: new Date(now.getTime() + interval),
			learnedAt: p.learnedAt ?? (ok && level >= this.learnedLevel ? now : undefined)
		};
	}

	isDue(p: LearningProgress, now: Date): boolean {
		return p.reviewCount > 0 && (!p.nextReviewAt || p.nextReviewAt.getTime() <= now.getTime());
	}
}

/** Map internal level to the 0..3 dots shown in the UI. */
export function masteryDots(p: LearningProgress | undefined, maxLevel = INTERVALS.length - 1): number {
	if (!p || p.reviewCount === 0) return -1;
	return Math.round((p.level / maxLevel) * 3);
}
