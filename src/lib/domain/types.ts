/**
 * Domain model. Content (LearningItem) is kept apart from the learner's
 * spaced-repetition state (LearningProgress) so content can be imported,
 * replaced or synced without touching progress, and vice versa.
 */

export type ItemType = 'word' | 'phrase';
export type ReviewResult = 'remembered' | 'not_remembered';
export type CategoryTone = 0 | 1; // 0 = terracotta, 1 = sage (Organic DS)

export interface User {
	id: string;
	name: string;
	email: string;
}

export interface Category {
	id: string;
	name: string;
	description?: string;
	/** Single glyph shown in the category blob; defaults to the initial. */
	icon?: string;
	tone: CategoryTone;
	createdAt: Date;
}

export interface LearningItem {
	id: string;
	type: ItemType;
	german: string;
	/** German paraphrase/synonym, shown as the main meaning after reveal. */
	alt?: string;
	/** Spanish meaning. */
	translation?: string;
	/** When/why you'd say it. */
	context?: string;
	categoryId: string;
	audioUrl?: string;
	nativeAudioUrl?: string;
	/** Media blob ids stored by MediaRepository. */
	imageId?: string;
	nativeAudioId?: string;
	/** User-added content (vs. seeded/imported). */
	userCreated?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface LearningProgress {
	itemId: string;
	/** 0..MAX_LEVEL internal repetition level. */
	level: number;
	/** 0..1 normalized mastery derived from level. */
	mastery: number;
	/** 0..1, grows with failures, decays with successes. */
	difficulty: number;
	reviewCount: number;
	correctCount: number;
	incorrectCount: number;
	lastResult?: ReviewResult;
	lastReviewedAt?: Date;
	nextReviewAt?: Date;
	/** When the item was first answered correctly at level >= 2. */
	learnedAt?: Date;
}

export interface Session {
	id: string;
	startedAt: Date;
	endedAt?: Date;
	/** Seconds actually studied (excludes pauses). */
	duration: number;
	/** Seconds. */
	targetDuration: number;
	itemsReviewed: number;
	remembered: number;
	notRemembered: number;
	completed: boolean;
	categoryId?: string;
}

export interface SessionItem {
	id: string;
	sessionId: string;
	learningItemId: string;
	categoryId: string;
	itemType: ItemType;
	shownAt: Date;
	answeredAt: Date;
	result: ReviewResult;
	/** Milliseconds from card shown to rating. */
	responseTime: number;
}

export interface AudioSource {
	kind: 'native' | 'recorded' | 'generated';
	/** URL or object URL; undefined for generated (speech synthesis). */
	url?: string;
	text: string;
	lang: string;
}

export type RouteReason = 'new' | 'review' | 'difficult' | 'forgotten' | 'mastered';

export interface RouteEntry {
	itemId: string;
	reason: RouteReason;
}

export interface LearningRoute {
	createdAt: Date;
	entries: RouteEntry[];
	categoryId?: string;
}

/** Content + progress joined for the UI. */
export interface StudyCard {
	item: LearningItem;
	progress: LearningProgress;
	category: Category;
	reason: RouteReason;
}

export type ImageTiming = 'after' | 'before';

export interface Settings {
	rememberSeconds: number;
	showSpanish: boolean;
	imageTiming: ImageTiming;
	autoPlayAudio: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	rememberSeconds: 5,
	showSpanish: true,
	imageTiming: 'after',
	autoPlayAudio: false
};

export const SESSION_SECONDS = 600;
export const DAILY_SESSION_GOAL = 2;
