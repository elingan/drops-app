<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import IconButton from '$lib/components/IconButton.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import VocabularyCard from '$lib/components/VocabularyCard.svelte';
	import { masteryDots } from '$lib/engine/review-scheduler';
	import { m } from '$lib/paraglide/messages.js';
	import { learning } from '$lib/state/learning.svelte';
	import { cardsCount, relativeDay, toneVars } from '$lib/utils/format';
	import { usePlayer } from '$lib/utils/player.svelte';

	const id = $derived(page.params.id ?? '');
	const category = $derived(learning.categoriesById.get(id));
	const stats = $derived(category && learning.services.progress.byCategory([category], learning.items, learning.progress, new Date())[0]);
	const items = $derived(learning.items.filter((i) => i.categoryId === id));
	const tone = $derived(toneVars(category?.tone ?? 0));
	const player = usePlayer();
</script>

<svelte:head><title>{category?.name ?? m.categories_title()} · {m.app_name()}</title></svelte:head>

<div class="page" data-screen-label="09 Category detail">
	<TopBar onback={() => (history.length > 1 ? history.back() : goto('/categories'))} />
	{#if !category || !stats}
		<EmptyState title={m.category_not_found()}><a class="btn btn-primary" href="/categories">{m.categories_title()}</a></EmptyState>
	{:else}
		<div class="hero">
			<span class="blob" style:background={tone.blob} style:color={tone.fg} aria-hidden="true">{category.icon ?? category.name[0]?.toUpperCase()}</span>
			<div class="col">
				<h1 lang="de" class:long={category.name.length > 10}>{category.name}</h1>
				<span class="sub">{cardsCount(stats.count)} · {stats.pct}% · {relativeDay(stats.lastPracticed)}</span>
			</div>
		</div>
		<div class="bar"><ProgressBar value={stats.pct / 100} height={12} fill={tone.fill} label={category.name} /></div>
		<div class="facts">
			<span class="tag tag-neutral">{m.category_words({ count: stats.words })}</span>
			<span class="tag tag-neutral">{m.category_phrases({ count: stats.phrases })}</span>
			<span class="tag tag-accent">{m.category_pending({ count: stats.pending })}</span>
		</div>
		<div class="actions">
			<button class="practice" disabled={!items.length} onclick={() => goto(`/learn?category=${encodeURIComponent(category.id)}`)}>
				<span>{m.category_practice()}</span>
				<span class="play" aria-hidden="true"><Icon name="play" size={20} /></span>
			</button>
			<IconButton icon="plus" variant="sage" size={68} iconSize={26} label={m.category_add_here()} onclick={() => goto(`/add?category=${encodeURIComponent(category.id)}`)} />
		</div>
		{#if items.length}
			<span class="hint">{m.category_hint()}</span>
			<div class="list">
				{#each items as it (it.id)}
					<VocabularyCard item={it} level={masteryDots(learning.progress.get(it.id))} playing={player.playingId === it.id} onplay={() => player.toggle(it)} />
				{/each}
			</div>
		{:else}
			<EmptyState title={m.category_empty_title()} body={m.category_empty_body()} />
		{/if}
	{/if}
</div>

<style>
	.page { flex: 1; overflow-y: auto; padding: 14px 18px calc(var(--nav-h) + 40px); display: flex; flex-direction: column; gap: 16px; }
	.hero { display: flex; align-items: center; gap: 14px; padding: 0 4px; }
	.blob { width: 64px; height: 64px; flex: none; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-heading); font-size: 28px; }
	.col { display: flex; flex-direction: column; min-width: 0; }
	h1 { margin: 0; font-size: 36px; hyphens: auto; overflow-wrap: anywhere; }
	h1.long { font-size: 28px; }
	.sub { font-size: 15px; color: var(--color-neutral-700); }
	.bar { display: flex; margin: 0 4px; }
	.facts { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 4px; }
	.actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
	.practice {
		border: 0;
		min-height: 68px;
		border-radius: 999px;
		background: var(--color-accent);
		color: var(--color-neutral-100);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 0 10px 0 24px;
		font-family: var(--font-heading);
		font-size: 19px;
	}
	.practice:active { background: var(--color-accent-700); }
	.practice:disabled { opacity: 0.45; }
	.play { width: 50px; height: 50px; flex: none; border-radius: 50%; background: var(--color-neutral-100); color: var(--color-accent-600); display: grid; place-items: center; padding-left: 3px; }
	.hint { font-size: 13px; color: var(--color-neutral-700); padding: 0 6px; }
	.list { display: flex; flex-direction: column; gap: 8px; }
	.btn { align-self: flex-start; margin-top: 10px; min-height: 48px; padding-inline: 22px; font-size: 16px; }
</style>
