import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningItem } from '$lib/domain/types';
import type { MediaRepository } from '$lib/repositories/interfaces';
import { AudioService, type PlaybackState } from './audio';

/** Minimal HTMLAudioElement: the test decides when a clip ends or fails. */
class FakeAudio {
	static instances: FakeAudio[] = [];
	paused = true;
	ended = false;
	onplaying: (() => void) | null = null;
	onpause: (() => void) | null = null;
	onended: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor(readonly url: string) {
		FakeAudio.instances.push(this);
	}
	play() {
		this.paused = false;
		queueMicrotask(() => this.onplaying?.());
		return Promise.resolve();
	}
	pause() {
		this.paused = true;
		this.onpause?.();
	}
	finish() {
		this.ended = true;
		this.paused = true;
		this.onended?.();
	}
	fail() {
		this.onerror?.();
	}
}

/** Browser speech synthesis that "speaks" instantly and records what it was asked to say. */
function stubSpeech() {
	const spoken: { text: string; lang: string }[] = [];
	vi.stubGlobal('SpeechSynthesisUtterance', class {
		onstart?: () => void;
		onend?: () => void;
		onerror?: (e: { error: string }) => void;
		lang = '';
		rate = 1;
		voice: unknown;
		constructor(readonly text: string) {}
	});
	vi.stubGlobal('speechSynthesis', {
		getVoices: () => [],
		cancel: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
		speak: vi.fn((u: { text: string; lang: string; onstart?: () => void; onend?: () => void }) => {
			spoken.push({ text: u.text, lang: u.lang });
			u.onstart?.();
			queueMicrotask(() => u.onend?.());
		})
	});
	return spoken;
}

const media = { get: async () => undefined } as unknown as MediaRepository;
const item = (patch: Partial<LearningItem> = {}): LearningItem => ({
	id: '1',
	type: 'word',
	german: 'heuer',
	translation: 'este año; en el presente año',
	example: 'Heuer fahren wir nach Kroatien.',
	exampleTranslation: 'Este año vamos a Croacia.',
	categoryId: 'alltag',
	createdAt: new Date(0),
	updatedAt: new Date(0),
	...patch
});
const withAudio = item({ audioUrl: '/audio/de.mp3', translationAudioUrl: '/audio/es.mp3', exampleAudioUrl: '/audio/ex.mp3' });

const clip = async (n: number) => {
	await vi.waitFor(() => expect(FakeAudio.instances.length).toBeGreaterThanOrEqual(n));
	return FakeAudio.instances[n - 1]!;
};

