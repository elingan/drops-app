import type {
	Category,
	LearningItem,
	LearningProgress,
	Session,
	SessionItem,
	Settings
} from '$lib/domain/types';

/**
 * Minimal key/value collection contract. Every repository is one of these,
 * so the engine and services never depend on a concrete database
 * (IndexedDB today; SQLite/Postgres/Supabase later).
 */
export interface Collection<T> {
	all(): Promise<T[]>;
	get(id: string): Promise<T | undefined>;
	put(value: T): Promise<void>;
	putMany(values: T[]): Promise<void>;
	delete(id: string): Promise<void>;
	clear(): Promise<void>;
}

export type CategoryRepository = Collection<Category>;
export type LearningRepository = Collection<LearningItem>;
/** Keyed by itemId. */
export type ProgressRepository = Collection<LearningProgress>;

export interface SessionRepository {
	sessions: Collection<Session>;
	items: Collection<SessionItem>;
}

export interface UserRepository {
	getSettings(): Promise<Settings>;
	saveSettings(settings: Settings): Promise<void>;
	getFlag(key: string): Promise<string | undefined>;
	setFlag(key: string, value: string): Promise<void>;
}

/** Binary media (photos, recorded pronunciations). */
export interface MediaRepository {
	put(blob: Blob, id?: string): Promise<string>;
	get(id: string): Promise<Blob | undefined>;
	delete(id: string): Promise<void>;
}

export interface Repositories {
	categories: CategoryRepository;
	items: LearningRepository;
	progress: ProgressRepository;
	sessions: SessionRepository;
	user: UserRepository;
	media: MediaRepository;
}
