<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import Icon from './Icon.svelte';

	const path = $derived(page.url.pathname);
	const isLearn = $derived(path.startsWith('/categories') || path.startsWith('/vocabulary'));
</script>

<nav class="nav-pill" aria-label={m.app_name()}>
	<a href="/app" aria-current={path === '/app' ? 'page' : undefined}>
		<Icon name="home" />{m.nav_home()}
	</a>
	<a href="/categories" aria-current={isLearn ? 'page' : undefined}>
		<Icon name="layers" />{m.nav_learn()}
	</a>
	<a href="/add" class="add" aria-label={m.nav_add()} title={m.nav_add()}>
		<Icon name="plus" size={28} stroke={3} />
	</a>
	<a href="/progress" aria-current={path === '/progress' ? 'page' : undefined}>
		<Icon name="chart" />{m.nav_progress()}
	</a>
</nav>

<style>
	.nav-pill {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: calc(12px + env(safe-area-inset-bottom));
		z-index: 10;
		height: var(--nav-h);
		border-radius: 999px;
		background: var(--color-neutral-100);
		box-shadow: var(--shadow-lg);
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		align-items: center;
		padding: 0 6px;
	}
	a {
		height: 60px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		color: var(--color-neutral-600);
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		border-radius: 999px;
	}
	a[aria-current='page'] { color: var(--color-accent-700); }
	.add {
		justify-self: center;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: var(--color-accent-2-700);
		color: var(--color-neutral-100);
		display: grid;
		place-items: center;
		box-shadow: var(--shadow-md);
		transition: transform 0.15s;
	}
	.add:hover { color: var(--color-neutral-100); }
	.add:active { background: var(--color-accent-2-800); transform: scale(0.94); }
</style>
