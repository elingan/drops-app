<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PrimaryButton from '$lib/components/PrimaryButton.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { auth } from '$lib/state/auth.svelte';

	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	function safeNext(): string {
		const next = page.url.searchParams.get('next') ?? '/app';
		// Only same-app relative paths.
		return next.startsWith('/') && !next.startsWith('//') ? next : '/app';
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		error = null;
		const res = await auth.signIn(email.trim(), password);
		busy = false;
		if (res === 'ok') await goto(safeNext(), { replaceState: true });
		else {
			error = res === 'network' ? m.login_error_network() : m.login_error();
			password = '';
		}
	}
</script>

<svelte:head><title>{m.app_name()}</title></svelte:head>

<div class="login" data-screen-label="01 Login">
	<div class="b1" aria-hidden="true"></div>
	<div class="b2" aria-hidden="true"></div>
	<div class="b3" aria-hidden="true"></div>
	<div class="hero">
		<span class="tag tag-accent-2">{m.login_tag()}</span>
		<h1 lang="de">{m.login_title()}</h1>
		<p>{m.login_subtitle()}</p>
	</div>
	<form onsubmit={submit} novalidate>
		<input class="input" type="email" autocomplete="username" required bind:value={email} placeholder={m.login_email()} aria-label={m.login_email()} aria-invalid={!!error} />
		<input class="input" type="password" autocomplete="current-password" required bind:value={password} placeholder={m.login_password()} aria-label={m.login_password()} aria-invalid={!!error} />
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<PrimaryButton type="submit" disabled={busy || !email || !password}>{m.login_submit()}</PrimaryButton>
	</form>
</div>

<style>
	.login {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 32px 26px calc(28px + env(safe-area-inset-bottom));
		position: relative;
		overflow: hidden;
	}
	.b1, .b2, .b3 { position: absolute; border-radius: 50%; }
	.b1 { width: 360px; height: 360px; background: var(--color-accent-300); top: -140px; right: -150px; }
	.b2 { width: 170px; height: 170px; background: var(--color-accent-2-300); top: 170px; right: 36px; }
	.b3 { width: 64px; height: 64px; background: var(--color-accent-500); top: 300px; left: 40px; }
	.hero { margin-top: auto; position: relative; display: flex; flex-direction: column; gap: 14px; }
	.tag { align-self: flex-start; font-size: 13px; padding: 5px 12px; }
	h1 { font-size: 50px; margin: 0; text-wrap: balance; }
	p { font-size: 18px; color: var(--color-neutral-700); margin: 0; text-wrap: pretty; }
	form { position: relative; display: flex; flex-direction: column; gap: 12px; margin-top: 34px; }
	.input { min-height: 58px; font-size: 17px; padding-inline: 24px; }
	.error { margin: 0; padding: 0 12px; font-size: 15px; font-weight: 600; color: var(--color-accent-800); }
</style>
