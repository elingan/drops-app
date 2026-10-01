<script lang="ts">
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { learning } from '$lib/state/learning.svelte';
	import { number, studyTime, toneVars } from '$lib/utils/format';

	const svc = learning.services.progress;
	const now = new Date();
	const totals = $derived(svc.totals(learning.sessions, learning.sessionItems, learning.items, learning.progress, now));
	const week = $derived(svc.week(learning.sessions, now));
	const cats = $derived(svc.byCategory(learning.categories, learning.items, learning.progress, now));
	const dayLabels = [m.day_short_0, m.day_short_1, m.day_short_2, m.day_short_3, m.day_short_4, m.day_short_5, m.day_short_6];
	const dayName = (d: Date) => new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(d);
</script>

<svelte:head><title>{m.progress_title()} · {m.app_name()}</title></svelte:head>

<div class="page" data-screen-label="10 Progress">
	<h1>{m.progress_title()}</h1>

	<section class="hero">
		<div class="hero-top">
			<span class="col"><span class="big">{studyTime(totals.seconds)}</span><span class="lbl">{m.progress_total_time()}</span></span>
			<span class="col end"><span class="mid">{totals.sessions}</span><span class="lbl">{m.progress_sessions()}</span></span>
		</div>
		<ul class="week" aria-label={m.progress_week()}>
			{#each week as d (d.date.getTime())}
				<li aria-label="{dayName(d.date)}: {d.sessions} {m.progress_sessions()}, {d.minutes} min">
					<span class="dot" class:on={d.sessions >= 1}></span>
					<span class="dot" class:on={d.sessions >= 2}></span>
					<span class="day" aria-hidden="true">{dayLabels[d.date.getDay()]!()}</span>
				</li>
			{/each}
		</ul>
	</section>

	<div class="two">
		<div class="tile">
			<span class="lbl2">{m.progress_words_learned()}</span>
			<span class="num">{number(totals.wordsLearned)}</span>
			<ProgressBar value={totals.words ? totals.wordsLearned / totals.words : 0} />
			<span class="small">{m.progress_of({ total: number(totals.words) })} · {m.progress_practiced({ count: totals.wordsPracticed })}</span>
		</div>
		<div class="tile">
			<span class="lbl2">{m.progress_phrases_learned()}</span>
			<span class="num">{number(totals.phrasesLearned)}</span>
			<ProgressBar value={totals.phrases ? totals.phrasesLearned / totals.phrases : 0} />
			<span class="small">{m.progress_of({ total: number(totals.phrases) })} · {m.progress_practiced({ count: totals.phrasesPracticed })}</span>
		</div>
	</div>

	<div class="review">
		<span class="rn">{totals.needReview}</span>
		<span>{m.progress_need_review()}</span>
	</div>

	<section class="by">
		<h2>{m.progress_by_category()}</h2>
		{#each cats as c (c.category.id)}
			<a class="cat" href="/categories/{c.category.id}">
				<span class="name" lang="de">{c.category.name}</span>
				<ProgressBar value={c.pct / 100} height={10} fill={toneVars(c.category.tone).fill} label={c.category.name} />
				<span class="pct">{c.pct}%</span>
			</a>
		{/each}
	</section>
</div>

<style>
	.page { flex: 1; overflow-y: auto; padding: 26px 18px calc(var(--nav-h) + 40px); display: flex; flex-direction: column; gap: 14px; }
	h1 { margin: 0; font-size: 40px; padding: 0 4px; }
	.hero { background: var(--color-accent); color: var(--color-neutral-100); border-radius: 34px; padding: 22px; display: flex; flex-direction: column; gap: 16px; }
	.hero-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
	.col { display: flex; flex-direction: column; }
	.end { text-align: right; }
	.big { font-family: var(--font-heading); font-size: 46px; line-height: 1; }
	.mid { font-family: var(--font-heading); font-size: 30px; line-height: 1; }
	.lbl { font-size: 15px; font-weight: 600; }
	.week { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
	.week li { display: flex; flex-direction: column; align-items: center; gap: 5px; }
	.dot { width: 22px; height: 22px; border-radius: 50%; background: color-mix(in srgb, var(--color-neutral-100) 30%, transparent); }
	.dot.on { background: var(--color-neutral-100); }
	.day { font-size: 12px; font-weight: 700; }
	.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
	.tile { background: var(--color-neutral-100); border-radius: 28px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
	.lbl2 { font-size: 14px; font-weight: 600; color: var(--color-neutral-700); }
	.num { font-family: var(--font-heading); font-size: 34px; line-height: 1; }
	.small { font-size: 13px; color: var(--color-neutral-700); }
	.tile :global(.track) { flex: none; }
	.review { background: var(--color-accent-200); color: var(--color-accent-900); border-radius: 999px; padding: 10px 22px; display: flex; align-items: center; gap: 12px; min-height: 68px; font-size: 15px; font-weight: 600; }
	.rn { font-family: var(--font-heading); font-size: 28px; font-weight: 400; }
	.by { background: var(--color-neutral-100); border-radius: 30px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
	h2 { margin: 0; font-family: var(--font-body); font-size: 14px; font-weight: 600; color: var(--color-neutral-700); }
	.cat { display: grid; grid-template-columns: 110px minmax(0, 1fr) 38px; align-items: center; gap: 10px; color: inherit; text-decoration: none; border-radius: 8px; }
	.name { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.pct { font-size: 13px; text-align: right; color: var(--color-neutral-700); }
</style>
