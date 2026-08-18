/**
 * Start the GitHub OAuth flow.
 *
 * `state` is a signed, short-lived value rather than a random string held in a
 * store — it is what stops a third-party site from completing a login on your
 * behalf (CSRF), and it needs no session storage to verify.
 */

import crypto from 'node:crypto';
import { seal } from '../../lib/session.js';

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'GITHUB_CLIENT_ID is not set' });

  const state = seal({ n: crypto.randomBytes(16).toString('hex'), exp: Date.now() + 10 * 60_000 });

  const params = new URLSearchParams({
    client_id: clientId,
    // public_repo, not repo: this only ever writes to one public repository, so
    // the wider scope would be authority the editor has no use for.
    scope: 'public_repo read:user',
    state,
    allow_signup: 'false',
  });

  res.setHeader(
    'Set-Cookie',
    `cc_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
  );
  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
