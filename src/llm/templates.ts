import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(__dirname, '../../prompts');

export interface ParsedTemplate {
  system: string;
  user: string;
  diversityBaseline: string;
  diversityExpand: string;
}

export function loadTemplate(templatePath: string): ParsedTemplate {
  const raw = fs.readFileSync(templatePath, 'utf-8');
  const systemMatch = raw.match(/---system---\n([\s\S]*?)(?=---user---|$)/);
  const userMatch = raw.match(/---user---\n([\s\S]*?)(?=---diversity-baseline---|$)/);
  const baselineMatch = raw.match(/---diversity-baseline---\n([\s\S]*?)(?=---diversity-expand---|$)/);
  const expandMatch = raw.match(/---diversity-expand---\n([\s\S]*?)$/);

  if (!systemMatch || !userMatch) {
    throw new Error(
      `Template at ${templatePath} is missing ---system--- or ---user--- sections`
    );
  }

  return {
    system: systemMatch[1].trim(),
    user: userMatch[1].trim(),
    diversityBaseline: baselineMatch ? baselineMatch[1].trim() : '',
    diversityExpand: expandMatch ? expandMatch[1].trim() : '',
  };
}

export function defaultTemplatePath(queryType: string): string {
  return path.join(PROMPTS_DIR, `${queryType}.md`);
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in vars) return vars[key];
    return `{{${key}}}`;
  });
}
