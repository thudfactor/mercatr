import fs from 'fs';
import path from 'path';
import type { TrackInfo } from '../llm/trackExtract.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface XspfOptions {
  title?: string;
  description?: string;
}

export function buildXspf(tracks: TrackInfo[], options: XspfOptions = {}): string {
  const trackEntries = tracks.map(t =>
    `    <track>\n      <creator>${escapeXml(t.artist)}</creator>\n      <title>${escapeXml(t.track)}</title>\n    </track>`
  ).join('\n');

  const meta = [
    options.title ? `  <title>${escapeXml(options.title)}</title>` : '',
    options.description ? `  <annotation>${escapeXml(options.description)}</annotation>` : '',
  ].filter(Boolean).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<playlist version="1" xmlns="http://xspf.org/ns/0/">
${meta ? meta + '\n' : ''}  <trackList>
${trackEntries}
  </trackList>
</playlist>
`;
}

export function writeXspf(tracks: TrackInfo[], outputPath: string, options: XspfOptions = {}): void {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buildXspf(tracks, options));
}
