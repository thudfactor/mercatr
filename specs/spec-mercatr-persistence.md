# Feature Spec: Session Persistence via LocalStorage
**Project:** Mercatr  
**Scope:** Web interface only  
**Version:** 1.0  
**Status:** Draft

---

## Overview

Mercatr currently generates playlists and LLM commentary ephemerally — navigating away or switching modes discards all output. This feature introduces a session history that persists across page loads using the browser's LocalStorage API, with no user accounts required.

A **session** is defined as a single mode run: one set of inputs, one playlist, one commentary. Sessions are immutable once created. The history is surfaced via a side drawer and auto-named by mode, input, and date.

---

## Goals

- Preserve the playlist and commentary from any completed mode run
- Allow users to browse and re-read past sessions without re-running the LLM
- Impose no authentication burden
- Degrade gracefully when LocalStorage is unavailable or full

## Non-Goals (this spec)

- Re-running or forking past sessions
- User-defined session naming or annotation
- Cross-device or cloud sync
- Exporting session history (beyond the existing single-playlist download)

---

## Data Model

### Session Object

Each session is stored as a serialized JSON object:

```typescript
interface MercatrSession {
  id: string;              // UUID v4, generated at save time
  mode: 'artist' | 'theme' | 'transition';
  inputs: SessionInputs;   // discriminated union by mode (see below)
  playlist: Track[];       // ordered array of track objects
  commentary: string;      // raw LLM output, stored as-is
  createdAt: string;       // ISO 8601 timestamp
  displayName: string;     // pre-computed at save time (see Naming)
}

// Discriminated union for inputs
type SessionInputs =
  | { mode: 'artist';     artist: string }
  | { mode: 'theme';      theme: string }
  | { mode: 'transition'; artistFrom: string; artistTo: string };

interface Track {
  title: string;
  artist: string;
  album?: string;
  year?: number;
}
```

### LocalStorage Schema

All Mercatr data lives under a single namespaced key to avoid collisions with other scripts sharing the origin:

```
mercatr:sessions  →  JSON.stringify(MercatrSession[])
```

The value is an array of session objects, ordered newest-first. A single top-level key (rather than one key per session) is simpler to manage and keeps reads/writes atomic. Given expected usage patterns, the array should not grow large enough to make this a performance concern.

### Storage Budget

LocalStorage is capped at ~5MB per origin (browser-dependent). Commentary is the largest variable — estimate ~2–4KB per session including playlist metadata. This gives a practical ceiling of roughly **500–1,000 sessions** before space pressure.

**Retention policy:** Cap the stored array at **50 sessions**. When a new session would push the count above 50, drop the oldest entry before saving. Implement this as a pure function so it's testable in isolation:

```typescript
function enforceRetentionLimit(sessions: MercatrSession[], limit = 50): MercatrSession[] {
  return sessions.slice(0, limit);
}
```

A storage quota error (`QuotaExceededError`) should be caught explicitly and surfaced as a user-visible warning rather than a silent failure (see Error Handling).

---

## Session Naming

Display names are computed once at save time and stored on the session object. They are never recomputed. Format:

| Mode | Format | Example |
|------|--------|---------|
| Artist | `Artist: {artist} — {Mon DD}` | `Artist: Radiohead — Feb 21` |
| Theme | `Theme: {theme} — {Mon DD}` | `Theme: Road Trip — Feb 21` |
| Transition | `{artistFrom} → {artistTo} — {Mon DD}` | `Talking Heads → Wilco — Feb 21` |

Input strings should be title-cased on display if not already. Date uses the user's local timezone. Year is omitted from the short date format but is stored in `createdAt` for full fidelity.

---

## UI Affordances

### 1. Save Trigger

Sessions are saved **automatically** when a mode run completes successfully — i.e., when the playlist and commentary have both been received and rendered. No explicit "save" button is required.

A brief, non-blocking **toast notification** confirms the save: *"Session saved to history."* This should appear for ~3 seconds and not interrupt the user's reading of the output.

### 2. History Drawer

A **History** button in the main navigation/header opens a side drawer. The drawer:

- Slides in from the right (or left — follow existing UI conventions)
- Does not navigate away from the current view
- Renders a chronological list of saved sessions, newest first
- Each item shows the session's `displayName` only; no further metadata visible in the list
- Remains open until explicitly closed (click outside, press Escape, or close button)

