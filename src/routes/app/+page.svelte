<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { DAILY_SESSION_GOAL } from '$lib/domain/types';
	import { routeCategories } from '$lib/engine/learning-engine';
	import { m } from '$lib/paraglide/messages.js';
	import { auth } from '$lib/state/auth.svelte';
	import { learning } from '$lib/state/learning.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { longDate, number } from '$lib/utils/format';

	const svc = learning.services;
	const now = new Date();
	const name = $derived(auth.user?.name?.split(' ')[0] || auth.user?.email.split('@')[0] || '');

	const today = $derived(svc.progress.today(learning.sessions, now));
	const done = $derived(Math.min(today.sessions, DAILY_SESSION_GOAL));
	const allDone = $derived(today.sessions >= DAILY_SESSION_GOAL);
	const totals = $derived(svc.progress.totals(learning.sessions, learning.sessionItems, learning.items, learning.progress, now));

	const route = $derived.by(() => {
		void learning.version;
		return learning.route();
	});
	const preview = $derived(svc.engine.routePreview(route));
	const cats = $derived(routeCategories(route, learning.itemsById, learning.categoriesById));
	const catsLabel = $derived(cats.slice(0, 2).join(', ') + (cats.length > 2 ? ' ' + m.start_session_more({ count: cats.length - 2 }) : ''));

	const C = 2 * Math.PI * 32;
</script>

<svelte:head><title>{m.app_name()}</title></svelte:head>

