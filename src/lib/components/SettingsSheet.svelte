<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';
	import { auth } from '$lib/state/auth.svelte';
	import { learning } from '$lib/state/learning.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	const s = $derived(learning.settings);
	let importing = $state(false);

	async function onImport(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		importing = true;
		try {
			if (file.size > 5 * 1024 * 1024) throw new Error('too_big');
			const res = await learning.importText(file.name, await file.text());
			let msg: string = m.settings_import_done({ count: res.added });
			if (res.errors.length) msg += ' · ' + m.settings_import_errors({ count: res.errors.length });
			ui.flash(res.rows.length || !res.errors.length ? msg : m.settings_import_failed());
		} catch {
			ui.flash(m.settings_import_failed());
		} finally {
			importing = false;
		}
	}

	async function logout() {
		ui.settingsOpen = false;
		await auth.signOut();
		await goto('/login', { replaceState: true });
	}
</script>

<Sheet open={ui.settingsOpen} title={m.settings()} onclose={() => (ui.settingsOpen = false)}>
	<label class="row col">
		<span class="lbl">{m.settings_remember()} · <strong>{m.settings_seconds({ n: s.rememberSeconds })}</strong></span>
		<input
			type="range"
			min="3"
			max="7"
			step="1"
			value={s.rememberSeconds}
			oninput={(e) => learning.saveSettings({ rememberSeconds: Number(e.currentTarget.value) })}
		/>
	</label>

	<label class="row">
		<span class="lbl">{m.settings_show_spanish()}</span>
		<input type="checkbox" class="switch" checked={s.showSpanish} onchange={(e) => learning.saveSettings({ showSpanish: e.currentTarget.checked })} />
	</label>

	<label class="row">
		<span class="lbl">{m.settings_autoplay()}</span>
		<input type="checkbox" class="switch" checked={s.autoPlayAudio} onchange={(e) => learning.saveSettings({ autoPlayAudio: e.currentTarget.checked })} />
	</label>

	<div class="row col">
		<span class="lbl" id="img-timing">{m.settings_image_timing()}</span>
		<div class="seg" role="radiogroup" aria-labelledby="img-timing">
			<label class="seg-opt"><input type="radio" name="imgt" checked={s.imageTiming === 'after'} onchange={() => learning.saveSettings({ imageTiming: 'after' })} />{m.settings_image_after()}</label>
			<label class="seg-opt"><input type="radio" name="imgt" checked={s.imageTiming === 'before'} onchange={() => learning.saveSettings({ imageTiming: 'before' })} />{m.settings_image_before()}</label>
		</div>
	</div>

	<div class="row col">
		<span class="lbl" id="ui-lang">{m.settings_language()}</span>
		<div class="seg" role="radiogroup" aria-labelledby="ui-lang">
			{#each locales as l (l)}
				<label class="seg-opt"><input type="radio" name="lang" checked={getLocale() === l} onchange={() => setLocale(l)} />{l === 'es' ? m.lang_es() : m.lang_de()}</label>
			{/each}
		</div>
	</div>

	<label class="action" class:busy={importing}>
		<input type="file" accept=".json,.csv,application/json,text/csv" class="sr-only" onchange={onImport} disabled={importing} />
		<span class="ic"><Icon name="upload" size={18} /></span>{m.settings_import()}
	</label>

	<button class="action danger" onclick={logout}>
		<span class="ic"><Icon name="logout" size={18} /></span>{m.logout()}
	</button>
</Sheet>

<style>
	.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; }
	.col { flex-direction: column; align-items: stretch; gap: 8px; }
	.lbl { font-size: 15px; font-weight: 600; }
	input[type='range'] { width: 100%; accent-color: var(--color-accent); height: 32px; }
	.switch {
		appearance: none;
		width: 52px;
		height: 32px;
		flex: none;
		border-radius: 999px;
		background: var(--color-neutral-300);
		position: relative;
		cursor: pointer;
		transition: background 0.2s;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 4px;
		left: 4px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--color-neutral-100);
		box-shadow: var(--shadow-sm);
		transition: transform 0.2s var(--ease-out);
	}
	.switch:checked { background: var(--color-accent-2-700); }
	.switch:checked::after { transform: translateX(20px); }
	.seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
	.seg-opt { justify-content: center; min-height: 44px; font-size: 14px; font-weight: 600; }
	.action {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		padding: 0 16px 0 8px;
		border: 0;
		border-radius: 999px;
		background: var(--color-neutral-100);
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		text-align: left;
	}
	.action:focus-within { outline: 2px solid var(--color-accent); outline-offset: 2px; }
	.busy { opacity: 0.6; }
	.ic { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--color-accent-2-200); color: var(--color-accent-2-800); }
	.danger { color: var(--color-accent-800); }
	.danger .ic { background: var(--color-accent-200); color: var(--color-accent-800); }
</style>
