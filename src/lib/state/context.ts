import { browser } from '$app/environment';
import { LearningEngine } from '$lib/engine/learning-engine';
import { createIdbRepositories } from '$lib/repositories/idb';
import { createMemoryRepositories } from '$lib/repositories/memory';
import type { Repositories } from '$lib/repositories/interfaces';
import { NoopAIService, type AIService } from '$lib/services/ai';
import { AudioService } from '$lib/services/audio';
import { ContentService } from '$lib/services/content';
import { RuleBasedContentAnalysis, type ContentAnalysisService } from '$lib/services/content-analysis';
import { ProgressService } from '$lib/services/progress';
import { WebSpeechRecognitionService, type SpeechRecognitionService } from '$lib/services/speech-recognition';

/**
 * Composition root: the only place that knows concrete implementations.
 * Swap IndexedDB for a remote API, or Noop AI for a real provider, here.
 */
export interface AppServices {
	repos: Repositories;
	engine: LearningEngine;
	content: ContentService;
	progress: ProgressService;
	audio: AudioService;
	speech: SpeechRecognitionService;
	analysis: ContentAnalysisService;
	ai: AIService;
}

let services: AppServices | undefined;

export function createServices(repos: Repositories): AppServices {
	const engine = new LearningEngine();
	return {
		repos,
		engine,
		content: new ContentService(repos),
		progress: new ProgressService(engine),
		audio: new AudioService(repos.media),
		speech: new WebSpeechRecognitionService(),
		analysis: new RuleBasedContentAnalysis(),
		ai: new NoopAIService()
	};
}

export function getServices(): AppServices {
	if (!services) {
		const repos = browser && 'indexedDB' in globalThis ? createIdbRepositories() : createMemoryRepositories();
		services = createServices(repos);
	}
	return services;
}

/** Test hook. */
export function setServices(s: AppServices): void {
	services = s;
}
