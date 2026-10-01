<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ImageTiming, LearningItem } from '$lib/domain/types';
	import { m } from '$lib/paraglide/messages.js';
	import AnswerReveal from './AnswerReveal.svelte';
	import MediaImage from './MediaImage.svelte';

	/**
	 * Card face: kind, German text, optional photo, and (after reveal) the
	 * meaning. Audio controls are passed in as a snippet.
	 */
	let {
		item,
		revealed,
		showSpanish = true,
		imageTiming = 'after',
		audio
	}: {
		item: LearningItem;
		revealed: boolean;
		showSpanish?: boolean;
		imageTiming?: ImageTiming;
		audio?: Snippet;
	} = $props();

	const isPhrase = $derived(item.type === 'phrase');
	const size = $derived(isPhrase ? (item.german.length > 30 ? '31px' : '35px') : '48px');
	const showImg = $derived(!!item.imageId && (revealed || imageTiming === 'before'));
</script>

<div class="face">
	<span class="kind">{isPhrase ? m.session_type_phrase() : m.session_type_word()}</span>
	<div class="body">
		{#if showImg && item.imageId}<MediaImage id={item.imageId} />{/if}
		<p class="de" lang="de" style:font-size={size}>{item.german}</p>
		{#if revealed}<AnswerReveal {item} {showSpanish} />{/if}
	</div>
	{@render audio?.()}
</div>

<style>
	.face { height: 100%; display: flex; flex-direction: column; }
	.kind { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: var(--color-accent-700); }
	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: safe center;
		gap: 18px;
		min-height: 0;
		overflow-y: auto;
		margin: 10px 0;
		scrollbar-width: none;
	}
	.de { margin: 0; font-family: var(--font-heading); line-height: 1.12; letter-spacing: -0.01em; text-wrap: balance; overflow-wrap: anywhere; hyphens: auto; }
</style>
