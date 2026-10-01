<script lang="ts">
	import type { SessionSummary } from '$lib/engine/session-engine';
	import { m } from '$lib/paraglide/messages.js';
	import Icon from './Icon.svelte';
	import PrimaryButton from './PrimaryButton.svelte';

	let {
		summary,
		categoryName,
		dailyDone,
		ondone
	}: {
		summary: SessionSummary;
		categoryName: (id: string) => string | undefined;
		/** Daily goal reached → tomorrow's session is the next one. */
		dailyDone: boolean;
		ondone: () => void;
	} = $props();

	const s = $derived(summary.session);
	const minutes = $derived(s.duration >= s.targetDuration - 5 ? Math.round(s.targetDuration / 60) : Math.max(1, Math.round(s.duration / 60)));
	const cats = $derived(summary.categoryIds.map(categoryName).filter((n): n is string => !!n));
</script>

<div class="summary" data-screen-label="Session complete">
	<div class="blob" aria-hidden="true"></div>
	<div class="check" aria-hidden="true"><Icon name="check" size={34} stroke={3.2} /></div>
	<div class="head">
		<h1>{m.summary_title()}</h1>
		<span class="time">{m.summary_minutes({ n: minutes })}</span>
	</div>
	<div class="tiles">
		<div class="tile"><span class="n">{s.itemsReviewed}</span><span>{m.summary_cards()}</span></div>
		<div class="tile ok"><span class="n">{s.remembered}</span><span>{m.summary_remembered()}</span></div>
		<div class="tile rev"><span class="n">{s.notRemembered}</span><span>{m.summary_to_review()}</span></div>
	</div>
	{#if cats.length}
		<div class="cats">
			<span class="lbl">{m.summary_categories()}</span>
			<div class="tags">
				{#each cats as c (c)}<span class="tag tag-neutral" lang="de">{c}</span>{/each}
			</div>
		</div>
	{/if}
	<div class="foot">
		<span class="great">{m.summary_great()}</span>
		<span class="next">{dailyDone ? m.summary_tomorrow() : m.summary_next()}</span>
		<PrimaryButton onclick={ondone}>{m.done()}</PrimaryButton>
	</div>
</div>

<style>
	.summary {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		padding: 28px 22px calc(22px + env(safe-area-inset-bottom));
		gap: 20px;
		position: relative;
	}
	.blob { position: absolute; width: 300px; height: 300px; border-radius: 50%; background: var(--color-accent-2-200); top: -110px; right: -110px; }
	.check {
		position: relative;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: var(--color-accent-2-700);
		color: var(--color-neutral-100);
		display: grid;
		place-items: center;
		margin-top: 24px;
		animation: d10fade-up 0.3s var(--ease-out);
	}
	.head { position: relative; display: flex; flex-direction: column; gap: 4px; }
	h1 { margin: 0; font-size: 42px; }
	.time { font-family: var(--font-heading); font-size: 76px; line-height: 1; color: var(--color-accent); }
	.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
	.tile { background: var(--color-neutral-100); border-radius: 26px; padding: 16px 14px; display: flex; flex-direction: column; gap: 2px; font-size: 14px; color: var(--color-neutral-700); }
	.tile .n { font-family: var(--font-heading); font-size: 34px; line-height: 1.05; color: var(--color-text); }
	.ok { background: var(--color-accent-2-200); color: var(--color-accent-2-900); }
	.ok .n { color: inherit; }
	.rev { background: var(--color-accent-200); color: var(--color-accent-900); }
	.rev .n { color: inherit; }
	.cats { display: flex; flex-direction: column; gap: 10px; }
	.lbl { font-size: 14px; font-weight: 600; color: var(--color-neutral-700); }
	.tags { display: flex; flex-wrap: wrap; gap: 8px; }
	.tag { font-size: 14px; padding: 6px 14px; }
	.foot { margin-top: auto; display: flex; flex-direction: column; gap: 10px; padding-top: 12px; }
	.great { font-family: var(--font-heading); font-size: 28px; }
	.next { font-size: 15px; color: var(--color-neutral-700); margin-bottom: 4px; }
</style>
