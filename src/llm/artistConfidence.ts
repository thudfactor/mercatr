import path from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate, interpolate } from './templates.js';
import { generateText } from './provider.js';
import type { LastfmClient } from '../lastfm/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIDENCE_TEMPLATE_PATH = path.resolve(__dirname, '../../prompts/artist-confidence.md');

export interface ConfidenceResult {
  confidence: 'high' | 'medium' | 'low';
  resolvedName: string | null;
  alternativeSuggestions: string[];
  reasoning: string;
  proceed: boolean;
}

export interface PreflightEntry {
  step: 'artist-confidence';
  templatePath: string;
  input: { artistName: string; lastfmDataPresent: boolean };
  output: ConfidenceResult;
  userConfirmed?: boolean;
  resolvedTo?: string;
}

export async function checkArtistConfidence(
  artistName: string,
  client: LastfmClient,
  model?: string
): Promise<{ result: ConfidenceResult; lastfmDataPresent: boolean }> {
  let lastfmData = '';
  let lastfmDataPresent = false;

  try {
    const info = await client.getArtistInfo(artistName);
    lastfmDataPresent = true;
    lastfmData = JSON.stringify({
      name: info.name,
      listeners: info.stats.listeners,
      playcount: info.stats.playcount,
      tags: info.tags.slice(0, 5).map(t => t.name),
      bioSummary: info.bio.summary.slice(0, 300),
    }, null, 2);
  } catch {
    lastfmDataPresent = false;
    lastfmData = 'No artist data returned from Last.fm.';
  }

  const noDataMessage = lastfmDataPresent
    ? ''
    : 'No artist data was returned from Last.fm for this name.';

  const template = loadTemplate(CONFIDENCE_TEMPLATE_PATH);
  const userPrompt = interpolate(template.user, {
    artistName,
    lastfmData,
    noDataMessage,
  });

  const completion = await generateText({
    model,
    usage: 'main',
    maxTokens: 512,
    systemPrompt: template.system,
    userPrompt,
  });

  const rawText = completion.text;

  // Strip markdown code fences if present
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let result: ConfidenceResult;
  try {
    result = JSON.parse(jsonText) as ConfidenceResult;
  } catch {
    throw new Error(`Failed to parse artist confidence response: ${rawText}`);
  }

  return { result, lastfmDataPresent };
}

export { CONFIDENCE_TEMPLATE_PATH };
