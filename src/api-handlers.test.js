/**
 * Smoke tests for the hosted editor's serverless handlers.
 *
 * These run the real handlers against a minimal stand-in for Vercel's req/res,
 * so the unauthenticated paths — the ones that decide who gets in — are verified
 * without deploying anything.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'z'.repeat(48);
process.env.GITHUB_REPO = 'Mr-bgrand/comic_collection';

const { default: me } = await import('../editor/api/me.js');
const { default: bins } = await import('../editor/api/bins.js');
const { default: value } = await import('../editor/api/value.js');
const { default: login } = await import('../editor/api/auth/login.js');
const { seal } = await import('../editor/lib/session.js');

/** Just enough of Vercel's res to observe what a handler decided. */
function fakeRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    redirected: null,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    redirect(code, url) { this.statusCode = code; this.redirected = url; },
  };
  return res;
}

const req = (over = {}) => ({ method: 'GET', headers: {}, query: {}, ...over });

test('me reports signed out when there is no cookie', () => {
  const res = fakeRes();
  me(req(), res);
  assert.deepEqual(res.body, { signedIn: false });
});

test('me never returns the token itself', () => {
  const cookie = `cc_session=${seal({ token: 'gho_secret', login: 'Mr-bgrand', exp: Date.now() + 60_000 })}`;
  const res = fakeRes();
  me(req({ headers: { cookie } }), res);
  assert.equal(res.body.signedIn, true);
  assert.equal(res.body.login, 'Mr-bgrand');
  assert.equal(res.body.token, undefined, 'token must never cross the wire');
  assert.ok(!JSON.stringify(res.body).includes('gho_secret'));
});

test('bins refuses an unauthenticated request', async () => {
  const res = fakeRes();
  await bins(req(), res);
  assert.equal(res.statusCode, 401);
});

test('value refuses anything but POST', async () => {
  const res = fakeRes();
  await value(req({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
});

test('value refuses an unauthenticated POST before touching GitHub', async () => {
  const res = fakeRes();
  await value(req({ method: 'POST', body: { cert: '1', value: '5' } }), res);
  assert.equal(res.statusCode, 401);
});

test('value rejects a POST with no cert', async () => {
  const cookie = `cc_session=${seal({ token: 't', login: 'Mr-bgrand', exp: Date.now() + 60_000 })}`;
  const res = fakeRes();
  await value(req({ method: 'POST', headers: { cookie }, body: {} }), res);
  assert.equal(res.statusCode, 400);
});

test('login refuses to start without a client id, rather than redirecting nowhere', () => {
  delete process.env.GITHUB_CLIENT_ID;
  const res = fakeRes();
  login(req(), res);
  assert.equal(res.statusCode, 500);
});

test('login redirects to GitHub with the narrow scope and a state cookie', () => {
  process.env.GITHUB_CLIENT_ID = 'test-client-id';
  const res = fakeRes();
  login(req(), res);

  assert.equal(res.statusCode, 302);
  assert.match(res.redirected, /^https:\/\/github\.com\/login\/oauth\/authorize\?/);

  const url = new URL(res.redirected);
  assert.equal(url.searchParams.get('client_id'), 'test-client-id');
  assert.equal(url.searchParams.get('scope'), 'public_repo read:user', 'narrow scope only');
  assert.ok(url.searchParams.get('state'), 'state is present');

  const cookie = res.headers['set-cookie'];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.ok(cookie.includes(url.searchParams.get('state')), 'cookie state matches the redirect');
});
