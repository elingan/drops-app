<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	/** Calm circular countdown; tap reveals early. */
	let { left, total, onreveal }: { left: number; total: number; onreveal: () => void } = $props();
	const C = 2 * Math.PI * 22;
	const offset = $derived(C * (1 - Math.max(0, left) / Math.max(total, 0.001)));
	const sec = $derived(Math.max(1, Math.ceil(left)));
</script>

<button class="remember" onclick={onreveal} aria-describedby="remember-sub">
	<span class="ring" aria-hidden="true">
		<svg width="56" height="56" viewBox="0 0 56 56">
			<circle cx="28" cy="28" r="22" class="bg" />
			<circle cx="28" cy="28" r="22" class="fg" stroke-dasharray={C} stroke-dashoffset={offset} />
		</svg>
		<span class="sec">{sec}</span>
	</span>
	<span class="txt">
		<span class="title">{m.remember_title()}</span>
		<span class="sub" id="remember-sub">{m.remember_sub()}</span>
	</span>
</button>

<style>
	.remember {
		border: 0;
		background: transparent;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 6px;
		min-height: 96px;
		text-align: left;
		width: 100%;
		border-radius: 28px;
		animation: d10fade-up 0.25s var(--ease-out);
	}
	.ring { position: relative; width: 56px; height: 56px; flex: none; }
	svg { transform: rotate(-90deg); }
	circle { fill: none; stroke-width: 7; }
	.bg { stroke: var(--color-neutral-300); }
	.fg { stroke: var(--color-accent); stroke-linecap: round; transition: stroke-dashoffset 0.1s linear; }
	.sec { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-heading); font-size: 20px; }
	.txt { display: flex; flex-direction: column; }
	.title { font-family: var(--font-heading); font-size: 28px; line-height: 1.1; }
	.sub { font-size: 15px; color: var(--color-neutral-700); }
</style>
