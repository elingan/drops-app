import type { AudioSource, LearningItem } from '$lib/domain/types';
import type { MediaRepository } from '$lib/repositories/interfaces';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/**
 * Resolves and plays pronunciation. Priority: native URL → recorded clip
 * (MediaRepository) → generated audio URL → browser speech synthesis.
 */
export class AudioService {
	private audio: HTMLAudioElement | null = null;
	private objectUrls = new Map<string, string>();
	private listener: ((s: PlaybackState) => void) | null = null;
	private current: string | null = null;

	constructor(private readonly media: MediaRepository) {}

	static hasSpeechSynthesis(): boolean {
		return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
	}

	async resolve(item: LearningItem): Promise<AudioSource | undefined> {
		const base = { text: item.german, lang: 'de-DE' };
		if (item.nativeAudioUrl) return { ...base, kind: 'native', url: item.nativeAudioUrl };
		if (item.nativeAudioId) {
			const url = await this.objectUrl(item.nativeAudioId);
			if (url) return { ...base, kind: 'recorded', url };
		}
		if (item.audioUrl) return { ...base, kind: 'generated', url: item.audioUrl };
		if (AudioService.hasSpeechSynthesis()) return { ...base, kind: 'generated' };
		return undefined;
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
		this.stop();
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
		a.onplaying = () => emit('playing');
		a.onpause = () => emit(a.ended ? 'idle' : 'paused');
		a.onended = () => emit('idle');
		a.onerror = () => emit('error');
		try {
			await a.play();
		} catch {
			emit('error');
		}
	}

	private speak(src: AudioSource, emit: (s: PlaybackState) => void) {
		if (!AudioService.hasSpeechSynthesis()) return emit('error');
		const u = new SpeechSynthesisUtterance(src.text);
		u.lang = src.lang;
		u.rate = 0.9;
		const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('de'));
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
