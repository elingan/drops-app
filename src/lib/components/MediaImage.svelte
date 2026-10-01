<script lang="ts">
	import { learning } from '$lib/state/learning.svelte';

	/** Round, slightly washed photo loaded from the media repository. */
	let { id, size = 120, alt = '' }: { id: string; size?: number; alt?: string } = $props();
	let url = $state<string>();

	$effect(() => {
		let objectUrl: string | undefined;
		let cancelled = false;
		learning.services.repos.media.get(id).then((blob) => {
			if (cancelled || !blob) return;
			objectUrl = URL.createObjectURL(blob);
			url = objectUrl;
		});
		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
			url = undefined;
		};
	});
</script>

<span class="img washed" style:width="{size}px" style:height="{size}px">
	{#if url}<img src={url} {alt} />{/if}
</span>

<style>
	.img { display: block; flex: none; border-radius: 50%; overflow: hidden; background: var(--color-neutral-200); }
	img { width: 100%; height: 100%; object-fit: cover; }
</style>
