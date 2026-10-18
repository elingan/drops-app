import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPhone, lockPortrait } from './orientation';

function device({ coarse, width = 390, height = 844, lock }: { coarse: boolean; width?: number; height?: number; lock?: (o: string) => Promise<void> | void }) {
	vi.stubGlobal('matchMedia', (q: string) => ({ matches: coarse && q.includes('coarse') }));
	vi.stubGlobal('screen', { width, height, orientation: lock ? { lock } : {} });
}

afterEach(() => vi.unstubAllGlobals());

describe('lockPortrait', () => {
	it('locks portrait on a phone (also when it is held sideways)', async () => {
		const lock = vi.fn(async () => {});
		device({ coarse: true, lock });
		expect(isPhone()).toBe(true);
		expect(await lockPortrait()).toBe(true);
		expect(lock).toHaveBeenCalledWith('portrait');
		device({ coarse: true, width: 844, height: 390, lock });
		expect(isPhone()).toBe(true);
	});

	it('leaves desktops and tablets alone', async () => {
		const lock = vi.fn(async () => {});
		device({ coarse: false, width: 1920, height: 1080, lock });
		expect(await lockPortrait()).toBe(false);
		device({ coarse: true, width: 820, height: 1180, lock });
		expect(await lockPortrait()).toBe(false);
		expect(lock).not.toHaveBeenCalled();
	});

	it('does not fail where the lock is refused or missing (plain browser tab, iOS Safari)', async () => {
		device({ coarse: true, lock: async () => Promise.reject(new DOMException('not allowed', 'NotSupportedError')) });
		expect(await lockPortrait()).toBe(false);
		device({ coarse: true });
		expect(await lockPortrait()).toBe(false);
	});
});
