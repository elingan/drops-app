<script lang="ts">
	let {
		value,
		height = 8,
		fill = 'var(--color-accent-2-600)',
		label,
		animate = true
	}: { value: number; height?: number; fill?: string; label?: string; animate?: boolean } = $props();
	const pct = $derived(Math.max(0, Math.min(1, value)) * 100);
</script>

<span
	class="track"
	style:height="{height}px"
	role="progressbar"
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(pct)}
	aria-label={label}
>
	<span class="bar" class:animate style:width="{pct}%" style:background={fill}></span>
</span>

<style>
	.track {
		display: block;
		flex: 1;
		border-radius: 999px;
		background: var(--color-neutral-300);
		overflow: hidden;
	}
	.bar { display: block; height: 100%; border-radius: 999px; }
	.animate { transition: width 0.5s var(--ease-out); }
</style>
