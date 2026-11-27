#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    omit: { type: 'string' },
    clean: { type: 'boolean' },
    help: { type: 'boolean' },
  },
});
const usage = 'npm run compare -- scene.json --omit layer-label --out comparison.html [--clean]';
if (values.help) {
  console.log(usage);
  process.exit(0);
}
if (positionals.length !== 1 || !values.omit || !values.out) throw Error(usage);
const source = resolve(positionals[0]),
  original = JSON.parse(await readFile(source, 'utf8'));
if (original.schemaVersion !== 2 || !original.layers?.every((l) => typeof l.id === 'string'))
  throw Error('Choose a version 2 scene with catalog layers');
const layers = original.layers.filter((l) => l.label !== values.omit);
if (layers.length !== original.layers.length - 1 || !layers.length)
  throw Error('Choose one named layer in a multi-source scene');
if (
  original.focus?.subjects?.includes(values.omit) ||
  original.focus?.moments?.some((m) => m.subjects?.includes(values.omit))
)
  throw Error('Choose a support layer so the comparison preserves the intended foreground');
const temp = await mkdtemp(join(tmpdir(), 'lumina-compare-'));
try {
  const alternate = join(temp, 'alternate.json');
  await writeFile(alternate, JSON.stringify({ ...original, id: original.id + '-reduced', layers }));
  const args = [
    fileURLToPath(new URL('./audition.mjs', import.meta.url)),
    source,
    alternate,
    '--out',
    resolve(values.out),
  ];
  if (values.clean) args.push('--clean');
  execFileSync(process.execPath, [...process.execArgv, ...args], { stdio: 'inherit' });
} finally {
  await rm(temp, { recursive: true, force: true });
}
