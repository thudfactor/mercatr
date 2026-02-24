import path from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate, interpolate } from './templates.js';
import { generateText } from './provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const THEME_TRANSLATE_TEMPLATE_PATH = path.resolve(__dirname, '../../prompts/theme-translate.md');

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
  const template = loadTemplate(THEME_TRANSLATE_TEMPLATE_PATH);
  const userPrompt = interpolate(template.user, { theme });

  const completion = await generateText({
    model,
    usage: 'main',
    maxTokens: 512,
    systemPrompt: template.system,
    userPrompt,
  });

  const rawText = completion.text;

  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let result: ThemeTranslateResult;
  try {
    result = JSON.parse(jsonText) as ThemeTranslateResult;
  } catch {
    throw new Error(`Failed to parse theme-translate response: ${rawText}`);
  }

  return { result };
}
