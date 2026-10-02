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
- **Audio**: native URL → recorded clip → generated URL → browser speech synthesis (`de-DE`).
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
type,german,translation,category,alt,context
word,heuer,este año,Alltag,dieses Jahr,Austriaco
```

`type` is optional (inferred), `alt` (German paraphrase) and `context` are optional.

## Built-in vocabulary

`data/vocabulary/*.txt` (one file per category) is the editable source of the bundled
dataset: ~800 words + ~260 phrases at B1 level, built from the analysis of 10 years of
personal emails (filtered for names, addresses and personal data) and completed with
Austrian German (Austriacisms carry the German-German equivalent in `alt` and "Austria"
in `context`). Rebuild with `npm run vocab:build` and bump `SEED_VERSION` in
`src/lib/data/seed.ts` so existing installs receive new items (progress is kept).

## Notes / limits of the MVP

- Learning data lives in the browser (IndexedDB): no cross-device sync yet. The repository
  layer is ready for a server-backed implementation.
- PWA-ready (manifest, offline-capable data); a service worker is not included yet.
