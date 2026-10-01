<script lang="ts">
	import CategoryCard from '$lib/components/CategoryCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { learning } from '$lib/state/learning.svelte';
	import { ui } from '$lib/state/ui.svelte';

	const stats = $derived(learning.services.progress.byCategory(learning.categories, learning.items, learning.progress, new Date()));
</script>

<svelte:head><title>{m.categories_title()} · {m.app_name()}</title></svelte:head>

<div class="page" data-screen-label="08 Categories">
	<div class="head">
		<h1>{m.categories_title()}</h1>
		<span class="sub">{m.categories_sub()}</span>
	</div>
	<div class="grid">
		{#each stats as s (s.category.id)}
			<CategoryCard stats={s} />
		{/each}
		<button class="new" onclick={() => ui.openNewCategory()}>
			<span class="plus" aria-hidden="true"><Icon name="plus" size={22} stroke={3} /></span>
			<span class="t">{m.categories_new()}</span>
		</button>
	</div>
</div>

<style>
	.page { flex: 1; overflow-y: auto; padding: 26px 18px calc(var(--nav-h) + 40px); display: flex; flex-direction: column; gap: 16px; }
	.head { display: flex; flex-direction: column; gap: 2px; padding: 0 4px; }
	h1 { margin: 0; font-size: 40px; }
	.sub { font-size: 15px; color: var(--color-neutral-700); }
	.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
	.new {
		text-align: left;
		background: transparent;
		border: 2px dashed var(--color-neutral-500);
		border-radius: 30px;
		padding: 16px;
		min-height: 168px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 10px;
	}
	.new:hover { background: var(--color-neutral-100); }
	.plus { width: 46px; height: 46px; border-radius: 50%; background: var(--color-accent-2-700); color: var(--color-neutral-100); display: grid; place-items: center; }
	.t { font-family: var(--font-heading); font-size: 19px; line-height: 1.1; }
</style>
