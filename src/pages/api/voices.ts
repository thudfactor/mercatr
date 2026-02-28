import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

const manifestPath = path.resolve(process.cwd(), 'prompts/voices/manifest.json');

export const GET: APIRoute = () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  return Response.json(manifest);
};
