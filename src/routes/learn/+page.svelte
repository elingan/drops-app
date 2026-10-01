<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AudioButton from '$lib/components/AudioButton.svelte';
	import Countdown from '$lib/components/Countdown.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import IconButton from '$lib/components/IconButton.svelte';
	import LearningCard from '$lib/components/LearningCard.svelte';
	import PrimaryButton from '$lib/components/PrimaryButton.svelte';
	import SessionProgress from '$lib/components/SessionProgress.svelte';
	import SessionSummary from '$lib/components/SessionSummary.svelte';
	import SessionTimer from '$lib/components/SessionTimer.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import SwipeCard from '$lib/components/SwipeCard.svelte';
	import { DAILY_SESSION_GOAL, type RouteReason } from '$lib/domain/types';
	import { m } from '$lib/paraglide/messages.js';
	import { learning } from '$lib/state/learning.svelte';
	import { session } from '$lib/state/session.svelte';
	import { clock } from '$lib/utils/format';

	const categoryId = page.url.searchParams.get('category') ?? undefined;
	let empty = $state(false);

	const REASONS: Record<RouteReason, () => string> = {
		new: m.reason_new,
		review: m.reason_review,
		difficult: m.reason_difficult,
		forgotten: m.reason_forgotten,
		mastered: m.reason_mastered
	};

	onMount(() => {
		const valid = !categoryId || learning.categoriesById.has(categoryId);
		empty = !session.start({ categoryId: valid ? categoryId : undefined });
	});
	onDestroy(() => session.dispose());

	const card = $derived(session.card);
	const settings = $derived(learning.settings);
	const complete = $derived(session.phase === 'SESSION_COMPLETE' && session.summary);
	const dailyDone = $derived(learning.services.progress.today(learning.sessions, new Date()).sessions >= DAILY_SESSION_GOAL);

	function onkeydown(e: KeyboardEvent) {
		if (!session.active || e.defaultPrevented) return;
		const target = e.target as HTMLElement;
		if (target.closest('input, textarea, [role="dialog"]')) return;
		if (session.paused) return;
		if (e.key === ' ' || e.key === 'Enter') {
			if (target.tagName === 'BUTTON' && session.revealed) return; // let focused buttons act
			e.preventDefault();
			session.reveal();
		} else if (e.key === 'ArrowRight') session.answer('remembered');
		else if (e.key === 'ArrowLeft') session.answer('not_remembered');
		else if (e.key === 'Escape') session.pause();
		else if (e.key.toLowerCase() === 'l') void session.playAudio();
	}

	function finish() {
		void goto(categoryId ? `/categories/${categoryId}` : '/app', { replaceState: true });
	}
</script>

<svelte:window {onkeydown} />
<svelte:head><title>{m.start_session()} · {m.app_name()}</title></svelte:head>

