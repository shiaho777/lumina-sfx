import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url)));
const audit = await json('./background-review.json');
const { masters } = await json('./release-masters.json');
const holds=Object.fromEntries((await json('../catalog.json')).sounds.filter(s=>s.cleanHold).map(s=>[s.id,s.cleanHold]));
const {revisions} = await json('./master-revisions.json');
const entries = [...audit.sounds, ...audit.relatedRepairs];
assert.equal(audit.scope.flaggedRecipes, audit.sounds.length);
assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
for (const entry of entries) {
  assert.ok(masters[entry.id], entry.id);
  if (entry.supersededReason) assert.notEqual(entry.masterSha256, masters[entry.id], entry.id);
  else assert.equal(entry.masterSha256, masters[entry.id], entry.id);
  assert.match(entry.variantsSha256, /^[0-9a-f]{64}$/);
}

execFileSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning',
  'scripts/build-reviewed-takes.mjs', '--check'], { cwd: root });
const matches = JSON.parse(execFileSync(process.execPath,
  ['scripts/search.mjs', '--background-checked', '--json'], { cwd: root }));
assert.deepEqual(matches.map(sound => sound.id).sort(), entries.filter(entry => !entry.auditionNote && !entry.supersededReason && !holds[entry.id] && !revisions[entry.id]).map(entry => entry.id).sort());
assert.ok(matches.every(sound => sound.backgroundChecked === true));
console.log('Verified review IDs, master checksums, repair reproducibility and catalog search for ' + entries.length + ' cues.');

const raw = (await json('./source-holds.json')).holds;
const { seeds, auditions } = await json('./flag-auditions.json');
assert.deepEqual(Object.keys(auditions).sort(), Object.keys(raw).sort());
assert.equal(new Set(seeds).size, 2);
for (const [id, evidence] of Object.entries(auditions)) {
  assert.deepEqual(evidence.heard.map(([seed]) => seed).sort(), [...seeds].sort(), id);
  assert.equal(evidence.hashes.length, seeds.length, id);
  assert.ok(evidence.hashes.every(hash => /^[a-f0-9]{64}$/.test(hash)), id);
  assert.ok(['hold', 'field', 'retained', 'repaired'].includes(evidence.status), id);
  if (evidence.status === 'repaired') assert.equal(evidence.retest[0], 'yes', id);
}
