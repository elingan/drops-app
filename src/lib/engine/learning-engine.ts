import type {
	Category,
	LearningItem,
	LearningProgress,
	LearningRoute,
	ReviewResult,
	RouteEntry,
	RouteReason
} from '$lib/domain/types';
import { SimpleScheduler, type ReviewScheduler } from './review-scheduler';

const DAY = 86_400_000;
/** New items the user created outrank bundled new items (but not due reviews). */
const USER_ITEM_BOOST = 40;
/** Cards reviewed within this window are held back so a route doesn't replay them. */
const COOLDOWN = 6 * 3_600_000;
/** Extra priority for new cards from categories the learner has barely touched. */
const COVERAGE_BONUS = 10;
/** Random spread for new cards: wide enough that every route samples different ones. */
const NEW_JITTER = 14;
/** Below this priority a seen card isn't worth practising yet. */
const WORTH_REVIEWING = 15;
/** Routes shorter than this are padded with recently seen cards. */
const MIN_ROUTE = 8;

export interface PriorityInfo {
	itemId: string;
	reason: RouteReason;
	priority: number;
}

export interface RouteOptions {
	now: Date;
	/** Number of cards to plan; a 10-min session sees ~30–60. */
	size?: number;
	categoryId?: string;
	/** Upper bound on brand-new items per route. */
	maxNew?: number;
	/** Injected for deterministic tests. */
	random?: () => number;
	/** Avoid starting with this item (e.g. the card just shown). */
	avoidFirst?: string;
	/**
	 * Cards already shown in this session/playlist. They are left out as long
	 * as enough other cards exist, so refills rotate through the library.
	 */
	exclude?: ReadonlySet<string>;
}

export function accuracy(p: LearningProgress): number {
	return p.reviewCount === 0 ? 0 : p.correctCount / p.reviewCount;
}

/**
 * Central learning logic: priorities, routes and result recording.
 * Stateless apart from the scheduler, so it is trivially testable and
 * independent from persistence.
 */
export class LearningEngine {
	constructor(readonly scheduler: ReviewScheduler = new SimpleScheduler()) {}

	progressFor(itemId: string, progress: Map<string, LearningProgress>): LearningProgress {
		return progress.get(itemId) ?? this.scheduler.initial(itemId);
	}

	reasonFor(p: LearningProgress, now: Date): RouteReason {
		if (p.reviewCount === 0) return 'new';
		const recent = p.lastReviewedAt && now.getTime() - p.lastReviewedAt.getTime() < 2 * DAY;
		if (p.lastResult === 'not_remembered' && recent) return 'forgotten';
		if ((p.reviewCount >= 2 && accuracy(p) < 0.6) || p.difficulty >= 0.6) return 'difficult';
		if (p.level >= this.scheduler.maxLevel - 1 && !this.scheduler.isDue(p, now)) return 'mastered';
		return 'review';
	}

	calculatePriority(p: LearningProgress, now: Date): PriorityInfo {
		const reason = this.reasonFor(p, now);
		let priority: number;
		if (p.reviewCount === 0) {
			priority = 50;
		} else if (this.scheduler.isDue(p, now)) {
			const overdueDays = p.nextReviewAt ? (now.getTime() - p.nextReviewAt.getTime()) / DAY : 0;
			priority = 100 + Math.min(overdueDays * 5, 40);
		} else if (p.learnedAt && now.getTime() - p.learnedAt.getTime() < 3 * DAY) {
			// Recently learned: light reinforcement.
			priority = 20;
		} else {
			priority = 5 * (1 - p.mastery);
		}
		if (reason === 'forgotten') priority += 30;
		if (p.reviewCount > 0) priority += (1 - accuracy(p)) * 40 + p.difficulty * 10;
		priority -= this.cooldownPenalty(p, now);
		return { itemId: p.itemId, reason, priority };
	}

