import type { APIRoute } from 'astro';
import { LastfmClient } from '../../lastfm/client.js';
import { checkArtistConfidence } from '../../llm/artistConfidence.js';
import { buildContext } from '../../context/builder.js';
import { runQuery } from '../../llm/harness.js';
import { parseTracksFromResponse } from '../../llm/parseTracksFromResponse.js';
import { resolveProcessingModel } from '../../llm/provider.js';
import { validateStringField, validateOptionalStringField } from '../../lib/validate.js';

export const POST: APIRoute = async ({ request }) => {
  const { from, to, fromSong, toSong, voice } = await request.json() as {
    from?: string;
    to?: string;
    fromSong?: string;
    toSong?: string;
    voice?: string;
  };

  const fromErr = validateStringField(from, 'from');
  if (fromErr) return Response.json({ error: fromErr.error }, { status: fromErr.status });

  const toErr = validateStringField(to, 'to');
  if (toErr) return Response.json({ error: toErr.error }, { status: toErr.status });

  const fromSongErr = validateOptionalStringField(fromSong, 'fromSong');
  if (fromSongErr) return Response.json({ error: fromSongErr.error }, { status: fromSongErr.status });

  const toSongErr = validateOptionalStringField(toSong, 'toSong');
  if (toSongErr) return Response.json({ error: toSongErr.error }, { status: toSongErr.status });

  try {
    const client = new LastfmClient({ noCache: false });
    const processingModel = resolveProcessingModel();
    const [fromCheck, toCheck] = await Promise.all([
      checkArtistConfidence(from!, client, processingModel),
      checkArtistConfidence(to!, client, processingModel),
    ]);

    if (fromCheck.result.confidence === 'low') {
      return Response.json(
        { error: fromCheck.result.reasoning, type: 'artist_not_found', artist: from },
        { status: 404 },
      );
    }
    if (toCheck.result.confidence === 'low') {
      return Response.json(
        { error: toCheck.result.reasoning, type: 'artist_not_found', artist: to },
        { status: 404 },
      );
    }

    const resolvedFrom = fromCheck.result.resolvedName ?? from!;
    const resolvedTo = toCheck.result.resolvedName ?? to!;

    const query = {
      type: 'bridge' as const,
      fromArtist: resolvedFrom,
      toArtist: resolvedTo,
      ...(fromSong?.trim() ? { fromSong: fromSong.trim() } : {}),
      ...(toSong?.trim()   ? { toSong: toSong.trim() }     : {}),
    };
    const context = await buildContext(client, query);
    const { response: raw } = await runQuery(context, { expand: false, voice });
    const { narrative, tracks, warning } = parseTracksFromResponse(raw);
    if (warning) process.stderr.write(`[bridge] ${warning}\n`);

    const fromCorrected = resolvedFrom.toLowerCase() !== from!.toLowerCase();
    const toCorrected = resolvedTo.toLowerCase() !== to!.toLowerCase();

    return Response.json({
      response: narrative,
      tracks,
      ...((fromCorrected || toCorrected) ? {
        resolvedArtist: [resolvedFrom, resolvedTo],
        originalInput: [from, to],
      } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
};
