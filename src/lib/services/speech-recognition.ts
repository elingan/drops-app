/**
 * Speech-to-text abstraction. The default provider uses the browser's Web
 * Speech API when present; swap in a server/cloud provider without touching UI.
 */
export interface SpeechRecognitionResult {
	transcript: string;
	final: boolean;
}

export type SpeechErrorCode = 'not_supported' | 'permission_denied' | 'no_speech' | 'network' | 'unknown';

export interface SpeechRecognitionService {
	readonly supported: boolean;
	start(opts: {
		lang: string;
		onResult: (r: SpeechRecognitionResult) => void;
		onEnd: () => void;
		onError: (code: SpeechErrorCode) => void;
	}): void;
	stop(): void;
}

// Minimal typing for the (prefixed) Web Speech API.
interface WebSpeechRecognition {
	lang: string;
	interimResults: boolean;
	continuous: boolean;
	onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
	onerror: ((e: { error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}
type Ctor = new () => WebSpeechRecognition;

function getCtor(): Ctor | undefined {
	if (typeof window === 'undefined') return undefined;
	const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
	return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export class WebSpeechRecognitionService implements SpeechRecognitionService {
	private rec: WebSpeechRecognition | null = null;
	get supported() {
		return !!getCtor();
	}
	start({ lang, onResult, onEnd, onError }: Parameters<SpeechRecognitionService['start']>[0]) {
		const C = getCtor();
		if (!C) return onError('not_supported');
		this.stop();
		const rec = new C();
		rec.lang = lang;
		rec.interimResults = true;
		rec.continuous = false;
		rec.onresult = (e) => {
			let text = '';
			let final = false;
			for (let i = 0; i < e.results.length; i++) {
				const r = e.results[i]!;
				text += r[0]?.transcript ?? '';
				final = r.isFinal;
			}
			onResult({ transcript: text.trim(), final });
		};
		rec.onerror = (e) =>
			onError(
				e.error === 'not-allowed' || e.error === 'service-not-allowed'
					? 'permission_denied'
					: e.error === 'no-speech'
						? 'no_speech'
						: e.error === 'network'
							? 'network'
							: 'unknown'
			);
		rec.onend = () => {
			this.rec = null;
			onEnd();
		};
		this.rec = rec;
		rec.start();
	}
	stop() {
		this.rec?.stop();
	}
}
