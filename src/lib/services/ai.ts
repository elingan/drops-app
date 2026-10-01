import type { LearningItem, SessionItem } from '$lib/domain/types';

/**
 * Provider-agnostic AI boundary. Nothing in the UI talks to a concrete
 * provider; future implementations (e.g. a server endpoint calling an LLM)
 * plug in here. Every method may return `undefined` = "no opinion".
 */
export interface AIService {
	readonly available: boolean;
	categorize(text: string, categories: string[]): Promise<string | undefined>;
	translate(text: string, targetLang: string): Promise<string | undefined>;
	detectExpressions(text: string): Promise<string[] | undefined>;
	relatedWords(item: LearningItem): Promise<string[] | undefined>;
	analyzeMistakes(history: SessionItem[]): Promise<string | undefined>;
	suggestContent(known: LearningItem[]): Promise<Array<Pick<LearningItem, 'german' | 'translation'>> | undefined>;
}

/** Default: AI disabled. */
export class NoopAIService implements AIService {
	readonly available = false;
	async categorize() {
		return undefined;
	}
	async translate() {
		return undefined;
	}
	async detectExpressions() {
		return undefined;
	}
	async relatedWords() {
		return undefined;
	}
	async analyzeMistakes() {
		return undefined;
	}
	async suggestContent() {
		return undefined;
	}
}
