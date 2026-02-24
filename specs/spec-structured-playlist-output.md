# Spec: Structured Playlist Output

## Overview

This change replaces the existing track extraction pipeline (a second LLM call via `extractTracks` using `claude-haiku`) with a delimiter-based approach where the primary LLM embeds a structured JSON track list directly in its response. The server parses this before returning to the client, and all API routes return a `tracks` field alongside the narrative.

This eliminates the `extractTracks` haiku call, simplifies the XSPF route, and gives the frontend a structured track array it can use to render decorated playlist items without any additional round-trips.

---

## Changes by Layer

### 1. `TrackInfo` type (`src/llm/trackExtract.ts`)

Extend the existing interface with `album` and `year`:

```typescript
export interface TrackInfo {
  artist: string;
  track: string;
  album: string;
  year: string; // string to accommodate uncertainty, e.g. "c. 1968", "1965–66"
}
```

`year` is a string rather than a number to handle cases where the LLM can only approximate the date. Both `album` and `year` should be treated as best-effort — the LLM may return an empty string if it cannot determine either with confidence.

---

### 2. Prompt templates (`prompts/explore.md`, `prompts/bridge.md`, `prompts/theme.md`)

Add the following block to the **end** of the `---user---` section in all three templates. The instruction must appear after the main request so it reads as a formatting epilogue, not a constraint on the content:

```
---

After your response, append the following delimiter on its own line, followed immediately by a JSON array of every track you recommended:

---TRACKS---
[
  { "artist": "Artist Name", "track": "Track Title", "album": "Album Title", "year": "YYYY" }
]

Rules for the JSON block:
- Include every track you recommended, in the order they appear in your response
- Use the exact artist name and track title as written in your response
- Provide `album` and `year` to the best of your knowledge; use an empty string if uncertain
- Do not include tracks that appear only as contextual references, only tracks you are recommending
- Return valid JSON — no trailing commas, no comments
- Nothing should appear after the closing bracket
```

The delimiter string is `---TRACKS---`. It must appear on its own line with no leading or trailing whitespace. The JSON array must begin on the immediately following line.

---

### 3. New parsing utility (`src/llm/parseTracksFromResponse.ts`)

A pure function that takes the raw LLM response string and returns a structured result. No API calls, no side effects.

```typescript
export interface ParsedResponse {
  narrative: string;
  tracks: TrackInfo[] | null;
  warning?: string;
}

export function parseTracksFromResponse(raw: string): ParsedResponse
```

**Logic:**

1. Split `raw` on the first occurrence of `\n---TRACKS---\n`. If the delimiter is not found, return `{ narrative: raw, tracks: null, warning: 'No ---TRACKS--- delimiter found in LLM response' }`.
2. Assign everything before the delimiter to `narrative`. Trim trailing whitespace from `narrative`.
3. Attempt `JSON.parse` on the portion after the delimiter (trimmed).
4. If parsing succeeds and the result is a non-empty array, return `{ narrative, tracks }`.
5. If parsing succeeds but the result is an empty array, return `{ narrative, tracks: [], warning: 'Track list parsed but was empty' }`.
6. If `JSON.parse` throws, return `{ narrative, tracks: null, warning: \`Failed to parse track JSON: ${error.message}\` }`.

**On warnings:** The function never throws. All failure modes return a valid `ParsedResponse` with `tracks: null` and a `warning` string. Callers are responsible for logging the warning.

---

### 4. Route handlers (`src/server/routes/explore.ts`, `bridge.ts`, `theme.ts`)

After `runQuery` returns the raw LLM response string, each route should:

1. Call `parseTracksFromResponse(rawResponse)`.
2. If `result.warning` is present, log it to stderr (consistent with existing warning patterns).
3. Return the response object with `response: result.narrative` and `tracks: result.tracks`.

**Updated response shapes:**

**`/api/explore`**
```json
{
  "response": "<narrative markdown>",
  "tracks": [
    { "artist": "string", "track": "string", "album": "string", "year": "string" }
  ],
  "resolvedArtist": "string (if auto-corrected)",
  "originalInput": "string (if auto-corrected)"
}
```

