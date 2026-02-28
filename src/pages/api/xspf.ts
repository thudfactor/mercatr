import type { APIRoute } from 'astro';
import type { TrackInfo } from '../../llm/trackExtract.js';
import { buildXspf } from '../../export/xspf.js';

export const POST: APIRoute = async ({ request }) => {
  const { tracks, title } = await request.json() as {
    tracks?: TrackInfo[];
    title?: string;
  };

  if (!Array.isArray(tracks) || tracks.length === 0) {
    return Response.json({ error: 'tracks must be a non-empty array' }, { status: 400 });
  }

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const xml = buildXspf(tracks, { title });

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xspf+xml',
      'Content-Disposition': 'attachment; filename="playlist.xspf"',
    },
  });
};
