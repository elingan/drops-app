import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';

export function clock(seconds: number): string {
	const s = Math.max(0, Math.ceil(seconds));
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function longDate(d: Date): string {
	return new Intl.DateTimeFormat(getLocale() === 'de' ? 'de-AT' : 'es-ES', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).format(d);
}

export function number(n: number): string {
	return new Intl.NumberFormat(getLocale() === 'de' ? 'de-AT' : 'es-ES').format(n);
}

export function relativeDay(d: Date | undefined, now = new Date()): string {
	if (!d) return m.last_never();
	const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
	const n = Math.round((day(now) - day(d)) / 86_400_000);
	if (n <= 0) return m.last_today();
	if (n === 1) return m.last_yesterday();
	return m.last_days({ n });
}

export function studyTime(seconds: number): string {
	const total = Math.round(seconds / 60);
	const h = Math.floor(total / 60);
	const min = total % 60;
	return h ? m.progress_hours({ h, m: String(min).padStart(2, '0') }) : m.progress_minutes({ m: min });
}

export function cardsCount(n: number): string {
	return n === 1 ? m.cards_count_one() : m.cards_count({ count: number(n) });
}

export function toneVars(tone: 0 | 1) {
	return tone
		? { blob: 'var(--color-accent-2-200)', fg: 'var(--color-accent-2-800)', fill: 'var(--color-accent-2-600)' }
		: { blob: 'var(--color-accent-200)', fg: 'var(--color-accent-800)', fill: 'var(--color-accent-500)' };
}
