import { spokenGerman, spokenSpanish } from '../utils/speech-text.ts';

/**
 * Link between the vocabulary and the generated MP3s (data/audio-manifest.json,
 * written by scripts/build-audio.ts). Each clip keeps the text it was generated
 * from, so a reworded entry is never paired with stale audio.
 */
export interface AudioClip {
	text: string;
	url: string;
}

export interface AudioManifestEntry {
	audio?: AudioClip;
	translation?: AudioClip;
	example?: AudioClip;
}

/** Keyed by the lower-cased German text, like the duplicate check of the importer. */
export type AudioManifest = Record<string, AudioManifestEntry>;

export interface AudioRow {
	german: string;
	translation?: string;
	example?: string;
	audioUrl?: string;
	translationAudioUrl?: string;
	exampleAudioUrl?: string;
}

export const manifestKey = (german: string) => german.trim().toLowerCase();

/** What each of the three clips of an entry says (undefined: nothing to say). */
export function clipTexts(row: AudioRow): { audio: string; translation?: string; example?: string } {
	return {
		audio: spokenGerman(row.german),
		translation: row.translation ? spokenSpanish(row.translation) || undefined : undefined,
		example: row.example ? spokenGerman(row.example) : undefined
	};
}

/** Sets (or clears) the audio URLs of every row from the manifest; returns how many got any. */
export function applyAudioManifest<T extends AudioRow>(rows: T[], manifest: AudioManifest): number {
	let withAudio = 0;
	for (const row of rows) {
		const entry = manifest[manifestKey(row.german)];
		const text = clipTexts(row);
		const pick = (clip: AudioClip | undefined, expected: string | undefined) =>
			clip && expected !== undefined && clip.text === expected ? clip.url : undefined;
		const urls = {
			audioUrl: pick(entry?.audio, text.audio),
			translationAudioUrl: pick(entry?.translation, text.translation),
			exampleAudioUrl: pick(entry?.example, text.example)
		};
		for (const [field, url] of Object.entries(urls) as [keyof typeof urls, string | undefined][]) {
			if (url) row[field] = url;
			else delete row[field];
		}
		if (urls.audioUrl || urls.translationAudioUrl || urls.exampleAudioUrl) withAudio++;
	}
	return withAudio;
}
