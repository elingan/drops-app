<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { clock } from '$lib/utils/format';
	let { remaining }: { remaining: number } = $props();
	// Announce only whole minutes to screen readers.
	const minute = $derived(Math.ceil(remaining / 60));
</script>

<span class="time" role="timer" aria-label="{m.session_time_left()}: {minute} min">{clock(remaining)}</span>

<style>
	.time { font-family: var(--font-heading); font-size: 20px; font-variant-numeric: tabular-nums; min-width: 58px; text-align: right; }
</style>
