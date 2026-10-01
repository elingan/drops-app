<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, body, children }: { title: string; body?: string; children?: Snippet } = $props();
</script>

<div class="empty">
	<span class="t">{title}</span>
	{#if body}<span class="b">{body}</span>{/if}
	{@render children?.()}
</div>

<style>
	.empty { background: var(--color-neutral-100); border-radius: 30px; padding: 22px; display: flex; flex-direction: column; gap: 4px; }
	.t { font-family: var(--font-heading); font-size: 21px; }
	.b { font-size: 15px; color: var(--color-neutral-700); }
</style>
