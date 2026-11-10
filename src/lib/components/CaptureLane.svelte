<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { AudioRecorder, type PlaybackState } from '$lib/services/audio';
	import { learning } from '$lib/state/learning.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import Icon from './Icon.svelte';

	/**
	 * One half of a phrase capture: records the voice and, with the browser's
	 * speech recognition, writes what is said as it is said. The text stays
	 * editable, and "Dictar" transcribes again without recording, for phones
	 * that cannot record and transcribe at the same time.
	 */
	let {
		lang,
		step,
		title,
		hint,
		placeholder,
		text = $bindable(''),
		audioId = $bindable(),
		busy = $bindable(false),
		locked = false,
		oncreated
	}: {
		lang: 'de-DE' | 'es-ES';
		step: number;
		title: string;
		hint: string;
		placeholder: string;
		text?: string;
		audioId?: string;
		busy?: boolean;
		locked?: boolean;
		oncreated: (id: string) => void;
	} = $props();

	const svc = learning.services;
	const recorder = new AudioRecorder();
	const canRecord = AudioRecorder.supported();

	let mode = $state<'idle' | 'recording' | 'dictating' | 'saving'>('idle');
	let speechIssue = $state(false);
	let playback = $state<PlaybackState>('idle');
	/** Text already confirmed before the current recognition run (the browser restarts it after pauses). */
	let committed = '';
	let wantSpeech = false;

	$effect(() => {
		busy = mode !== 'idle';
	});

	$effect(() => () => {
		stopSpeech();
		if (mode === 'recording') recorder.stop().catch(() => {});
	});

	function listen() {
		if (!svc.speech.supported) {
			speechIssue = true;
			if (mode === 'dictating') mode = 'idle';
			return;
		}
		committed = text.trim();
		wantSpeech = true;
		svc.speech.start({
			lang,
			continuous: true,
			onResult: (r) => {
				if (wantSpeech) text = [committed, r.transcript].filter(Boolean).join(' ');
			},
			onEnd: () => {
				// Chrome ends recognition after a pause; keep going while we still listen.
				if (wantSpeech && (mode === 'recording' || mode === 'dictating')) listen();
			},
			onError: (code) => {
				if (code === 'no_speech') return;
				wantSpeech = false;
				speechIssue = true;
				if (code === 'permission_denied' && mode === 'dictating') ui.flash(m.editor_mic_denied());
				if (mode === 'dictating') mode = 'idle';
			}
		});
	}

	function stopSpeech() {
		wantSpeech = false;
		svc.speech.stop();
	}

	async function toggleRecord() {
		if (mode === 'recording') return finish();
		if (mode !== 'idle' || locked) return;
		svc.audio.stop();
		try {
			await recorder.start();
		} catch {
			ui.flash(m.editor_mic_denied());
			return;
		}
		mode = 'recording';
		speechIssue = false;
		text = '';
		listen();
	}

	async function finish() {
		stopSpeech();
		mode = 'saving';
		try {
			const blob = await recorder.stop();
			const id = await svc.repos.media.put(blob);
			oncreated(id);
			audioId = id;
		} finally {
			mode = 'idle';
		}
	}

	function toggleDictate() {
		if (mode === 'dictating') {
			stopSpeech();
			mode = 'idle';
			return;
		}
		if (mode !== 'idle' || locked) return;
		svc.audio.stop();
		mode = 'dictating';
		speechIssue = false;
		listen();
	}

	async function play() {
		if (!audioId) return;
		if (playback === 'playing') return svc.audio.stop();
		const src = await svc.audio.resolveRecording(audioId, lang);
		if (src) await svc.audio.play(src, (s) => (playback = s));
	}

	const status = $derived(
		mode === 'recording' ? m.capture_recording()
		: mode === 'dictating' ? m.capture_dictating()
		: audioId ? m.capture_recorded()
		: hint
	);
</script>

