import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	applyAudioManifest,
	clipTexts,
	manifestKey,
	type AudioManifest,
	type AudioManifestEntry,
	type AudioRow
} from '../src/lib/data/audio-manifest.ts';
import { loadEnv } from './env.ts';

/**
 * Generates the MP3s of the bundled vocabulary with ElevenLabs and links them
 * into src/lib/data/vocabulary-at.json (via data/audio-manifest.json):
 *
 *   audio        the German word or phrase          voice «Livia»
 *   example      the German example sentence        voice «Livia»
 *   translation  the Spanish translation (1st sense) voice «Marina»
 *
 *   npm run audio:build                  # estimate only (characters per voice)
 *   npm run audio:build -- --limit 8     # test batch: 8 entries spread over the vocabulary
 *   npm run audio:build -- --all         # everything that is missing
 *
 * Idempotent: a file is named after a hash of voice + model + format + language +
 * text, and an existing file is never requested again. Needs ELEVENLABS_API_KEY
 * (environment or .env); the key is never printed or stored.
 */

export type Slot = 'audio' | 'example' | 'translation';
export type Lang = 'de' | 'es';

export interface Job {
	/** Manifest key of the vocabulary entry. */
	key: string;
	slot: Slot;
	text: string;
	lang: Lang;
}

export interface Options {
	/** Test batch: only this many entries, evenly spread over the vocabulary. */
	limit?: number;
	/** Generate everything that is missing. */
	all: boolean;
	/** Estimate only. */
	dryRun: boolean;
	/** Restrict to words or phrases. */
	type?: 'word' | 'phrase';
}

export interface Config {
	apiKey: string;
	/** Multilingual model; eleven_multilingual_v2 unless ELEVENLABS_MODEL says otherwise. */
	model: string;
	format: string;
	/** Voice name or id for German/Spanish; names are resolved against the account's voices. */
	voiceDe: string;
	voiceEs: string;
	concurrency: number;
	audioDir: string;
	audioUrlBase: string;
	manifestFile: string;
	vocabularyFile: string;
}

export interface Voice {
	voice_id: string;
	name: string;
}

export interface Report {
	generated: number;
	existing: number;
	/** Characters sent to the API, per voice. */
	characters: Record<Lang, number>;
	bytes: number;
}

type VocabRow = AudioRow & { type: 'word' | 'phrase' };
type FetchFn = typeof fetch;

const API = 'https://api.elevenlabs.io';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
// 48 kbps mono at 24 kHz: clear speech at ~6 KB/s, available on every plan.
const DEFAULT_FORMAT = 'mp3_24000_48';
export class FatalApiError extends Error {}

// ── Planning ────────────────────────────────────────────────────────

/** `limit` entries evenly spread over the list, so the batch mixes categories, words and phrases. */
export function sample<T>(items: T[], limit: number): T[] {
	if (limit >= items.length) return items;
	return Array.from({ length: limit }, (_, i) => items[Math.floor(((i + 0.5) * items.length) / limit)]!);
}

/** The clips of the selected entries, de-duplicated by (language, text). */
export function planJobs(rows: VocabRow[], opts: Pick<Options, 'limit' | 'type'>): Job[] {
	const rowsOfType = rows.filter((r) => !opts.type || r.type === opts.type);
	// A sample only makes sense over entries that have the most clips, i.e. words with an example.
	const selected = opts.limit ? sample(rowsOfType, opts.limit) : rowsOfType;
	const jobs: Job[] = [];
	const seen = new Set<string>();
	for (const row of selected) {
		const texts = clipTexts(row);
		const wanted: [Slot, string | undefined, Lang][] = [
			['audio', texts.audio, 'de'],
			['translation', texts.translation, 'es'],
			['example', texts.example, 'de']
		];
		for (const [slot, text, lang] of wanted) {
			if (!text || seen.has(`${lang}|${text}`)) continue;
			seen.add(`${lang}|${text}`);
			jobs.push({ key: manifestKey(row.german), slot, text, lang });
		}
	}
	return jobs;
}

