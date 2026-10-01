import type { AudioSource, ReviewResult, RouteEntry, StudyCard } from '$lib/domain/types';
import { SESSION_SECONDS } from '$lib/domain/types';
import { SessionEngine, type SessionSummary } from '$lib/engine/session-engine';
import type { PlaybackState } from '$lib/services/audio';
import { learning, type LearningState } from './learning.svelte';

export type SessionPhase =
	| 'IDLE'
	| 'SHOW_CARD'
	| 'WAITING_FOR_RECALL'
	| 'REVEAL_ANSWER'
	| 'AUDIO'
	| 'WAITING_FOR_RATING'
	| 'NEXT_CARD'
	| 'SESSION_COMPLETE';

/** Card exit animation length (ms), matches the design's 230 ms. */
export const EXIT_MS = 230;
const ENTER_MS = 30;

/**
 * UI-facing session state machine built on Svelte runes.
 * Timing/queue/results live in SessionEngine; this class sequences phases,
 * persistence and audio.
 */
export class SessionState {
	phase = $state<SessionPhase>('IDLE');
	paused = $state(false);
	elapsed = $state(0);
	rememberLeft = $state(0);
	rememberTotal = $state(5);
	answered = $state(0);
	position = $state(0);
	entry = $state<RouteEntry | undefined>(undefined);
	exitDirection = $state<ReviewResult | null>(null);
	audioState = $state<PlaybackState>('idle');
	audioSource = $state<AudioSource | undefined>(undefined);
	summary = $state<SessionSummary | null>(null);
	categoryId = $state<string | undefined>(undefined);

	readonly target = SESSION_SECONDS;
	private engine: SessionEngine | null = null;
	private raf = 0;
	private last = 0;
	private finishAfterRating = false;
	private timers = new Set<ReturnType<typeof setTimeout>>();

	constructor(private readonly data: LearningState = learning) {}

	card = $derived.by((): StudyCard | undefined => {
		const e = this.entry;
		if (!e) return undefined;
		const item = this.data.itemsById.get(e.itemId);
		if (!item) return undefined;
		const category = this.data.categoriesById.get(item.categoryId) ?? {
			id: item.categoryId,
			name: '—',
			tone: 0 as const,
			createdAt: new Date(0)
		};
		const { engine } = this.data.services;
		return { item, category, progress: engine.progressFor(item.id, this.data.progress), reason: e.reason };
	});

	get revealed(): boolean {
		return this.phase === 'REVEAL_ANSWER' || this.phase === 'AUDIO' || this.phase === 'WAITING_FOR_RATING';
	}

	get remaining(): number {
		return Math.max(0, this.target - this.elapsed);
	}

	get active(): boolean {
		return this.phase !== 'IDLE' && this.phase !== 'SESSION_COMPLETE';
	}

	// ── Lifecycle ─────────────────────────────────────────────────────

	start(opts: { categoryId?: string; now?: Date; animate?: boolean } = {}): boolean {
		this.dispose();
		const now = opts.now ?? new Date();
		this.categoryId = opts.categoryId;
		const route = this.data.route({ categoryId: opts.categoryId });
		if (route.entries.length === 0) {
			this.phase = 'IDLE';
			return false;
		}
		this.engine = new SessionEngine(
			route.entries,
			(id) => {
				const it = this.data.itemsById.get(id);
				return it && { categoryId: it.categoryId, itemType: it.type };
			},
			(avoidFirst) => this.data.route({ categoryId: opts.categoryId, avoidFirst }).entries,
			now,
			{ targetDuration: this.target, categoryId: opts.categoryId }
		);
		this.summary = null;
		this.paused = false;
		this.elapsed = 0;
		this.answered = 0;
		this.finishAfterRating = false;
		this.showCard(now, opts.animate ?? true);
		if (typeof requestAnimationFrame !== 'undefined') this.loop();
		return true;
	}

	private showCard(now: Date, animate: boolean) {
		const engine = this.engine!;
		this.entry = engine.getCurrentCard();
		this.position = engine.position;
		this.exitDirection = null;
		this.rememberTotal = this.data.settings.rememberSeconds;
		this.rememberLeft = this.rememberTotal;
		this.stopAudio();
		this.audioSource = undefined;
		this.phase = 'SHOW_CARD';
		engine.markShown(now);
		void this.resolveAudio();
		if (animate) this.later(() => this.phase === 'SHOW_CARD' && (this.phase = 'WAITING_FOR_RECALL'), ENTER_MS);
		else this.phase = 'WAITING_FOR_RECALL';
	}

