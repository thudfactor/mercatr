# Mercatr

A CLI tool for generating thematic music playlists with transparent reasoning. Given a seed (an artist, a song, or a theme), it queries Last.fm for folksonomy data, then uses Claude to surface thematic connections across genres and decades.

The goal is **musical diversity through thematic coherence** — finding what Elliott Smith and Hank Williams share, not just what sounds similar.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API keys

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

- **Last.fm**: Get a free API key at https://www.last.fm/api/account/create
- **Anthropic**: Get an API key at https://console.anthropic.com

```bash
LASTFM_API_KEY=your_lastfm_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Web interface

Mercatr also runs as a local web server with a browser UI that exposes all three query modes.

### Running the server

```bash
npm run serve
```

Then open `http://localhost:3000`. The browser will prompt for a username and password (set via `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` in `.env`).

The web interface supports all three query modes — explore, bridge, and theme — and lets you download results as an XSPF playlist file directly from the browser.

### Additional environment variables

Add these to your `.env` before running the server:

```bash
BASIC_AUTH_USER=your_username_here
BASIC_AUTH_PASSWORD=your_password_here
```

The server will refuse to start if either variable is missing.

## Commands

### `explore` — Explore an artist or song

Thematically explores a single artist (or a specific song), pulling in similar artists and tag data to surface unexpected connections.

```bash
# Explore an artist
npx tsx src/cli.ts explore --artist "Elliott Smith"

# Explore a specific song
npx tsx src/cli.ts explore --artist "Radiohead" --track "How to Disappear Completely"
```

| Option | Required | Description |
|---|---|---|
| `--artist <name>` | Yes | Seed artist |
| `--track <name>` | No | Specific track to explore |

### `bridge` — Connect two artists

Finds thematic and emotional connections between two artists and produces a playlist that traces a path from one to the other.

```bash
npx tsx src/cli.ts bridge --from "Nick Drake" --to "Frank Ocean"
```

| Option | Required | Description |
|---|---|---|
| `--from <artist>` | Yes | Starting artist |
| `--to <artist>` | Yes | Destination artist |

### `theme` — Build a thematic playlist

Builds a playlist from an abstract theme or mood. Themes can be concrete ("rainy day jazz") or abstract ("loneliness in crowded places") — a translation step converts abstract themes into Last.fm folksonomy tags before querying.

```bash
# Theme-based playlist
npx tsx src/cli.ts theme --theme "loneliness in crowded places"

# Theme grounded by a seed artist
npx tsx src/cli.ts theme --theme "performative happiness" --seed-artist "Carly Rae Jepsen"
```

| Option | Required | Description |
|---|---|---|
| `--theme <theme>` | Yes | Theme or mood |
| `--seed-artist <artist>` | No | Grounds the theme around a specific artist's world |

## Shared flags

These flags work with all three commands.

| Flag | Description |
|---|---|
| `--verbose` | Print assembled Last.fm context to stderr |
| `--dry-run` | Print the full interpolated prompt without calling the LLM |
| `--no-cache` | Bypass Last.fm cache for this run |
| `--model <model>` | Override the default Claude model |
| `--template <path>` | Use a custom prompt template file |
| `--expand` | Activate expanded genre diversity mode |
| `--export [path]` | Export the playlist as an XSPF file |

## Features

### Artist confidence preflight

Before querying, mercatr checks every artist name against Last.fm and Claude to catch typos and ambiguous names. This fires automatically — no flag needed.

- **High confidence** — proceeds silently, using the canonical spelling from Last.fm
- **Medium confidence** — prompts for confirmation:
  ```
  ⚠  Artist not found: "Samantha Carpenter"
     Did you mean: Sabrina Carpenter?
     Proceed with Sabrina Carpenter? (y/n)
  ```
- **Low confidence** — halts with an explanation and suggestions:
  ```
  ✗  Unknown artist: "Blorpus McFee"
     No close matches found in Last.fm or known discographies.
  ```

The resolved name (not the original input) is used for all downstream lookups and prompts.

### Theme translation

The `theme` command translates abstract themes into Last.fm folksonomy tags before querying. For example, "loneliness in crowded places" might become tags like `melancholy`, `introspective`, `urban`, `ambient`, `post-punk`. This bridges the gap between how people describe moods and how Last.fm users tag music.

