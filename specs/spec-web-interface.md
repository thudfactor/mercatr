# Mercatr Web App — Implementation Spec

## Overview

Mercatr is an existing CLI tool (TypeScript/Node.js) that generates thematic music playlists using Last.fm folksonomy data and the Anthropic API. This spec covers adding a web interface to the existing codebase — an Express server and a single-page frontend — without breaking the existing CLI.

The result is an alpha web application for invited users only, deployed to Render as an always-on web service.

---

## Constraints and Principles

- **Preserve the CLI.** `src/cli.ts` and all existing modules are untouched. The server imports from the same modules the CLI uses.
- **No new account layer.** Access control is HTTP Basic Auth at the server level.
- **No streaming.** Responses arrive all at once. Latency is seconds, not minutes.
- **No model selection UI.** The model is configured via environment variable as it is today.
- **No prompt customization UI.**
- **Filesystem required.** The server must be a persistent process (not serverless) because Last.fm cache and LLM logs are written to disk.

---

## Repository Structure

Add the following to the existing repo. Do not move or rename existing files.

```
src/
  cli.ts              ← existing, untouched
  server/
    index.ts          ← Express app entry point
    auth.ts           ← Basic Auth middleware
    routes/
      explore.ts
      bridge.ts
      theme.ts
      xspf.ts         ← XSPF download endpoint
public/
  index.html          ← Single-page frontend (self-contained)
```

Add a new script to `package.json`:

```json
"scripts": {
  "cli": "tsx src/cli.ts",
  "serve": "tsx src/server/index.ts"
}
```

---

## Dependencies to Add

```bash
npm install express express-basic-auth
npm install --save-dev @types/express
```

---

## Environment Variables

All existing env vars continue to work unchanged. Add two new ones:

| Variable | Required | Description |
|---|---|---|
| `BASIC_AUTH_USER` | Yes (server only) | Username for HTTP Basic Auth |
| `BASIC_AUTH_PASSWORD` | Yes (server only) | Password for HTTP Basic Auth |
| `PORT` | No | Server port, defaults to `3000` |

---

## Server: `src/server/index.ts`

```typescript
import express from 'express';
import path from 'path';
import basicAuthMiddleware from './auth';
import exploreRouter from './routes/explore';
import bridgeRouter from './routes/bridge';
import themeRouter from './routes/theme';
import xspfRouter from './routes/xspf';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(basicAuthMiddleware);
app.use(express.static(path.join(__dirname, '../../public')));

app.use('/api/explore', exploreRouter);
app.use('/api/bridge', bridgeRouter);
app.use('/api/theme', themeRouter);
app.use('/api/xspf', xspfRouter);

app.listen(PORT, () => {
  console.log(`Mercatr server running on port ${PORT}`);
});
```

---

## Auth Middleware: `src/server/auth.ts`

Use the `express-basic-auth` package.

```typescript
import basicAuth from 'express-basic-auth';

const user = process.env.BASIC_AUTH_USER;
const password = process.env.BASIC_AUTH_PASSWORD;

if (!user || !password) {
  throw new Error('BASIC_AUTH_USER and BASIC_AUTH_PASSWORD must be set');
}

export default basicAuth({
  users: { [user]: password },
  challenge: true,   // sends WWW-Authenticate header, prompts browser dialog
});
```

---

## API Routes

All routes accept POST with a JSON body and return JSON. All routes should handle errors and return appropriate HTTP status codes with an `{ error: string }` body.

### Shared response shape

**Success:**

```json
{
  "response": "<LLM markdown string>",
  "resolvedArtist": "Sabrina Carpenter",   // only present if artist was auto-corrected
  "originalInput": "Samantha Carpenter"    // only present if artist was auto-corrected
}
```

**Error:**

```json
{
  "error": "Artist not found: Blorpus McFee. No close matches found.",
  "type": "artist_not_found" | "api_error" | "validation_error"
}
```

---

