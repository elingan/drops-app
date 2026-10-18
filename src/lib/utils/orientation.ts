/** Phones and small touch screens; tablets and desktops keep rotating freely. */
export function isPhone(): boolean {
	if (typeof window === 'undefined' || typeof screen === 'undefined') return false;
	const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
	return touch && Math.min(screen.width, screen.height) < 768;
}

/**
 * Keeps the app in portrait on phones. Browsers only grant the lock to an
 * installed app or in fullscreen (the manifest asks for portrait too), and
 * iOS Safari has no lock at all: there it is silently a no-op.
 * Resolves to whether the lock was applied.
 */
export async function lockPortrait(): Promise<boolean> {
	if (!isPhone()) return false;
	try {
		const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
		if (!orientation?.lock) return false;
		await orientation.lock('portrait');
		return true;
	} catch {
		return false;
	}
}