beforeEach(() => {
	FakeAudio.instances = [];
	vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => vi.unstubAllGlobals());

describe('AudioService sources', () => {
	it('resolves word, translation and example to their MP3s, in that order', async () => {
		const audio = new AudioService(media);
		const queue = await audio.resolveReveal(withAudio);
		expect(queue.map((s) => [s.lang, s.url, s.text])).toEqual([
			['de-DE', '/audio/de.mp3', 'heuer'],
			['es-ES', '/audio/es.mp3', 'este año'],
			['de-DE', '/audio/ex.mp3', 'Heuer fahren wir nach Kroatien.']
		]);
	});

	it('keeps native audio ahead of the generated MP3', async () => {
		const src = await new AudioService(media).resolve({ ...withAudio, nativeAudioUrl: '/native.mp3' });
		expect(src).toMatchObject({ kind: 'native', url: '/native.mp3' });
	});

	it('falls back to browser speech (de-DE / es-ES) for the sources without MP3', async () => {
		stubSpeech();
		const queue = await new AudioService(media).resolveReveal(item());
		expect(queue.map((s) => [s.lang, s.url])).toEqual([['de-DE', undefined], ['es-ES', undefined], ['de-DE', undefined]]);
	});

	it('skips what the card lacks: no translation, no example, and nothing at all without any voice', async () => {
		const audio = new AudioService(media);
		const bare = item({ translation: undefined, example: undefined, exampleTranslation: undefined, audioUrl: '/audio/de.mp3' });
		expect((await audio.resolveReveal(bare)).map((s) => s.lang)).toEqual(['de-DE']);
		expect(await audio.resolveReveal(item())).toEqual([]); // no MP3 and no speech synthesis
	});

	it('reads slashes and notes the way the generated audio does', async () => {
		const audio = new AudioService(media);
		const src = await audio.resolve(item({ german: 'der Kunde / die Kundin', audioUrl: '/a.mp3' }));
		expect(src?.text).toBe('der Kunde, die Kundin');
		expect(audio.resolveTranslation(item({ translation: 'hola; adiós (informal)', translationAudioUrl: '/b.mp3' }))?.text).toBe('hola');
	});
});

describe('AudioService playback', () => {
	it('plays a sequence one clip after the other and reports idle only at the end', async () => {
		const audio = new AudioService(media);
		const states: PlaybackState[] = [];
		const done = audio.playSequence(await audio.resolveReveal(withAudio), (s) => states.push(s));

		(await clip(1)).finish();
		expect(FakeAudio.instances.map((a) => a.url)).toEqual(['/audio/de.mp3']);
		(await clip(2)).finish();
		(await clip(3)).finish();
		await done;

		expect(FakeAudio.instances.map((a) => a.url)).toEqual(['/audio/de.mp3', '/audio/es.mp3', '/audio/ex.mp3']);
		expect(states.at(-1)).toBe('idle');
		expect(states.filter((s) => s === 'idle')).toHaveLength(1);
	});

	it('playToEnd resolves when the clip ends', async () => {
		const audio = new AudioService(media);
		let ended = false;
		void audio.playToEnd({ kind: 'generated', url: '/a.mp3', text: 'x', lang: 'de-DE' }).then(() => (ended = true));
		const a = await clip(1);
		await Promise.resolve();
		expect(ended).toBe(false);
		a.finish();
		await vi.waitFor(() => expect(ended).toBe(true));
	});

	it('reads a clip with browser speech when its MP3 fails to load, and goes on with the sequence', async () => {
		const spoken = stubSpeech();
		const audio = new AudioService(media);
		const states: PlaybackState[] = [];
		const done = audio.playSequence(await audio.resolveReveal(withAudio), (s) => states.push(s));

		(await clip(1)).finish();
		(await clip(2)).fail(); // the Spanish MP3 is missing
		await vi.waitFor(() => expect(spoken).toEqual([{ text: 'este año', lang: 'es-ES' }]));
		(await clip(3)).finish();
		await done;

		expect(states).not.toContain('error');
		expect(states.at(-1)).toBe('idle');
	});

	it('reports an error when nothing can be played at all', async () => {
		const audio = new AudioService(media); // no speech synthesis to fall back on
		const states: PlaybackState[] = [];
		const done = audio.playSequence(await audio.resolveReveal(withAudio), (s) => states.push(s));
		for (const n of [1, 2, 3]) (await clip(n)).fail();
		await done;
		expect(states.at(-1)).toBe('error');
	});

	it('stop() ends a running sequence: later clips are never started', async () => {
		const audio = new AudioService(media);
		const done = audio.playSequence(await audio.resolveReveal(withAudio), () => {});
		await clip(1);
		audio.stop();
		await done;
		expect(FakeAudio.instances).toHaveLength(1);
	});

	it('starting other audio cancels the sequence in progress', async () => {
		const audio = new AudioService(media);
		const done = audio.playSequence(await audio.resolveReveal(withAudio), () => {});
		await clip(1);
		void audio.play({ kind: 'generated', url: '/other.mp3', text: 'y', lang: 'de-DE' }, () => {});
		await clip(2);
		await done;
		expect(FakeAudio.instances.map((a) => a.url)).toEqual(['/audio/de.mp3', '/other.mp3']);
	});
});
