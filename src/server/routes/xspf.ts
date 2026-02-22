import { Router } from 'express';
import type { TrackInfo } from '../../llm/trackExtract.js';
import { buildXspf } from '../../export/xspf.js';

const router = Router();

router.post('/', (req, res) => {
  const { tracks, title } = req.body as { tracks?: TrackInfo[]; title?: string };

  if (!Array.isArray(tracks) || tracks.length === 0) {
    res.status(400).json({ error: 'tracks must be a non-empty array' });
    return;
  }

  if (!title || typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const xml = buildXspf(tracks, { title });

  res.setHeader('Content-Type', 'application/xspf+xml');
  res.setHeader('Content-Disposition', 'attachment; filename="playlist.xspf"');
  res.send(xml);
});

export default router;
