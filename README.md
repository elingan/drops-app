# Deutsch 10

Personal German micro-learning SPA: open the app, study for 10 minutes, close it.
**Remember → Reveal → Listen → Swipe → Next.**

UI follows the Claude Design file *Deutsch 10* (Organic design system: Caprasimo + Figtree,
terracotta/sage palette). Concepts are inspired by micro-learning apps; no third-party branding.

## Stack

- SvelteKit 2 · Svelte 5 (runes) · TypeScript strict
- Paraglide JS 2 (UI in `es` / `de`; study content is independent)
- BetterAuth (email + password, **sign-up disabled**) on libSQL / Turso
- Plain CSS with the design-system tokens (`src/app.css`) — Tailwind wasn't needed
- IndexedDB (via `idb`) for learning data, behind repository interfaces
- Vitest + Testing Library

The app runs as an SPA (`ssr = false`); the server only hosts `/api/auth/*`.

## Getting started

```bash
npm install
cp .env.example .env            # fill BETTER_AUTH_SECRET (openssl rand -base64 32)
# set SEED_USER_EMAIL / SEED_USER_PASSWORD in .env: tables + user are created on first request
# (or explicitly: npm run auth:migrate && npm run seed:user)
npm run dev                     # http://localhost:5173
```

Other scripts: `npm run check` (svelte-check), `npm test`, `npm run build`.

## Deploying to Vercel

The Vercel project is linked to this repo (`main` = production).

1. **Database**: Vercel → project → *Storage* → *Turso* → create a database and connect it to
   the project. The integration injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
   (`DATABASE_URL` / `DATABASE_AUTH_TOKEN` also work).
2. **Env vars** (already set): `BETTER_AUTH_SECRET`, `SEED_USER_EMAIL`, `SEED_USER_NAME`,
   `SEED_USER_PASSWORD` (change the placeholder!). `BETTER_AUTH_URL` is optional — the
   production and preview URLs are derived from Vercel's system variables.
3. **Redeploy**. On the first request to `/api/auth`, the server creates the auth tables and,
   if no user exists, the single user from `SEED_USER_*`. Changing `SEED_USER_PASSWORD` later
   does not change an existing user's password.

In production the server uses the HTTP-only `@libsql/client/web`, so no native module is needed.

## Architecture

```
src/lib/
  domain/types.ts          LearningItem, LearningProgress, Category, Session, SessionItem, …
  engine/
    review-scheduler.ts    ReviewScheduler interface + SimpleScheduler (replaceable, e.g. by SM-2/FSRS)
    learning-engine.ts     priorities, reasons, balanced/interleaved route generation
    session-engine.ts      10-min timer, queue, re-insertion of failed cards, refill, summary
  repositories/            Collection-based interfaces; IndexedDB + in-memory implementations
  services/                content, categories, progress, importer, audio, speech, content analysis, AI
  state/                   runes state: auth, learning data, session state machine, UI
  state/context.ts         composition root (swap persistence/AI/speech providers here)
  components/              AppShell, BottomNavigation, LearningCard, SwipeCard, Countdown, …
src/routes/                /login /app /learn /vocabulary /categories /categories/[id] /progress /add
```

- **Content vs. progress**: `LearningItem` holds content; `LearningProgress` holds the
  spaced-repetition state (`mastery`, `difficulty`, counts, `lastReviewedAt`, `nextReviewAt`).
- **Session state machine** (`state/session.svelte.ts`):
  `IDLE → SHOW_CARD → WAITING_FOR_RECALL → REVEAL_ANSWER → AUDIO → WAITING_FOR_RATING → NEXT_CARD → … → SESSION_COMPLETE`.
- **Routes**: due cards first, then low-accuracy/forgotten, then a capped number of new cards
  (progressive introduction), category-balanced and interleaved so categories alternate and
  words/phrases mix. Failed cards return 4 positions later; the route refills while time remains.
