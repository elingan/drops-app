<script lang="ts">
	import type { LearningItem } from '$lib/domain/types';
	import { m } from '$lib/paraglide/messages.js';
	import { AudioRecorder, type PlaybackState } from '$lib/services/audio';
	import { isPhraseText, suggestCategory } from '$lib/services/content-analysis';
	import { learning } from '$lib/state/learning.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { compressImage } from '$lib/utils/image';
	import Icon from './Icon.svelte';
	import MediaImage from './MediaImage.svelte';
	import PrimaryButton from './PrimaryButton.svelte';
	import TopBar from './TopBar.svelte';
	import VoiceInput from './VoiceInput.svelte';

	let {
		item,
		defaultCategoryId,
		onclose,
		onsaved
	}: {
		item?: LearningItem;
		defaultCategoryId?: string;
		onclose: () => void;
		onsaved: (item: LearningItem, created: boolean) => void;
	} = $props();

	const svc = learning.services;
	// The page re-mounts this form per item ({#key}), so initial values are intended.
	const init = (() => ({ item, defaultCategoryId }))();
	const editing = !!init.item;

	let mode = $state<'type' | 'speak'>('type');
	let german = $state(init.item?.german ?? '');
	let translation = $state(init.item?.translation ?? '');
	let alt = $state(init.item?.alt ?? '');
	let context = $state(init.item?.context ?? '');
	let categoryId = $state<string | undefined>(init.item?.categoryId ?? init.defaultCategoryId);
	let imageId = $state<string | undefined>(init.item?.imageId);
	let audioId = $state<string | undefined>(init.item?.nativeAudioId);
	let recording = $state(false);
	let playback = $state<PlaybackState>('idle');
	let saving = $state(false);
	let imageError = $state(false);
	let known = $state<{ translation?: string; alt?: string; context?: string; categoryName: string } | null>(null);
	const recorder = new AudioRecorder();
	/** Media created in this editor that must be discarded on cancel. */
	const created = new Set<string>();

	const hasText = $derived(german.trim().length > 0);
	const suggestedName = $derived(known?.categoryName ?? suggestCategory(german));
	const suggested = $derived(learning.categories.find((c) => c.name === suggestedName) ?? learning.categories[0]);
	const chosenId = $derived(categoryId ?? suggested?.id);

	// Look up existing knowledge for the typed text (debounced).
	$effect(() => {
		const text = german;
		const t = setTimeout(async () => {
			known = text.trim() ? await svc.analysis.analyze(text, learning.items, learning.categoryName) : null;
		}, 250);
		return () => clearTimeout(t);
	});

	async function pickImage(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		imageError = false;
		try {
			const blob = await compressImage(file);
			const id = await svc.repos.media.put(blob);
			created.add(id);
			imageId = id;
		} catch {
			imageError = true;
		}
	}

	async function toggleRecording() {
		if (recording) {
			const blob = await recorder.stop();
			recording = false;
			const id = await svc.repos.media.put(blob);
			created.add(id);
			audioId = id;
			return;
		}
		if (audioId) {
			const src = await svc.audio.resolve({ ...(item ?? ({} as LearningItem)), german, nativeAudioId: audioId, nativeAudioUrl: undefined });
			if (src) await svc.audio.play(src, (s) => (playback = s));
			return;
		}
		try {
			await recorder.start();
			recording = true;
		} catch {
			ui.flash(m.editor_mic_denied());
		}
	}

	async function discardCreated(except: (string | undefined)[] = []) {
		for (const id of created) if (!except.includes(id)) await svc.repos.media.delete(id);
	}

	async function cancel() {
		if (recording) await recorder.stop().catch(() => {});
		await discardCreated();
		onclose();
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!hasText || !chosenId || saving) return;
		saving = true;
		try {
			const saved = await learning.saveItem(
				{
					german,
					translation: translation.trim() || known?.translation,
					alt: alt.trim() || known?.alt,
					context: context.trim() || known?.context,
					categoryId: chosenId,
					imageId: imageId ?? null,
					nativeAudioId: audioId ?? null
				},
				item?.id
			);
			await discardCreated([imageId, audioId]);
			onsaved(saved, !editing);
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!item || !confirm(m.editor_delete_confirm({ text: item.german }))) return;
		await learning.deleteItem(item.id);
		ui.flash(m.toast_deleted());
		onclose();
	}
</script>

