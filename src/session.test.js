import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'x'.repeat(48);
const { seal, unseal, parseCookies } = await import('../editor/lib/session.js');

test('a sealed session round-trips', () => {
  const out = unseal(seal({ token: 'gho_secret', login: 'Mr-bgrand', exp: Date.now() + 60_000 }));
  assert.equal(out.token, 'gho_secret');
  assert.equal(out.login, 'Mr-bgrand');
});

test('the token is not readable from the sealed string', () => {
  const sealed = seal({ token: 'gho_secret', exp: Date.now() + 60_000 });
  assert.ok(!sealed.includes('gho_secret'));
  assert.ok(!Buffer.from(sealed, 'base64url').toString('utf8').includes('gho_secret'));
});

test('a tampered session fails to open rather than decoding to something else', () => {
  const sealed = seal({ token: 'a', login: 'Mr-bgrand', exp: Date.now() + 60_000 });
  const bytes = Buffer.from(sealed, 'base64url');
  bytes[bytes.length - 1] ^= 0xff; // flip a bit of ciphertext
  assert.equal(unseal(bytes.toString('base64url')), null);
});

test('an expired session is refused', () => {
  assert.equal(unseal(seal({ token: 'a', exp: Date.now() - 1000 })), null);
});

test('a session with no expiry is refused rather than living forever', () => {
  assert.equal(unseal(seal({ token: 'a' })), null);
});

test('garbage is refused without throwing', () => {
  assert.equal(unseal('not-a-session'), null);
  assert.equal(unseal(''), null);
  assert.equal(unseal(undefined), null);
});

test('a session sealed with a different secret cannot be opened', async () => {
  const sealed = seal({ token: 'a', exp: Date.now() + 60_000 });
  const original = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'y'.repeat(48);
  try {
    assert.equal(unseal(sealed), null);
  } finally {
    process.env.SESSION_SECRET = original;
  }
});

test('parseCookies reads multiple cookies', () => {
  const c = parseCookies({ headers: { cookie: 'a=1; cc_session=abc; b=2' } });
  assert.equal(c.cc_session, 'abc');
  assert.equal(c.a, '1');
});

test('parseCookies handles a request with no cookies', () => {
  assert.deepEqual(parseCookies({ headers: {} }), {});
});

test('session lifetime tracks the GitHub token and dies before it', async () => {
  const { setSession } = await import('../editor/lib/session.js');
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; } };

  // GitHub issues 8h tokens when "Expire user access tokens" is on.
  const maxAge = setSession(res, { token: 't', login: 'Mr-bgrand' }, 28800);
  assert.ok(maxAge < 28800, 'cookie must expire before the token it carries');
  assert.equal(maxAge, 28800 - 120);
  assert.match(res.headers['set-cookie'], new RegExp(`Max-Age=${maxAge}`));
});

test('session falls back to a sane default when GitHub sends no expiry', async () => {
  const { setSession } = await import('../editor/lib/session.js');
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; } };
  assert.equal(setSession(res, { token: 't' }, undefined), 60 * 60 * 8);
});

test('a very short token lifetime still yields a usable session', async () => {
  const { setSession } = await import('../editor/lib/session.js');
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; } };
  assert.equal(setSession(res, { token: 't' }, 30), 60, 'floored, never zero or negative');
});