	/**
	 * Cards seen a moment ago fade out of the ranking (a failed card only
	 * partly, since it should come back soon) and return as the window passes.
	 */
	cooldownPenalty(p: LearningProgress, now: Date): number {
		if (!p.lastReviewedAt) return 0;
		const age = now.getTime() - p.lastReviewedAt.getTime();
		if (age >= COOLDOWN) return 0;
		const base = 60 * (1 - Math.max(age, 0) / COOLDOWN);
		return p.lastResult === 'not_remembered' ? base / 2 : base;
	}

	inCooldown(p: LearningProgress, now: Date): boolean {
		return !!p.lastReviewedAt && now.getTime() - p.lastReviewedAt.getTime() < COOLDOWN && !this.scheduler.isDue(p, now);
	}

	/**
	 * Builds a varied route: picks the highest-priority cards (capping new
	 * ones) and interleaves them so categories alternate and words/phrases mix.
	 */
	generateLearningRoute(
		items: LearningItem[],
		progress: Map<string, LearningProgress>,
		opts: RouteOptions
	): LearningRoute {
		const { now, size = 40, categoryId, random = Math.random, exclude } = opts;
		let pool = categoryId ? items.filter((i) => i.categoryId === categoryId) : items;
		if (pool.length === 0) return { createdAt: now, entries: [], categoryId };
		// Rotate: prefer cards not shown yet, unless that leaves almost nothing.
		if (exclude?.size) {
			const fresh = pool.filter((i) => !exclude.has(i.id));
			if (fresh.length >= Math.min(8, pool.length)) pool = fresh;
		}

		const byId = new Map(pool.map((i) => [i.id, i]));
		const coverage = this.categoryCoverage(items, progress);
		const scored = pool
			.map((i) => {
				const info = this.calculatePriority(this.progressFor(i.id, progress), now);
				if (info.reason === 'new') {
					// Words the user added themselves come before bundled new content;
					// among the rest, untouched categories and chance decide.
					if (i.userCreated) info.priority += USER_ITEM_BOOST;
					info.priority += COVERAGE_BONUS * (1 - (coverage.get(i.categoryId) ?? 0)) + random() * NEW_JITTER;
				} else {
					// Small jitter keeps equal-priority cards from always coming in the same order.
					info.priority += random() * 4;
				}
				return info;
			})
			.sort((a, b) => b.priority - a.priority);

		const dueCount = scored.filter((s) => s.priority >= 100).length;
		const maxNew = opts.maxNew ?? (dueCount > 30 ? 4 : dueCount > 15 ? 8 : 12);

		const picked = balancedPick(scored, byId, size, maxNew, WORTH_REVIEWING);
		// Top up with seen cards worth practising. Cards reviewed moments ago are
		// only used as a last resort, so the route stays short and the session
		// refill introduces fresh cards instead of replaying the same ones.
		const inCooldown = (s: PriorityInfo) => this.inCooldown(this.progressFor(s.itemId, progress), now);
		const fill = (limit: number, ok: (s: PriorityInfo) => boolean) => {
			for (const s of scored) {
				if (picked.length >= limit) return;
				if (s.reason !== 'new' && !picked.includes(s) && ok(s)) picked.push(s);
			}
		};
		fill(size, (s) => s.priority >= WORTH_REVIEWING && !inCooldown(s));
		fill(size, (s) => !inCooldown(s));
		fill(Math.min(size, MIN_ROUTE), () => true);

		const entries = interleave(picked, byId, opts.avoidFirst);
		return { createdAt: now, entries, categoryId };
	}

	recordResult(p: LearningProgress, result: ReviewResult, now: Date): LearningProgress {
		return this.scheduler.review(p, result, now);
	}

	isLearned(p: LearningProgress | undefined): boolean {
		return !!p && p.level >= this.scheduler.learnedLevel;
	}

	isDue(p: LearningProgress | undefined, now: Date): boolean {
		return !!p && this.scheduler.isDue(p, now);
	}

