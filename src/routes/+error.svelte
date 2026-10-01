<script lang="ts">
	import { page } from '$app/state';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { m } from '$lib/paraglide/messages.js';
</script>

<div class="wrap">
	<EmptyState title={page.status === 404 ? m.not_found() : m.error_title()}>
		<a class="btn btn-primary" href="/app">{m.go_home()}</a>
	</EmptyState>
</div>

<style>
	.wrap { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 22px; }
	.btn { align-self: flex-start; margin-top: 10px; min-height: 48px; padding-inline: 22px; font-size: 16px; }
</style>