- **Audio**: native URL → recorded clip → generated MP3 (ElevenLabs, see [Audio](#audio)) → browser
  speech synthesis (`de-DE` / `es-ES`), which also takes over when an MP3 fails to load.
  Revealing a card says the word, its Spanish translation and the example sentence, in that order
  (`AudioService.playSequence`); walk mode follows the same order.
- **Speech-to-text**: `SpeechRecognitionService` (Web Speech API by default; hidden when unsupported).
- **AI**: `AIService` / `ContentAnalysisService` interfaces; MVP uses rules + existing vocabulary.

## Importing vocabulary

Settings (avatar on Home) → *Import vocabulary*. JSON or CSV (`,` or `;`), validated
(required fields, lengths, types, duplicates). Unknown categories are created.

```json
[
  { "type": "word", "german": "ausmachen", "translation": "apagar / acordar", "category": "Alltag" },
  { "type": "phrase", "german": "Das kriegen wir heute noch hin.", "translation": "Lo podemos terminar hoy.", "category": "Arbeit" }
]
```

```csv
type,german,translation,category,alt,context,example,exampleTranslation
word,heuer,este año,Alltag,dieses Jahr,Austriaco,Heuer fahren wir nach Kroatien.,Este año vamos a Croacia.
```

`type` is optional (inferred); `alt` (German paraphrase), `context`, `example` (a short German sentence
that uses the word) and `exampleTranslation` are optional.

## Built-in vocabulary

`data/vocabulary/*.txt` (one file per category) is the editable source of the bundled
dataset: ~850 words + ~300 phrases at B1 level, built from the analysis of 10 years of
personal emails (filtered for names, addresses and personal data) and completed with
Austrian German (Austriacisms carry the German-German equivalent in `alt` and "Austria"
in `context`). Every word also has a short B1 example sentence with its Spanish translation
(`example` / `exampleTranslation`; the phrases have none). Rebuild with `npm run vocab:build` and bump
`SEED_VERSION` in `src/lib/data/seed.ts` so existing installs receive new items, example sentences and
audio (progress is kept; items the user created or reworded are left alone).

## Audio

Pronunciation comes from MP3 files generated once with [ElevenLabs](https://elevenlabs.io) and served
from `static/audio/` (nothing is called at runtime). Three clips per entry:

| Clip | Text | Field |
| --- | --- | --- |
| German word or phrase | `german` | `audioUrl` |
| Spanish translation (first meaning, notes removed) | `translation` | `translationAudioUrl` |
| Example sentence | `example` | `exampleAudioUrl` |

```bash
export ELEVENLABS_API_KEY=...        # or put it in .env (never commit it, never paste it in a chat)
npm run audio:build                  # estimate only: characters per voice, clips, size
npm run audio:build -- --limit 8     # test batch: 8 entries spread over the vocabulary
npm run audio:build -- --all         # everything that is still missing
npm run audio:build -- --all --type word    # words only (skips the phrases)
npm run audio:build -- --all --category Restaurant --type word   # one block at a time
```

- **Idempotent**: files are named after a hash of voice + model + output format + language + text, and an
  existing file is never requested again. Editing a text or changing voice/model only generates what changed.
  The result is linked through `data/audio-manifest.json` and written into `src/lib/data/vocabulary-at.json`;
  `npm run vocab:build` keeps the links (a reworded text drops its stale audio).
  After regenerating, bump `SEED_VERSION` so installed apps pick up the new URLs.
- **Voices**: looked up by name among the voices of your account (`GET /v1/voices`, exact name,
  case-insensitive; «Livia» also matches «Livia - Expressive & Dynamic»). The default is **Matilda** for German
  and Spanish, a premade voice that works on the free plan. «Livia» (German) and «Marina» (Spanish) are
  library voices: ElevenLabs only lets paid plans use them through the API. If a voice is not found or is
  ambiguous the script stops; it never picks another one.
- **Environment**: `ELEVENLABS_API_KEY` (required, only needs the *voices* and *text to speech*
  permissions); `ELEVENLABS_VOICE_DE`, `ELEVENLABS_VOICE_ES` (name or voice id, e.g. `Livia` / `Marina`);
  `ELEVENLABS_MODEL` (default `eleven_multilingual_v2`); `ELEVENLABS_OUTPUT_FORMAT` (default `mp3_24000_48`,
  ~6 KB/s); `ELEVENLABS_CONCURRENCY` (default 3). The language is pinned with `language_code` on every request.
- **Cost**: ElevenLabs bills per character. Each run prints the characters per voice (total and pending)
  before generating anything. The full dataset is about 55,000 German + 22,000 Spanish characters and
  ~30 MB of MP3 in `static/audio/`, served by Vercel's CDN with an immutable cache header (`vercel.json`; the
  file names are hashes). Keep one voice and model: every regeneration with another voice adds its own set of
  files to the repo. If that ever grows too much, upload the folder to Vercel Blob and point `audioUrlBase`
  in `scripts/build-audio.ts` at it.
- **App**: on reveal a card says the word, the translation and the example (`autoPlayAudio`, on by default,
  can be turned off in Settings; the speaker button replays the sequence). The example and its translation
  are shown on the card. Walk mode plays word → translation → example → word again; each part can be
  switched off. Browser speech takes over for any clip without an MP3 or whose MP3 fails to load.

## Notes / limits of the MVP

- Learning data lives in the browser (IndexedDB): no cross-device sync yet. The repository
  layer is ready for a server-backed implementation.
- PWA-ready (manifest, offline-capable data); a service worker is not included yet.
