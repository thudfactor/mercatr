import Anthropic from '@anthropic-ai/sdk';

export type LlmProvider = 'claude' | 'openai-compat';
export type LlmUsage = 'main' | 'track-extract';

const DEFAULT_PROVIDER: LlmProvider = 'claude';
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_CLAUDE_TRACK_EXTRACT_MODEL = 'claude-haiku-4-5-20251001';

export interface GenerateTextOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  model?: string;
  usage?: LlmUsage;
}

export interface GenerateTextResult {
  provider: LlmProvider;
  model: string;
  text: string;
}

function normalizeProvider(rawProvider: string | undefined): LlmProvider {
  const value = rawProvider?.trim().toLowerCase();
  if (!value || value === 'claude' || value === 'anthropic') return 'claude';
  if (value === 'openai-compat' || value === 'openai-compatible' || value === 'openai') {
    return 'openai-compat';
  }
  throw new Error(
    `Unsupported LLM_PROVIDER "${rawProvider}". Expected "claude" or "openai-compat".`
  );
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

function resolveModel(provider: LlmProvider, usage: LlmUsage, requestedModel?: string): string {
  if (requestedModel) return requestedModel;

  if (provider === 'claude') {
    if (usage === 'track-extract') {
      return (
        process.env.ANTHROPIC_TRACK_EXTRACT_MODEL ??
        process.env.ANTHROPIC_MODEL ??
        DEFAULT_CLAUDE_TRACK_EXTRACT_MODEL
      );
    }
    return process.env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL;
  }

  if (usage === 'track-extract') {
    const trackExtractModel = process.env.OPENAI_COMPAT_TRACK_EXTRACT_MODEL;
    if (trackExtractModel) return trackExtractModel;
  }

  const openAiCompatModel = process.env.OPENAI_COMPAT_MODEL;
  if (!openAiCompatModel) {
    throw new Error(
      'OPENAI_COMPAT_MODEL environment variable is not set. ' +
      'Set OPENAI_COMPAT_MODEL or pass --model.'
    );
  }

  return openAiCompatModel;
}

function extractAnthropicText(message: unknown): string {
  if (!message || typeof message !== 'object') {
    throw new Error('Anthropic response is invalid');
  }

  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error('Anthropic response did not include content blocks');
  }

  return content
    .filter((block): block is { type: string; text?: string } =>
      Boolean(block) && typeof block === 'object' && 'type' in block
    )
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('\n');
}

function extractOpenAiCompatText(responseBody: unknown): string {
  if (!responseBody || typeof responseBody !== 'object') {
    throw new Error('OpenAI-compatible response is not an object');
  }

  const choices = (responseBody as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('OpenAI-compatible response did not include choices');
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    throw new Error('OpenAI-compatible response choice is invalid');
  }

  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== 'object') {
    throw new Error('OpenAI-compatible response did not include message content');
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map(part => {
        if (!part || typeof part !== 'object') return '';
        const typedPart = part as { text?: unknown };
        return typeof typedPart.text === 'string' ? typedPart.text : '';
      })
      .join('');
    if (text.length > 0) return text;
  }

  throw new Error('OpenAI-compatible response did not include text content');
}

async function runClaudeCompletion(options: GenerateTextOptions, model: string): Promise<string> {
  const apiKey = readRequiredEnv('ANTHROPIC_API_KEY');
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model,
    max_tokens: options.maxTokens,
    system: options.systemPrompt,
    messages: [{ role: 'user', content: options.userPrompt }],
  });
  return extractAnthropicText(message);
}

async function runOpenAiCompatCompletion(options: GenerateTextOptions, model: string): Promise<string> {
  const apiKey = readRequiredEnv('OPENAI_COMPAT_API_KEY');
  const baseUrl = readRequiredEnv('OPENAI_COMPAT_BASE_URL').replace(/\/+$/, '');
  const endpoint = `${baseUrl}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(
      `OpenAI-compatible API request failed (${response.status} ${response.statusText}): ${rawBody}`
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new Error(`OpenAI-compatible API returned invalid JSON: ${rawBody}`);
  }

  return extractOpenAiCompatText(parsedBody);
}

export function resolveLlmSettings(options: { model?: string; usage?: LlmUsage } = {}): {
  provider: LlmProvider;
  model: string;
} {
  const provider = normalizeProvider(process.env.LLM_PROVIDER ?? DEFAULT_PROVIDER);
  const usage = options.usage ?? 'main';
  const model = resolveModel(provider, usage, options.model);
  return { provider, model };
}

export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const settings = resolveLlmSettings({ model: options.model, usage: options.usage });
  const text = settings.provider === 'claude'
    ? await runClaudeCompletion(options, settings.model)
    : await runOpenAiCompatCompletion(options, settings.model);

  return {
    provider: settings.provider,
    model: settings.model,
    text,
  };
}
