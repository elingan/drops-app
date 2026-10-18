import { describe, expect, it } from 'vitest';
import { parseVocabularySource } from './vocabulary-source';

const file = (text: string, name = 'x.txt') => ({ name, text });

describe('parseVocabularySource', () => {
	it('reads 5-field lines (no example) and 7-field lines (with example)', () => {
		const { rows } = parseVocabularySource([
			file(
				[
					'# Alltag',
					'w|heuer|este año|dieses Jahr|Austria.|Heuer fahren wir im Sommer nach Kroatien.|Este año vamos a Croacia en verano.',
					'p|Servus!|¡Hola!||Informal.',
					''
				].join('\n')
			)
		]);
		expect(rows).toEqual([
			{
				type: 'word',
				german: 'heuer',
				translation: 'este año',
				alt: 'dieses Jahr',
				context: 'Austria.',
				example: 'Heuer fahren wir im Sommer nach Kroatien.',
				exampleTranslation: 'Este año vamos a Croacia en verano.',
				category: 'Alltag'
			},
			{ type: 'phrase', german: 'Servus!', translation: '¡Hola!', context: 'Informal.', category: 'Alltag' }
		]);
	});

	it('rejects malformed lines, naming file and line', () => {
		expect(() => parseVocabularySource([file('# A\nw|a|b|c', 'f.txt')])).toThrow('f.txt:2 invalid line');
		expect(() => parseVocabularySource([file('w|a|b|||', 'f.txt')])).toThrow('f.txt:1 invalid line');
		expect(() => parseVocabularySource([file('# A\nw|a|b|||Beispiel.|', 'f.txt')])).toThrow('example and its translation go together');
		expect(() => parseVocabularySource([file('# A\np|Hallo!|hola|||Hallo!|Hola.', 'f.txt')])).toThrow('only words take an example');
	});

	it('merges duplicates across files: first category wins, meanings combine, example is kept', () => {
		const { rows, merged } = parseVocabularySource([
			file('# Alltag\nw|das Amt|oficina||'),
			file('# Behörden\nw|Das Amt|oficina; ministerio|||Ich muss aufs Amt.|Tengo que ir a la oficina.')
		]);
		expect(merged).toBe(1);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			category: 'Alltag',
			translation: 'oficina; ministerio',
			example: 'Ich muss aufs Amt.',
			exampleTranslation: 'Tengo que ir a la oficina.'
		});
	});
});
