import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioSource, LearningItem } from '$lib/domain/types';
import { createMemoryRepositories } from '$lib/repositories/memory';
import { createServices } from './context';
import { LearningState } from './learning.svelte';
import { WALK_DEFAULTS, WalkState } from './walk.svelte';

const src = (url: string, lang: string): AudioSource => ({ kind: 'generated', text: url, lang, url });

/** A walk over the real vocabulary whose audio service just records what it is asked to play. */
async function setup() {
	const services = createServices(createMemoryRepositories());
	const data = new LearningState(() => services);
	await data.load();
	const walk = new WalkState(data);
	const played: { url?: string; lang: string; rate?: number; step: string }[] = [];
	Object.assign(services.audio, {
		resolve: async (item: LearningItem) => src(`de:${item.german}`, 'de-DE'),
		resolveTranslation: (item: LearningItem) => (item.translation ? src(`es:${item.german}`, 'es-ES') : undefined),
		resolveExample: (item: LearningItem) => (item.example ? src(`ex:${item.german}`, 'de-DE') : undefined),
		playToEnd: async (s: AudioSource) => void played.push({ url: s.url, lang: s.lang, rate: s.rate, step: walk.step }),
		stop: () => {}
	});
	return { data, walk, played };
}

/** Lets the playback loop run through the card that is playing. */
async function playOneCard(walk: WalkState) {
	walk.start();
	const first = walk.item!;
	await vi.advanceTimersByTimeAsync(20_000);
	walk.stop();
	return first;
}

describe('WalkState playback order', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		localStorage.clear();
	});
	afterEach(() => vi.useRealTimers());

	it('says word → translation → example → word again', async () => {
		const { walk, played } = await setup();
		const item = await playOneCard(walk);
		const first = played.slice(0, 4).map((p) => p.url!.split(':')[0]);
		expect(item.example).toBeTruthy();
		expect(first).toEqual(['de', 'es', 'ex', 'de']);
		expect(played[0]!.url).toBe(`de:${item.german}`);
		expect(played[3]!.url).toBe(`de:${item.german}`);
	});

	it('follows the walk options: no example, no repeat, no Spanish', async () => {
		const { walk, played } = await setup();
		walk.update({ example: false, repeat: false });
		await playOneCard(walk);
		expect(played.slice(0, 2).map((p) => p.url!.split(':')[0])).toEqual(['de', 'es']);
		expect(played.slice(2)[0]?.url?.startsWith('de:')).toBe(true); // already the next card
		played.length = 0;
		walk.update({ spanish: false, example: true });
		await playOneCard(walk);
		expect(played.slice(0, 2).map((p) => p.url!.split(':')[0])).toEqual(['de', 'ex']);
	});

	it('applies the speed to every clip and defaults the example to on', async () => {
		const { walk, played } = await setup();
		expect(WALK_DEFAULTS.example).toBe(true);
		walk.update({ rate: 0.7 });
		await playOneCard(walk);
		expect(played.slice(0, 4).every((p) => p.rate === 0.7)).toBe(true);
	});

	it('moves through the steps while it plays, so the screen can show the example', async () => {
		const { walk, played } = await setup();
		await playOneCard(walk);
		expect(played.slice(0, 4).map((p) => p.step)).toEqual(['german', 'spanish', 'example', 'again']);
	});
});
