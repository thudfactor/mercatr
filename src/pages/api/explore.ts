import type { APIRoute } from 'astro';
import { LastfmClient } from '../../lastfm/client.js';
import { checkArtistConfidence } from '../../llm/artistConfidence.js';
import { buildContext } from '../../context/builder.js';
import { runQuery } from '../../llm/harness.js';
import { parseTracksFromResponse } from '../../llm/parseTracksFromResponse.js';
import { resolveProcessingModel } from '../../llm/provider.js';
import { validateStringField, validateOptionalStringField } from '../../lib/validate.js';

export const POST: APIRoute = async ({ request }) => {
  const { artist, track, voice } = await request.json() as {
    artist?: string;
    track?: string;
    voice?: string;
  };

  const artistErr = validateStringField(artist, 'artist');
  if (artistErr) return Response.json({ error: artistErr.error }, { status: artistErr.status });

  const trackErr = validateOptionalStringField(track, 'track');
  if (trackErr) return Response.json({ error: trackErr.error }, { status: trackErr.status });

  try {
    const client = new LastfmClient({ noCache: false });
    const processingModel = resolveProcessingModel();
    const { result } = await checkArtistConfidence(artist!, client, processingModel);

    if (result.confidence === 'low') {
      return Response.json(
        { error: result.reasoning, type: 'artist_not_found' },
        { status: 404 },
      );
    }

    const resolvedName = result.resolvedName ?? artist!;
    const query = { type: 'explore' as const, artist: resolvedName, ...(track ? { track } : {}) };
    const context = await buildContext(client, query);
    const { response: raw } = await runQuery(context, { expand: false, voice });
    const { narrative, tracks, warning } = parseTracksFromResponse(raw);
    if (warning) process.stderr.write(`[explore] ${warning}\n`);

    const corrected = resolvedName.toLowerCase() !== artist!.toLowerCase();
    return Response.json({
      response: narrative,
      tracks,
      ...(corrected ? { resolvedArtist: resolvedName, originalInput: artist } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
};
