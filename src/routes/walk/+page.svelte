<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import IconButton from '$lib/components/IconButton.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { learning } from '$lib/state/learning.svelte';
	import { WALK_SECONDS, walk } from '$lib/state/walk.svelte';

	const categoryId = page.url.searchParams.get('category') ?? undefined;
	let empty = $state(false);

	const RATES = [
		{ value: 0.7, label: () => m.walk_speed_slow() },
		{ value: 0.85, label: () => m.walk_speed_normal() },
		{ value: 1, label: () => m.walk_speed_fast() }
	];
	const GAPS = [
		{ value: 1.5, label: () => m.walk_gap_short() },
		{ value: 3, label: () => m.walk_gap_normal() },
		{ value: 5, label: () => m.walk_gap_long() }
	];

	const item = $derived(walk.item);
	const showSpanish = $derived(walk.step === 'spanish' || walk.step === 'again' || walk.step === 'gap' || walk.status === 'paused');
	const playing = $derived(walk.status === 'playing');
	const finished = $derived(walk.status === 'finished');
	const clock = $derived(`${Math.floor(walk.remaining / 60)}:${String(walk.remaining % 60).padStart(2, '0')}`);

	function again() {
		empty = !walk.start(categoryId && learning.categoriesById.has(categoryId) ? categoryId : undefined);
	}

	function mediaSession(on: boolean) {
		if (!('mediaSession' in navigator)) return;
		const ms = navigator.mediaSession;
		ms.setActionHandler('play', on ? () => walk.play() : null);
		ms.setActionHandler('pause', on ? () => walk.pause() : null);
		ms.setActionHandler('nexttrack', on ? () => walk.skip() : null);
	}

	// Keep the card and lock-screen title in sync with what is playing.
	$effect(() => {
		if (!item || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
		navigator.mediaSession.metadata = new MediaMetadata({ title: item.german, artist: item.translation ?? '', album: m.app_name() });
	});

	// The screen lock is released when the tab is hidden; take it back on return.
	function onvisibility() {
		if (document.visibilityState === 'visible' && walk.status === 'playing') {
			walk.pause();
			walk.play();
		}
	}

	onMount(() => {
		const valid = !categoryId || learning.categoriesById.has(categoryId);
		empty = !walk.start(valid ? categoryId : undefined);
		mediaSession(true);
	});
	onDestroy(() => {
		walk.stop();
		if (typeof navigator !== 'undefined') mediaSession(false);
	});

	function leave() {
		void goto(categoryId ? `/categories/${categoryId}` : '/app', { replaceState: true });
	}
</script>

<svelte:document onvisibilitychange={onvisibility} />
<svelte:head><title>{m.walk_title()} · {m.app_name()}</title></svelte:head>

<div class="walk" data-screen-label="Walk">
	<TopBar onback={leave} backIcon="x" backLabel={m.close()} />

	{#if empty}
		<EmptyState title={m.session_empty_title()} body={m.session_empty_body()}>
			<a class="btn btn-primary" href="/add">{m.nav_add()}</a>
		</EmptyState>
	{:else if finished}
		<EmptyState title={m.walk_done_title()} body={m.walk_done_body({ n: walk.heard, min: WALK_SECONDS / 60 })}>
			<button class="btn btn-primary" onclick={again}>{m.walk_again()}</button>
			<button class="btn" onclick={leave}>{m.close()}</button>
		</EmptyState>
	{:else if item}
		<div class="meta">
			<span class="tag tag-neutral" lang="de">{walk.category?.name ?? '—'}</span>
			<span class="count">{clock} · {m.walk_heard({ n: walk.heard })}</span>
		</div>

		<div class="stage" aria-live="polite">
			{#key item.id}
				<p class="de" lang="de" class:phrase={item.type === 'phrase'} class:long={item.german.length > 30}>{item.german}</p>
				<p class="es" class:shown={showSpanish && !!item.translation}>{item.translation ?? ''}</p>
			{/key}
		</div>

		<div class="transport">
			<span class="state">{playing ? m.walk_playing() : m.walk_paused()}</span>
			<div class="buttons">
				<IconButton icon={playing ? 'pause' : 'play'} variant="accent" size={96} iconSize={38} label={playing ? m.walk_pause() : m.walk_play()} onclick={() => walk.toggle()} />
				<IconButton icon="chevronRight" size={64} iconSize={26} label={m.walk_next()} onclick={() => walk.skip()} />
			</div>
		</div>

		<section class="opts" aria-label={m.walk_options()}>
			<div class="toggles">
				<button class="chip" aria-pressed={walk.settings.spanish} onclick={() => walk.update({ spanish: !walk.settings.spanish })}>{m.walk_opt_spanish()}</button>
				<button class="chip" aria-pressed={walk.settings.repeat} onclick={() => walk.update({ repeat: !walk.settings.repeat })}>{m.walk_opt_repeat()}</button>
			</div>
			<div class="group" role="group" aria-label={m.walk_speed()}>
				<span class="lbl">{m.walk_speed()}</span>
				{#each RATES as r (r.value)}
					<button class="chip" aria-pressed={walk.settings.rate === r.value} onclick={() => walk.update({ rate: r.value })}>{r.label()}</button>
				{/each}
			</div>
			<div class="group" role="group" aria-label={m.walk_gap()}>
				<span class="lbl">{m.walk_gap()}</span>
				{#each GAPS as g (g.value)}
					<button class="chip" aria-pressed={walk.settings.gap === g.value} onclick={() => walk.update({ gap: g.value })}>{g.label()}</button>
				{/each}
			</div>
		</section>
		<p class="note"><Icon name="volume" size={16} /> {m.walk_note()}</p>
	{/if}
</div>

<style>
	.walk { flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 14px 18px calc(18px + env(safe-area-inset-bottom)); min-height: 0; overflow-y: auto; }
	.meta { display: flex; align-items: center; gap: 8px; }
	.meta .tag { font-size: 13px; font-weight: 600; padding: 4px 12px; }
	.count { margin-left: auto; font-size: 13px; color: var(--color-neutral-700); }
	.stage { flex: 1; min-height: 200px; display: flex; flex-direction: column; justify-content: center; gap: 18px; padding: 24px 22px; border-radius: 32px; background: var(--color-surface); text-align: center; }
	.de { margin: 0; font-family: var(--font-heading); font-size: 44px; line-height: 1.1; overflow-wrap: anywhere; hyphens: auto; animation: d10fade-up 0.25s var(--ease-out); }
	.de.phrase { font-size: 32px; }
	.de.long { font-size: 27px; }
	.es { margin: 0; font-size: 22px; color: var(--color-accent-2-800); min-height: 1.3em; opacity: 0; transition: opacity 0.3s; }
	.es.shown { opacity: 1; }
	.transport { display: flex; flex-direction: column; align-items: center; gap: 10px; }
	.state { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent-2-700); }
	.buttons { display: flex; align-items: center; gap: 18px; }
	.opts { display: flex; flex-direction: column; gap: 10px; }
	.toggles, .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
	.lbl { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); margin-right: 4px; min-width: 64px; }
	.chip { border: 0; min-height: 40px; padding: 0 16px; border-radius: 999px; background: var(--color-neutral-200); color: var(--color-neutral-800); font-size: 14px; font-weight: 600; }
	.chip[aria-pressed='true'] { background: var(--color-accent-2-700); color: var(--color-neutral-100); }
	.note { margin: 0; display: flex; gap: 6px; align-items: flex-start; font-size: 13px; color: var(--color-neutral-600); }
</style>
