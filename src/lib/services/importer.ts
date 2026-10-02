import type { ItemType } from '$lib/domain/types';
import { isPhraseText } from './content-analysis.ts';

export interface ImportRow {
	type: ItemType;
	german: string;
	translation?: string;
	alt?: string;
	context?: string;
	category: string;
}

export interface ImportError {
	/** 1-based row/entry number. */
	row: number;
	message: 'invalid_format' | 'missing_german' | 'missing_category' | 'invalid_type' | 'too_long' | 'duplicate';
}

export interface ImportResult {
	rows: ImportRow[];
	errors: ImportError[];
}

export const LIMITS = { german: 300, translation: 300, alt: 300, context: 500, category: 60, rows: 10_000 } as const;

/** Strips control characters (keeps newlines out of single-line fields). */
function clean(v: unknown, max: number): string | undefined | null {
	if (v === undefined || v === null || v === '') return undefined;
	if (typeof v !== 'string' && typeof v !== 'number') return null;
	// eslint-disable-next-line no-control-regex
	const s = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
	if (!s) return undefined;
	return s.length > max ? null : s;
}

export function validateEntries(entries: unknown[]): ImportResult {
	const rows: ImportRow[] = [];
	const errors: ImportError[] = [];
	const seen = new Set<string>();
	entries.slice(0, LIMITS.rows).forEach((raw, i) => {
		const row = i + 1;
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			errors.push({ row, message: 'invalid_format' });
			return;
		}
		const r = raw as Record<string, unknown>;
		const german = clean(r.german, LIMITS.german);
		const category = clean(r.category, LIMITS.category);
		const translation = clean(r.translation, LIMITS.translation);
		const alt = clean(r.alt, LIMITS.alt);
		const context = clean(r.context, LIMITS.context);
		if (german === null || category === null || translation === null || alt === null || context === null) {
			errors.push({ row, message: 'too_long' });
			return;
		}
		if (!german) return void errors.push({ row, message: 'missing_german' });
		if (!category) return void errors.push({ row, message: 'missing_category' });
		let type: ItemType;
		if (r.type === undefined || r.type === '') type = isPhraseText(german) ? 'phrase' : 'word';
		else if (r.type === 'word' || r.type === 'phrase') type = r.type;
		else return void errors.push({ row, message: 'invalid_type' });
		const key = german.toLowerCase();
		if (seen.has(key)) return void errors.push({ row, message: 'duplicate' });
		seen.add(key);
		rows.push({ type, german, category, translation, alt, context });
	});
	return { rows, errors };
}

export function parseJson(text: string): ImportResult {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { rows: [], errors: [{ row: 0, message: 'invalid_format' }] };
	}
	if (!Array.isArray(data)) return { rows: [], errors: [{ row: 0, message: 'invalid_format' }] };
	return validateEntries(data);
}

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, , or ; separators). */
export function parseCsvRecords(text: string): string[][] {
	const src = text.replace(/^﻿/, '');
	const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
	const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
	const out: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < src.length; i++) {
		const c = src[i]!;
		if (quoted) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else quoted = false;
			} else field += c;
		} else if (c === '"') quoted = true;
		else if (c === sep) {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && src[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			if (row.some((f) => f.trim() !== '')) out.push(row);
			row = [];
		} else field += c;
	}
	row.push(field);
	if (row.some((f) => f.trim() !== '')) out.push(row);
	return out;
}

export function parseCsv(text: string): ImportResult {
	const records = parseCsvRecords(text);
	const header = records.shift()?.map((h) => h.trim().toLowerCase());
	if (!header || !header.includes('german') || !header.includes('category')) {
		return { rows: [], errors: [{ row: 0, message: 'invalid_format' }] };
	}
	const entries = records.map((rec) => Object.fromEntries(header.map((h, i) => [h, rec[i] ?? ''])));
	return validateEntries(entries);
}

export function parseImport(fileName: string, text: string): ImportResult {
	return /\.csv$/i.test(fileName) || !text.trim().startsWith('[') ? parseCsv(text) : parseJson(text);
}
