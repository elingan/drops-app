<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	let { onretry, title = m.error_title(), body = m.error_body() }: { onretry?: () => void; title?: string; body?: string } = $props();
</script>

<div class="err" role="alert">
	<span class="t">{title}</span>
	<span class="b">{body}</span>
	{#if onretry}<button class="btn btn-primary" onclick={onretry}>{m.retry()}</button>{/if}
</div>

<style>
	.err { margin: auto 0; background: var(--color-accent-100); color: var(--color-accent-900); border-radius: 30px; padding: 22px; display: flex; flex-direction: column; gap: 8px; }
	.t { font-family: var(--font-heading); font-size: 22px; }
	.b { font-size: 15px; }
	.btn { align-self: flex-start; min-height: 48px; font-size: 16px; padding-inline: 22px; }
</style>
