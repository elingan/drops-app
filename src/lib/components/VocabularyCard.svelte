<script lang="ts">
	import type { LearningItem } from '$lib/domain/types';
	import { m } from '$lib/paraglide/messages.js';
	import Icon from './Icon.svelte';
	import MasteryDots from './MasteryDots.svelte';
	import MediaImage from './MediaImage.svelte';

	let {
		item,
		level,
		playing = false,
		onplay
	}: { item: LearningItem; level: number; playing?: boolean; onplay?: () => void } = $props();
</script>

<div class="row">
	<a class="main" href="/add?edit={item.id}">
		{#if item.imageId}<MediaImage id={item.imageId} size={46} />{/if}
		<span class="text">
			<span class="de" lang="de">{item.german}</span>
			{#if item.translation}<span class="es" lang="es">{item.translation}</span>{/if}
			{#if item.context}<span class="ctx">{item.context}</span>{/if}
		</span>
		<MasteryDots {level} />
	</a>
	{#if onplay}
		<button class="play" class:on={playing} aria-label="{m.listen()}: {item.german}" onclick={onplay}>
			<Icon name="volumeLow" size={18} />
		</button>
	{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--color-neutral-100);
		border-radius: 26px;
		padding: 10px 10px 10px 14px;
		min-height: 68px;
		transition: background 0.15s;
	}
	.row:hover { background: var(--color-neutral-200); }
	.main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; border-radius: 18px; }
	.main:hover { color: inherit; }
	.text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding-left: 4px; }
	.de { font-size: 17px; font-weight: 700; text-wrap: pretty; }
	.es { font-size: 14px; color: var(--color-neutral-700); }
	.ctx { font-size: 13px; color: var(--color-accent-2-800); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.play { width: 44px; height: 44px; flex: none; border: 0; border-radius: 50%; background: var(--color-neutral-200); color: var(--color-neutral-800); display: grid; place-items: center; }
	.play:active { background: var(--color-neutral-300); }
	.on { background: var(--color-accent); color: var(--color-neutral-100); }
</style>
