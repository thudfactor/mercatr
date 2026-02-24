import type { TrackInfo } from './trackExtract.js';

export interface ParsedResponse {
  narrative: string;
  tracks: TrackInfo[] | null;
  warning?: string;
}

export function parseTracksFromResponse(raw: string): ParsedResponse {
  const DELIMITER = '\n---TRACKS---\n';
  const idx = raw.indexOf(DELIMITER);

  if (idx === -1) {
    return { narrative: raw, tracks: null, warning: 'No ---TRACKS--- delimiter found in LLM response' };
  }

  const narrative = raw.slice(0, idx).trimEnd();
  const jsonPart = raw.slice(idx + DELIMITER.length).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPart);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { narrative, tracks: null, warning: `Failed to parse track JSON: ${message}` };
  }

  if (!Array.isArray(parsed)) {
    return { narrative, tracks: null, warning: 'Track JSON is not an array' };
  }

  if (parsed.length === 0) {
    return { narrative, tracks: [], warning: 'Track list parsed but was empty' };
  }

  return { narrative, tracks: parsed as TrackInfo[] };
}