/** Stable file name: same text + voice + model + format + language → same file. */
export function fileName(voiceId: string, model: string, format: string, lang: Lang, text: string): string {
	const hash = createHash('sha256').update([voiceId, model, format, lang, text].join('\n')).digest('hex');
	return `${hash.slice(0, 20)}.mp3`;
}

/** Rough size of the speech: ~14 characters per second at the bitrate of the output format. */
export function estimateBytes(characters: number, format: string): number {
	const kbps = Number(format.match(/_(\d+)$/)?.[1] ?? 64);
	return Math.round((characters / 14) * ((kbps * 1000) / 8));
}

// ── ElevenLabs API ──────────────────────────────────────────────────

/** Exact name, case-insensitive. «Livia» also matches the account's «Livia - Expressive & Dynamic». */
export function findVoice(voices: Voice[], wanted: string): Voice {
	const w = wanted.trim().toLowerCase();
	const matches = voices.filter((v) => {
		const name = v.name.trim().toLowerCase();
		return name === w || name.split(' - ')[0]!.trim() === w;
	});
	if (matches.length === 0) {
		throw new FatalApiError(`Voice «${wanted}» not found among the ${voices.length} voices of the account. Add it to your voices in ElevenLabs or set its id in ELEVENLABS_VOICE_DE / ELEVENLABS_VOICE_ES.`);
	}
	if (matches.length > 1) {
		throw new FatalApiError(`Voice «${wanted}» is ambiguous (${matches.map((v) => `${v.name} [${v.voice_id}]`).join('; ')}). Set its id in ELEVENLABS_VOICE_DE / ELEVENLABS_VOICE_ES.`);
	}
	return matches[0]!;
}

async function apiError(res: Response): Promise<string> {
	const body = await res.text().catch(() => '');
	try {
		const d = JSON.parse(body)?.detail;
		return `${res.status} ${typeof d === 'string' ? d : (d?.message ?? d?.status ?? body)}`.slice(0, 400);
	} catch {
		return `${res.status} ${body}`.slice(0, 400);
	}
}

