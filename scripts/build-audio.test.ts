import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
	FatalApiError,
	configFromEnv,
	estimateBytes,
	fileName,
	findVoice,
	parseArgs,
	planJobs,
	run,
	sample,
	type Config
} from './build-audio.ts';

const VOICES = [
	{ voice_id: 'Utm9AAAAAAAAAAAAAAAA', name: 'Livia - Expressive & Dynamic' },
	{ voice_id: 'GB7fBBBBBBBBBBBBBBBB', name: 'Marina - Clear, Velvety and Articulated' },
	{ voice_id: 'XrExCCCCCCCCCCCCCCCC', name: 'Matilda - Knowledgable, Professional' }
];

const ROWS = [
	{ type: 'word', german: 'heuer', translation: 'este año; en el presente año', example: 'Heuer fahren wir nach Kroatien.', exampleTranslation: 'x' },
	{ type: 'word', german: 'der Kunde / die Kundin', translation: 'el cliente / la clienta (formal)', example: 'Die Kundin ruft an.', exampleTranslation: 'x' },
	{ type: 'phrase', german: 'Servus!', translation: '¡Hola!' }
];

function setup(rows: unknown[] = ROWS) {
	const dir = mkdtempSync(join(tmpdir(), 'audio-'));
	const cfg: Config = {
		apiKey: 'sk_test_secret',
		model: 'eleven_multilingual_v2',
		format: 'mp3_24000_48',
		voiceDe: 'livia',
		voiceEs: 'MARINA',
		concurrency: 2,
		audioDir: join(dir, 'audio'),
		audioUrlBase: '/audio',
		manifestFile: join(dir, 'manifest.json'),
		vocabularyFile: join(dir, 'vocabulary.json')
	};
	writeFileSync(cfg.vocabularyFile, JSON.stringify(rows));
	return { dir, cfg };
}

/** Fake ElevenLabs: lists voices, answers TTS with 3 bytes, records the calls. */
function fakeApi(tts: (url: string, body: Record<string, unknown>) => Response | undefined = () => undefined) {
	const calls: { url: string; headers: Record<string, string>; body?: Record<string, unknown> }[] = [];
	const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const headers = (init?.headers ?? {}) as Record<string, string>;
		const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
		calls.push({ url, headers, body });
		if (url.endsWith('/v1/voices')) return new Response(JSON.stringify({ voices: VOICES }), { status: 200 });
		return tts(url, body!) ?? new Response(new Uint8Array([1, 2, 3]), { status: 200 });
	});
	return { fn: fn as unknown as typeof fetch, calls };
}

describe('voices', () => {
	it('matches the exact name, case-insensitively, also before the " - " description', () => {
		expect(findVoice(VOICES, 'livia').voice_id).toBe('Utm9AAAAAAAAAAAAAAAA');
		expect(findVoice(VOICES, 'MARINA').name).toContain('Marina');
		expect(findVoice(VOICES, 'Marina - Clear, Velvety and Articulated').voice_id).toBe('GB7fBBBBBBBBBBBBBBBB');
	});

	it('stops when a voice is missing or ambiguous, never falling back to another', () => {
		expect(() => findVoice(VOICES, 'Liv')).toThrow(FatalApiError);
		expect(() => findVoice([...VOICES, { voice_id: 'x', name: 'Livia' }], 'Livia')).toThrow('ambiguous');
	});
});

