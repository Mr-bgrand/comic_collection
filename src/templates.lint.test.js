/**
 * Guards against a bug class that has bitten three times.
 *
 * Templates embed CSS and JavaScript inside tagged template literals. A stray
 * backtick anywhere in that embedded text — even inside a comment — closes the
 * literal early. The failures are nasty because they are quiet: sometimes the
 * build still succeeds and a single statement silently vanishes from the output,
 * and sometimes the module simply refuses to parse hours later.
 *
 * So: no backticks inside the embedded blocks, checked mechanically.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.join('src', 'templates');

/** Lines inside `const <name> = ` ... `;` blocks, with their line numbers. */
function embeddedBlocks(source) {
  const lines = source.split('\n');
  const blocks = [];
  let current = null;

  lines.forEach((line, i) => {
    if (!current) {
      const open = line.match(/^const (\w+) = `$/);
      if (open) current = { name: open[1], start: i + 1, lines: [] };
      return;
    }
    if (/^`;$/.test(line)) {
      blocks.push(current);
      current = null;
      return;
    }
    current.lines.push({ n: i + 1, text: line });
  });

  return blocks;
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.js'));

test('every template file has embedded blocks that close cleanly', async () => {
  for (const file of files) {
    const source = await readFile(path.join(DIR, file), 'utf8');
    const blocks = embeddedBlocks(source);
    for (const block of blocks) {
      assert.ok(block.lines.length > 0, `${file}: ${block.name} block is empty`);
    }
  }
});

test('no backtick appears inside an embedded css or script block', async () => {
  const offenders = [];

  for (const file of files) {
    const source = await readFile(path.join(DIR, file), 'utf8');
    for (const block of embeddedBlocks(source)) {
      for (const { n, text } of block.lines) {
        if (text.includes('`')) offenders.push(`${file}:${n} (${block.name}) ${text.trim().slice(0, 60)}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'A backtick inside an embedded block closes the template literal early:\n  ' +
      offenders.join('\n  '),
  );
});

test('no nested template interpolation inside an embedded script block', async () => {
  // ${...} inside the embedded script is evaluated at BUILD time against
  // build-time scope, not at runtime in the browser — silently producing
  // undefined or dropping the statement.
  const offenders = [];

  for (const file of files) {
    const source = await readFile(path.join(DIR, file), 'utf8');
    for (const block of embeddedBlocks(source)) {
      if (block.name !== 'script') continue;
      for (const { n, text } of block.lines) {
        if (/\$\{/.test(text)) offenders.push(`${file}:${n} ${text.trim().slice(0, 60)}`);
      }
    }
  }

  assert.deepEqual(offenders, [], `Interpolation in an embedded script:\n  ${offenders.join('\n  ')}`);
});

test('every template module actually parses', async () => {
  // The cheapest possible catch for the failure that only appears at build time.
  for (const file of files) {
    await import(`./templates/${file}`);
  }
});
