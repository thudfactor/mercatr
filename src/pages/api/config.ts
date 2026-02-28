import type { APIRoute } from 'astro';
import { resolveLlmSettings, resolveProcessingModel } from '../../llm/provider.js';

export const GET: APIRoute = () => {
  const { provider, model } = resolveLlmSettings();
  const processingModel = resolveProcessingModel();
  return Response.json({ provider, model, processingModel });
};
