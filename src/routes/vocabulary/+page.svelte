<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import VocabularyCard from '$lib/components/VocabularyCard.svelte';
	import type { ItemType } from '$lib/domain/types';
	import { masteryDots } from '$lib/engine/review-scheduler';
	import { m } from '$lib/paraglide/messages.js';
	import { learning } from '$lib/state/learning.svelte';
	import { number } from '$lib/utils/format';
	import { usePlayer } from '$lib/utils/player.svelte';

	let query = $state(page.url.searchParams.get('q') ?? '');
	let category = $state<string>(page.url.searchParams.get('category') ?? 'all');
	let type = $state<'all' | ItemType>('all');
	const player = usePlayer();

	const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
	const results = $derived.by(() => {
		const q = fold(query.trim());
		return learning.items.filter(
			(i) =>
				(category === 'all' || i.categoryId === category) &&
				(type === 'all' || i.type === type) &&
				(!q || fold(i.german).includes(q) || fold(i.translation ?? '').includes(q) || fold(i.alt ?? '').includes(q))
		);
	});
	/** Group by category, as in "Alltag ✓ wissen ○ erledigen". */
	const groups = $derived(
		learning.categories
			.map((c) => ({ category: c, items: results.filter((i) => i.categoryId === c.id) }))
			.filter((g) => g.items.length)
	);
</script>

<svelte:head><title>{m.vocab_title()} · {m.app_name()}</title></svelte:head>

<div class="page" data-screen-label="Vocabulary">
	<TopBar onback={() => (history.length > 1 ? history.back() : goto('/app'))} />
	<div class="head">
		<h1>{m.vocab_title()}</h1>
		<span class="sub">{number(learning.items.length)}</span>
	</div>

	<label class="search">
		<Icon name="search" size={20} />
		<input type="search" bind:value={query} placeholder={m.vocab_search()} aria-label={m.vocab_search()} />
	</label>

	<div class="seg" role="radiogroup" aria-label={m.vocab_all()}>
		{#each [['all', m.vocab_all()], ['word', m.vocab_words()], ['phrase', m.vocab_phrases()]] as [v, label] (v)}
			<label class="seg-opt"><input type="radio" name="type" value={v} bind:group={type} />{label}</label>
		{/each}
	</div>

	<div class="chips" role="radiogroup" aria-label={m.nav_categories()}>
		<button role="radio" aria-checked={category === 'all'} class="chip" class:on={category === 'all'} onclick={() => (category = 'all')}>{m.vocab_all_categories()}</button>
		{#each learning.categories as c (c.id)}
			<button role="radio" aria-checked={category === c.id} class="chip" class:on={category === c.id} lang="de" onclick={() => (category = c.id)}>{c.name}</button>
		{/each}
	</div>

	{#if groups.length === 0}
		<EmptyState title={m.vocab_empty_title()} body={m.vocab_empty_body()} />
	{:else}
		{#each groups as g (g.category.id)}
			<section class="group" aria-labelledby="g-{g.category.id}">
				<h2 id="g-{g.category.id}" lang="de">{g.category.name} <span class="n">{g.items.length}</span></h2>
				<div class="list">
					{#each g.items as it (it.id)}
						<VocabularyCard item={it} level={masteryDots(learning.progress.get(it.id))} playing={player.playingId === it.id} onplay={() => player.toggle(it)} />
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>

<style>
	.page { flex: 1; overflow-y: auto; padding: 14px 18px calc(var(--nav-h) + 40px); display: flex; flex-direction: column; gap: 14px; }
	.head { display: flex; align-items: baseline; gap: 10px; padding: 0 4px; }
	h1 { margin: 0; font-size: 40px; }
	.sub { font-size: 15px; color: var(--color-neutral-700); }
	.search { display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 0 20px; border-radius: 999px; background: var(--color-neutral-100); color: var(--color-neutral-700); }
	.search:focus-within { outline: 2px solid var(--color-accent); outline-offset: 2px; }
	.search input { flex: 1; min-width: 0; border: 0; background: transparent; font-size: 17px; color: var(--color-text); outline: none; }
	.seg { display: grid; grid-template-columns: repeat(3, 1fr); background: var(--color-neutral-100); }
	.seg-opt { justify-content: center; min-height: 44px; font-size: 14px; font-weight: 600; }
	.chips { display: flex; gap: 8px; overflow-x: auto; margin: 0 -18px; padding: 2px 18px 4px; scrollbar-width: none; }
	.chip { flex: none; border: 0; min-height: 42px; padding: 0 16px; border-radius: 999px; background: var(--color-neutral-100); font-size: 14px; font-weight: 700; }
	.chip.on { background: var(--color-accent-2-700); color: var(--color-neutral-100); }
	.group { display: flex; flex-direction: column; gap: 8px; }
	h2 { margin: 6px 6px 0; font-size: 22px; }
	.n { font-family: var(--font-body); font-size: 14px; color: var(--color-neutral-700); }
	.list { display: flex; flex-direction: column; gap: 8px; }
</style>
