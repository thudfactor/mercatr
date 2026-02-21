import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate, interpolate } from './templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const THEME_TRANSLATE_TEMPLATE_PATH = path.resolve(__dirname, '../../prompts/theme-translate.md');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export interface ThemeTranslateResult {
  originalTheme: string;
  translatedTags: string[];
  moodTerms: string[];
  genreHints: string[];
  reasoning: string;
}

export interface ThemeTranslateEntry {
  step: 'theme-translate';
  templatePath: string;
  input: { theme: string };
  output: ThemeTranslateResult;
  lastfmTagsQueried: string[];
  lastfmResultsReturned: number;
}

export async function runThemeTranslation(
  theme: string,
  model?: string
): Promise<{ result: ThemeTranslateResult }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');

  const template = loadTemplate(THEME_TRANSLATE_TEMPLATE_PATH);
  const userPrompt = interpolate(template.user, { theme });

  const anthropic = new Anthropic({ apiKey });
  const resolvedModel = model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const message = await anthropic.messages.create({
    model: resolvedModel,
    max_tokens: 512,
    system: template.system,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = message.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let result: ThemeTranslateResult;
  try {
    result = JSON.parse(jsonText) as ThemeTranslateResult;
  } catch {
    throw new Error(`Failed to parse theme-translate response: ${rawText}`);
  }

  return { result };
}
