import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateEntries } from '../src/lib/services/importer.ts';

/**
 * Builds src/lib/data/vocabulary-at.json from data/vocabulary/*.txt.
 * Duplicated German entries are merged (first category wins, translations
 * are combined when they differ). Output is validated with the app importer.
 */
interface Row {
	type: 'word' | 'phrase';
	german: string;
	translation: string;
	alt?: string;
	context?: string;
	category: string;
}

const dir = 'data/vocabulary';
const rows: Row[] = [];
const byKey = new Map<string, Row>();
let merged = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()) {
	let category = '';
	readFileSync(join(dir, file), 'utf8')
		.split(/\r?\n/)
		.forEach((raw, i) => {
			const line = raw.trim();
			if (!line) return;
			if (line.startsWith('#')) return void (category = line.slice(1).trim());
			const parts = line.split('|');
			if (parts.length !== 5 || !category) throw new Error(`${file}:${i + 1} invalid line: ${line}`);
			const [t, german, translation, alt, context] = parts.map((p) => p.trim()) as [string, string, string, string, string];
			if ((t !== 'w' && t !== 'p') || !german || !translation) throw new Error(`${file}:${i + 1} invalid entry`);
			const key = german.toLowerCase();
			const prev = byKey.get(key);
			if (prev) {
				merged++;
				// Add only meanings that are not there yet.
				const have = new Set(prev.translation.split(/[;,]/).map((t) => t.trim().toLowerCase()));
				const extra = translation.split(/[;,]/).map((t) => t.trim()).filter((t) => t && !have.has(t.toLowerCase()));
				if (extra.length) prev.translation += '; ' + extra.join(', ');
				return;
			}
			const row: Row = { type: t === 'w' ? 'word' : 'phrase', german, translation, category };
			if (alt) row.alt = alt;
			if (context) row.context = context;
			byKey.set(key, row);
			rows.push(row);
		});
}

const { rows: valid, errors } = validateEntries(rows);
if (errors.length) {
	console.error(errors.map((e) => `row ${e.row}: ${e.message} (${rows[e.row - 1]?.german})`).join('\n'));
	process.exit(1);
}
writeFileSync('src/lib/data/vocabulary-at.json', JSON.stringify(valid, null, '\t') + '\n');
const count = (t: string) => valid.filter((r) => r.type === t).length;
const cats = [...new Set(valid.map((r) => r.category))];
console.log(`${count('word')} words, ${count('phrase')} phrases, ${cats.length} categories (${merged} duplicates merged)`);
