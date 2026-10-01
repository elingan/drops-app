<script lang="ts">
	import type { CategoryTone } from '$lib/domain/types';
	import { m } from '$lib/paraglide/messages.js';
	import { learning } from '$lib/state/learning.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { toneVars } from '$lib/utils/format';
	import PrimaryButton from './PrimaryButton.svelte';
	import Sheet from './Sheet.svelte';

	let name = $state('');
	let tone = $state<CategoryTone>(0);
	const clean = $derived(name.trim());
	const exists = $derived(learning.categories.some((c) => c.name.toLowerCase() === clean.toLowerCase()));
	const preview = $derived(toneVars(tone));

	$effect(() => {
		if (ui.newCategoryOpen) {
			name = '';
			tone = (learning.categories.length % 2) as CategoryTone;
		}
	});

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (!clean || exists) return;
		const cat = await learning.createCategory(clean, tone);
		ui.newCategoryOpen = false;
		ui.onCategoryCreated?.(cat.id);
		ui.flash(m.toast_category_created({ name: cat.name }));
	}
</script>

<Sheet open={ui.newCategoryOpen} title={m.new_category_title()} onclose={() => (ui.newCategoryOpen = false)}>
	<form onsubmit={create}>
		<input
			class="input"
			bind:value={name}
			maxlength="60"
			lang="de"
			placeholder={m.new_category_placeholder()}
			aria-label={m.new_category_name()}
			aria-invalid={exists}
		/>
		<div class="tones">
			<span class="lbl" id="tone-lbl">{m.new_category_color()}</span>
			<div role="radiogroup" aria-labelledby="tone-lbl" class="tone-list">
				{#each [0, 1] as const as t (t)}
					<button
						type="button"
						role="radio"
						aria-checked={tone === t}
						aria-label={t ? m.tone_sage() : m.tone_terracotta()}
						class="tone"
						class:on={tone === t}
						style:background={toneVars(t).fill}
						onclick={() => (tone = t)}
					></button>
				{/each}
			</div>
			<span class="preview" aria-hidden="true" style:background={preview.blob} style:color={preview.fg}>{clean ? clean[0]!.toUpperCase() : '?'}</span>
		</div>
		<PrimaryButton type="submit" disabled={!clean || exists}>{m.new_category_create()}</PrimaryButton>
	</form>
</Sheet>

<style>
	form { display: flex; flex-direction: column; gap: 16px; }
	.input { min-height: 58px; font-size: 18px; padding-inline: 22px; }
	.tones { display: flex; align-items: center; gap: 16px; }
	.tone-list { display: flex; gap: 16px; }
	.lbl { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }
	.tone { width: 48px; height: 48px; border: 0; border-radius: 50%; transition: box-shadow 0.15s; }
	.tone.on { box-shadow: 0 0 0 4px var(--color-bg), 0 0 0 7px var(--color-text); }
	.preview { margin-left: auto; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-heading); font-size: 21px; }
</style>
