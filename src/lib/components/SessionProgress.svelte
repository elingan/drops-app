<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	let { elapsed, target }: { elapsed: number; target: number } = $props();
	const pct = $derived(Math.min(100, (elapsed / target) * 100));
</script>

<div class="track" role="progressbar" aria-label={m.session_time_left()} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
	<div class="bar" style:width="{pct}%"></div>
</div>

<style>
	.track { flex: 1; height: 10px; border-radius: 999px; background: var(--color-neutral-300); overflow: hidden; }
	.bar { height: 100%; border-radius: 999px; background: var(--color-accent); transition: width 0.2s linear; }
</style>