The history button should display a **count badge** showing the number of saved sessions (e.g., `History (12)`). If there are no sessions yet, the button is present but the drawer shows an empty state message: *"No sessions saved yet. Complete a mode run to save your first session."*

### 3. Session Detail View

Clicking a session in the drawer replaces the drawer's list with the **session detail view**, showing:

- The `displayName` as a heading
- Mode and inputs displayed as read-only metadata (e.g., *"Artist exploration · Radiohead"*)
- The full playlist, rendered identically to the primary output view
- The full commentary, rendered identically to the primary output view
- A **Back** button returning to the session list
- A **Download** button (same behavior as the existing playlist download affordance)

The detail view does not include any "re-run" or "edit" affordance.

### 4. Storage Management

In a **Settings** area (new or existing), expose:

- A count of saved sessions and an estimate of storage used (e.g., *"12 sessions · ~48KB used"*)
- A **Clear History** button with a confirmation dialog before execution

No per-session delete is required in v1, though it is a natural v2 addition.

---

## Storage Service

Isolate all LocalStorage reads and writes behind a single module. This decouples the rest of the app from the storage mechanism and makes the quota/availability logic testable.

```typescript
// storageService.ts

const STORAGE_KEY = 'mercatr:sessions';
const SESSION_LIMIT = 50;

export function loadSessions(): MercatrSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // parse failure or unavailability — return empty, don't throw
  }
}

export function saveSession(session: MercatrSession): { success: boolean; error?: string } {
  try {
    const existing = loadSessions();
    const updated = enforceRetentionLimit([session, ...existing], SESSION_LIMIT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      return { success: false, error: 'storage_full' };
    }
    return { success: false, error: 'unknown' };
  }
}

export function clearSessions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function estimateStorageUsed(): number {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  return new Blob([raw]).size; // bytes
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| LocalStorage unavailable (private browsing, permissions) | Session runs normally; no save attempted; no toast; history button hidden or disabled with tooltip: *"History unavailable in this browser context."* |
| `QuotaExceededError` on save | Toast: *"Couldn't save session — storage full. Clear your history in Settings to free space."* |
| Corrupted data on load (`JSON.parse` failure) | Return empty array; do not crash; optionally log to console |
| Session count at limit (50) | Oldest session silently dropped before new one is saved; no user notification needed |

LocalStorage availability should be checked once on app init using a try/catch write test, not by checking `window.localStorage !== undefined` (which can still throw in some contexts).

---

## Acceptance Criteria

### Saving
- [ ] When a mode run completes, a session object is created and written to LocalStorage within 500ms of the output rendering
- [ ] The session contains the correct mode, inputs, playlist, commentary, timestamp, and display name
- [ ] A toast notification appears and disappears after ~3 seconds
- [ ] Saving a 51st session drops the oldest, keeping the array at 50

### History Drawer
- [ ] The History button is visible in the header at all times
- [ ] The count badge reflects the actual number of stored sessions
- [ ] The drawer opens without navigating away from the current output
- [ ] Sessions are listed newest-first
- [ ] An empty state message appears when no sessions exist
- [ ] The drawer closes on Escape or outside click

### Session Detail
- [ ] Clicking a session item opens the detail view within the drawer
- [ ] The playlist and commentary render identically to the primary output view
- [ ] The Download button functions identically to the primary download affordance
- [ ] The Back button returns to the session list without losing list position

### Storage Management
- [ ] Settings surface shows session count and estimated storage size
- [ ] Clear History removes all sessions from LocalStorage and resets the count badge
- [ ] Clear History requires confirmation before executing

### Error Handling
- [ ] In a private browsing context where LocalStorage is blocked, the History button is hidden or disabled with an explanatory tooltip
- [ ] A `QuotaExceededError` surfaces as a user-visible toast, not a console error
- [ ] A corrupted LocalStorage value does not crash the app

---

## Open Questions for v2

- **Per-session delete:** Straightforward addition once the drawer UI exists.
- **User-defined names:** Would require an inline edit affordance on the detail view.
- **Export/import:** Serializing the full `mercatr:sessions` array as JSON would enable manual backup without cloud infrastructure.
- **Session search/filter:** Relevant once history grows; filter by mode is the obvious first cut.
