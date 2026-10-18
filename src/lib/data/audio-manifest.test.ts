import { describe, expect, it } from 'vitest';
import { spokenGerman, spokenSpanish } from '../utils/speech-text';
import { applyAudioManifest, clipTexts, type AudioManifest, type AudioRow } from './audio-manifest';

describe('speech text', () => {
	it('reads slashes as pauses and keeps only the first Spanish meaning, without notes', () => {
		expect(spokenGerman('der Kunde / die Kundin')).toBe('der Kunde, die Kundin');
		expect(spokenGerman('Grüß  Gott')).toBe('Grüß Gott');
		expect(spokenSpanish('hola; adiós (informal)')).toBe('hola');
		expect(spokenSpanish('buenos días (saludo formal)')).toBe('buenos días');
		expect(spokenSpanish('acordar · apagar')).toBe('acordar');
		expect(spokenSpanish('vale, de acuerdo, perfecto')).toBe('vale, de acuerdo, perfecto');
	});
});

describe('applyAudioManifest', () => {
	const row = (): AudioRow => ({
		german: 'Heuer',
		translation: 'este año; en el presente año',
		example: 'Heuer fahren wir nach Kroatien.'
	});
	const manifest: AudioManifest = {
		heuer: {
			audio: { text: 'Heuer', url: '/audio/a.mp3' },
			translation: { text: 'este año', url: '/audio/b.mp3' },
			example: { text: 'Heuer fahren wir nach Kroatien.', url: '/audio/c.mp3' }
		}
	};

	it('derives the text of each clip', () => {
		expect(clipTexts(row())).toEqual({ audio: 'Heuer', translation: 'este año', example: 'Heuer fahren wir nach Kroatien.' });
		expect(clipTexts({ german: 'Servus!' })).toEqual({ audio: 'Servus!', translation: undefined, example: undefined });
	});

	it('links the three clips by lower-cased German text', () => {
		const rows = [row()];
		expect(applyAudioManifest(rows, manifest)).toBe(1);
		expect(rows[0]).toMatchObject({ audioUrl: '/audio/a.mp3', translationAudioUrl: '/audio/b.mp3', exampleAudioUrl: '/audio/c.mp3' });
	});

	it('drops clips whose text no longer matches, and clears stale URLs', () => {
		const rows = [{ ...row(), example: 'Heuer bleiben wir zu Hause.', audioUrl: '/audio/old.mp3', exampleAudioUrl: '/audio/stale.mp3' }];
		applyAudioManifest(rows, manifest);
		expect(rows[0]!.audioUrl).toBe('/audio/a.mp3');
		expect(rows[0]!.exampleAudioUrl).toBeUndefined();
		const none = [{ german: 'unbekannt', audioUrl: '/audio/old.mp3' } as AudioRow];
		expect(applyAudioManifest(none, manifest)).toBe(0);
		expect(none[0]!.audioUrl).toBeUndefined();
	});
});
