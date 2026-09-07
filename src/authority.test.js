import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeAuthority, acceptedAuthorityScan, mergeAuthority } from './authority.js';
import { graderOf, gradeLabel, certUrl, detailLines, compactDetailLines } from './model.js';
const fixture = JSON.parse(readFileSync(new URL('../data/incoming/authority-1700597971.json', import.meta.url)));

test('Authority canonical QR redirects preserve leading-zero certificate IDs',()=>{
 const c=structuredClone(fixture);c.providerId='0097410939';
 c.fields.find(f=>f.label==='Certificate Number').value=c.providerId;
 for(const base of ['https://www.theauthority.com/','https://www.theauthority.com/Id/','https://id.theauthority.com/']){
  c.pageUrl=base+c.providerId;assert.equal(normalizeAuthority(c).cert,'0097410939');
 }
});

test('Authority preserves distinct issue and variant-code fields and exact provenance', () => {
  const comic = normalizeAuthority(fixture);
  assert.equal(comic.issue, '1');
  assert.equal(comic.coverCode, 'D');
  assert.equal(comic.upc, '75960621024400141');
  assert.equal(comic.holder, 'soft-sleeve');
  assert.deepEqual(comic.featuredCharacters, ['Deathlok']);
  assert.equal(comic.authentication.sourceUrl, fixture.pageUrl);
  assert.equal(comic.location, null);
  assert.equal(comic.valuation, null);
});

test('raw authentication never falls through to the legacy CGC grading default', () => {
  const comic = normalizeAuthority(fixture);
  assert.equal(graderOf(comic), null);
  assert.equal(gradeLabel(comic), 'RAW Authentic');
  assert.equal(comic.grade, null);
  assert.equal(certUrl(comic), fixture.pageUrl);
  for (const details of [detailLines(comic), compactDetailLines(comic)]) {
    assert.match(details.join(' '), /Authority ID 1700597971/);
    assert.doesNotMatch(details.join(' '), /CGC|null cert/);
  }
  assert.equal(graderOf({ cert: '123', grade: '9.8' }), 'CGC');
  assert.equal(gradeLabel({ grading: { status: 'raw' } }), 'Raw · ungraded');
});

test('source validation rejects marketplace, side swaps, credentials and lookalike hosts', () => {
  const front = fixture.scans[0].url;
  assert.equal(acceptedAuthorityScan(front, 'front'), true);
  for (const bad of [front.replace('https:', 'http:'), front.replace('imga.theauthority.com', 'imga.theauthority.com.evil.test'), front.replace('imga.', 'owner@imga.'), front + '&Type=Back', 'https://i.ebayimg.com/card.jpg']) {
    assert.equal(acceptedAuthorityScan(bad, 'front'), false);
  }
  assert.equal(acceptedAuthorityScan(front, 'back'), false);
});

test('wrong certificate, mixed internal image IDs and unreviewed grading status cannot import', () => {
  assert.throws(() => normalizeAuthority({ ...fixture, providerId: '1700597972' }), /mismatch/);
  const wrongPageCert = structuredClone(fixture);
  wrongPageCert.fields[0].value = '1700597972';
  assert.throws(() => normalizeAuthority(wrongPageCert), /mismatch/);
  const mixed = structuredClone(fixture);
  mixed.scans[1].url = mixed.scans[1].url.replace('d8ab3cff', 'a8ab3cff');
  assert.throws(() => normalizeAuthority(mixed), /different internal items/);
  assert.throws(() => normalizeAuthority({ ...fixture, status: '9.8' }), /Unreviewed/);
});

test('refreshing a provider ID preserves owner data without creating another copy', () => {
  const fresh = normalizeAuthority(fixture);
  const existing = { ...fresh, location: 'Bin 12', notes: 'Gift', manual: { value: 42 }, valuation: { value: 42 } };
  const refreshed = mergeAuthority([existing], fresh);
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].location, 'Bin 12');
  assert.equal(refreshed[0].notes, 'Gift');
  assert.equal(refreshed[0].manual.value, 42);
  assert.equal(refreshed[0].valuation.value, 42);
  assert.equal(mergeAuthority([], fresh).length, 1);
});