	private async resolveAudio() {
		const card = this.card;
		if (!card) return;
		const src = await this.data.services.audio.resolve(card.item);
		if (this.card?.item.id === card.item.id) this.audioSource = src;
	}

	private loop = () => {
		this.raf = requestAnimationFrame((t) => {
			const dt = this.last ? Math.min((t - this.last) / 1000, 0.5) : 0;
			this.last = t;
			this.tick(dt);
			if (this.active) this.loop();
		});
	};

	/** Advances time by `dt` seconds (driven by rAF, or directly in tests). */
	tick(dt: number): void {
		if (!this.engine || !this.active || this.paused) return;
		this.engine.tick(dt);
		this.elapsed = this.engine.elapsed;
		if (this.phase === 'WAITING_FOR_RECALL') {
			this.rememberLeft = Math.max(0, this.rememberLeft - dt);
			if (this.rememberLeft <= 0) this.reveal();
		}
		if (this.engine.isTimeUp) {
			// Let the user rate a card that is already revealed.
			if (this.revealed || this.phase === 'NEXT_CARD') this.finishAfterRating = true;
			else void this.complete();
		}
	}

	reveal(): void {
		if (this.phase !== 'WAITING_FOR_RECALL' && this.phase !== 'SHOW_CARD') return;
		this.phase = 'REVEAL_ANSWER';
		this.rememberLeft = 0;
		if (this.data.settings.autoPlayAudio && this.audioSource) void this.playAudio();
		else this.phase = 'WAITING_FOR_RATING';
	}

	async playAudio(): Promise<void> {
		const src = this.audioSource;
		if (!src) return;
		if (this.revealed) this.phase = 'AUDIO';
		await this.data.services.audio.play(src, (s) => {
			this.audioState = s;
			if ((s === 'idle' || s === 'error') && this.phase === 'AUDIO') this.phase = 'WAITING_FOR_RATING';
		});
	}

	pauseAudio(): void {
		this.data.services.audio.pause();
	}

	stopAudio(): void {
		if (this.audioState !== 'idle') this.data.services.audio.stop();
		this.audioState = 'idle';
	}

	answer(result: ReviewResult, now = new Date()): void {
		const engine = this.engine;
		if (!engine || !this.revealed || this.paused) return;
		const record = engine.submitResult(result, now);
		if (!record) return;
		this.phase = 'NEXT_CARD';
		this.exitDirection = result;
		this.answered = engine.results.length;
		this.stopAudio();
		void this.data.recordResult(record.learningItemId, result, record);
		void this.data.saveSession({ ...engine.session });
		this.later(() => {
			if (this.finishAfterRating || engine.isTimeUp) return void this.complete();
			engine.nextCard();
			this.showCard(new Date(), true);
		}, EXIT_MS);
	}

	pause(): void {
		if (!this.active) return;
		this.stopAudio();
		this.paused = true;
	}

	resume(): void {
		this.paused = false;
		this.last = 0;
	}

	async complete(now = new Date()): Promise<void> {
		if (!this.engine || this.phase === 'SESSION_COMPLETE') return;
		if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
		this.clearTimers();
		this.stopAudio();
		this.paused = false;
		this.summary = this.engine.completeSession(now);
		this.phase = 'SESSION_COMPLETE';
		if (this.summary.session.itemsReviewed > 0) await this.data.saveSession(this.summary.session);
	}

	/** Leaves the session screen (keeps nothing running). */
	dispose(): void {
		if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
		this.clearTimers();
		this.stopAudio();
		this.engine = null;
		this.last = 0;
		this.phase = 'IDLE';
		this.entry = undefined;
	}

	private later(fn: () => void, ms: number) {
		const t = setTimeout(() => {
			this.timers.delete(t);
			fn();
		}, ms);
		this.timers.add(t);
	}

	private clearTimers() {
		for (const t of this.timers) clearTimeout(t);
		this.timers.clear();
	}
}

export const session = new SessionState();