<div class="home" data-screen-label="02 Home">
	<div class="top">
		<span class="date">{longDate(now)}</span>
		<button class="avatar" aria-label={m.settings()} title={m.settings()} onclick={() => (ui.settingsOpen = true)}>
			{name[0]?.toUpperCase() ?? '·'}
			<span class="gear" aria-hidden="true"><Icon name="settings" size={12} stroke={2.5} /></span>
		</button>
	</div>
	<h1>{m.home_greeting({ name })}</h1>

	<section class="today" aria-labelledby="today-lbl">
		<div class="today-row">
			<div class="ring" aria-hidden="true">
				<svg width="80" height="80" viewBox="0 0 80 80">
					<circle cx="40" cy="40" r="32" class="bg" />
					<circle cx="40" cy="40" r="32" class="fg" stroke-dasharray={C} stroke-dashoffset={C * (1 - done / DAILY_SESSION_GOAL)} />
				</svg>
				<span>{done}/{DAILY_SESSION_GOAL}</span>
			</div>
			<div class="today-txt">
				<span class="kicker" id="today-lbl">{m.home_today()}</span>
				<span class="title">{allDone ? m.home_both_done() : m.home_sessions_of({ done: today.sessions, goal: DAILY_SESSION_GOAL })}</span>
				<span class="sub">{today.cards ? m.home_day_sub({ cards: today.cards, minutes: Math.round(today.seconds / 60) }) : m.home_day_none()}</span>
			</div>
		</div>
		<div class="slots">
			{#each [m.home_morning(), m.home_evening()] as label, i (i)}
				<div class="slot" class:on={today.sessions > i}>
					{#if today.sessions > i}<Icon name="check" size={16} stroke={3.2} />{:else}<span class="open" aria-hidden="true"></span>{/if}
					{label}
				</div>
			{/each}
		</div>
	</section>

	<div class="tiles">
		<a class="tile" href="/vocabulary">
			<span class="ic acc"><Icon name="book" size={22} /></span>
			<span class="col"><span class="t">{m.nav_vocabulary()}</span><span class="s">{m.home_tile_vocab_sub({ count: number(learning.items.length) })}</span></span>
		</a>
		<a class="tile" href="/categories">
			<span class="ic sage"><Icon name="grid" size={22} /></span>
			<span class="col"><span class="t">{m.nav_categories()}</span><span class="s">{m.home_tile_categories_sub({ count: learning.categories.length })}</span></span>
		</a>
		<a class="tile" href="/progress">
			<span class="ic acc"><Icon name="chart" size={22} /></span>
			<span class="col"><span class="t">{m.nav_progress()}</span><span class="s">{m.home_tile_progress_sub({ pct: totals.learnedPct })}</span></span>
		</a>
	</div>

	<div class="start-wrap">
		{#if route.entries.length}
			<div class="next">
				<span class="lbl">{m.home_next_route()}</span>
				{#if preview.difficult}<span class="tag tag-accent">{m.home_tag_difficult({ count: preview.difficult })}</span>{/if}
				{#if preview.new}<span class="tag tag-accent-2">{m.home_tag_new({ count: preview.new })}</span>{/if}
				{#if preview.review}<span class="tag tag-neutral">{m.home_tag_review({ count: preview.review })}</span>{/if}
			</div>
		{/if}
		<button class="start" aria-label={m.start_session_aria()} onclick={() => goto('/learn')}>
			<span class="col">
				<span class="big">{m.start_session()}</span>
				<span class="meta" lang="de">{m.start_session_sub({ cats: catsLabel })}</span>
			</span>
			<span class="play" aria-hidden="true"><Icon name="play" size={30} /></span>
		</button>
	</div>
</div>

<style>
	.home { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 22px 20px calc(var(--nav-h) + 40px); }
	.top { display: flex; align-items: center; justify-content: space-between; min-height: 44px; }
	.date { font-size: 14px; font-weight: 600; color: var(--color-neutral-700); }
	.date::first-letter { text-transform: uppercase; }
	.avatar {
		position: relative;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: var(--color-accent-2-200);
		color: var(--color-accent-2-800);
		display: grid;
		place-items: center;
		font-family: var(--font-heading);
		font-size: 19px;
	}
	.gear { position: absolute; right: -2px; bottom: -2px; width: 20px; height: 20px; border-radius: 50%; background: var(--color-neutral-100); display: grid; place-items: center; box-shadow: var(--shadow-sm); }
	h1 { font-size: 44px; margin: 0; overflow-wrap: anywhere; }
	.today { background: var(--color-surface); border-radius: 32px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
	.today-row { display: flex; align-items: center; gap: 18px; }
	.ring { position: relative; width: 80px; height: 80px; flex: none; }
	.ring svg { transform: rotate(-90deg); }
	.ring circle { fill: none; stroke-width: 10; }
	.ring .bg { stroke: var(--color-neutral-300); }
	.ring .fg { stroke: var(--color-accent-2-600); stroke-linecap: round; transition: stroke-dashoffset 0.6s var(--ease-out); }
	.ring span { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-heading); font-size: 22px; }
	.today-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
	.kicker { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; color: var(--color-accent-2-700); }
	.title { font-family: var(--font-heading); font-size: 22px; line-height: 1.15; }
	.sub { font-size: 15px; color: var(--color-neutral-700); }
	.slots { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.slot { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; background: var(--color-neutral-200); color: var(--color-neutral-700); font-size: 14px; font-weight: 600; }
	.slot.on { background: var(--color-accent-2-200); color: var(--color-accent-2-800); }
	.open { width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; margin: 0 3px; }
	.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
	.tile { text-decoration: none; color: inherit; background: var(--color-neutral-100); border-radius: 24px; padding: 14px; min-height: 96px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; transition: background 0.15s; }
	.tile:hover { color: inherit; }
	.tile:active { background: var(--color-neutral-200); }
	.ic.acc { color: var(--color-accent-600); }
	.ic.sage { color: var(--color-accent-2-600); }
	.col { display: flex; flex-direction: column; min-width: 0; }
	.t { font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
	.s { font-size: 13px; color: var(--color-neutral-700); }
	.start-wrap { margin-top: auto; display: flex; flex-direction: column; gap: 10px; padding-top: 6px; }
	.next { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
	.next .lbl { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); margin-right: 2px; }
	.next .tag { font-size: 12px; }
	.start {
		border: 0;
		width: 100%;
		min-height: 136px;
		border-radius: 40px;
		background: var(--color-accent);
		color: var(--color-neutral-100);
		padding: 22px 22px 22px 28px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		text-align: left;
		box-shadow: var(--shadow-md);
		transition: transform 0.15s, background 0.15s;
	}
	.start:hover { background: var(--color-accent-600); }
	.start:active { background: var(--color-accent-700); transform: scale(0.98); }
	.big { font-family: var(--font-heading); font-size: 34px; line-height: 1; }
	.meta { font-size: 16px; font-weight: 600; opacity: 0.92; margin-top: 6px; }
	.play { width: 76px; height: 76px; flex: none; border-radius: 50%; background: var(--color-neutral-100); color: var(--color-accent-600); display: grid; place-items: center; padding-left: 4px; }
</style>
