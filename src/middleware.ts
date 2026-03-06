import { defineMiddleware } from 'astro:middleware';
import { webcrypto } from 'node:crypto';

// --- Rate limiting ---
const RATE_LIMIT_ROUTES = ['/api/explore', '/api/bridge', '/api/theme'];
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 5;
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return timestamps.length > RATE_MAX_REQUESTS;
}

// --- Security tokens (per server instance) ---
const APP_CSRF_TOKEN = (webcrypto as Crypto).randomUUID();
const SESSION_TOKEN = (webcrypto as Crypto).randomUUID();

function hasValidSession(cookieHeader: string | null): boolean {
  return cookieHeader?.split(';').some(c => c.trim() === `session=${SESSION_TOKEN}`) ?? false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Rate limiting
  if (RATE_LIMIT_ROUTES.includes(context.url.pathname)) {
    const ip =
      context.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (isRateLimited(ip)) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }
  }

  // Expose CSRF token to Astro pages via locals
  context.locals.csrfToken = APP_CSRF_TOKEN;

  // CSRF token validation for POST /api/* routes
  if (context.request.method === 'POST' && context.url.pathname.startsWith('/api/')) {
    const token = context.request.headers.get('X-CSRF-Token');
    if (token !== APP_CSRF_TOKEN) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Auth: valid session cookie is sufficient
  const cookieHeader = context.request.headers.get('Cookie');
  if (hasValidSession(cookieHeader)) {
    return next();
  }

  // No valid session — fall back to Basic Auth
  const user = process.env.BASIC_AUTH_USER ?? import.meta.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD ?? import.meta.env.BASIC_AUTH_PASSWORD;

  if (!user || !password) {
    return new Response('Server misconfigured: missing auth credentials', { status: 500 });
  }

  const header = context.request.headers.get('Authorization');

  if (!header || !header.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Mercatr"' },
    });
  }

  const decoded = atob(header.slice(6));
  const colonIndex = decoded.indexOf(':');

  if (colonIndex === -1) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Mercatr"' },
    });
  }

  const providedUser = decoded.slice(0, colonIndex);
  const providedPassword = decoded.slice(colonIndex + 1);

  if (providedUser !== user || providedPassword !== password) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Mercatr"' },
    });
  }

  // Valid Basic Auth — issue a session cookie so subsequent requests skip Basic Auth
  const secure = context.url.protocol === 'https:' ? '; Secure' : '';
  const response = await next();
  response.headers.append(
    'Set-Cookie',
    `session=${SESSION_TOKEN}; HttpOnly${secure}; SameSite=Strict; Path=/`,
  );
  return response;
});