**`/api/bridge`**
```json
{
  "response": "<narrative markdown>",
  "tracks": [...],
  "resolvedArtist": ["string", "string"],
  "originalInput": ["string", "string"]
}
```

**`/api/theme`**
```json
{
  "response": "<narrative markdown>",
  "tracks": [...]
}
```

`tracks` will be `null` if parsing failed (soft failure). Frontend must handle this case.

---

### 5. XSPF route (`src/server/routes/xspf.ts`)

The route should now accept a pre-parsed tracks array directly, eliminating the `extractTracks` call:

**Updated request body:**
```json
{
  "tracks": [
    { "artist": "string", "track": "string", "album": "string", "year": "string" }
  ],
  "title": "string"
}
```

**Implementation:**

1. Validate that `tracks` is a non-empty array and `title` is a non-empty string. Return 400 if either fails.
2. Call `buildXspf(tracks, { title })` directly.
3. Return the XSPF string with appropriate headers.

The `response` field is no longer accepted. Remove the `extractTracks` call entirely from this route. The `extractTracks` function itself can remain in the codebase for now (it's used by the CLI `--export` flag) but should not be called from any web route.

> **Note on CLI:** The CLI `--export` path still calls `extractTracks` and is not affected by this change. A future spec may migrate the CLI to use the delimiter approach as well, but that is out of scope here.

---

### 6. Frontend (`public/index.html`)

**Response handling in `submitForm`:**

The function currently stores the raw response string. It should now store both `data.response` (the narrative) and `data.tracks` (the array or null) in state accessible to the XSPF download handler.

**Playlist rendering:**

After rendering `data.response` as markdown (existing behavior), if `data.tracks` is a non-null, non-empty array, render a structured track list below the narrative. Each track item should display artist, track title, album, and year, and include a Last.fm link constructed from the artist and track name:

```
https://www.last.fm/music/{encodeURIComponent(artist)}/_/{encodeURIComponent(track)}
```

The track list should be visually distinct from the narrative — a lighter-weight list rather than prose formatting.

If `data.tracks` is null, do not render the track list. The narrative alone is sufficient. No error message is needed for a soft failure here.

**XSPF download button:**

Update the `downloadXspf` function to POST `{ tracks: currentTracks, title }` instead of `{ response: responseText, title }`. The button should be disabled if `currentTracks` is null.

---

## Files Changed

| File | Change |
|---|---|
| `src/llm/trackExtract.ts` | Extend `TrackInfo` interface |
| `src/llm/parseTracksFromResponse.ts` | New file |
| `prompts/explore.md` | Add delimiter instruction |
| `prompts/bridge.md` | Add delimiter instruction |
| `prompts/theme.md` | Add delimiter instruction |
| `src/server/routes/explore.ts` | Use `parseTracksFromResponse`, update response shape |
| `src/server/routes/bridge.ts` | Use `parseTracksFromResponse`, update response shape |
| `src/server/routes/theme.ts` | Use `parseTracksFromResponse`, update response shape |
| `src/server/routes/xspf.ts` | Accept `tracks` array directly, remove `extractTracks` call |
| `public/index.html` | Render track list, update XSPF download handler |

---

## What Is Not Changing

- The CLI `--export` path continues to use `extractTracks` and is unaffected
- The `buildXspf` and `writeXspf` functions in `src/export/xspf.ts` are unaffected
- The `loadTemplate` / `interpolate` / `runQuery` pipeline is unaffected
- Basic Auth, Railway deployment, logging schema — all unaffected

---

## Definition of Done

1. All three API routes return `{ response, tracks }` where `tracks` is either a valid `TrackInfo[]` or `null`
2. The frontend renders a decorated track list when `tracks` is non-null
3. XSPF download uses the pre-parsed tracks array — no second LLM call is made during a download
4. A deliberate malformed `---TRACKS---` block (invalid JSON) results in a 200 response with `tracks: null` and a warning logged to stderr, not a 500
5. Existing CLI behavior is unchanged
