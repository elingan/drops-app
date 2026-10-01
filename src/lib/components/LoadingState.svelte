<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
</script>

<div class="loading" role="status" aria-live="polite">
	<span class="dot"></span><span class="dot"></span><span class="dot"></span>
	<span class="sr-only">{m.loading()}</span>
</div>

<style>
	.loading { flex: 1; min-height: 200px; display: flex; align-items: center; justify-content: center; gap: 8px; }
	.dot { width: 12px; height: 28px; border-radius: 999px; background: var(--color-accent); animation: d10wave 0.9s ease-in-out infinite; }
	.dot:nth-child(2) { animation-delay: 0.15s; background: var(--color-accent-2-600); }
	.dot:nth-child(3) { animation-delay: 0.3s; }
</style>
