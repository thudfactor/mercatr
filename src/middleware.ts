import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  // process.env for production (dotenv preloaded); import.meta.env for dev (Vite loads .env there)
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

  return next();
});
