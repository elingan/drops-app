/**
 * Parser for the editable vocabulary source (data/vocabulary/*.txt), one line per entry:
 *
 *   tipo|alemán|traducción|alt|contexto[|ejemplo|traducción del ejemplo]
 *
 * `ejemplo` and its translation go together and are written for words only.
 * Plain relative imports only: scripts/build-vocabulary.ts runs this under Node.
 */
export interface SourceRow {
	type: 'word' | 'phrase';
	german: string;
	translation: string;
	alt?: string;
	context?: string;
	example?: string;
	exampleTranslation?: string;
	category: string;
}

export interface SourceFile {
	name: string;
	text: string;
}

export interface SourceResult {
	rows: SourceRow[];
	/** Duplicated German entries folded into the first one. */
	merged: number;
}

/**
 * Duplicated German entries are merged (first category wins, translations are
 * combined when they differ). Throws on a malformed line, naming file and line.
 */
export function parseVocabularySource(files: SourceFile[]): SourceResult {
	const rows: SourceRow[] = [];
	const byKey = new Map<string, SourceRow>();
	let merged = 0;

	for (const { name, text } of files) {
		let category = '';
		text.split(/\r?\n/).forEach((raw, i) => {
			const line = raw.trim();
			if (!line) return;
			if (line.startsWith('#')) return void (category = line.slice(1).trim());
			const parts = line.split('|').map((p) => p.trim());
			if ((parts.length !== 5 && parts.length !== 7) || !category) throw new Error(`${name}:${i + 1} invalid line: ${line}`);
			const [t, german, translation, alt, context, example, exampleTranslation] = parts as [string, string, string, string, string, string?, string?];
			if ((t !== 'w' && t !== 'p') || !german || !translation) throw new Error(`${name}:${i + 1} invalid entry`);
			if (!!example !== !!exampleTranslation) throw new Error(`${name}:${i + 1} example and its translation go together`);
			if (example && t !== 'w') throw new Error(`${name}:${i + 1} only words take an example`);
			const key = german.toLowerCase();
			const prev = byKey.get(key);
			if (prev) {
				merged++;
				// Add only meanings that are not there yet.
				const have = new Set(prev.translation.split(/[;,]/).map((t) => t.trim().toLowerCase()));
				const extra = translation.split(/[;,]/).map((t) => t.trim()).filter((t) => t && !have.has(t.toLowerCase()));
				if (extra.length) prev.translation += '; ' + extra.join(', ');
				if (example && !prev.example) Object.assign(prev, { example, exampleTranslation });
				return;
			}
			const row: SourceRow = { type: t === 'w' ? 'word' : 'phrase', german, translation, category };
			if (alt) row.alt = alt;
			if (context) row.context = context;
			if (example) Object.assign(row, { example, exampleTranslation });
			byKey.set(key, row);
			rows.push(row);
		});
	}
	return { rows, merged };
}
