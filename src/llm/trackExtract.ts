import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate, interpolate } from './templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TRACK_EXTRACT_TEMPLATE_PATH = path.resolve(__dirname, '../../prompts/track-extract.md');

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');

  const template = loadTemplate(TRACK_EXTRACT_TEMPLATE_PATH);
  const userPrompt = interpolate(template.user, { response: responseText });

  const anthropic = new Anthropic({ apiKey });
  const resolvedModel = model ?? DEFAULT_MODEL;

  const message = await anthropic.messages.create({
    model: resolvedModel,
    max_tokens: 1024,
    system: template.system,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = message.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

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