<form class="editor" onsubmit={save} data-screen-label="Word / phrase editor">
	<div class="bar">
		<TopBar onback={cancel} backIcon="x" backLabel={m.close()}>
			{#snippet end()}
				{#if editing}<button type="button" class="delete" onclick={remove}>{m.editor_delete()}</button>{/if}
			{/snippet}
		</TopBar>
	</div>

	<div class="scroll">
		<h2>{editing ? (isPhraseText(german) ? m.editor_edit_phrase() : m.editor_edit_word()) : m.editor_add_title()}</h2>

		{#if !editing}
			<div class="mode" role="radiogroup" aria-label={m.editor_german_label()}>
				<button type="button" role="radio" aria-checked={mode === 'type'} class:on={mode === 'type'} onclick={() => (mode = 'type')}>
					<Icon name="type" size={18} />{m.editor_type()}
				</button>
				<button type="button" role="radio" aria-checked={mode === 'speak'} class:on={mode === 'speak'} onclick={() => (mode = 'speak')}>
					<Icon name="mic" size={18} />{m.editor_speak()}
				</button>
			</div>
		{/if}

		<textarea
			class="de"
			bind:value={german}
			lang="de"
			maxlength="300"
			rows="3"
			placeholder={m.editor_placeholder()}
			aria-label={m.editor_german_label()}
			required
		></textarea>

		{#if mode === 'speak'}
			<VoiceInput service={svc.speech} {hasText} autostart ontranscript={(t) => (german = t)} />
		{/if}

		<label class="field">
			<span class="lbl">{m.editor_translation()}</span>
			<input class="input big" bind:value={translation} maxlength="300" lang="es" placeholder={known?.translation || m.editor_translation_placeholder()} />
		</label>

		<label class="field">
			<span class="lbl">{m.editor_alt()}</span>
			<input class="input big" bind:value={alt} maxlength="300" lang="de" placeholder={known?.alt || m.editor_alt_placeholder()} />
		</label>

		<div class="field">
			<div class="lbl-row">
				<span class="lbl" id="cat-lbl">{m.editor_category()}</span>
				{#if !categoryId && hasText && suggested}<span class="tag tag-accent-2">{m.editor_suggested({ name: suggested.name })}</span>{/if}
			</div>
			<div class="chips" role="radiogroup" aria-labelledby="cat-lbl">
				{#each learning.categories as c (c.id)}
					<button type="button" role="radio" aria-checked={c.id === chosenId} class="chip" class:on={c.id === chosenId} lang="de" onclick={() => (categoryId = c.id)}>{c.name}</button>
				{/each}
				<button type="button" class="chip new" onclick={() => ui.openNewCategory((id) => (categoryId = id))}>
					<Icon name="plus" size={16} stroke={3} />{m.editor_new_category()}
				</button>
			</div>
		</div>

		<div class="field">
			<div class="lbl-row"><span class="lbl">{m.editor_image()}</span><span class="hint">{m.editor_image_hint()}</span></div>
			{#if imageId}
				<div class="img-row">
					<MediaImage id={imageId} size={104} />
					<div class="img-actions">
						<label class="pill"><input type="file" accept="image/*" class="sr-only" onchange={pickImage} />{m.editor_change_photo()}</label>
						<button type="button" class="pill ghost" onclick={() => (imageId = undefined)}>{m.editor_remove()}</button>
					</div>
				</div>
			{:else}
				<label class="add-photo">
					<input type="file" accept="image/*" class="sr-only" onchange={pickImage} />
					<span class="ph"><Icon name="image" size={26} /></span>
					<span class="col"><span class="t">{m.editor_add_photo()}</span><span class="s">{m.editor_add_photo_sub()}</span></span>
				</label>
			{/if}
			{#if imageError}<span class="err" role="alert">{m.editor_photo_too_big()}</span>{/if}
		</div>

		<label class="field">
			<span class="lbl-row"><span class="lbl">{m.editor_context()}</span><span class="hint">{m.editor_context_hint()}</span></span>
			<textarea class="ctx" bind:value={context} maxlength="500" rows="3" placeholder={m.editor_context_placeholder()}></textarea>
		</label>

		{#if AudioRecorder.supported() || audioId}
			<div class="audio-row">
				<button type="button" class="audio" onclick={toggleRecording}>
					<span class="ac" class:rec={recording} class:has={!!audioId && !recording}><Icon name="volumeLow" size={18} /></span>
					<span class="col">
						<span class="t">{recording ? m.editor_audio_recording() : audioId ? m.editor_audio_added() : m.editor_audio_add()}</span>
						<span class="s">{audioId ? (playback === 'playing' ? m.audio_playing() : m.editor_audio_listen()) : m.editor_audio_optional()}</span>
					</span>
				</button>
				{#if audioId && !recording}
					<button type="button" class="x" aria-label={m.editor_audio_remove()} onclick={() => (audioId = undefined)}><Icon name="x" size={18} /></button>
				{/if}
			</div>
		{/if}
	</div>

	<div class="save">
		<PrimaryButton type="submit" disabled={!hasText || saving || recording}>{editing ? m.editor_save_changes() : m.editor_save()}</PrimaryButton>
	</div>
</form>

<style>
	.editor { flex: 1; display: flex; flex-direction: column; min-height: 0; }
	.bar { padding: 14px 18px 0; }
	.delete { border: 0; min-height: 44px; padding: 0 18px; border-radius: 999px; background: transparent; color: var(--color-accent-800); font-size: 15px; font-weight: 700; }
	.delete:hover { background: var(--color-accent-100); }
	.scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 18px; }
	h2 { margin: 0; font-size: 32px; text-wrap: balance; }
	.mode { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 5px; background: var(--color-neutral-200); border-radius: 999px; }
	.mode button { border: 0; min-height: 50px; border-radius: 999px; background: transparent; color: var(--color-neutral-700); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 16px; font-weight: 700; transition: background 0.2s; }
	.mode .on { background: var(--color-neutral-100); color: var(--color-text); }
	textarea { width: 100%; border: 0; resize: none; color: var(--color-text); caret-color: var(--color-accent); background: var(--color-neutral-100); }
	.de { min-height: 130px; border-radius: 30px; padding: 22px; font-family: var(--font-heading); font-size: 26px; line-height: 1.2; }
	.ctx { min-height: 96px; border-radius: 26px; padding: 16px 20px; font-size: 16px; line-height: 1.4; }
	.field { display: flex; flex-direction: column; gap: 8px; }
	.lbl-row { display: flex; align-items: center; gap: 8px; padding: 0 6px; }
	.lbl { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); padding: 0 6px; }
	.lbl-row .lbl { padding: 0; }
	.hint { font-size: 13px; color: var(--color-neutral-600); }
	.big { min-height: 56px; font-size: 17px; padding-inline: 22px; background: var(--color-neutral-100); border-color: transparent; }
	.chips { display: flex; gap: 8px; overflow-x: auto; margin: 0 -20px; padding: 2px 20px 4px; scrollbar-width: none; }
	.chip { flex: none; border: 0; min-height: 46px; padding: 0 18px; border-radius: 999px; background: var(--color-neutral-100); color: var(--color-text); font-size: 15px; font-weight: 700; transition: background 0.2s; }
	.chip.on { background: var(--color-accent-2-700); color: var(--color-neutral-100); }
	.chip.new { background: transparent; border: 2px dashed var(--color-neutral-500); color: var(--color-neutral-800); display: flex; align-items: center; gap: 6px; padding: 0 18px 0 12px; }
	.img-row { display: flex; align-items: center; gap: 16px; }
	.img-actions { display: flex; flex-direction: column; gap: 8px; }
	.pill { cursor: pointer; border: 0; min-height: 46px; padding: 0 20px; border-radius: 999px; background: var(--color-neutral-100); display: flex; align-items: center; font-size: 15px; font-weight: 700; }
	.pill.ghost { background: transparent; color: var(--color-accent-800); }
	.pill:focus-within { outline: 2px solid var(--color-accent); }
	.add-photo { cursor: pointer; display: flex; align-items: center; gap: 14px; padding: 14px 18px 14px 14px; border-radius: 30px; background: var(--color-neutral-100); min-height: 76px; }
	.add-photo:focus-within { outline: 2px solid var(--color-accent); outline-offset: 2px; }
	.ph { width: 52px; height: 52px; flex: none; border-radius: 50%; background: var(--color-accent-2-200); color: var(--color-accent-2-800); display: grid; place-items: center; }
	.col { display: flex; flex-direction: column; text-align: left; flex: 1; }
	.t { font-size: 16px; font-weight: 700; }
	.s { font-size: 13px; color: var(--color-neutral-700); }
	.err { font-size: 13px; color: var(--color-accent-800); padding: 0 6px; }
	.audio-row { display: flex; align-items: center; gap: 8px; }
	.audio { flex: 1; border: 0; display: flex; align-items: center; gap: 14px; padding: 12px 16px 12px 12px; border-radius: 999px; background: var(--color-neutral-100); min-height: 64px; }
	.audio:active { background: var(--color-neutral-200); }
	.ac { width: 42px; height: 42px; flex: none; border-radius: 50%; background: var(--color-neutral-200); color: var(--color-neutral-800); display: grid; place-items: center; }
	.ac.rec { background: var(--color-accent); color: var(--color-neutral-100); }
	.ac.has { background: var(--color-accent-2-700); color: var(--color-neutral-100); }
	.x { width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--color-neutral-100); display: grid; place-items: center; }
	.save { padding: 10px 20px calc(18px + env(safe-area-inset-bottom)); }
</style>
