# Spec: Artist Entity Tagging & Clickable Navigation

## Purpose

This spec describes a feature that makes artist names in LLM-generated commentary
interactive, enabling users to branch from any result into a new Explore query. This is
the first implementation of Mercatr's "yes, and" associative navigation model — where
generated content becomes an entry point for further exploration rather than a terminal
output.

---

## Background & Design Rationale

Mercatr's value proposition is active listening and music discovery through transparent
curatorial reasoning. The commentary is the product; the tracklist is evidence. To support
an exploratory, Wikipedia-like navigation pattern, artist names in prose commentary should
function as branch points — clicking one should launch a new Explore query with the same
curatorial lens applied.

This spec covers only artist name tagging and the Explore branch. Thematic concept linking
and other entity types are explicitly out of scope but should not be precluded by this
implementation.

---

## Scope

**In scope:**
- Prompt changes to tag artist names in LLM output across all three modes (explore, bridge, theme)
- Server-side parsing to extract entities and strip markup from prose
- Updated API response shape to include `entities` array
- Frontend rendering to make tagged artists clickable
- Click behavior: launch new Explore query

**Out of scope:**
- Bridge or Theme branches from artist clicks (future iteration)
- Thematic concept tagging
- Album or track linking
- History provenance ("Tom Waits from MC Chris exploration")

---

## Prompt Changes

### Instruction to add to all three prompt templates

Add the following instruction to the system prompt section of `prompts/explore.md`,
`prompts/bridge.md`, and `prompts/theme.md`. Place it in a shared position near the end
of the system prompt, after voice instructions:

```
## Artist Name Tagging

When you mention a music artist by name in your commentary, wrap the name using this
exact format: [ARTIST]Artist Name[/ARTIST]

Use the artist's name exactly as you would naturally write it. Do not change your prose
to accommodate the tags — write as you normally would, then wrap the names. Apply tags
every time an artist name appears, including repeated mentions.

Do not tag artist names that appear only in the ---TRACKS--- JSON block. Only tag names
in the prose commentary above the delimiter.
```

### Rationale

- Inline tagging is more reliable than asking the LLM to count character offsets
- Tagging every occurrence (not just first) gives the frontend maximum flexibility
- Explicit exclusion of the TRACKS block prevents double-processing
- The instruction is additive — it does not ask the LLM to change how it writes

---

## Server-Side Changes

### New module: `src/llm/parseEntities.ts`

This module is responsible for extracting artist entities from tagged LLM output and
returning clean prose. It mirrors the structure of `src/llm/trackExtract.ts`.

```typescript
export interface EntityInfo {
  name: string;
  type: 'artist';
}

/**
 * Extracts all [ARTIST]...[/ARTIST] tags from prose,
 * returns deduplicated entity list and clean prose string.
 */
export function parseEntitiesFromResponse(raw: string): {
  entities: EntityInfo[];
  cleanResponse: string;
} {
  const ARTIST_TAG_RE = /\[ARTIST\](.*?)\[\/ARTIST\]/g;
  const seen = new Set<string>();
  const entities: EntityInfo[] = [];

  let match: RegExpExecArray | null;
  while ((match = ARTIST_TAG_RE.exec(raw)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      entities.push({ name, type: 'artist' });
    }
  }

  const cleanResponse = raw.replace(ARTIST_TAG_RE, '$1');

  return { entities, cleanResponse };
}
```

**Key behaviors:**
- Deduplicates by exact name string — "The Replacements" appearing three times yields one entity
- Strips tags from prose, leaving only the artist name text
- Does not touch the `---TRACKS---` block (it appears after the prose and contains no tags per prompt instruction)
- Returns both artifacts so the caller can use each independently

### Changes to route handlers

All three route handlers (`src/server/routes/explore.ts`, `bridge.ts`, `theme.ts`) follow
the same pattern. After receiving the raw LLM response string from `runQuery`:

1. Call `parseEntitiesFromResponse(result.response)`
2. Use `cleanResponse` as the `response` value sent to the client
3. Include `entities` in the response JSON

**Updated shared response shape:**

```json
{
  "response": "<clean LLM markdown, no [ARTIST] tags>",
  "tracks": [...],
  "entities": [
    { "name": "The Replacements", "type": "artist" },
    { "name": "Pavement", "type": "artist" }
  ],
  "resolvedArtist": "...",   // only present if auto-corrected, unchanged
  "originalInput": "..."     // only present if auto-corrected, unchanged
}
```

Note: `tracks` is already extracted server-side before the response is sent. The
`parseEntitiesFromResponse` call should happen in the same location, operating on the same
raw string before the `---TRACKS---` delimiter is stripped.