<section class="lane" class:active={mode !== 'idle'} class:dim={locked && mode === 'idle'} aria-labelledby="lane-{step}">
	<div class="head">
		<span class="num" class:done={!!audioId || !!text.trim()}>{#if audioId && text.trim()}<Icon name="check" size={16} stroke={3} />{:else}{step}{/if}</span>
		<span class="col">
			<span class="t" id="lane-{step}">{title}</span>
			<span class="s" aria-live="polite">{status}</span>
		</span>
	</div>

	<div class="row">
		{#if canRecord}
			<button
				type="button"
				class="rec"
				class:on={mode === 'recording'}
				aria-pressed={mode === 'recording'}
				aria-label={mode === 'recording' ? m.capture_stop() : audioId ? m.capture_rerecord() : m.capture_record()}
				disabled={locked || (mode !== 'idle' && mode !== 'recording')}
				onclick={toggleRecord}
			>
				{#if mode === 'recording'}<span class="pulse" aria-hidden="true"></span><Icon name="square" size={26} />{:else}<Icon name="mic" size={30} />{/if}
			</button>
		{/if}
		<textarea
			bind:value={text}
			lang={lang.slice(0, 2)}
			maxlength="300"
			rows="3"
			{placeholder}
			aria-label={title}
			readonly={mode === 'recording' || mode === 'dictating'}
		></textarea>
	</div>

	{#if speechIssue}
		<p class="issue" role="status">{svc.speech.supported ? m.capture_speech_issue() : m.editor_mic_unsupported()}</p>
	{/if}

	<div class="actions">
		{#if audioId}
			<button type="button" class="pill" disabled={mode !== 'idle'} onclick={play}>
				<Icon name={playback === 'playing' ? 'pause' : 'play'} size={16} />{m.capture_listen()}
			</button>
		{/if}
		{#if svc.speech.supported}
			<button type="button" class="pill" class:on={mode === 'dictating'} disabled={locked || (mode !== 'idle' && mode !== 'dictating')} onclick={toggleDictate}>
				<Icon name={mode === 'dictating' ? 'square' : 'type'} size={16} />{mode === 'dictating' ? m.capture_dictate_stop() : m.editor_dictate()}
			</button>
		{/if}
	</div>
</section>

<style>
	.lane { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 30px; background: var(--color-neutral-100); transition: opacity 0.2s; }
	.lane.active { box-shadow: 0 0 0 2px var(--color-accent); }
	.lane.dim { opacity: 0.55; }
	.head { display: flex; align-items: center; gap: 12px; }
	.num { width: 32px; height: 32px; flex: none; border-radius: 50%; background: var(--color-neutral-200); color: var(--color-neutral-800); display: grid; place-items: center; font-weight: 800; font-size: 15px; }
	.num.done { background: var(--color-accent-2-700); color: var(--color-neutral-100); }
	.col { display: flex; flex-direction: column; min-width: 0; }
	.t { font-size: 17px; font-weight: 800; }
	.s { font-size: 13px; color: var(--color-neutral-700); }
	.row { display: flex; align-items: flex-start; gap: 12px; }
	.rec { position: relative; width: 72px; height: 72px; flex: none; border: 0; border-radius: 50%; background: var(--color-accent); color: var(--color-neutral-100); display: grid; place-items: center; }
	.rec:disabled { opacity: 0.5; }
	.rec.on { background: var(--color-accent-800); }
	.pulse { position: absolute; inset: -6px; border-radius: 50%; border: 3px solid var(--color-accent); animation: pulse 1.4s ease-out infinite; }
	@keyframes pulse { from { transform: scale(0.9); opacity: 1; } to { transform: scale(1.2); opacity: 0; } }
	@media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
	textarea { flex: 1; min-width: 0; min-height: 92px; border: 0; resize: none; border-radius: 22px; padding: 14px 16px; background: var(--color-neutral-200); color: var(--color-text); caret-color: var(--color-accent); font-family: var(--font-heading); font-size: 20px; line-height: 1.25; }
	.issue { margin: 0; padding: 0 6px; font-size: 13px; font-weight: 600; color: var(--color-accent-800); }
	.actions { display: flex; flex-wrap: wrap; gap: 8px; }
	.actions:empty { display: none; }
	.pill { border: 0; min-height: 44px; padding: 0 16px; border-radius: 999px; background: var(--color-neutral-200); color: var(--color-text); display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }
	.pill.on { background: var(--color-accent); color: var(--color-neutral-100); }
	.pill:disabled { opacity: 0.5; }
</style>