describe('planning', () => {
	it('creates the three clips per word with the right language, and word/phrase clips for phrases', () => {
		const jobs = planJobs(ROWS as never, {});
		expect(jobs.map((j) => [j.slot, j.lang, j.text])).toEqual([
			['audio', 'de', 'heuer'],
			['translation', 'es', 'este año'],
			['example', 'de', 'Heuer fahren wir nach Kroatien.'],
			['audio', 'de', 'der Kunde, die Kundin'],
			['translation', 'es', 'el cliente / la clienta'],
			['example', 'de', 'Die Kundin ruft an.'],
			['audio', 'de', 'Servus!'],
			['translation', 'es', '¡Hola!']
		]);
		expect(planJobs(ROWS as never, { type: 'phrase' })).toHaveLength(2);
	});

	it('samples evenly and de-duplicates identical texts', () => {
		expect(sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toEqual([2, 4, 6, 8, 10]);
		const dup = [
			{ type: 'word', german: 'a', translation: 'sí' },
			{ type: 'word', german: 'b', translation: 'sí' }
		];
		expect(planJobs(dup as never, {}).filter((j) => j.lang === 'es')).toHaveLength(1);
	});

	it('names files after voice, model, format, language and text (stable and distinct)', () => {
		const a = fileName('v1', 'm', 'f', 'de', 'Haus');
		expect(a).toMatch(/^[0-9a-f]{20}\.mp3$/);
		expect(fileName('v1', 'm', 'f', 'de', 'Haus')).toBe(a);
		for (const other of [fileName('v2', 'm', 'f', 'de', 'Haus'), fileName('v1', 'm2', 'f', 'de', 'Haus'), fileName('v1', 'm', 'f2', 'de', 'Haus'), fileName('v1', 'm', 'f', 'es', 'Haus'), fileName('v1', 'm', 'f', 'de', 'Haus!')]) {
			expect(other).not.toBe(a);
		}
	});

	it('estimates size from the bitrate', () => {
		expect(estimateBytes(14, 'mp3_44100_64')).toBe(8000);
		expect(estimateBytes(14, 'mp3_24000_48')).toBe(6000);
	});
});

describe('run', () => {
	it('only estimates without --all/--limit: no TTS calls, nothing written', async () => {
		const { cfg } = setup();
		const api = fakeApi();
		const logs: string[] = [];
		const report = await run({ all: false, dryRun: false }, cfg, api.fn, (m) => logs.push(m));
		expect(report.generated).toBe(0);
		expect(api.calls.filter((c) => c.url.includes('text-to-speech'))).toHaveLength(0);
		expect(existsSync(cfg.audioDir)).toBe(false);
		const text = logs.join('\n');
		expect(text).toContain('Alemán');
		expect(text).toContain('Livia');
		expect(text).toContain('Marina');
	});

	it('generates with the right voice, language and model, links the dataset, and is idempotent', async () => {
		const { cfg } = setup();
		const api = fakeApi();
		const logs: string[] = [];
		const report = await run({ all: true, dryRun: false }, cfg, api.fn, (m) => logs.push(m));
		expect(report.generated).toBe(8);
		expect(readdirSync(cfg.audioDir)).toHaveLength(8);
		// 'heuer'+example+'der Kunde, die Kundin'+example+'Servus!' vs. 'este año'+'el cliente / la clienta'+'¡Hola!'
		expect(report.characters.de).toBe('heuer'.length + 'Heuer fahren wir nach Kroatien.'.length + 'der Kunde, die Kundin'.length + 'Die Kundin ruft an.'.length + 'Servus!'.length);
		expect(report.characters.es).toBe('este año'.length + 'el cliente / la clienta'.length + '¡Hola!'.length);

		const tts = api.calls.filter((c) => c.url.includes('text-to-speech'));
		for (const c of tts) {
			const german = c.body!.language_code === 'de';
			expect(c.url).toContain(german ? 'Utm9AAAAAAAAAAAAAAAA' : 'GB7fBBBBBBBBBBBBBBBB');
			expect(c.body).toMatchObject({ model_id: 'eleven_multilingual_v2' });
			expect(c.headers['xi-api-key']).toBe('sk_test_secret');
		}
		// The key never reaches the log or the written files.
		for (const f of [cfg.manifestFile, cfg.vocabularyFile]) expect(readFileSync(f, 'utf8')).not.toContain('sk_test_secret');
		expect(logs.join('\n')).not.toContain('sk_test_secret');

		const rows = JSON.parse(readFileSync(cfg.vocabularyFile, 'utf8'));
		expect(rows[0].audioUrl).toMatch(/^\/audio\/[0-9a-f]{20}\.mp3$/);
		expect(rows[0].translationAudioUrl).toMatch(/^\/audio\//);
		expect(rows[0].exampleAudioUrl).toMatch(/^\/audio\//);
		expect(rows[2].exampleAudioUrl).toBeUndefined();
		expect(Object.keys(JSON.parse(readFileSync(cfg.manifestFile, 'utf8'))).sort()).toEqual(['der kunde / die kundin', 'heuer', 'servus!']);

		// Second run: everything exists, nothing is requested again.
		const again = fakeApi();
		const second = await run({ all: true, dryRun: false }, cfg, again.fn, () => {});
		expect(second.generated).toBe(0);
		expect(second.existing).toBe(8);
		expect(again.calls.filter((c) => c.url.includes('text-to-speech'))).toHaveLength(0);
	});

	it('the test batch generates only the sampled entries', async () => {
		const { cfg } = setup();
		const api = fakeApi();
		const report = await run({ all: false, dryRun: false, limit: 1 }, cfg, api.fn, () => {});
		expect(report.generated).toBe(3);
		const rows = JSON.parse(readFileSync(cfg.vocabularyFile, 'utf8'));
		expect(rows.filter((r: { audioUrl?: string }) => r.audioUrl)).toHaveLength(1);
	});

	it('stops on a payment/permission error and says so, without writing partial garbage', async () => {
		const { cfg } = setup();
		const api = fakeApi(() => new Response(JSON.stringify({ detail: { message: 'Free users cannot use library voices via the API.' } }), { status: 402 }));
		await expect(run({ all: true, dryRun: false }, cfg, api.fn, () => {})).rejects.toThrow('Free users cannot use library voices');
		expect(readdirSync(cfg.audioDir).filter((f) => f.endsWith('.mp3'))).toHaveLength(0);
	});

	it('stops when the voice is not in the account (no fallback voice)', async () => {
		const { cfg } = setup();
		cfg.voiceDe = 'Hannelore';
		const api = fakeApi();
		await expect(run({ all: true, dryRun: false }, cfg, api.fn, () => {})).rejects.toThrow('«Hannelore» not found');
		expect(api.calls.filter((c) => c.url.includes('text-to-speech'))).toHaveLength(0);
	});

	it('accepts a voice id from the environment overrides', async () => {
		const { cfg } = setup();
		cfg.voiceDe = 'ZZZZZZZZZZZZZZZZZZZZ';
		const api = fakeApi();
		await run({ all: false, dryRun: false, limit: 1 }, cfg, api.fn, () => {});
		expect(api.calls.some((c) => c.url.includes('/ZZZZZZZZZZZZZZZZZZZZ?'))).toBe(true);
	});

	it('retries a language_code refusal without it, and rate limits with backoff', async () => {
		const { cfg } = setup();
		let first = true;
		const api = fakeApi((_url, body) => {
			if ('language_code' in body) return new Response(JSON.stringify({ detail: { message: 'Model does not support language_code' } }), { status: 400 });
			if (first) {
				first = false;
				return new Response('slow down', { status: 429 });
			}
			return undefined;
		});
		vi.useFakeTimers();
		const p = run({ all: false, dryRun: false, limit: 1 }, { ...cfg, concurrency: 1 }, api.fn, () => {});
		await vi.runAllTimersAsync();
		const report = await p;
		vi.useRealTimers();
		expect(report.generated).toBe(3);
		expect(api.calls.filter((c) => c.body && 'language_code' in c.body)).toHaveLength(1);
	});
});

describe('cli', () => {
	it('parses options and reads configuration from the environment', () => {
		expect(parseArgs(['--limit', '8', '--type', 'word'])).toEqual({ all: false, dryRun: false, limit: 8, type: 'word' });
		expect(() => parseArgs(['--limit', 'x'])).toThrow();
		expect(() => parseArgs(['--nope'])).toThrow('Unknown option');
		const cfg = configFromEnv({ ELEVENLABS_API_KEY: ' k ', ELEVENLABS_VOICE_ES: 'Sarah' });
		expect(cfg).toMatchObject({ apiKey: 'k', voiceDe: 'Matilda', voiceEs: 'Sarah', model: 'eleven_multilingual_v2' });
	});

	it('asks for the key (without asking to paste it anywhere) when it is missing', () => {
		expect(() => configFromEnv({})).toThrow(/ELEVENLABS_API_KEY is not set/);
	});
});
