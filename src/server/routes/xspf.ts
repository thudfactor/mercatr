import { Router } from 'express';
import { extractTracks } from '../../llm/trackExtract.js';
import { buildXspf } from '../../export/xspf.js';

const router = Router();

router.post('/', async (req, res) => {
  const { response, title } = req.body as { response?: string; title?: string };

  if (!response || !title) {
    res.status(400).json({ error: 'response and title are required' });
    return;
  }

  try {
    const tracks = await extractTracks(response);
    const xml = buildXspf(tracks, { title });

    res.setHeader('Content-Type', 'application/xspf+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="playlist.xspf"');
    res.send(xml);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
