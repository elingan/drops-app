import type { AudioSource, LearningItem } from '$lib/domain/types';
import type { MediaRepository } from '$lib/repositories/interfaces';
import { spokenGerman, spokenSpanish } from '$lib/utils/speech-text';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/**
 * Resolves and plays pronunciation. Priority: native URL → recorded clip
 * (MediaRepository) → generated audio URL (ElevenLabs MP3) → browser speech
 * synthesis, which also takes over when an audio file fails to load.
 * On reveal a card says: German word → Spanish translation → example sentence.
 */
export class AudioService {
	private audio: HTMLAudioElement | null = null;
	private objectUrls = new Map<string, string>();
	private listener: ((s: PlaybackState) => void) | null = null;
	private current: string | null = null;
	/** Bumped whenever playback is started or stopped from outside, so a running sequence gives up. */
	private sequence = 0;

	constructor(private readonly media: MediaRepository) {}

	static hasSpeechSynthesis(): boolean {
		return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
	}

	async resolve(item: LearningItem): Promise<AudioSource | undefined> {
		const base = { text: spokenGerman(item.german), lang: 'de-DE' };
		if (item.nativeAudioUrl) return { ...base, kind: 'native', url: item.nativeAudioUrl };
		if (item.nativeAudioId) {
			const url = await this.objectUrl(item.nativeAudioId);
			if (url) return { ...base, kind: 'recorded', url };
		}
		if (item.audioUrl) return { ...base, kind: 'generated', url: item.audioUrl };
		if (AudioService.hasSpeechSynthesis()) return { ...base, kind: 'generated' };
		return undefined;
	}

	/** The Spanish translation (first meaning), as an MP3 or, failing that, browser speech. */
	resolveTranslation(item: LearningItem): AudioSource | undefined {
		const text = item.translation ? spokenSpanish(item.translation) : '';
		return text ? this.generated(text, 'es-ES', item.translationAudioUrl) : undefined;
	}

	/** The example sentence, as an MP3 or, failing that, browser speech. */
	resolveExample(item: LearningItem): AudioSource | undefined {
		const text = item.example ? spokenGerman(item.example) : '';
		return text ? this.generated(text, 'de-DE', item.exampleAudioUrl) : undefined;
	}

	/** What a revealed card says, in order: word, translation, example. Missing parts are skipped. */
	async resolveReveal(item: LearningItem): Promise<AudioSource[]> {
		const word = await this.resolve(item);
		return [word, this.resolveTranslation(item), this.resolveExample(item)].filter((s): s is AudioSource => !!s);
	}

	private generated(text: string, lang: string, url?: string): AudioSource | undefined {
		if (url) return { kind: 'generated', text, lang, url };
		return AudioService.hasSpeechSynthesis() ? { kind: 'generated', text, lang } : undefined;
	}

	private async objectUrl(id: string): Promise<string | undefined> {
		const cached = this.objectUrls.get(id);
		if (cached) return cached;
		const blob = await this.media.get(id);
		if (!blob) return undefined;
		const url = URL.createObjectURL(blob);
		this.objectUrls.set(id, url);
		return url;
	}

	/** Plays a source; `onState` receives every state change of this playback. */
	async play(src: AudioSource, onState: (s: PlaybackState) => void): Promise<void> {
		this.sequence++;
		return this.start(src, onState);
	}

	private async start(src: AudioSource, onState: (s: PlaybackState) => void): Promise<void> {
		this.halt();
		this.listener = onState;
		const token = crypto.randomUUID();
		this.current = token;
		const emit = (s: PlaybackState) => {
			if (this.current === token) this.listener?.(s);
		};
		if (!src.url) return this.speak(src, emit);
		emit('loading');
		const a = new Audio(src.url);
		this.audio = a;
		// A file that cannot be loaded or played is read by the browser voice instead.
		let fellBack = false;
		const fallback = () => {
			if (fellBack || this.current !== token) return;
			fellBack = true;
			a.onplaying = a.onpause = a.onended = a.onerror = null;
			this.audio = null;
			this.speak({ ...src, url: undefined }, emit);
		};
		a.onplaying = () => emit('playing');
		a.onpause = () => emit(a.ended ? 'idle' : 'paused');
		a.onended = () => emit('idle');
		a.onerror = fallback;
		try {
			await a.play();
		} catch {
			fallback();
		}
	}

	/** Plays a source and resolves when it ends (or fails, or is stopped). */
	playToEnd(src: AudioSource, onState?: (s: PlaybackState) => void): Promise<void> {
		return new Promise((resolve) => {
			void this.start(src, (s) => {
				onState?.(s);
				if (s === 'idle' || s === 'error') resolve();
			});
		});
	}

	/**
	 * Plays the sources one after the other. `onState` follows the clip being
	 * played and only reports `idle` (or `error`, if nothing could be played)
	 * once the whole sequence is over. Starting other audio or stopping ends it.
	 */
	async playSequence(sources: AudioSource[], onState: (s: PlaybackState) => void): Promise<void> {
		const run = ++this.sequence;
		const alive = () => this.sequence === run;
		let failed = 0;
		for (const src of sources) {
			if (!alive()) return;
			let clipFailed = false;
			await this.playToEnd(src, (s) => {
				if (s === 'error') clipFailed = true;
				else if (s !== 'idle' && alive()) onState(s);
			});
			if (clipFailed) failed++;
		}
		if (alive()) onState(sources.length > 0 && failed === sources.length ? 'error' : 'idle');
	}

	private speak(src: AudioSource, emit: (s: PlaybackState) => void) {
		if (!AudioService.hasSpeechSynthesis()) return emit('error');
		const u = new SpeechSynthesisUtterance(src.text);
		u.lang = src.lang;
		u.rate = src.rate ?? 0.9;
		const prefix = src.lang.slice(0, 2).toLowerCase();
		const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix));
		if (voice) u.voice = voice;
		u.onstart = () => emit('playing');
		u.onend = () => emit('idle');
		u.onerror = (e) => emit(e.error === 'interrupted' || e.error === 'canceled' ? 'idle' : 'error');
		emit('loading');
		speechSynthesis.cancel();
		speechSynthesis.speak(u);
	}

	pause(): void {
		if (this.audio && !this.audio.paused) this.audio.pause();
		else if (AudioService.hasSpeechSynthesis()) speechSynthesis.pause();
	}

	resume(): void {
		if (this.audio?.paused) void this.audio.play();
		else if (AudioService.hasSpeechSynthesis()) speechSynthesis.resume();
	}

	stop(): void {
		this.sequence++;
		this.halt();
	}

	private halt(): void {
		const prev = this.listener;
		this.current = null;
		this.listener = null;
		if (this.audio) {
			this.audio.onpause = this.audio.onended = this.audio.onerror = this.audio.onplaying = null;
			this.audio.pause();
			this.audio = null;
		}
		if (AudioService.hasSpeechSynthesis()) speechSynthesis.cancel();
		prev?.('idle');
	}
}

/** Records a short pronunciation clip with MediaRecorder. */
export class AudioRecorder {
	private rec: MediaRecorder | null = null;
	private chunks: Blob[] = [];

	static supported(): boolean {
		return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
	}

	async start(): Promise<void> {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		this.chunks = [];
		this.rec = new MediaRecorder(stream);
		this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
		this.rec.start();
	}

	stop(): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const rec = this.rec;
			if (!rec) return reject(new Error('not_recording'));
			rec.onstop = () => {
				rec.stream.getTracks().forEach((t) => t.stop());
				resolve(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }));
			};
			rec.stop();
			this.rec = null;
		});
	}
}
