import type {
	Category,
	LearningItem,
	LearningProgress,
	Session,
	SessionItem
} from '$lib/domain/types';
import type { LearningEngine } from '$lib/engine/learning-engine';

export interface CategoryStats {
	category: Category;
	count: number;
	words: number;
	phrases: number;
	learned: number;
	pending: number;
	pct: number;
	lastPracticed?: Date;
}

export interface DayDots {
	date: Date;
	sessions: number;
	minutes: number;
}

export function startOfDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

/** Pure aggregation over repositories' data — no persistence knowledge. */
export class ProgressService {
	constructor(private readonly engine: LearningEngine) {}

	completedSessions(sessions: Session[]): Session[] {
		return sessions.filter((s) => s.itemsReviewed > 0);
	}

	today(sessions: Session[], now: Date) {
		const from = startOfDay(now).getTime();
		const todays = this.completedSessions(sessions).filter((s) => s.startedAt.getTime() >= from);
		return {
			sessions: todays.length,
			seconds: todays.reduce((a, s) => a + s.duration, 0),
			cards: todays.reduce((a, s) => a + s.itemsReviewed, 0)
		};
	}

	/** Last 7 days ending today (oldest first). */
	week(sessions: Session[], now: Date): DayDots[] {
		const done = this.completedSessions(sessions);
		const today = startOfDay(now);
		return Array.from({ length: 7 }, (_, k) => {
			const date = new Date(today);
			date.setDate(today.getDate() - (6 - k));
			const next = new Date(date);
			next.setDate(date.getDate() + 1);
			const day = done.filter((s) => s.startedAt >= date && s.startedAt < next);
			return { date, sessions: day.length, minutes: Math.round(day.reduce((a, s) => a + s.duration, 0) / 60) };
		});
	}

	totals(sessions: Session[], sessionItems: SessionItem[], items: LearningItem[], progress: Map<string, LearningProgress>, now: Date) {
		const done = this.completedSessions(sessions);
		const learned = (t: 'word' | 'phrase') => items.filter((i) => i.type === t && this.engine.isLearned(progress.get(i.id))).length;
		const practiced = (t: 'word' | 'phrase') => new Set(sessionItems.filter((s) => s.itemType === t).map((s) => s.learningItemId)).size;
		return {
			sessions: done.length,
			seconds: done.reduce((a, s) => a + s.duration, 0),
			words: items.filter((i) => i.type === 'word').length,
			phrases: items.filter((i) => i.type === 'phrase').length,
			wordsLearned: learned('word'),
			phrasesLearned: learned('phrase'),
			wordsPracticed: practiced('word'),
			phrasesPracticed: practiced('phrase'),
			needReview: items.filter((i) => {
				const p = progress.get(i.id);
				return !!p && (this.engine.isDue(p, now) || p.lastResult === 'not_remembered');
			}).length,
			learnedPct: items.length ? Math.round(((learned('word') + learned('phrase')) / items.length) * 100) : 0
		};
	}

	byCategory(categories: Category[], items: LearningItem[], progress: Map<string, LearningProgress>, now: Date): CategoryStats[] {
		return categories.map((category) => {
			const inCat = items.filter((i) => i.categoryId === category.id);
			const learned = inCat.filter((i) => this.engine.isLearned(progress.get(i.id))).length;
			const pending = inCat.filter((i) => {
				const p = progress.get(i.id);
				return !p || p.reviewCount === 0 || this.engine.isDue(p, now);
			}).length;
			const last = inCat
				.map((i) => progress.get(i.id)?.lastReviewedAt?.getTime() ?? 0)
				.reduce((a, b) => Math.max(a, b), 0);
			return {
				category,
				count: inCat.length,
				words: inCat.filter((i) => i.type === 'word').length,
				phrases: inCat.filter((i) => i.type === 'phrase').length,
				learned,
				pending,
				pct: inCat.length ? Math.round((learned / inCat.length) * 100) : 0,
				lastPracticed: last ? new Date(last) : undefined
			};
		});
	}
}
