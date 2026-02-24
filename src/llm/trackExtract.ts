import path from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate, interpolate } from './templates.js';
import { generateText } from './provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TRACK_EXTRACT_TEMPLATE_PATH = path.resolve(__dirname, '../../prompts/track-extract.md');

export interface TrackInfo {
  artist: string;
  track: string;
  album: string;
  year: string;
}

export async function extractTracks(
  responseText: string,
  model?: string
): Promise<TrackInfo[]> {
  const template = loadTemplate(TRACK_EXTRACT_TEMPLATE_PATH);
  const userPrompt = interpolate(template.user, { response: responseText });

  const completion = await generateText({
    model,
    usage: 'track-extract',
    maxTokens: 1024,
    systemPrompt: template.system,
    userPrompt,
  });

  const rawText = completion.text;

  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let tracks: TrackInfo[];
  try {
    tracks = JSON.parse(jsonText) as TrackInfo[];
  } catch {
    throw new Error(`Failed to parse track-extract response: ${rawText}`);
  }

  if (!Array.isArray(tracks)) {
    throw new Error(`track-extract response is not an array: ${rawText}`);
  }

  return tracks;
}
