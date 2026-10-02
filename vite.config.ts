import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// SPA: the UI locale is a user preference, not part of the URL.
			strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
		})
	],
	test: {
		projects: [
			{
				extends: true,
				plugins: [svelteTesting()],
				test: {
					name: 'client',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					environment: 'jsdom',
					setupFiles: ['./vitest-setup.ts']
				}
			},
			{
				extends: true,
				test: {
					name: 'server',
					include: ['src/lib/server/**/*.{test,spec}.{js,ts}'],
					environment: 'node'
				}
			}
		]
	}
});
