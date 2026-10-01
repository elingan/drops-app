<script lang="ts">
	import { fly } from 'svelte/transition';
	import Icon from './Icon.svelte';
	let { message }: { message: string | null } = $props();
</script>

<div class="region" role="status" aria-live="polite">
	{#if message}
		<div class="toast" transition:fly={{ y: -20, duration: 180 }}>
			<span class="ic"><Icon name="check" size={18} stroke={3.2} /></span>{message}
		</div>
	{/if}
</div>

<style>
	.region { position: absolute; top: calc(14px + env(safe-area-inset-top)); left: 18px; right: 18px; z-index: 50; pointer-events: none; }
	.toast {
		background: var(--color-neutral-900);
		color: var(--color-neutral-100);
		border-radius: 999px;
		padding: 14px 20px;
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 15px;
		font-weight: 600;
		box-shadow: var(--shadow-lg);
	}
	.ic { color: var(--color-accent-2-300); }
</style>
