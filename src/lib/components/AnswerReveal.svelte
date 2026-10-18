<script lang="ts">
	import type { LearningItem } from '$lib/domain/types';
	import Icon from './Icon.svelte';

	let { item, showSpanish }: { item: LearningItem; showSpanish: boolean } = $props();
	// The design leads with the German paraphrase; Spanish is secondary.
	const main = $derived(item.alt || item.translation || '');
	const sub = $derived(item.alt && item.translation && showSpanish ? item.translation : '');
</script>

<div class="reveal">
	<div class="meaning">
		<div class="bar" aria-hidden="true"></div>
		{#if main}<div class="main" lang={item.alt ? 'de' : 'es'}>{main}</div>{/if}
		{#if sub}<div class="sub" lang="es">{sub}</div>{/if}
	</div>
	{#if item.example}
		<figure class="example">
			<blockquote lang="de">{item.example}</blockquote>
			{#if item.exampleTranslation && showSpanish}<figcaption lang="es">{item.exampleTranslation}</figcaption>{/if}
		</figure>
	{/if}
	{#if item.context}
		<div class="ctx"><Icon name="message" size={18} /><span>{item.context}</span></div>
	{/if}
</div>

<style>
	.reveal { display: flex; flex-direction: column; gap: 18px; animation: d10fade-up 0.22s var(--ease-out); }
	.meaning { display: flex; flex-direction: column; gap: 8px; }
	.bar { width: 40px; height: 6px; border-radius: 999px; background: var(--color-accent-2-400); }
	.main { font-size: 22px; line-height: 1.3; font-weight: 700; color: var(--color-accent-2-800); text-wrap: pretty; }
	.sub { font-size: 17px; color: var(--color-neutral-700); }
	.example { margin: 0; display: flex; flex-direction: column; gap: 4px; padding-left: 14px; border-left: 3px solid var(--color-accent-2-300); }
	.example blockquote { margin: 0; font-size: 18px; line-height: 1.35; font-weight: 600; color: var(--color-neutral-900); text-wrap: pretty; }
	.example figcaption { font-size: 15px; line-height: 1.35; color: var(--color-neutral-700); }
	.ctx {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		background: var(--color-accent-2-100);
		color: var(--color-accent-2-900);
		border-radius: 22px;
		padding: 12px 16px;
		font-size: 15px;
		line-height: 1.4;
	}
	.ctx :global(svg) { margin-top: 2px; }
</style>
