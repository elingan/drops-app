import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyAudioManifest, type AudioManifest } from '../src/lib/data/audio-manifest.ts';
import { parseVocabularySource } from '../src/lib/data/vocabulary-source.ts';
import { validateEntries } from '../src/lib/services/importer.ts';

/**
 * Builds src/lib/data/vocabulary-at.json from data/vocabulary/*.txt.
 * Duplicated German entries are merged (first category wins, translations
 * are combined when they differ). Output is validated with the app importer;
 * generated audio (data/audio-manifest.json, from npm run audio:build) is linked in.
 */
const dir = 'data/vocabulary';
const manifestFile = 'data/audio-manifest.json';

const files = readdirSync(dir)
	.filter((f) => f.endsWith('.txt'))
	.sort()
	.map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
const { rows, merged } = parseVocabularySource(files);

const { rows: valid, errors } = validateEntries(rows);
if (errors.length) {
	console.error(errors.map((e) => `row ${e.row}: ${e.message} (${rows[e.row - 1]?.german})`).join('\n'));
	process.exit(1);
}
const manifest: AudioManifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
const withAudio = applyAudioManifest(valid, manifest);
writeFileSync('src/lib/data/vocabulary-at.json', JSON.stringify(valid, null, '\t') + '\n');
const count = (t: string) => valid.filter((r) => r.type === t).length;
const cats = [...new Set(valid.map((r) => r.category))];
const examples = valid.filter((r) => r.example).length;
console.log(
	`${count('word')} words, ${count('phrase')} phrases, ${cats.length} categories (${merged} duplicates merged), ${examples} examples, ${withAudio} with audio`
);
