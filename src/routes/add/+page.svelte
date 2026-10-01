<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AddContentForm from '$lib/components/AddContentForm.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { learning } from '$lib/state/learning.svelte';
	import { ui } from '$lib/state/ui.svelte';

	const editId = $derived(page.url.searchParams.get('edit'));
	const item = $derived(editId ? learning.itemsById.get(editId) : undefined);
	const defaultCategoryId = $derived(page.url.searchParams.get('category') ?? undefined);

	function back() {
		if (history.length > 1) history.back();
		else void goto('/app');
	}
</script>

<svelte:head><title>{m.editor_add_title()} · {m.app_name()}</title></svelte:head>

{#key editId}
	<AddContentForm
		{item}
		{defaultCategoryId}
		onclose={back}
		onsaved={(saved, created) => {
			ui.flash(created ? m.toast_added({ category: learning.categoryName(saved.categoryId) ?? '' }) : m.toast_saved());
			back();
		}}
	/>
{/key}
