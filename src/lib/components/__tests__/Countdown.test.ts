import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import Countdown from '../Countdown.svelte';

describe('Countdown', () => {
	it('shows whole seconds left and reveals on click/keyboard', async () => {
		const onreveal = vi.fn();
		const { getByRole, getByText, rerender } = render(Countdown, { left: 4.2, total: 5, onreveal });
		expect(getByText('5')).toBeTruthy();
		await rerender({ left: 0.3, total: 5, onreveal });
		expect(getByText('1')).toBeTruthy();
		const btn = getByRole('button');
		await fireEvent.click(btn);
		expect(onreveal).toHaveBeenCalledTimes(1);
	});
});
