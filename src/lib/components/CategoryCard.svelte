<script lang="ts">
	import type { CategoryStats } from '$lib/services/progress';
	import { cardsCount, relativeDay, toneVars } from '$lib/utils/format';
	import ProgressBar from './ProgressBar.svelte';

	let { stats }: { stats: CategoryStats } = $props();
	const t = $derived(toneVars(stats.category.tone));
</script>

<a class="cat" href="/categories/{stats.category.id}">
	<span class="blob" style:background={t.blob} style:color={t.fg} aria-hidden="true">{stats.category.icon ?? stats.category.name[0]?.toUpperCase()}</span>
	<span class="name" lang="de">{stats.category.name}</span>
	<span class="meta">
		<ProgressBar value={stats.pct / 100} fill={t.fill} />
		<span class="row"><span>{cardsCount(stats.count)} · {stats.pct}%</span><span>{relativeDay(stats.lastPracticed)}</span></span>
	</span>
</a>

<style>
	.cat {
		text-decoration: none;
		color: inherit;
		background: var(--color-neutral-100);
		border-radius: 30px;
		padding: 16px;
		min-height: 168px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		transition: transform 0.15s, background 0.15s;
	}
	.cat:hover { color: inherit; background: var(--color-neutral-200); }
	.cat:active { transform: scale(0.98); }
	.blob { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-heading); font-size: 21px; }
	.name { font-family: var(--font-heading); font-size: 19px; line-height: 1.1; margin-top: auto; hyphens: auto; overflow-wrap: anywhere; }
	.meta { display: flex; flex-direction: column; gap: 6px; }
	.row { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; color: var(--color-neutral-700); }
</style>
