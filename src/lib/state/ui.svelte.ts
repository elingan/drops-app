class UIState {
	toast = $state<string | null>(null);
	settingsOpen = $state(false);
	newCategoryOpen = $state(false);
	/** Called with the new category id once created from the sheet. */
	onCategoryCreated: ((id: string) => void) | null = null;
	online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
	private timer: ReturnType<typeof setTimeout> | undefined;

	flash(message: string) {
		this.toast = message;
		clearTimeout(this.timer);
		this.timer = setTimeout(() => (this.toast = null), 2400);
	}

	openNewCategory(onCreated?: (id: string) => void) {
		this.onCategoryCreated = onCreated ?? null;
		this.newCategoryOpen = true;
	}
}

export const ui = new UIState();
