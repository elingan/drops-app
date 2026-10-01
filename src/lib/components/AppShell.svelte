<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { ui } from '$lib/state/ui.svelte';
	import BottomNavigation from './BottomNavigation.svelte';
	import Icon from './Icon.svelte';
	import NewCategorySheet from './NewCategorySheet.svelte';
	import SettingsSheet from './SettingsSheet.svelte';
	import Toast from './Toast.svelte';

	let { children, nav = false }: { children: Snippet; nav?: boolean } = $props();
</script>

<svelte:window ononline={() => (ui.online = true)} onoffline={() => (ui.online = false)} />

<div class="stage">
	<div class="app" data-screen-label="App">
		{#if !ui.online}
			<div class="offline" role="status"><Icon name="wifiOff" size={16} />{m.offline()}</div>
		{/if}
		<main class="screen" class:with-nav={nav}>
			{@render children()}
		</main>
		{#if nav}<BottomNavigation />{/if}
		<Toast message={ui.toast} />
		<SettingsSheet />
		<NewCategorySheet />
	</div>
</div>

<style>
	.stage {
		min-height: 100dvh;
		display: flex;
		justify-content: center;
		background: var(--color-neutral-300);
	}
	.app {
		position: relative;
		width: 100%;
		max-width: 430px;
		height: 100dvh;
		background: var(--color-bg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-lg);
	}
	.screen { flex: 1; min-height: 0; display: flex; flex-direction: column; }
	.offline {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 16px calc(8px);
		padding-top: calc(8px + env(safe-area-inset-top));
		background: var(--color-neutral-800);
		color: var(--color-neutral-100);
		font-size: 13px;
		font-weight: 600;
	}
	@media (min-width: 760px) {
		.app { height: min(100dvh, 932px); margin-block: auto; border-radius: 40px; }
	}
</style>
