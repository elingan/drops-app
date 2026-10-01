import { onDestroy } from 'svelte';
import type { LearningItem } from '$lib/domain/types';
import { learning } from '$lib/state/learning.svelte';

/** Tiny list-row audio player: one item at a time, stops on unmount. */
export function usePlayer() {
	const audio = learning.services.audio;
	let playingId = $state<string | null>(null);

	onDestroy(() => audio.stop());

	return {
		get playingId() {
			return playingId;
		},
		async toggle(item: LearningItem) {
			if (playingId === item.id) {
				audio.stop();
				playingId = null;
				return;
			}
			const src = await audio.resolve(item);
			if (!src) return;
			playingId = item.id;
			await audio.play(src, (s) => {
				if (s === 'idle' || s === 'error') {
					if (playingId === item.id) playingId = null;
				}
			});
		}
	};
}
