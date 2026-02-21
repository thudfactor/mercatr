import basicAuth from 'express-basic-auth';

const user = process.env.BASIC_AUTH_USER;
const password = process.env.BASIC_AUTH_PASSWORD;

if (!user || !password) {
  throw new Error('BASIC_AUTH_USER and BASIC_AUTH_PASSWORD environment variables must be set');
}

export const auth = basicAuth({
  users: { [user]: password },
  challenge: true,
  realm: 'Mercatr',
});