### Logging

The existing log schema records the raw `response` field from the LLM harness. This should
remain unchanged — logs capture raw LLM output including tags, which is useful for
debugging prompt compliance. The `cleanResponse` is what gets sent to the client; the
tagged version stays in logs.

---

## TypeScript Types

Add to `src/types.ts` or a new `src/llm/types.ts` if preferred:

```typescript
export interface EntityInfo {
  name: string;
  type: 'artist';
}
```

Update the API response type used in route handlers to include:

```typescript
entities: EntityInfo[];
```

---

## Frontend Changes (`public/index.html`)

### Rendering entities as links

After a successful API response, the frontend already renders `response` as Markdown via
`marked.js`. The entity linking layer should run as a post-processing step on the rendered
HTML, not on the Markdown source.

**Approach:** After `marked.parse(response)` produces HTML, run a second pass that wraps
artist name occurrences in anchor tags.

```javascript
function linkArtistNames(html, entities) {
  let result = html;
  for (const entity of entities) {
    if (entity.type !== 'artist') continue;
    // Escape special regex characters in artist name
    const escaped = entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match whole-word occurrences not already inside an anchor or tag
    const re = new RegExp(`(?<!<[^>]*)\\b(${escaped})\\b`, 'g');
    result = result.replace(re, `<a href="#" class="artist-link" data-artist="${entity.name}">$1</a>`);
  }
  return result;
}
```

Attach a delegated event listener to the results container:

```javascript
resultsContainer.addEventListener('click', (e) => {
  const link = e.target.closest('.artist-link');
  if (!link) return;
  e.preventDefault();
  const artistName = link.dataset.artist;
  launchExplore(artistName);
});

function launchExplore(artistName) {
  // Switch to Explore tab
  setActiveMode('explore');
  // Populate artist field
  document.getElementById('explore-artist').value = artistName;
  // Submit
  document.getElementById('generate-btn').click();
}
```

**UI considerations:**
- `.artist-link` should be styled to be visually distinct but not disruptive — consider
  a subtle underline or color variation that fits the existing dark theme
- The link should feel like a natural affordance, not a loud CTA
- No tooltip or hover state is required for this iteration, but `data-artist` is available
  for future enhancement

### Scroll behavior

When `launchExplore` fires, the page should scroll to the top of the form so the user sees
the new query being built. A smooth scroll to the mode selector is appropriate.

---

## Acceptance Criteria

- [ ] All three prompt templates include the artist tagging instruction
- [ ] LLM output for explore, bridge, and theme queries contains `[ARTIST]...[/ARTIST]`
      tags around artist names in prose (verify via logs)
- [ ] `parseEntitiesFromResponse` correctly extracts and deduplicates entity names
- [ ] `parseEntitiesFromResponse` correctly strips tags, leaving clean prose
- [ ] All three route handlers include `entities` array in API response
- [ ] `response` sent to client contains no `[ARTIST]` markup
- [ ] Raw LLM output in logs still contains tags (logging is pre-parse)
- [ ] Frontend renders artist names as clickable links in commentary
- [ ] Clicking an artist link switches to Explore mode, populates the artist field, and
      submits the form
- [ ] Artist links do not appear inside existing `<a>` tags or HTML attributes
- [ ] CLI behavior is entirely unchanged

---

## Out of Scope / Future Iterations

- **Bridge branch:** Clicking an artist in a bridge result could offer "Explore [Artist]"
  or "Bridge [Artist A] → [Artist]" — defer until entity linking UX is validated
- **Thematic concept tagging:** `[THEME]outsider perspective[/THEME]` tags linking to new
  Theme queries — same infrastructure, different tag type
- **History provenance:** Recording that a query was branched from another
- **External links:** Wikipedia, Spotify, band homepages — natural extension once the
  internal linking pattern is established

---

## Files Changed

| File | Change |
|------|--------|
| `prompts/explore.md` | Add artist tagging instruction to system section |
| `prompts/bridge.md` | Add artist tagging instruction to system section |
| `prompts/theme.md` | Add artist tagging instruction to system section |
| `src/llm/parseEntities.ts` | New module |
| `src/types.ts` | Add `EntityInfo` type |
| `src/server/routes/explore.ts` | Call `parseEntitiesFromResponse`, include `entities` in response |
| `src/server/routes/bridge.ts` | Same |
| `src/server/routes/theme.ts` | Same |
| `public/index.html` | `linkArtistNames` post-processor, delegated click handler, `launchExplore` function |
