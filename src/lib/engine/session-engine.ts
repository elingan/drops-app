import type {
	ItemType,
	ReviewResult,
	RouteEntry,
	Session,
	SessionItem
} from '$lib/domain/types';
import { SESSION_SECONDS } from '$lib/domain/types';

/** A failed card comes back this many positions later. */
export const REINSERT_OFFSET = 4;

export interface CardMeta {
	categoryId: string;
	itemType: ItemType;
}

export interface SessionSummary {
	session: Session;
	categoryIds: string[];
	toReview: string[];
}

/**
 * Framework-agnostic session controller: queue, timing and results.
 * Time is fed in via tick() so tests can drive it with a fake clock.
 */
export class SessionEngine {
	readonly session: Session;
	private queue: RouteEntry[] = [];
	private pos = 0;
	private shownAt: Date;
	readonly results: SessionItem[] = [];

	constructor(
		route: RouteEntry[],
		private readonly meta: (itemId: string) => CardMeta | undefined,
		private readonly refill: (avoidFirst: string | undefined) => RouteEntry[],
		now: Date,
		opts: { id?: string; targetDuration?: number; categoryId?: string } = {}
	) {
		this.queue = [...route];
		this.shownAt = now;
		this.session = {
			id: opts.id ?? crypto.randomUUID(),
			startedAt: now,
			duration: 0,
			targetDuration: opts.targetDuration ?? SESSION_SECONDS,
			itemsReviewed: 0,
			remembered: 0,
			notRemembered: 0,
			completed: false,
			categoryId: opts.categoryId
		};
		if (this.queue.length === 0) this.queue.push(...this.refill(undefined));
	}

	get elapsed(): number {
		return this.session.duration;
	}

	get remaining(): number {
		return Math.max(0, this.session.targetDuration - this.session.duration);
	}

	get isTimeUp(): boolean {
		return this.session.duration >= this.session.targetDuration;
	}

	get position(): number {
		return this.pos;
	}

	get isEmpty(): boolean {
		return this.queue.length === 0;
	}

	/** Advance active study time (pauses simply don't call this). */
	tick(seconds: number): void {
		if (this.session.completed) return;
		this.session.duration = Math.min(this.session.targetDuration, this.session.duration + seconds);
	}

	getCurrentCard(): RouteEntry | undefined {
		return this.queue[this.pos];
	}

	/** Marks when the current card became visible (for response time). */
	markShown(now: Date): void {
		this.shownAt = now;
	}

	submitResult(result: ReviewResult, now: Date): SessionItem | undefined {
		const entry = this.getCurrentCard();
		if (!entry || this.session.completed) return undefined;
		const meta = this.meta(entry.itemId);
		const record: SessionItem = {
			id: crypto.randomUUID(),
			sessionId: this.session.id,
			learningItemId: entry.itemId,
			categoryId: meta?.categoryId ?? '',
			itemType: meta?.itemType ?? 'word',
			shownAt: this.shownAt,
			answeredAt: now,
			result,
			responseTime: Math.max(0, now.getTime() - this.shownAt.getTime())
		};
		this.results.push(record);
		this.session.itemsReviewed++;
		if (result === 'remembered') this.session.remembered++;
		else {
			this.session.notRemembered++;
			const at = Math.min(this.pos + 1 + REINSERT_OFFSET, this.queue.length);
			this.queue.splice(at, 0, { itemId: entry.itemId, reason: 'forgotten' });
		}
		return record;
	}

	/** Moves to the next card, refilling the route when it runs out. */
	nextCard(): RouteEntry | undefined {
		const last = this.getCurrentCard()?.itemId;
		this.pos++;
		if (this.pos >= this.queue.length) {
			const more = this.refill(last);
			// Never show the same card twice in a row.
			if (more[0]?.itemId === last && more.length > 1) more.push(more.shift()!);
			this.queue.push(...more);
		}
		return this.getCurrentCard();
	}

	completeSession(now: Date): SessionSummary {
		this.session.completed = true;
		this.session.endedAt = now;
		const categoryIds = [...new Set(this.results.map((r) => r.categoryId).filter(Boolean))];
		const toReview = [
			...new Set(this.results.filter((r) => r.result === 'not_remembered').map((r) => r.learningItemId))
		];
		return { session: { ...this.session }, categoryIds, toReview };
	}
}
