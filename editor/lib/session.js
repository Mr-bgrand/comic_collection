/**
 * Stateless sessions.
 *
 * The GitHub OAuth token is sealed into an httpOnly cookie with AES-256-GCM
 * rather than kept in a database. There is no server-side store to breach, and
 * the token cannot be read by page JavaScript. GCM is authenticated, so a
 * tampered cookie fails to open rather than decrypting to something attacker-
 * chosen.
 */

import crypto from 'node:crypto';

const COOKIE = 'cc_session';
const MAX_AGE = 60 * 60 * 8; // 8 hours — long enough to work, short enough to matter

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function seal(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function unseal(token) {
  try {
    const raw = Buffer.from(String(token), 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const out = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    const payload = JSON.parse(out.toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null; // tampered, expired key, or garbage — all mean "not signed in"
  }
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setSession(res, payload) {
  const token = seal({ ...payload, exp: Date.now() + MAX_AGE * 1000 });
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`,
  );
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

export function getSession(req) {
  const token = parseCookies(req)[COOKIE];
  return token ? unseal(token) : null;
}

/** Guard a handler. Returns the session, or answers 401 and returns null. */
export function requireSession(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'not signed in' });
    return null;
  }
  return session;
}