### `src/server/routes/explore.ts`

**POST /api/explore**

Request body:

```json
{
  "artist": "Elliott Smith",
  "track": "Between the Bars"   // optional
}
```

Implementation steps:

1. Validate that `artist` is present; return 400 if missing.
2. Instantiate `LastfmClient` with `{ noCache: false }`.
3. Call `checkArtistConfidence(artist, client)`.
   - If result is `low` confidence: return 404 with `type: "artist_not_found"` and the explanation from the confidence result.
   - If result is `medium` or `high` confidence: use the resolved canonical name from the result. If the resolved name differs from the input, include `resolvedArtist` and `originalInput` in the response.
4. Build a `Query` of type `explore` using the resolved artist name and optional track.
5. Call `buildContext(client, query)`.
6. Call `runQuery(context, { expand: false })`.
7. Return the `HarnessResult.response` string as `response` in the JSON body.

---

### `src/server/routes/bridge.ts`

**POST /api/bridge**

Request body:

```json
{
  "from": "Nick Drake",
  "to": "Frank Ocean"
}
```

Implementation steps:

1. Validate that both `from` and `to` are present; return 400 if either is missing.
2. Instantiate `LastfmClient`.
3. Run `checkArtistConfidence` on both artists in parallel (`Promise.all`).
   - If either is low confidence: return 404 with a message identifying which artist failed.
   - Apply auto-accept for any medium-confidence resolution; track corrections for both.
4. Build a `Query` of type `bridge` with resolved names.
5. Call `buildContext` then `runQuery`.
6. Return response. If either artist name was auto-corrected, include both `resolvedArtist` and `originalInput` as arrays (one entry per artist, in `[from, to]` order). Only include the arrays if at least one correction occurred.

---

### `src/server/routes/theme.ts`

**POST /api/theme**

Request body:

```json
{
  "theme": "loneliness in crowded places",
  "seedArtist": "Carly Rae Jepsen"   // optional
}
```

Implementation steps:

1. Validate that `theme` is present; return 400 if missing.
2. Instantiate `LastfmClient`.
3. If `seedArtist` is provided, run `checkArtistConfidence`. Apply same low/medium confidence logic as explore route.
4. Run `runThemeTranslation(theme, ...)` to get folksonomy tags (this is the existing preflight step).
5. Build a `Query` of type `theme` with the theme string, translated tags, and resolved seed artist if provided.
6. Call `buildContext` then `runQuery`.
7. Return response.

---

### `src/server/routes/xspf.ts`

**POST /api/xspf**

This route takes the LLM response text, extracts a track list, builds XSPF, and returns the file as a download.

Request body:

```json
{
  "response": "<full LLM response markdown string>",
  "title": "Exploring Elliott Smith"
}
```

Implementation steps:

1. Validate that `response` and `title` are present.
2. Call `extractTracks(response)` — this uses the haiku model to pull structured track data from the LLM output.
3. Call `buildXspf(tracks, title)` — returns an XSPF XML string.
4. Set response headers:

   ```
   Content-Type: application/xspf+xml
   Content-Disposition: attachment; filename="playlist.xspf"
   ```

5. Send the XSPF string as the response body.

Note: Do not call `writeXspf` — that's for filesystem writes in the CLI. Use `buildXspf` and send the result directly.

---

## Frontend: `public/index.html`

A single self-contained HTML file. No build step, no bundler. Vanilla JS with `fetch`. Styles are inline or in a `<style>` block.

### Layout

Three-panel or tabbed interface for the three modes: **Explore**, **Bridge**, **Theme**. One mode is active at a time. Below the mode selector is a form whose fields change based on the selected mode. Below the form is a results area.

### Mode: Explore

Fields:

- Artist (text input, required)
- Track (text input, optional) — label: "Specific track (optional)"

### Mode: Bridge

Fields:

- From (text input, required) — label: "Starting artist"
- To (text input, required) — label: "Destination artist"

### Mode: Theme

