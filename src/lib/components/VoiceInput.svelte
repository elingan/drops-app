<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { SpeechErrorCode, SpeechRecognitionService } from '$lib/services/speech-recognition';
	import Icon from './Icon.svelte';

	/** Dictation button: asks for mic permission, transcribes German, hands text back. */
	let {
		service,
		hasText,
		ontranscript,
		autostart = false
	}: {
		service: SpeechRecognitionService;
		hasText: boolean;
		ontranscript: (text: string, final: boolean) => void;
		autostart?: boolean;
	} = $props();

	let listening = $state(false);
	let error = $state<SpeechErrorCode | null>(null);

	function start() {
		if (listening) return service.stop();
		error = null;
		if (!service.supported) {
			error = 'not_supported';
			return;
		}
		listening = true;
		service.start({
			lang: 'de-DE',
			onResult: (r) => ontranscript(r.transcript, r.final),
			onEnd: () => (listening = false),
			onError: (code) => {
				error = code;
				listening = false;
			}
		});
	}

	$effect(() => {
		if (autostart) untrack(start);
		return () => service.stop();
	});

	const title = $derived(listening ? m.editor_mic_listening() : hasText ? m.editor_mic_got() : m.editor_mic_tap());
	const sub = $derived(
		error === 'not_supported' ? m.editor_mic_unsupported()
		: error === 'permission_denied' ? m.editor_mic_denied()
		: error ? m.editor_mic_error()
		: listening ? m.editor_mic_sub_listening()
		: hasText ? m.editor_mic_sub_again() : m.editor_mic_sub_tap()
	);
</script>

<div class="voice">
	<button type="button" class="mic" aria-label={m.editor_dictate()} aria-pressed={listening} onclick={start} disabled={error === 'not_supported'}>
		{#if listening}<span class="pulse" aria-hidden="true"></span>{/if}
		<Icon name="mic" size={30} />
	</button>
	<span class="txt" aria-live="polite">
		<span class="title">{title}</span>
		<span class="sub" class:err={!!error}>{sub}</span>
	</span>
</div>

<style>
	.voice { display: flex; align-items: center; gap: 16px; }
	.mic {
		position: relative;
		width: 76px;
		height: 76px;
		flex: none;
		border: 0;
		border-radius: 50%;
		background: var(--color-accent);
		color: var(--color-neutral-100);
		display: grid;
		place-items: center;
	}
	.mic:active { background: var(--color-accent-700); }
	.mic:disabled { opacity: 0.45; }
	.mic :global(svg) { position: relative; }
	.pulse { position: absolute; inset: 0; border-radius: 50%; background: var(--color-accent); animation: d10pulse 1.2s ease-out infinite; }
	.txt { display: flex; flex-direction: column; }
	.title { font-family: var(--font-heading); font-size: 21px; }
	.sub { font-size: 14px; color: var(--color-neutral-700); }
	.err { color: var(--color-accent-800); }
</style>
