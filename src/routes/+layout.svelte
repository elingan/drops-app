<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AppShell from '$lib/components/AppShell.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { auth } from '$lib/state/auth.svelte';
	import { learning } from '$lib/state/learning.svelte';

	let { children } = $props();

	const NAV_ROUTES = ['/app', '/categories', '/vocabulary', '/progress'];
	const path = $derived(page.url.pathname);
	const isPublic = $derived(path === '/login');
	const showNav = $derived(NAV_ROUTES.some((r) => path === r || path.startsWith(r + '/')));

	document.documentElement.lang = getLocale();
	void auth.check();

	// Route guard: private routes need a session.
	$effect(() => {
		if (auth.status === 'anonymous' && !isPublic) {
			void goto('/login?next=' + encodeURIComponent(path + page.url.search), { replaceState: true });
		} else if (auth.status === 'authenticated') {
			void learning.load();
			if (isPublic) void goto('/app', { replaceState: true });
		}
	});
</script>

<AppShell nav={showNav && auth.status === 'authenticated' && learning.status === 'ready'}>
	{#if isPublic}
		{@render children()}
	{:else if auth.status !== 'authenticated' || learning.status === 'loading' || learning.status === 'idle'}
		<LoadingState />
	{:else if learning.status === 'error'}
		<div class="pad"><ErrorState onretry={() => learning.load(true)} /></div>
	{:else}
		{@render children()}
	{/if}
</AppShell>

<style>
	.pad { flex: 1; display: flex; padding: 22px; }
</style>
