import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '../../.cache/lastfm');

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

function getTtlMs(): number {
  const hours = parseFloat(process.env.LASTFM_CACHE_TTL_HOURS ?? '24');
  return hours * 60 * 60 * 1000;
}

function cacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const slug = `${endpoint}__${sorted}`
    .toLowerCase()
    .replace(/[^a-z0-9_=&.-]/g, '_')
    .slice(0, 120);
  const hash = crypto.createHash('md5').update(`${endpoint}:${sorted}`).digest('hex').slice(0, 8);
  return `${slug}__${hash}.json`;
}

export function readCache<T>(endpoint: string, params: Record<string, string>): T | null {
  const file = path.join(CACHE_DIR, cacheKey(endpoint, params));
  if (!fs.existsSync(file)) return null;

  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > getTtlMs()) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(endpoint: string, params: Record<string, string>, data: T): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, cacheKey(endpoint, params));
  const entry: CacheEntry<T> = { timestamp: Date.now(), data };
  fs.writeFileSync(file, JSON.stringify(entry, null, 2));
}
