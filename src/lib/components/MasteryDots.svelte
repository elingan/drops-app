<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	/** -1 = never studied, 0..3 = mastery steps. */
	let { level }: { level: number } = $props();
</script>

<span class="dots" role="img" aria-label={m.mastery_label({ n: Math.max(0, level + 1) })}>
	{#each [0, 1, 2, 3] as k (k)}
		<span class="dot" class:on={k <= level}></span>
	{/each}
</span>

<style>
	.dots { display: flex; gap: 3px; flex: none; }
	.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-neutral-300); }
	.on { background: var(--color-accent-2-600); }
</style>
