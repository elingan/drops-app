/**
 * Text as it is read aloud. Shared by the app (speech-synthesis fallback) and
 * by scripts/build-audio.ts, so the generated MP3s and the fallback say the
 * same thing. Plain relative imports only: Node runs the scripts directly.
 */

/** «der Kunde / die Kundin» → «der Kunde, die Kundin» (a slash is read badly). */
export function spokenGerman(text: string): string {
	return text.replace(/\s*\/\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

/**
 * First meaning only, without notes: «hola; adiós (informal)» → «hola».
 * Reading every synonym drags on and the first one is the main meaning.
 */
export function spokenSpanish(translation: string): string {
	const first = translation.split(/[;·]/)[0] ?? '';
	return first.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}
