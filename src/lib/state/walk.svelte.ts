import type { AudioSource, LearningItem, RouteEntry } from '$lib/domain/types';
import { learning, type LearningState } from './learning.svelte';

export type WalkStep = 'german' | 'spanish' | 'again' | 'gap';

export interface WalkSettings {
	/** Read the Spanish meaning after the German. */
	spanish: boolean;
	/** Say the German a second time at the end. */
	repeat: boolean;
	/** Speech rate for generated voices. */
	rate: number;
	/** Pause between cards, in seconds. */
	gap: number;
}

export const WALK_DEFAULTS: WalkSettings = { spanish: true, repeat: true, rate: 0.85, gap: 3 };
const STORAGE_KEY = 'd10.walk';
/** Cards planned per batch; the playlist refills (rotating) when it runs out. */
const BATCH = 30;
/** Listening is passive, so introduce more new cards per batch than in a session. */
const BATCH_NEW = 20;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Hands-free "walk" mode: plays German → Spanish → German card after card
 * without any interaction. It reuses the learning engine's route (due and
 * difficult cards first, categories interleaved) and excludes cards already
 * heard, so a long walk keeps moving through new material.
 * Listening is passive: it doesn't touch spaced-repetition progress.
 */
export class WalkState {
	status = $state<'idle' | 'playing' | 'paused'>('idle');
	item = $state<LearningItem | undefined>(undefined);
	step = $state<WalkStep>('german');
	heard = $state(0);
	categoryId = $state<string | undefined>(undefined);
	settings = $state<WalkSettings>(this.loadSettings());

	private queue: RouteEntry[] = [];
	private done = new Set<string>();
	private runId = 0;
	private wake: WakeLockSentinel | null = null;

	constructor(private readonly data: LearningState = learning) {}

	get category() {
		return this.item && this.data.categoriesById.get(this.item.categoryId);
	}

	start(categoryId?: string): boolean {
		this.stop();
		this.categoryId = categoryId;
		this.done.clear();
		this.queue = [];
		this.heard = 0;
		if (!this.refill()) return false;
		this.play();
		return true;
	}

	/** Starts or resumes playback of the current card. */
	play(): void {
		if (this.status === 'playing') return;
		this.status = 'playing';
		void this.acquireWakeLock();
		void this.loop(++this.runId);
	}

	pause(): void {
		if (this.status !== 'playing') return;
		this.status = 'paused';
		this.runId++;
		this.data.services.audio.stop();
		this.releaseWakeLock();
	}

	toggle(): void {
		if (this.status === 'playing') this.pause();
		else this.play();
	}

	/** Skips to the next card, keeping the paused/playing state. */
	skip(): void {
		const wasPlaying = this.status === 'playing';
		this.runId++;
		this.data.services.audio.stop();
		this.advance();
		if (wasPlaying) {
			this.status = 'paused';
			this.play();
		}
	}

	stop(): void {
		this.runId++;
		this.data.services.audio.stop();
		this.releaseWakeLock();
		this.status = 'idle';
		this.item = undefined;
	}

	update(patch: Partial<WalkSettings>): void {
		this.settings = { ...this.settings, ...patch };
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(this.settings)));
		} catch {
			/* private mode: settings just don't persist */
		}
	}

	// ── Playback loop ───────────────────────────────────────────────

	private async loop(id: number) {
		const alive = () => this.runId === id;
		const { audio } = this.data.services;
		while (alive()) {
			const item = this.item ?? this.advance();
			if (!item) return this.stop();
			const { spanish, repeat, rate, gap } = this.settings;

			this.step = 'german';
			const de = await audio.resolve(item);
			if (!alive()) return;
			if (de) await audio.playToEnd({ ...de, rate });
			if (!alive()) return;

			if (spanish && item.translation) {
				await wait(900);
				if (!alive()) return;
				this.step = 'spanish';
				await audio.playToEnd(this.spanishSource(item.translation, rate));
				if (!alive()) return;
			}
			if (repeat && de) {
				await wait(900);
				if (!alive()) return;
				this.step = 'again';
				await audio.playToEnd({ ...de, rate });
				if (!alive()) return;
			}

			this.step = 'gap';
			// Longer phrases get a little more time to sink in.
			await wait(gap * 1000 + (item.type === 'phrase' ? 1000 : 0));
			if (!alive()) return;
			this.heard++;
			this.advance();
		}
	}

	private spanishSource(text: string, rate: number): AudioSource {
		// «a; b» / «a, b»: reading every synonym drags on, the first meaning is enough.
		const first = text.split(/[;·]/)[0]!.trim();
		return { kind: 'generated', text: first, lang: 'es-ES', rate };
	}

	/** Moves to the next card of the playlist, refilling it when empty. */
	private advance(): LearningItem | undefined {
		if (this.item) this.done.add(this.item.id);
		for (let tries = 0; tries < 3; tries++) {
			while (this.queue.length) {
				const next = this.data.itemsById.get(this.queue.shift()!.itemId);
				if (next) return (this.item = next);
			}
			if (!this.refill()) break;
		}
		return (this.item = undefined);
	}

	private refill(): boolean {
		const { entries } = this.data.route({
			categoryId: this.categoryId,
			size: BATCH,
			maxNew: BATCH_NEW,
			avoidFirst: this.item?.id,
			exclude: this.done
		});
		this.queue = entries;
		if (!this.item) this.item = this.data.itemsById.get(entries[0]?.itemId ?? '');
		if (this.item && this.queue[0]?.itemId === this.item.id) this.queue.shift();
		return entries.length > 0;
	}

	// ── Keep playing while walking ───────────────────────────────────

	private async acquireWakeLock() {
		try {
			this.wake ??= (await navigator.wakeLock?.request('screen')) ?? null;
		} catch {
			/* unsupported or denied: playback still works */
		}
	}

	private releaseWakeLock() {
		void this.wake?.release().catch(() => {});
		this.wake = null;
	}

	private loadSettings(): WalkSettings {
		try {
			return { ...WALK_DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
		} catch {
			return { ...WALK_DEFAULTS };
		}
	}
}

export const walk = new WalkState();
