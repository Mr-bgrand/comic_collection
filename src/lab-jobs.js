import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { isPrintPdf } from './print-packs.js';

export function createPrintJobs(root) {
  let current = { status: 'idle', stage: '', log: '', files: [] };
  let completion = Promise.resolve();
  const append = chunk => { current.log = (current.log + chunk.toString()).slice(-18000); };
  function command(script) {
    return new Promise((resolve, reject) => {
      // Fixed package script names only; user input never becomes shell text.
      const win = process.platform === 'win32';
      const child = win ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm run ${script}`], { cwd: root, windowsHide: true }) : spawn('npm', ['run', script], { cwd: root });
      child.stdout.on('data', append); child.stderr.on('data', append);
      child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`${script} exited with code ${code}. See the build log.`)));
    });
  }
  async function files() {
    try {
      const names = (await readdir(path.join(root, 'print'))).filter(isPrintPdf).sort();
      return Promise.all(names.map(async name => ({ name, url: '/print/' + name, updatedAt: (await stat(path.join(root, 'print', name))).mtime.toISOString() })));
    } catch { return []; }
  }
  return {
    async snapshot() { return { ...current, files: await files() }; },
    wait() { return completion; },
    start(action) {
      if (!['build', 'print', 'build-print', 'review'].includes(action)) throw new Error('Unknown print action');
      if (current.status === 'running') throw Object.assign(new Error('A build is already running'), { status: 409 });
      const steps = action === 'build-print' ? ['build', 'print'] : action === 'review' ? ['review:build'] : [action];
      current = { status: 'running', action, stage: steps[0], log: '', files: [], startedAt: new Date().toISOString() };
      completion = (async () => {
        try { for (const step of steps) { current.stage = `npm run ${step}`; append(`\n> npm run ${step}\n`); await command(step); } current.status = 'complete'; current.finishedAt = new Date().toISOString(); }
        catch (error) { current.status = 'failed'; current.error = error.message; }
      })();
      return { ...current };
    },
  };
}
