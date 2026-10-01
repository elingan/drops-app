<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		onclick,
		type = 'button',
		disabled = false,
		variant = 'primary',
		size = 'lg'
	}: {
		children: Snippet;
		onclick?: (e: MouseEvent) => void;
		type?: 'button' | 'submit';
		disabled?: boolean;
		variant?: 'primary' | 'secondary';
		size?: 'md' | 'lg';
	} = $props();
</script>

<button {type} {disabled} {onclick} class="btn btn-{variant} pb {size}">
	{@render children()}
</button>

<style>
	.pb { width: 100%; margin: 0; }
	.lg { min-height: 62px; font-size: 20px; }
	.md { min-height: 56px; font-size: 17px; }
</style>
