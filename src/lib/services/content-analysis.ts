import type { ItemType, LearningItem } from '$lib/domain/types';

export interface ContentAnalysis {
	type: ItemType;
	/** Suggested category name (may not exist yet). */
	categoryName: string;
	translation?: string;
	alt?: string;
	context?: string;
}

/**
 * Analyses new German content. The default implementation uses simple rules
 * and the existing vocabulary; an AI-backed implementation can replace it.
 */
export interface ContentAnalysisService {
	analyze(text: string, known: LearningItem[], categoryName: (id: string) => string | undefined): Promise<ContentAnalysis>;
}

export function isPhraseText(text: string): boolean {
	const t = text.trim();
	return /[.?!]$/.test(t) || t.split(/\s+/).length > 3;
}

const RULES: [RegExp, string][] = [
	[/morgen|besprech|termin|meeting|chef|büro|frist|kolleg|arbeit|projekt|kund/i, 'Arbeit'],
	[/kauf|zahl|preis|karte|laden|sackerl|tüte|kassa|kasse|angebot/i, 'Einkaufen'],
	[/essen|rechnung|tisch|kellner|bestell|trink|speise|jause/i, 'Restaurant'],
	[/bus|zug|bahn|fahr|ticket|halte|flug|stau|u-bahn|straßenbahn/i, 'Verkehr'],
	[/mutter|vater|kind|bruder|schwester|oma|opa|eltern|familie|onkel|tante/i, 'Familie'],
	[/arzt|krank|schmerz|apotheke|kopf|fieber|gesund|schwindel/i, 'Gesundheit'],
	[/wochenende|urlaub|kino|spiel|sport|ausflug|freizeit|lust/i, 'Freizeit']
];

export function suggestCategory(text: string): string {
	for (const [re, name] of RULES) if (re.test(text)) return name;
	return 'Alltag';
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[.!?¿¡,]/g, '');

export class RuleBasedContentAnalysis implements ContentAnalysisService {
	async analyze(text: string, known: LearningItem[], categoryName: (id: string) => string | undefined): Promise<ContentAnalysis> {
		const match = known.find((i) => norm(i.german) === norm(text));
		const type: ItemType = isPhraseText(text) ? 'phrase' : 'word';
		if (match) {
			return {
				type,
				categoryName: categoryName(match.categoryId) ?? suggestCategory(text),
				translation: match.translation,
				alt: match.alt,
				context: match.context
			};
		}
		return { type, categoryName: suggestCategory(text) };
	}
}