export async function listVoices(fetchFn: FetchFn, apiKey: string): Promise<Voice[]> {
	const res = await fetchFn(`${API}/v1/voices`, { headers: { 'xi-api-key': apiKey } });
	if (!res.ok) throw new FatalApiError(`GET /v1/voices failed: ${await apiError(res)}`);
	return ((await res.json()) as { voices: Voice[] }).voices;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class TextToSpeech {
	/** The language is pinned with language_code (accepted by eleven_multilingual_v2); set if a model refuses it. */
	languageCodeRefused = false;

	private readonly fetchFn: FetchFn;
	private readonly apiKey: string;
	private readonly model: string;
	private readonly format: string;
	private readonly retryDelayMs: number;

	constructor(fetchFn: FetchFn, apiKey: string, model: string, format: string, retryDelayMs = 2000) {
		this.fetchFn = fetchFn;
		this.apiKey = apiKey;
		this.model = model;
		this.format = format;
		this.retryDelayMs = retryDelayMs;
	}

	async synthesize(voiceId: string, lang: Lang, text: string): Promise<Uint8Array> {
		for (let attempt = 0; ; attempt++) {
			const withLanguage = !this.languageCodeRefused;
			const res = await this.fetchFn(`${API}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${this.format}`, {
				method: 'POST',
				headers: { 'xi-api-key': this.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
				body: JSON.stringify({ text, model_id: this.model, ...(withLanguage ? { language_code: lang } : {}) })
			});
			if (res.ok) return new Uint8Array(await res.arrayBuffer());
			const error = await apiError(res);
			if (withLanguage && (res.status === 400 || res.status === 422) && /language/i.test(error)) {
				this.languageCodeRefused = true;
				continue;
			}
			// Quota, auth and permission problems will not fix themselves: stop the whole run.
			if ([401, 402, 403].includes(res.status)) throw new FatalApiError(`ElevenLabs refused the request: ${error}`);
			if ((res.status === 429 || res.status >= 500) && attempt < 5) {
				await wait(this.retryDelayMs * 2 ** attempt);
				continue;
			}
			throw new Error(`Text-to-speech failed for «${text}»: ${error}`);
		}
	}
}

// ── Run ─────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('es-ES');
const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

export async function run(opts: Options, cfg: Config, fetchFn: FetchFn = fetch, log: (msg: string) => void = console.log): Promise<Report> {
	const rows = JSON.parse(readFileSync(cfg.vocabularyFile, 'utf8')) as VocabRow[];
	const jobs = planJobs(rows, opts);

	// Voices: resolve names against the account (a voice is looked up by name unless an id is given).
	const voices = await listVoices(fetchFn, cfg.apiKey);
	const byId = (id: string) => voices.find((v) => v.voice_id === id);
	const resolve = (wanted: string) => {
		const direct = byId(wanted);
		if (direct) return direct;
		// ELEVENLABS_VOICE_*: ids are 20 characters of letters and digits, never a name.
		if (/^[A-Za-z0-9]{20}$/.test(wanted)) return { voice_id: wanted, name: wanted };
		return findVoice(voices, wanted);
	};
	const voice: Record<Lang, Voice> = { de: resolve(cfg.voiceDe), es: resolve(cfg.voiceEs) };

	const pathOf = (job: Job) => join(cfg.audioDir, fileName(voice[job.lang].voice_id, cfg.model, cfg.format, job.lang, job.text));
	const pending = jobs.filter((j) => !existsSync(pathOf(j)));

	const chars = (list: Job[], lang: Lang) => list.filter((j) => j.lang === lang).reduce((n, j) => n + j.text.length, 0);
	log(`Modelo ${cfg.model} · formato ${cfg.format} · ${jobs.length} clips (${rows.length} entradas${opts.limit ? `, lote de ${opts.limit}` : ''})`);
	for (const lang of ['de', 'es'] as const) {
		const all = jobs.filter((j) => j.lang === lang);
		const todo = pending.filter((j) => j.lang === lang);
		log(
			`  ${lang === 'de' ? 'Alemán ' : 'Español'} · voz «${voice[lang].name}» · ${fmt(chars(jobs, lang))} caracteres en ${all.length} clips · pendientes: ${fmt(chars(pending, lang))} caracteres en ${todo.length} clips`
		);
	}
	log(`  Tamaño estimado de lo pendiente: ~${mb(estimateBytes(chars(pending, 'de') + chars(pending, 'es'), cfg.format))}`);

	const report: Report = { generated: 0, existing: jobs.length - pending.length, characters: { de: 0, es: 0 }, bytes: 0 };
	if (opts.dryRun || (!opts.all && !opts.limit)) {
		log('Solo estimación. Usa --limit 8 para un lote de prueba o --all para generar todo lo pendiente.');
		return report;
	}

	mkdirSync(cfg.audioDir, { recursive: true });
	const tts = new TextToSpeech(fetchFn, cfg.apiKey, cfg.model, cfg.format);
	let next = 0;
	let fatal: unknown;
	const failures: string[] = [];
	const worker = async () => {
		while (!fatal && next < pending.length) {
			const job = pending[next++]!;
			try {
				const audio = await tts.synthesize(voice[job.lang].voice_id, job.lang, job.text);
				const file = pathOf(job);
				writeFileSync(`${file}.tmp`, audio);
				renameSync(`${file}.tmp`, file);
				report.generated++;
				report.characters[job.lang] += job.text.length;
				report.bytes += audio.length;
				log(`  [${report.generated}/${pending.length}] ${job.lang} «${job.text}» → ${(audio.length / 1000).toFixed(1)} KB`);
			} catch (e) {
				if (e instanceof FatalApiError) fatal = e;
				else failures.push(e instanceof Error ? e.message : String(e));
			}
		}
	};
	await Promise.all(Array.from({ length: cfg.concurrency }, worker));
	if (tts.languageCodeRefused) log(`Aviso: el modelo ${cfg.model} no admite language_code; se generó sin fijar el idioma.`);

	// Link every clip that exists (new or from earlier runs) into the manifest and the dataset.
	const manifest: AudioManifest = existsSync(cfg.manifestFile) ? JSON.parse(readFileSync(cfg.manifestFile, 'utf8')) : {};
	const keys = new Set(rows.map((r) => manifestKey(r.german)));
	for (const key of Object.keys(manifest)) if (!keys.has(key)) delete manifest[key];
	for (const job of jobs) {
		const file = pathOf(job);
		if (!existsSync(file) || statSync(file).size === 0) continue;
		const entry: AudioManifestEntry = (manifest[job.key] ??= {});
		entry[job.slot] = { text: job.text, url: `${cfg.audioUrlBase}/${fileName(voice[job.lang].voice_id, cfg.model, cfg.format, job.lang, job.text)}` };
	}
	// Texts shared by several entries (same translation) point to the same file.
	for (const row of rows) {
		const texts = clipTexts(row);
		const entry: AudioManifestEntry = (manifest[manifestKey(row.german)] ??= {});
		const slots: [Slot, string | undefined, Lang][] = [
			['audio', texts.audio, 'de'],
			['translation', texts.translation, 'es'],
			['example', texts.example, 'de']
		];
		for (const [slot, text, lang] of slots) {
			if (!text || entry[slot]?.text === text) continue;
			const name = fileName(voice[lang].voice_id, cfg.model, cfg.format, lang, text);
			if (existsSync(join(cfg.audioDir, name)) && jobs.some((j) => j.lang === lang && j.text === text)) {
				entry[slot] = { text, url: `${cfg.audioUrlBase}/${name}` };
			}
		}
	}
	const sorted = Object.fromEntries(Object.entries(manifest).filter(([, e]) => Object.keys(e).length).sort(([a], [b]) => a.localeCompare(b)));
	writeFileSync(cfg.manifestFile, JSON.stringify(sorted, null, '\t') + '\n');
	const withAudio = applyAudioManifest(rows, sorted);
	writeFileSync(cfg.vocabularyFile, JSON.stringify(rows, null, '\t') + '\n');

	log(`Generados ${report.generated} MP3 (${mb(report.bytes)}); ya existían ${report.existing}. Caracteres consumidos: alemán ${fmt(report.characters.de)}, español ${fmt(report.characters.es)}. Entradas con audio: ${withAudio}.`);
	if (failures.length) log(`${failures.length} clips fallaron (se reintentarán al repetir el comando):\n  ${failures.slice(0, 10).join('\n  ')}`);
	if (fatal) throw fatal;
	return report;
}

export function parseArgs(argv: string[]): Options {
	const opts: Options = { all: false, dryRun: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		if (a === '--all') opts.all = true;
		else if (a === '--dry-run') opts.dryRun = true;
		else if (a === '--limit') opts.limit = Number(argv[++i]);
		else if (a === '--type') opts.type = argv[++i] as Options['type'];
		else throw new Error(`Unknown option ${a}`);
	}
	if (opts.limit !== undefined && !(Number.isInteger(opts.limit) && opts.limit > 0)) throw new Error('--limit needs a positive integer');
	if (opts.type && opts.type !== 'word' && opts.type !== 'phrase') throw new Error('--type is word or phrase');
	return opts;
}

export function configFromEnv(env: Record<string, string | undefined>): Config {
	const apiKey = env.ELEVENLABS_API_KEY?.trim();
	if (!apiKey) {
		throw new FatalApiError('ELEVENLABS_API_KEY is not set. Export it in your shell or add it to .env (never commit it) and run again.');
	}
	return {
		apiKey,
		model: env.ELEVENLABS_MODEL?.trim() || DEFAULT_MODEL,
		format: env.ELEVENLABS_OUTPUT_FORMAT?.trim() || DEFAULT_FORMAT,
		voiceDe: env.ELEVENLABS_VOICE_DE?.trim() || 'Livia',
		voiceEs: env.ELEVENLABS_VOICE_ES?.trim() || 'Marina',
		concurrency: Math.max(1, Number(env.ELEVENLABS_CONCURRENCY) || 3),
		audioDir: 'static/audio',
		audioUrlBase: '/audio',
		manifestFile: 'data/audio-manifest.json',
		vocabularyFile: 'src/lib/data/vocabulary-at.json'
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		await run(parseArgs(process.argv.slice(2)), configFromEnv(loadEnv()));
	} catch (e) {
		console.error(e instanceof Error ? e.message : e);
		process.exit(1);
	}
}
