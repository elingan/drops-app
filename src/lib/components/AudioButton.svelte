<script lang="ts">
	import type { AudioSource } from '$lib/domain/types';
	import type { PlaybackState } from '$lib/services/audio';
	import { m } from '$lib/paraglide/messages.js';
	import Icon from './Icon.svelte';

	/**
	 * Play / pause / replay with loading & error states. Renders nothing
	 * when the card has no audio at all.
	 */
	let {
		source,
		playback,
		onplay,
		onpause,
		showLabel = true,
		size = 56
	}: {
		source: AudioSource | undefined;
		playback: PlaybackState;
		onplay: () => void;
		onpause: () => void;
		showLabel?: boolean;
		size?: number;
	} = $props();

	const playing = $derived(playback === 'playing');
	const label = $derived(
		playback === 'playing' ? m.audio_playing()
		: playback === 'loading' ? m.audio_loading()
		: playback === 'paused' ? m.audio_paused()
		: playback === 'error' ? m.audio_error()
		: source?.kind === 'generated' ? m.audio_generated() : m.audio_native()
	);
	const action = $derived(playing ? m.audio_pause() : playback === 'idle' ? m.listen() : m.audio_replay());

	function click(e: MouseEvent) {
		e.stopPropagation();
		if (playing) onpause();
		else onplay();
	}
</script>

{#if source}
	<div class="audio">
		<button
			class="play"
			class:on={playing || playback === 'loading'}
			class:err={playback === 'error'}
			style:width="{size}px"
			style:height="{size}px"
			aria-label={action}
			onclick={click}
			onpointerdown={(e) => e.stopPropagation()}
		>
			{#if playback === 'loading'}
				<span class="spin" aria-hidden="true"></span>
			{:else if playing}
				<span class="wave" aria-hidden="true"><i></i><i></i><i></i></span>
			{:else}
				<Icon name={playback === 'error' ? 'rotate' : 'volume'} size={24} />
			{/if}
		</button>
		{#if showLabel}<span class="lbl" aria-live="polite">{label}</span>{/if}
	</div>
{/if}

<style>
	.audio { display: flex; align-items: center; gap: 12px; }
	.play {
		border: 0;
		border-radius: 50%;
		flex: none;
		display: grid;
		place-items: center;
		background: var(--color-accent-2-200);
		color: var(--color-accent-2-800);
		transition: background 0.2s, transform 0.15s;
	}
	.play:active { transform: scale(0.94); }
	.on { background: var(--color-accent); color: var(--color-neutral-100); }
	.err { background: var(--color-accent-100); color: var(--color-accent-800); }
	.lbl { font-size: 14px; color: var(--color-neutral-700); }
	.spin { width: 22px; height: 22px; border-radius: 50%; border: 3px solid currentColor; border-right-color: transparent; animation: d10spin 0.8s linear infinite; }
	.wave { display: flex; gap: 3px; height: 20px; align-items: center; }
	.wave i { display: block; width: 4px; height: 20px; border-radius: 2px; background: currentColor; animation: d10wave 0.8s ease-in-out infinite; }
	.wave i:nth-child(2) { animation-delay: 0.15s; }
	.wave i:nth-child(3) { animation-delay: 0.3s; }
</style>
