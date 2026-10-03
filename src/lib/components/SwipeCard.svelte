<script lang="ts" module>
	/** px the card must travel to count as an answer (design: 90). */
	export const SWIPE_THRESHOLD = 90;
	const EXIT_DX = 560;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ReviewResult } from '$lib/domain/types';
	import { m } from '$lib/paraglide/messages.js';
	import Icon from './Icon.svelte';

	let {
		enabled,
		entering = false,
		exit = null,
		onswipe,
		ontap,
		children
	}: {
		/** Dragging is only possible once the answer is revealed. */
		enabled: boolean;
		entering?: boolean;
		exit?: ReviewResult | null;
		onswipe: (result: ReviewResult) => void;
		ontap?: () => void;
		children: Snippet;
	} = $props();

	let dx = $state(0);
	let dragging = $state(false);
	let startX = 0;
	let startY = 0;
	let moved = false;
	let axis: 'x' | 'y' | null = null;

	const offset = $derived(exit ? (exit === 'remembered' ? EXIT_DX : -EXIT_DX) : entering ? 0 : dx);
	const rightOp = $derived(offset > 0 ? Math.min(offset / 130, 1) * 0.94 : 0);
	const leftOp = $derived(offset < 0 ? Math.min(-offset / 130, 1) * 0.94 : 0);

	$effect(() => {
		// New card: reset drag position.
		if (entering) dx = 0;
	});

	function down(e: PointerEvent) {
		moved = false;
		axis = null;
		if (!enabled || exit || e.button > 0) return;
		startX = e.clientX - dx;
		startY = e.clientY;
		dragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (!dragging) return;
		const ddx = e.clientX - startX;
		const ddy = e.clientY - startY;
		// Decide once whether this gesture is a horizontal swipe or a scroll.
		if (!axis && (Math.abs(ddx) > 6 || Math.abs(ddy) > 6)) axis = Math.abs(ddx) >= Math.abs(ddy) ? 'x' : 'y';
		if (axis === 'y') return;
		if (Math.abs(ddx) > 4) moved = true;
		dx = ddx;
	}

	function up() {
		if (!dragging) return;
		dragging = false;
		if (Math.abs(dx) > SWIPE_THRESHOLD) onswipe(dx > 0 ? 'remembered' : 'not_remembered');
		else dx = 0;
	}

	function click() {
		if (moved) return;
		ontap?.();
	}
</script>

<div class="stack">
	<div class="under" aria-hidden="true"></div>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (keyboard: Space/arrows on the page + visible buttons) -->
	<div
		class="card"
		class:grab={enabled}
		class:dragging
		class:entering
		class:no-anim={dragging || entering}
		style:transform="translateX({offset}px) rotate({offset / 22}deg) scale({entering ? 0.93 : 1})"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onclick={click}
	>
		{@render children()}
		<div class="overlay right" style:opacity={rightOp} aria-hidden="true">
			<span class="stamp"><Icon name="check" size={20} stroke={3.2} />{m.answer_swipe_right()}</span>
		</div>
		<div class="overlay left" style:opacity={leftOp} aria-hidden="true">
			<span class="stamp"><Icon name="rotate" size={20} />{m.answer_swipe_left()}</span>
		</div>
	</div>
</div>

<style>
	.stack { flex: 1; position: relative; min-height: 0; margin-top: 4px; }
	.under { position: absolute; inset: 14px 14px -10px; border-radius: 40px; background: var(--color-neutral-300); }
	.card {
		position: absolute;
		inset: 0;
		border-radius: 40px;
		background: var(--color-neutral-100);
		box-shadow: var(--shadow-md);
		padding: 26px 24px 22px;
		touch-action: pan-y;
		overflow: hidden;
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		transition: transform 0.26s var(--ease-out), opacity 0.22s;
	}
	/*
	 * touch-action is not inherited: nested scroll areas (the card body) would
	 * otherwise claim horizontal pans and the browser cancels the swipe
	 * (pointercancel). Allow only vertical scrolling anywhere inside the card.
	 */
	.card :global(*) { touch-action: pan-y; }
	.grab { cursor: grab; }
	.dragging { cursor: grabbing; }
	.entering { opacity: 0; }
	.no-anim { transition: none; }
	.overlay {
		position: absolute;
		inset: 0;
		border-radius: 40px;
		pointer-events: none;
		display: flex;
		align-items: flex-start;
		padding: 26px;
	}
	.right { background: var(--color-accent-2-600); justify-content: flex-start; }
	.left { background: var(--color-accent-500); justify-content: flex-end; }
	.stamp {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--color-neutral-100);
		border-radius: 999px;
		padding: 10px 18px;
		font-family: var(--font-heading);
		font-size: 20px;
	}
	.right .stamp { color: var(--color-accent-2-800); transform: rotate(-6deg); }
	.left .stamp { color: var(--color-accent-800); transform: rotate(6deg); }
</style>
