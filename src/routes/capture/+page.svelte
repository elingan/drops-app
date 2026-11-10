<script lang="ts">
	import { goto } from '$app/navigation';
	import CaptureLane from '$lib/components/CaptureLane.svelte';
	import PrimaryButton from '$lib/components/PrimaryButton.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import type { Category } from '$lib/domain/types';
	import { m } from '$lib/paraglide/messages.js';
	import { sameText } from '$lib/services/content';
	import { learning } from '$lib/state/learning.svelte';
	import { ui } from '$lib/state/ui.svelte';

	/** Name of the category that collects captured phrases; its id is remembered so renaming it keeps working. */
	const CATEGORY_NAME = 'Frases escuchadas';
	const CATEGORY_FLAG = 'captureCategoryId';

	const svc = learning.services;

	let german = $state('');
	let spanish = $state('');
	let germanAudio = $state<string | undefined>();
	let spanishAudio = $state<string | undefined>();
	let busyDe = $state(false);
	let busyEs = $state(false);
	let saving = $state(false);
	let round = $state(0);
	let savedCategory = $state<Category | undefined>();
	/** Recordings made here that are not saved yet (discarded on leave or re-record). */
	const created = new Set<string>();

	const busy = $derived(busyDe || busyEs);
	const duplicate = $derived(german.trim() ? learning.items.find((i) => sameText(i.german, german)) : undefined);
	const canSave = $derived(!!german.trim() && !busy && !saving && !duplicate);

	async function captureCategory(): Promise<Category> {
		const id = await svc.repos.user.getFlag(CATEGORY_FLAG);
		const known = id ? learning.categoriesById.get(id) : undefined;
		if (known) return known;
		const cat = await svc.content.categories.ensure(CATEGORY_NAME, learning.categories);
		await svc.repos.user.setFlag(CATEGORY_FLAG, cat.id);
		return cat;
	}

	async function discard(except: (string | undefined)[] = []) {
		for (const id of created) if (!except.includes(id)) await svc.repos.media.delete(id).catch(() => {});
		created.clear();
	}

	async function save() {
		if (!canSave) return;
		saving = true;
		try {
			const cat = await captureCategory();
			await learning.saveItem({
				german,
				translation: spanish,
				type: 'phrase',
				categoryId: cat.id,
				nativeAudioId: germanAudio ?? null,
				translationAudioId: spanishAudio ?? null
			});
			await discard([germanAudio, spanishAudio]);
			savedCategory = cat;
			ui.flash(m.toast_added({ category: cat.name }));
			german = spanish = '';
			germanAudio = spanishAudio = undefined;
			round++;
		} catch {
			ui.flash(m.capture_save_error());
		} finally {
			saving = false;
		}
	}

	async function close() {
		svc.audio.stop();
		await discard();
		if (history.length > 1) history.back();
		else void goto('/app');
	}

	$effect(() => () => {
		void discard();
	});
</script>

<svelte:head><title>{m.capture_title()} · {m.app_name()}</title></svelte:head>

<div class="capture" data-screen-label="Capture phrase">
	<div class="bar">
		<TopBar onback={close} backIcon="x" backLabel={m.close()}>
			{#snippet end()}
				{#if savedCategory}<a class="see" href="/categories/{savedCategory.id}">{m.capture_see_all()}</a>{/if}
			{/snippet}
		</TopBar>
	</div>

	<div class="scroll">
		<h2>{m.capture_title()}</h2>
		<p class="lead">{m.capture_lead()}</p>

		{#key round}
			<CaptureLane
				lang="de-DE"
				step={1}
				title={m.capture_de_title()}
				hint={m.capture_de_hint()}
				placeholder={m.editor_placeholder()}
				bind:text={german}
				bind:audioId={germanAudio}
				bind:busy={busyDe}
				locked={busyEs}
				oncreated={(id) => created.add(id)}
			/>
			<CaptureLane
				lang="es-ES"
				step={2}
				title={m.capture_es_title()}
				hint={m.capture_es_hint()}
				placeholder={m.editor_translation_placeholder()}
				bind:text={spanish}
				bind:audioId={spanishAudio}
				bind:busy={busyEs}
				locked={busyDe}
				oncreated={(id) => created.add(id)}
			/>
		{/key}

		{#if duplicate}
			<p class="dup" role="status">{m.editor_duplicate()} <a href="/add?edit={duplicate.id}">{m.editor_duplicate_open()}</a></p>
		{/if}
	</div>

	<div class="save">
		<PrimaryButton disabled={!canSave} onclick={save}>{m.capture_save()}</PrimaryButton>
	</div>
</div>

<style>
	.capture { flex: 1; display: flex; flex-direction: column; min-height: 0; }
	.bar { padding: 14px 18px 0; }
	.see { min-height: 44px; padding: 0 16px; border-radius: 999px; display: flex; align-items: center; font-size: 15px; font-weight: 700; color: var(--color-accent-2-800); }
	.scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px 20px 20px; display: flex; flex-direction: column; gap: 14px; }
	h2 { margin: 0; font-size: 32px; text-wrap: balance; }
	.lead { margin: -6px 0 0; font-size: 15px; color: var(--color-neutral-700); }
	.dup { margin: 0 6px; font-size: 14px; font-weight: 600; color: var(--color-accent-800); }
	.save { padding: 10px 20px calc(18px + env(safe-area-inset-bottom)); }
</style>
