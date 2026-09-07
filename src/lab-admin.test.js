import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readCollection, adminState, saveBinMetadata } from './lab-admin.js';
import { localRequest, serveLab } from './lab-server.js';
import { renderLabel } from './templates/label.js';
import { renderSheet } from './templates/sheet.js';
import { createPrintJobs } from './lab-jobs.js';

test('bin saves preserve IDs and copy data, back up the original, and reject stale writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'collection-admin-test-'));
  try {
    await mkdir(path.join(root, 'data/bins'), { recursive: true });
    const bin = { bin: '01', title: 'Bin 01', location: '', comics: [{ cert: '123', title: 'Venom', grade: '9.8' }] };
    const raw = JSON.stringify(bin);
    await writeFile(path.join(root, 'data/bins/bin-01.json'), raw);
    await writeFile(path.join(root, 'data/config.json'), JSON.stringify({ baseUrl: 'https://example.test' }));
    const state = adminState(await readCollection(root));
    const edit = { id: '01', title: 'Favorite covers', location: 'Office shelf', revision: state.bins[0].revision };
    const result = await saveBinMetadata(root, edit);
    assert.equal(result.title, 'Favorite covers');
    const stored = JSON.parse(await readFile(path.join(root, 'data/bins/bin-01.json')));
    assert.equal(stored.bin, '01');assert.deepEqual(stored.comics, bin.comics);
    assert.equal((await readdir(path.join(root, 'data/backups/bins'))).length, 1);
    await assert.rejects(saveBinMetadata(root, edit), /changed since/);
    await assert.rejects(saveBinMetadata(root, { ...edit, id: '../config' }), /existing bin/);
    await assert.rejects(saveBinMetadata(root, { ...edit, title: '' }), /bin name/);
    assert.equal(JSON.parse(await readFile(path.join(root, 'data/bins/bin-01.json'))).title, 'Favorite covers');
    await mkdir(path.join(root,'data/cards'));
    const cards=[{cert:'Q9937497',grader:'TAG',kind:'card',images:{front:'owner.jpg'}}];
    await writeFile(path.join(root,'data/cards/case-01.json'),JSON.stringify({id:'case-01',title:'Case #1',physical:true,virtual:false,cards}));
    const current=adminState(await readCollection(root)).bins.find(b=>b.id==='case-01');
    const saved=await saveBinMetadata(root,{...current,title:'Desk favorites',location:'Office'});assert.equal(saved.id,'case-01');assert.equal(saved.count,1);
    assert.deepEqual(JSON.parse(await readFile(path.join(root,'data/cards/case-01.json'))).cards,cards);
  } finally { if (!path.basename(root).startsWith('collection-admin-test-') || path.dirname(root) !== os.tmpdir()) throw new Error('Unexpected test cleanup target');await rm(root, { recursive: true, force: true }); }
});

test('local Admin rejects foreign origins and hostile hostnames', () => {
  for (const headers of [{ host: 'evil.test' }, { host: 'localhost:4175', origin: 'https://evil.test' }, { host: 'localhost:4175', 'sec-fetch-site': 'cross-site' }]) assert.equal(localRequest({ headers }), false);
  assert.equal(localRequest({ headers: { host: 'localhost:4175', origin: 'http://localhost:4175' } }), true);
  assert.throws(() => createPrintJobs(process.cwd()).start('print & anything'), /Unknown/);
});

test('renamed bins reach the existing print templates with escaped names and stable IDs', () => {
  const bin = { bin: '01', title: 'Covers <favorites>', location: 'Office', comics: [{ title: 'Venom', issue: '1', grade: '9.8' }] };
  for (const html of [renderLabel({ bin, qrSvg: '', url: 'https://example.test/bin/01/', config: {} }), renderSheet({ bin, qrSvg: '', url: 'https://example.test/bin/01/' })]) {
    assert.match(html, /Covers &lt;favorites&gt;/);assert.match(html, /example.test\/bin\/01/);
  }
});

test('local server provides inventory and print previews while rejecting cross-origin writes', async () => {
  const server = await serveLab({ port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const state = await (await fetch(base + '/api/admin/state')).json();
    assert.ok(state.bins.length);assert.ok(state.summary.cards > 0);
    assert.ok(state.bins.some(b=>b.id==='comic-case-12'&&b.count>0));
    for(const id of ['case-01','case-02','case-wall-office','comic-case-12']){
      const response=await fetch(base+'/admin/print/bin/'+id+'/label');assert.equal(response.status,200);
      assert.match(await response.text(),/size: 4in 6in/);
    }
    const preview = await fetch(base + '/admin/print/bin/' + state.bins[0].id + '/label');
    assert.equal(preview.status, 200);assert.match(await preview.text(), /size: 4in 6in/);
    const master = await (await fetch(base + '/admin/print/master')).text();
    assert.match(master, /RAW Authentic/);assert.match(master, /Authority ID/);
    const denied = await fetch(base + '/api/admin/bin', { method: 'POST', headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(denied.status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
