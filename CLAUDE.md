# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `README.md` for commands, flags, environment variables, and feature documentation.

## Commands

```bash
# Type-check
npx astro check

# Run the CLI (no build step needed)
npx tsx src/cli.ts explore --artist "Elliott Smith"
npx tsx src/cli.ts bridge --from "Nick Drake" --to "Frank Ocean"
npx tsx src/cli.ts theme --theme "loneliness in crowded places"

# Dev server (requires BASIC_AUTH_USER and BASIC_AUTH_PASSWORD in .env)
npm run dev

# Production build + start
npm run build
npm start

# Deploy to Railway
npm run deploy
```

## Architecture

Three-layer pipeline: **Last.fm Client → Context Builder → LLM Harness**, wired together by two entry points: the CLI (`src/cli.ts`) and the Astro SSR web app (`src/pages/`).

### Core pipeline

**`src/lastfm/`** — Thin API wrapper. `client.ts` handles rate limiting (5 req/s via timestamp queue) and delegates cache reads/writes to `cache.ts` before every network call. Cache keys are deterministic slugs of `endpoint + params`, stored as JSON in `.cache/lastfm/`.

**`src/context/`** — `builder.ts` is query-type-aware: each of the three query types (`explore`, `bridge`, `theme`) triggers a different set of parallel Last.fm calls, filters tags by count threshold (`MIN_TAG_COUNT` env var, default 10), and formats everything into a structured text block. The builder takes a `LastfmClient` instance as a parameter (dependency injection) rather than constructing one internally.

**`src/llm/`** — Multiple modules, each with a single responsibility:
- `provider.ts` — LLM provider abstraction. Normalizes Claude and OpenAI-compatible APIs behind a single `generateText()` function. Resolves model names from env vars per usage type (`main` vs `track-extract`). All LLM calls go through this.
- `harness.ts` — loads a prompt template, interpolates `{{context}}` and `{{query}}`, selects diversity block (baseline vs expand), and calls `generateText()`
- `artistConfidence.ts` — preflight step that validates artist names against Last.fm + Claude before the main query runs
- `themeTranslate.ts` — preflight step that converts abstract themes into Last.fm folksonomy tags
- `trackExtract.ts` — post-flight step that parses track names from prose LLM output into structured `[{ artist, track }]` for XSPF export
- `parseTracksFromResponse.ts` — extracts tracks from LLM narrative text
- `logger.ts` — writes full prompt + response + preflight results to `logs/` as timestamped JSON
- `templates.ts` — parses prompt template files with section delimiters (`---system---`, `---user---`, `---diversity-baseline---`, `---diversity-expand---`)

**`src/export/`** — `xspf.ts` builds and writes XSPF playlist files with XML escaping. Accepts optional `title` and `description` (rendered as `<title>` and `<annotation>`).

### Web app (Astro SSR + Lit)

**`src/pages/`** — Astro SSR pages and API routes, using `@astrojs/node` standalone adapter.
- `index.astro` — main app page, wires Lit web components together with a thin orchestrator `<script>`
- `api/explore.ts`, `api/bridge.ts`, `api/theme.ts` — POST endpoints using Web API `Request`/`Response`. Each route reuses the core pipeline.
- `api/xspf.ts` — POST endpoint that builds XSPF XML from track data
- `api/voices.ts` — GET endpoint returning the voice manifest from `prompts/voices/manifest.json`
- `api/config.ts` — GET endpoint returning provider/model info

**`src/middleware.ts`** — Basic Auth middleware (requires `BASIC_AUTH_USER` + `BASIC_AUTH_PASSWORD` env vars)

**`src/components/`** — Lit web components for the interactive UI:
- `playlist-form.ts` — tabs (`role="tablist"`, arrow key nav), three form panels, voice selector, dispatches `playlist-submit` custom event
- `playlist-results.ts` — renders markdown (via `marked` + `DOMPurify`) and track list with Last.fm links
- `history-drawer.ts` — session history sidebar with localStorage management, list/detail views
- `waiting-song.ts` — loading animation cycling through song quotes
- `toast-notification.ts` — transient status messages
- `error-dialog.ts` — error modal wrapping native `<dialog>`

**`src/layouts/Base.astro`** — shared HTML shell with global CSS import

**`src/lib/`** — framework-agnostic utilities:
- `validate.ts` — input validation (pure functions returning error objects)
- `waiting-songs.ts` — song data array for the loading animation

### Prompts

**`prompts/`** — Markdown template files, editable without recompiling. Each query type maps to one file (`explore.md`, `bridge.md`, `theme.md`). Preflight/post-flight templates: `artist-confidence.md`, `theme-translate.md`, `track-extract.md`.

**`prompts/voices/`** — Alternative voice personas. `manifest.json` lists available voices; each voice is a separate `.md` template.

**`src/cli.ts`** — Orchestrates the full pipeline: parses args, runs preflight checks (artist confidence, theme translation), builds context, calls the LLM, and optionally exports XSPF. All progress goes to stderr; LLM output goes to stdout.

## Key conventions

- **Astro SSR for the web app.** Build with `npm run build`, start with `npm start`. Dev with `npm run dev`. Type-check with `npx astro check`.
- **CLI has no build step.** TypeScript runs directly via `tsx`.
- **No tests or linting.** The project has no test framework or lint config.
- **Lit web components use decorators.** `tsconfig.json` enables `experimentalDecorators` and `useDefineForClassFields: false`.
- **Component communication via custom events.** Components fire bubbling, composed events. The orchestrator `<script>` in `index.astro` wires events to fetch calls and passes results as properties. No framework state management.
- **CSS custom properties pierce Shadow DOM.** Global design tokens in `src/styles/global.css` are consumed by Lit components via `var(--color-*)`.
- **Path resolution in production.** A Vite plugin in `astro.config.mjs` rewrites `import.meta.url`-based `__dirname` patterns to `process.cwd()` so pipeline modules resolve `prompts/`, `.cache/`, and `logs/` correctly after bundling.
- **Dependency injection.** `LastfmClient` is instantiated in `cli.ts` and passed into builders/preflights rather than imported as a singleton.
- **stderr for status, stdout for output.** Never `console.log` status messages — use `process.stderr.write`.
- **Preflight results are logged.** All artist confidence checks and theme translations appear in the log entry's `preflight` array, including halted runs.
- **Prompt templates own the prose.** Code interpolates variables and selects sections; it never constructs prompt text inline.
- **Two-model split.** Playlist generation (`harness.ts`) uses the main model (`ANTHROPIC_MODEL` / `--model`). Preflights and track extraction use the processing model (`ANTHROPIC_PROCESSING_MODEL` / `--processing-model`), which falls back to the main model if unset.
