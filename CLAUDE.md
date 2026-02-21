# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `README.md` for commands, flags, environment variables, and feature documentation.

## Commands

```bash
# Type-check without emitting
npx tsc --noEmit

# Run the CLI (no build step needed)
npx tsx src/cli.ts explore --artist "Elliott Smith"
npx tsx src/cli.ts bridge --from "Nick Drake" --to "Frank Ocean"
npx tsx src/cli.ts theme --theme "loneliness in crowded places"
```

## Architecture

Three-layer pipeline: **Last.fm Client → Context Builder → LLM Harness**, wired together by the CLI.

**`src/lastfm/`** — Thin API wrapper. `client.ts` handles rate limiting (5 req/s via timestamp queue) and delegates cache reads/writes to `cache.ts` before every network call. Cache keys are deterministic slugs of `endpoint + params`, stored as JSON in `.cache/lastfm/`.

**`src/context/`** — `builder.ts` is query-type-aware: each of the three query types (`explore`, `bridge`, `theme`) triggers a different set of parallel Last.fm calls, filters tags by count threshold (`MIN_TAG_COUNT` env var, default 10), and formats everything into a structured text block. The builder takes a `LastfmClient` instance as a parameter (dependency injection) rather than constructing one internally.

**`src/llm/`** — Multiple harness modules, each with a single responsibility:
- `harness.ts` — loads a prompt template, interpolates `{{context}}` and `{{query}}`, selects diversity block (baseline vs expand), and calls the Anthropic API
- `artistConfidence.ts` — preflight step that validates artist names against Last.fm + Claude before the main query runs
- `themeTranslate.ts` — preflight step that converts abstract themes into Last.fm folksonomy tags
- `trackExtract.ts` — post-flight step that parses track names from prose LLM output into structured `[{ artist, track }]` for XSPF export (uses Haiku)
- `logger.ts` — writes full prompt + response + preflight results to `logs/` as timestamped JSON
- `templates.ts` — parses prompt template files with section delimiters (`---system---`, `---user---`, `---diversity-baseline---`, `---diversity-expand---`)

**`src/export/`** — `xspf.ts` builds and writes XSPF playlist files with XML escaping. Accepts optional `title` and `description` (rendered as `<title>` and `<annotation>`).

**`src/cli.ts`** — Orchestrates the full pipeline: parses args, runs preflight checks (artist confidence, theme translation), builds context, calls the LLM, and optionally exports XSPF. All progress goes to stderr; LLM output goes to stdout.

**`prompts/`** — Markdown template files, editable without recompiling. Each query type maps to one file (`explore.md`, `bridge.md`, `theme.md`). Preflight/post-flight templates: `artist-confidence.md`, `theme-translate.md`, `track-extract.md`.

## Key conventions

- **No build step.** TypeScript runs directly via `tsx`. Type-check with `npx tsc --noEmit`.
- **Dependency injection.** `LastfmClient` is instantiated in `cli.ts` and passed into builders/preflights rather than imported as a singleton.
- **stderr for status, stdout for output.** Never `console.log` status messages — use `process.stderr.write`.
- **Preflight results are logged.** All artist confidence checks and theme translations appear in the log entry's `preflight` array, including halted runs.
- **Prompt templates own the prose.** Code interpolates variables and selects sections; it never constructs prompt text inline.
