<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { m } from '$lib/paraglide/messages.js';

	let {
		open,
		title,
		onclose,
		children
	}: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props();

	let panel = $state<HTMLElement>();
	let returnFocus: Element | null = null;

	$effect(() => {
		if (!open) return;
		returnFocus = document.activeElement;
		queueMicrotask(() => panel?.querySelector<HTMLElement>('input,button,select,textarea')?.focus());
		return () => (returnFocus as HTMLElement | null)?.focus?.();
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
		}
		if (e.key === 'Tab' && panel) {
			const f = [...panel.querySelectorAll<HTMLElement>('a,button:not(:disabled),input,select,textarea,[tabindex="0"]')];
			if (!f.length) return;
			const first = f[0]!;
			const last = f[f.length - 1]!;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}
</script>

{#if open}
	<div class="backdrop" transition:fade={{ duration: 160 }} onclick={onclose} aria-hidden="true"></div>
	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
		bind:this={panel}
		{onkeydown}
		transition:fly={{ y: 300, duration: 220, opacity: 1 }}
	>
		<button class="grip" aria-label={m.close()} onclick={onclose}></button>
		<h2>{title}</h2>
		{@render children()}
	</div>
{/if}

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: 40;
		background: color-mix(in srgb, var(--color-neutral-900) 45%, transparent);
	}
	.sheet {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 41;
		max-height: 88%;
		overflow-y: auto;
		background: var(--color-bg);
		border-radius: 36px 36px 0 0;
		padding: 12px 22px calc(26px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 14px;
		box-shadow: var(--shadow-lg);
	}
	.grip {
		width: 44px;
		height: 5px;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: var(--color-neutral-400);
		align-self: center;
		margin-bottom: 4px;
	}
	h2 { margin: 0; font-size: 30px; }
</style>
