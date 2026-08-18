/**
 * Finish the GitHub OAuth flow.
 *
 * Two checks, both mandatory:
 *   1. `state` matches the cookie set at login — otherwise this is a CSRF attempt.
 *   2. The authenticated user is the allowed one — a valid GitHub login is not
 *      the same as permission to edit this collection.
 */

import { setSession, unseal, parseCookies } from '../../lib/session.js';
import { currentUser } from '../../lib/github.js';

export default async function handler(req, res) {
  const { code, state } = req.query ?? {};
  const cookieState = parseCookies(req).cc_state;

  if (!code) return res.status(400).send('Missing code');
  if (!state || state !== cookieState || !unseal(state)) {
    return res.status(400).send('Bad or expired state — start again from /');
  }

  const token = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  }).then((r) => r.json());

  if (!token.access_token) {
    return res.status(401).send(`GitHub refused the code: ${token.error ?? 'unknown'}`);
  }

  const user = await currentUser(token.access_token);
  const allowed = (process.env.ALLOWED_LOGIN ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length && !allowed.includes(String(user.login).toLowerCase())) {
    // Signed in to GitHub successfully, but not as someone who may edit.
    return res
      .status(403)
      .send(`Signed in as ${user.login}, who is not permitted to edit this collection.`);
  }

  setSession(res, { token: token.access_token, login: user.login, avatar: user.avatar_url });
  res.redirect(302, '/');
}
