<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';

	let {
		icon,
		label,
		onclick,
		size = 44,
		iconSize = 20,
		variant = 'neutral',
		type = 'button',
		pressed
	}: {
		icon: IconName;
		label: string;
		onclick?: (e: MouseEvent) => void;
		size?: number;
		iconSize?: number;
		variant?: 'neutral' | 'sage' | 'accent';
		type?: 'button' | 'submit';
		pressed?: boolean;
	} = $props();
</script>

<button
	{type}
	class="icon-btn {variant}"
	aria-label={label}
	aria-pressed={pressed}
	title={label}
	style:width="{size}px"
	style:height="{size}px"
	{onclick}
>
	<Icon name={icon} size={iconSize} />
</button>

<style>
	.icon-btn {
		flex: none;
		border: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		transition: background 0.15s, transform 0.15s;
	}
	.icon-btn:active { transform: scale(0.94); }
	.neutral { background: var(--color-neutral-100); color: var(--color-text); }
	.neutral:active { background: var(--color-neutral-300); }
	.sage { background: var(--color-accent-2-700); color: var(--color-neutral-100); }
	.sage:active { background: var(--color-accent-2-800); }
	.accent { background: var(--color-accent); color: var(--color-neutral-100); }
	.accent:active { background: var(--color-accent-700); }
</style>
