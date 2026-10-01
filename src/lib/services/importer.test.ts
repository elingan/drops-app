import { describe, expect, it } from 'vitest';
import { parseCsv, parseImport, parseJson } from './importer';

describe('importer', () => {
	it('parses the documented JSON format', () => {
		const r = parseJson(JSON.stringify([
			{ type: 'word', german: 'ausmachen', translation: 'apagar / acordar', category: 'Alltag' },
			{ type: 'phrase', german: 'Das kriegen wir heute noch hin.', translation: 'Lo podemos terminar hoy.', category: 'Arbeit' }
		]));
		expect(r.errors).toEqual([]);
		expect(r.rows).toHaveLength(2);
		expect(r.rows[1]).toMatchObject({ type: 'phrase', category: 'Arbeit' });
	});

	it('infers type and reports invalid rows', () => {
		const r = parseJson(JSON.stringify([
			{ german: 'Ich verstehe nur Bahnhof.', category: 'Redewendungen' },
			{ german: '', category: 'Alltag' },
			{ german: 'x', category: '' },
			{ german: 'y', category: 'A', type: 'sentence' },
			{ german: 'ich verstehe nur bahnhof.', category: 'Alltag' },
			'nope',
			{ german: 'z'.repeat(400), category: 'A' }
		]));
		expect(r.rows).toHaveLength(1);
		expect(r.rows[0]!.type).toBe('phrase');
		expect(r.errors.map((e) => e.message)).toEqual([
			'missing_german', 'missing_category', 'invalid_type', 'duplicate', 'invalid_format', 'too_long'
		]);
	});

	it('rejects non-array JSON and broken JSON', () => {
		expect(parseJson('{"a":1}').errors[0]!.message).toBe('invalid_format');
		expect(parseJson('[').errors[0]!.message).toBe('invalid_format');
	});

	it('parses CSV with quotes, commas and semicolons', () => {
		const csv = 'type,german,translation,category\nword,ausmachen,"apagar, acordar",Alltag\nphrase,"Er sagt ""Hallo"".",Dice hola.,Alltag\n';
		const r = parseCsv(csv);
		expect(r.errors).toEqual([]);
		expect(r.rows[0]!.translation).toBe('apagar, acordar');
		expect(r.rows[1]!.german).toBe('Er sagt "Hallo".');
		const semi = parseImport('x.csv', 'german;translation;category\nheuer;este año;Alltag');
		expect(semi.rows[0]).toMatchObject({ german: 'heuer', type: 'word' });
	});

	it('requires a CSV header with german and category', () => {
		expect(parseCsv('foo,bar\n1,2').errors[0]!.message).toBe('invalid_format');
	});
});
