<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import IconButton from './IconButton.svelte';

	let { onback, backIcon = 'chevronLeft', backLabel = m.back(), end }: {
		onback?: () => void;
		backIcon?: 'chevronLeft' | 'x';
		backLabel?: string;
		end?: Snippet;
	} = $props();
</script>

<div class="top">
	{#if onback}<IconButton icon={backIcon} label={backLabel} onclick={onback} iconSize={backIcon === 'x' ? 20 : 22} />{/if}
	<span class="spacer"></span>
	{@render end?.()}
</div>

<style>
	.top { display: flex; align-items: center; gap: 12px; min-height: 44px; }
	.spacer { flex: 1; }
</style>