Fields:

- Theme (text input, required) — label: "Theme or mood"
- Seed artist (text input, optional) — label: "Seed artist (optional)"

### Shared UI behaviors

**Submit button:** Labeled "Generate". Disabled and shows a spinner or loading text while a request is in flight.

**Results area:** Renders the LLM response as Markdown. Use a lightweight client-side Markdown renderer — [marked.js](https://cdn.jsdelivr.net/npm/marked/marked.min.js) is available on cdnjs and is appropriate here.

**Export button:** Appears in the results area after a successful response. Labeled "Download XSPF". On click, it POSTs to `/api/xspf` with the current response text and an auto-generated title, then triggers a file download using a blob URL.

**Auto-correction notice:** If the API response includes `resolvedArtist`, show an inline notice in the results area (not a dialog): e.g., _"Note: 'Samantha Carpenter' was interpreted as 'Sabrina Carpenter'."_

### Error handling with `<dialog>`

Use the native HTML `<dialog>` element for error display.

- **Artist not found (404, `type: "artist_not_found"`):** Dialog with the error message from the API and a single "OK" button to dismiss.
- **API errors (500):** Dialog with a generic message: "Something went wrong. Please try again."
- **Validation errors:** Inline form validation (HTML5 `required` attribute is sufficient for the alpha).

Pattern:

```html
<dialog id="error-dialog">
  <p id="error-message"></p>
  <button id="error-close">OK</button>
</dialog>
```

```javascript
function showError(message) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-dialog').showModal();
}
document.getElementById('error-close').addEventListener('click', () => {
  document.getElementById('error-dialog').close();
});
```

---

## Deployment: Railway

### Setup steps

1. Push the repo to GitHub.
2. Create a new project on [Railway](https://railway.app), connected to the GitHub repo.
3. Railway will auto-detect Node.js. Set the following in the Railway dashboard under **Variables**:
   - `LASTFM_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `BASIC_AUTH_USER`
   - `BASIC_AUTH_PASSWORD`
4. Under **Settings → Deploy**, set:
   - **Build command:** `npm install`
   - **Start command:** `npm run serve`
5. Railway exposes a `PORT` environment variable automatically — the server already reads `process.env.PORT` so no changes needed.

### Filesystem note

Railway's filesystem is ephemeral — cache and logs written to disk will be lost on each deploy or restart. This is acceptable for the alpha. If cache persistence becomes important, revisit by adding a Redis cache layer or a Railway Volume (their persistent disk offering).

### `.gitignore` additions

Ensure the following are ignored:

```
.env
.cache/
logs/
```

---

## Acceptance Criteria

- [ ] `npm run cli explore --artist "Elliott Smith"` still works exactly as before.
- [ ] `npm run serve` starts the server on the configured port.
- [ ] Unauthenticated requests to any route return 401.
- [ ] POST to `/api/explore` with a valid artist returns a JSON response with a `response` string.
- [ ] POST to `/api/explore` with an unknown artist returns a 404 with `type: "artist_not_found"`.
- [ ] POST to `/api/explore` with an auto-corrected artist returns `resolvedArtist` and `originalInput` in the response.
- [ ] POST to `/api/bridge` and `/api/theme` return equivalent correct behavior.
- [ ] POST to `/api/xspf` returns an XSPF file download.
- [ ] The frontend loads at `/`, shows three modes, submits to the correct endpoint, and renders the response as Markdown.
- [ ] The XSPF download button appears after a successful response and triggers a file download.
- [ ] Errors are displayed via `<dialog>`.
- [ ] Auto-correction notices are displayed inline, not as errors.

---

## Out of Scope for This Iteration

- User accounts or authentication beyond HTTP Basic Auth
- Model selection UI
- Prompt customization UI
- Result history or persistence
- Rate limiting per user
- Streaming responses
- Cache persistence across deploys
- The `--expand` genre diversity flag (can be added later as a UI checkbox)