The main prompt receives both the original theme and the translation metadata, so Claude knows the data is one step removed from the user's intent.

### Genre diversity controls

Every query includes a genre diversity audit that resists overrepresentation of indie/alternative/singer-songwriter and encourages pulls from blues, jazz, metal, country, classical, electronic, soul, reggae, non-Western traditions, and pre-1960s music.

The `--expand` flag upgrades this to hard constraints:

- No more than 2 selections from indie/alternative/mainstream hip-hop combined
- At least 1 selection predating 1970
- At least 1 selection from a non-anglophone tradition
- At least 1 selection from metal, blues, jazz, or classical

### XSPF export

The `--export` flag extracts a structured track list from the LLM response and writes a standards-compliant XSPF playlist file, compatible with import tools like Soundiiz and TuneMyMusic.

```bash
# Default filename (playlist-{timestamp}.xspf)
npx tsx src/cli.ts explore --artist "Björk" --export

# Custom path
npx tsx src/cli.ts bridge --from "Miles Davis" --to "Aphex Twin" --export bridge.xspf
```

The exported file includes a `<title>` and `<annotation>` derived from the query:

- explore: "Exploring Björk" (or "Exploring Army of Me by Björk")
- bridge: "Bridge: Miles Davis → Aphex Twin"
- theme: "Theme: loneliness in crowded places"

Track extraction uses a smaller model (`claude-haiku-4-5`) to keep costs low.

## Output contract

- The LLM response is printed to **stdout**
- Progress messages, warnings, and errors go to **stderr**

This makes it safe to pipe or redirect output:

```bash
npx tsx src/cli.ts explore --artist "Joni Mitchell" > response.md
npx tsx src/cli.ts theme --theme "desert highways" --export playlist.xspf > response.md
```

With `--dry-run`, the interpolated system and user prompts are printed to stdout instead, and the LLM is never called.

## Prompt customization

Prompts are stored as Markdown files in `prompts/` and can be edited without recompiling:

| File | Command |
|---|---|
| `prompts/explore.md` | `explore` |
| `prompts/bridge.md` | `bridge` |
| `prompts/theme.md` | `theme` |
| `prompts/artist-confidence.md` | Artist confidence preflight |
| `prompts/theme-translate.md` | Theme translation preflight |
| `prompts/track-extract.md` | Track extraction for XSPF |

### Template format

Each template uses section delimiters and `{{variable}}` interpolation:

```markdown
---system---
You are a music critic...

{{context}}

---diversity-baseline---
Genre diversity audit instructions...

---diversity-expand---
Hard genre diversity constraints...

---user---
{{query}}
```

Use `--template <path>` to test alternatives without modifying the defaults:

```bash
npx tsx src/cli.ts explore --artist "Joni Mitchell" --template ./prompts/my-experiment.md
```

## Caching

Last.fm responses are cached in `.cache/lastfm/` for 24 hours by default. Cache files are named by endpoint + parameters, so they're inspectable. The API client enforces a rate limit of 5 requests per second regardless of cache state.

Override the TTL:

```bash
LASTFM_CACHE_TTL_HOURS=48 npx tsx src/cli.ts explore --artist "PJ Harvey"
```

Bypass the cache entirely for a single run:

```bash
npx tsx src/cli.ts explore --artist "PJ Harvey" --no-cache
```

## Logging

Every LLM call is logged to `logs/` as a timestamped JSON file containing the full prompt, response, and all preflight results (artist confidence checks, theme translations). Halted runs (where an artist wasn't found) are logged too, with `"halted": true`.

```bash
ls logs/
# 2025-06-15_12-30-00__explore.json
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LASTFM_API_KEY` | Yes | — | Last.fm API key |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Default model for all LLM calls |
| `LASTFM_CACHE_TTL_HOURS` | No | `24` | Cache TTL (accepts decimals, e.g. `0.5` for 30 min) |
| `MIN_TAG_COUNT` | No | `10` | Filters out noisy low-count tags from Last.fm |
| `BASIC_AUTH_USER` | Web only | — | Username for Basic Auth (required by `npm run serve`) |
| `BASIC_AUTH_PASSWORD` | Web only | — | Password for Basic Auth (required by `npm run serve`) |
| `PORT` | No | `3000` | Port the web server listens on |