	/** Share of each category's cards that have been seen at least once (0..1). */
	categoryCoverage(items: LearningItem[], progress: Map<string, LearningProgress>): Map<string, number> {
		const total = new Map<string, number>();
		const seen = new Map<string, number>();
		for (const i of items) {
			total.set(i.categoryId, (total.get(i.categoryId) ?? 0) + 1);
			if ((progress.get(i.id)?.reviewCount ?? 0) > 0) seen.set(i.categoryId, (seen.get(i.categoryId) ?? 0) + 1);
		}
		return new Map([...total].map(([c, n]) => [c, (seen.get(c) ?? 0) / n]));
	}

	/** Counts used by the "Next route" tags on Home. */
	routePreview(route: LearningRoute) {
		const c = { difficult: 0, new: 0, review: 0 };
		for (const e of route.entries) {
			if (e.reason === 'new') c.new++;
			else if (e.reason === 'difficult' || e.reason === 'forgotten') c.difficult++;
			else c.review++;
		}
		return c;
	}
}

/** Per-category share penalty: keeps one big category from flooding a route. */
const CATEGORY_SHARE_PENALTY = 8;

/**
 * Picks by priority while discounting categories that already have many
 * cards in the route, and caps brand-new items.
 */
export function balancedPick(
	scored: PriorityInfo[],
	byId: Map<string, LearningItem>,
	size: number,
	maxNew: number,
	/** Seen cards ranked below this aren't worth a slot yet. */
	minSeenPriority = -Infinity
): PriorityInfo[] {
	const rest = [...scored];
	const perCat = new Map<string, number>();
	const picked: PriorityInfo[] = [];
	let newCount = 0;
	while (picked.length < size && rest.length) {
		let best = -1;
		let bestScore = -Infinity;
		for (let i = 0; i < rest.length; i++) {
			const cand = rest[i]!;
			if (cand.reason === 'new' ? newCount >= maxNew : cand.priority < minSeenPriority) continue;
			const cat = byId.get(cand.itemId)!.categoryId;
			const score = cand.priority - (perCat.get(cat) ?? 0) * CATEGORY_SHARE_PENALTY;
			if (score > bestScore) {
				bestScore = score;
				best = i;
			}
		}
		if (best < 0) break;
		const [chosen] = rest.splice(best, 1);
		const cat = byId.get(chosen!.itemId)!.categoryId;
		perCat.set(cat, (perCat.get(cat) ?? 0) + 1);
		if (chosen!.reason === 'new') newCount++;
		picked.push(chosen!);
	}
	return picked;
}

/**
 * Greedy interleave: always take the highest-priority remaining card whose
 * category differs from the previous one, and nudge word/phrase alternation.
 */
export function interleave(
	picked: PriorityInfo[],
	byId: Map<string, LearningItem>,
	avoidFirst?: string
): RouteEntry[] {
	const rest = [...picked];
	const out: RouteEntry[] = [];
	let lastCat: string | undefined;
	const lastTypes: string[] = [];

	while (rest.length) {
		let best = -1;
		let bestScore = -Infinity;
		for (let i = 0; i < rest.length; i++) {
			const cand = rest[i]!;
			const item = byId.get(cand.itemId)!;
			let score = cand.priority;
			if (out.length === 0 && cand.itemId === avoidFirst) score -= 1e6;
			if (item.categoryId === lastCat) score -= 1000;
			if (lastTypes.length >= 2 && lastTypes.every((t) => t === item.type)) score -= 25;
			if (score > bestScore) {
				bestScore = score;
				best = i;
			}
		}
		const [chosen] = rest.splice(best, 1);
		const item = byId.get(chosen!.itemId)!;
		out.push({ itemId: chosen!.itemId, reason: chosen!.reason });
		lastCat = item.categoryId;
		lastTypes.push(item.type);
		if (lastTypes.length > 2) lastTypes.shift();
	}
	return out;
}

/** Category label list for "10 min · Alltag, Arbeit +3". */
export function routeCategories(route: LearningRoute, items: Map<string, LearningItem>, categories: Map<string, Category>): string[] {
	const seen: string[] = [];
	for (const e of route.entries) {
		const cat = categories.get(items.get(e.itemId)?.categoryId ?? '');
		if (cat && !seen.includes(cat.name)) seen.push(cat.name);
	}
	return seen;
}
