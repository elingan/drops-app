import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import SwipeCard from '../SwipeCard.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Das kriegen wir heute noch hin.</p>' }));

function card(container: HTMLElement) {
	return container.querySelector('.card') as HTMLElement;
}

describe('SwipeCard', () => {
	it('swipes right past the threshold → remembered', async () => {
		const onswipe = vi.fn();
		const { container } = render(SwipeCard, { enabled: true, onswipe, children });
		const el = card(container);
		await fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1 });
		await fireEvent.pointerMove(el, { clientX: 220, clientY: 104, pointerId: 1 });
		await fireEvent.pointerUp(el, { clientX: 220, clientY: 104, pointerId: 1 });
		expect(onswipe).toHaveBeenCalledWith('remembered');
	});

	it('swipes left → not_remembered', async () => {
		const onswipe = vi.fn();
		const { container } = render(SwipeCard, { enabled: true, onswipe, children });
		const el = card(container);
		await fireEvent.pointerDown(el, { clientX: 200, clientY: 100, pointerId: 1 });
		await fireEvent.pointerMove(el, { clientX: 60, clientY: 100, pointerId: 1 });
		await fireEvent.pointerUp(el, { pointerId: 1 });
		expect(onswipe).toHaveBeenCalledWith('not_remembered');
	});

	it('snaps back below the threshold and stays put when disabled', async () => {
		const onswipe = vi.fn();
		const { container, rerender } = render(SwipeCard, { enabled: true, onswipe, children });
		const el = card(container);
		await fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1 });
		await fireEvent.pointerMove(el, { clientX: 150, clientY: 100, pointerId: 1 });
		await fireEvent.pointerUp(el, { pointerId: 1 });
		expect(onswipe).not.toHaveBeenCalled();
		expect(el.style.transform).toContain('translateX(0px)');

		await rerender({ enabled: false, onswipe, children });
		await fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1 });
		await fireEvent.pointerMove(el, { clientX: 300, clientY: 100, pointerId: 1 });
		await fireEvent.pointerUp(el, { pointerId: 1 });
		expect(onswipe).not.toHaveBeenCalled();
	});

	it('tap calls ontap (reveal) when not dragging', async () => {
		const ontap = vi.fn();
		const { container } = render(SwipeCard, { enabled: false, onswipe: vi.fn(), ontap, children });
		await fireEvent.click(card(container));
		expect(ontap).toHaveBeenCalled();
	});
});