{#if complete && session.summary}
	<SessionSummary summary={session.summary} categoryName={learning.categoryName} {dailyDone} ondone={finish} />
{:else if empty}
	<div class="empty-wrap">
		<EmptyState title={m.session_empty_title()} body={m.session_empty_body()}>
			<a class="btn btn-primary" href="/add">{m.nav_add()}</a>
		</EmptyState>
		<a class="btn btn-secondary back" href="/app">{m.go_home()}</a>
	</div>
{:else if card}
	<div class="session" data-screen-label="03 Session">
		<div class="head">
			<IconButton icon="pause" label={m.session_pause()} iconSize={18} onclick={() => session.pause()} />
			<SessionProgress elapsed={session.elapsed} target={session.target} />
			<SessionTimer remaining={session.remaining} />
		</div>
		<div class="meta">
			<span class="tag tag-neutral" lang="de">{card.category.name}</span>
			<span class="why">{REASONS[card.reason]()}</span>
			<span class="count">{m.session_count({ n: session.position + 1, done: session.answered })}</span>
		</div>

		<SwipeCard
			enabled={session.revealed && !session.paused}
			entering={session.phase === 'SHOW_CARD'}
			exit={session.exitDirection}
			onswipe={(r) => session.answer(r)}
			ontap={() => session.reveal()}
		>
			{#key card.item.id}
				<LearningCard item={card.item} revealed={session.revealed || session.phase === 'NEXT_CARD'} showSpanish={settings.showSpanish} imageTiming={settings.imageTiming}>
					{#snippet audio()}
						<AudioButton
							source={session.audioSource}
							playback={session.audioState}
							onplay={() => session.playAudio()}
							onpause={() => session.pauseAudio()}
						/>
					{/snippet}
				</LearningCard>
			{/key}
		</SwipeCard>

		<div class="controls">
			{#if session.phase === 'WAITING_FOR_RECALL' || session.phase === 'SHOW_CARD'}
				<Countdown left={session.rememberLeft} total={session.rememberTotal} onreveal={() => session.reveal()} />
			{:else}
				<div class="answers">
					<div class="row">
						<button class="ans forgot" onclick={() => session.answer('not_remembered')} disabled={!session.revealed}>
							<Icon name="chevronLeft" size={22} stroke={3} />{m.answer_forgot()}
						</button>
						<button class="ans ok" onclick={() => session.answer('remembered')} disabled={!session.revealed}>
							{m.answer_remembered()}<Icon name="chevronRight" size={22} stroke={3} />
						</button>
					</div>
					<span class="hint">{m.answer_or_swipe()}<span class="kbd">{' · '}{m.answer_keyboard_hint()}</span></span>
				</div>
			{/if}
		</div>
	</div>

	<Sheet open={session.paused} title={m.paused_title()} onclose={() => session.resume()}>
		<p class="note">{m.paused_note({ time: clock(session.remaining), cards: session.answered })}</p>
		<PrimaryButton onclick={() => session.resume()}>{m.resume()}</PrimaryButton>
		<PrimaryButton variant="secondary" size="md" onclick={() => session.complete()}>{m.end_session()}</PrimaryButton>
	</Sheet>
{/if}

<style>
	.session { flex: 1; display: flex; flex-direction: column; padding: 14px 18px calc(18px + env(safe-area-inset-bottom)); gap: 12px; min-height: 0; }
	.head { display: flex; align-items: center; gap: 12px; }
	.meta { display: flex; align-items: center; gap: 8px; min-height: 26px; }
	.meta .tag { font-size: 13px; font-weight: 600; padding: 4px 12px; }
	.why, .count { font-size: 13px; color: var(--color-neutral-700); }
	.count { margin-left: auto; }
	.controls { min-height: 132px; display: flex; flex-direction: column; justify-content: flex-end; padding-top: 14px; }
	.answers { display: flex; flex-direction: column; gap: 10px; animation: d10fade-up 0.2s var(--ease-out); }
	.row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.ans {
		border: 0;
		min-height: 72px;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-family: var(--font-heading);
		font-size: clamp(15px, 4.6vw, 18px);
		white-space: nowrap;
		padding: 0 12px;
		transition: transform 0.12s, background 0.15s;
	}
	.ans:active { transform: scale(0.97); }
	.forgot { background: var(--color-accent-200); color: var(--color-accent-800); }
	.forgot:active { background: var(--color-accent-300); }
	.ok { background: var(--color-accent-2-700); color: var(--color-neutral-100); }
	.ok:active { background: var(--color-accent-2-800); }
	.hint { text-align: center; font-size: 13px; color: var(--color-neutral-600); }
	.kbd { display: none; }
	@media (hover: hover) and (pointer: fine) { .kbd { display: inline; } }
	.note { margin: 0 0 6px; font-size: 16px; color: var(--color-neutral-700); }
	.empty-wrap { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 22px; }
	.empty-wrap .btn { align-self: flex-start; min-height: 48px; padding-inline: 22px; font-size: 16px; margin-top: 10px; }
	.empty-wrap .back { align-self: stretch; }
</style>
