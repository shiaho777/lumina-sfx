import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('the blind review desk never adds incidental weather to a dry audition', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lumina-desk-'));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const file = join(temp, 'review.html');
  const args = ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', 'scripts/audition.mjs',
    'references/listening-scenes/dry-cockpit.json', 'references/listening-scenes/pilot-inside-canopy.json',
    '--clean', '--out', file];
  const run = (extra) => execFileSync(process.execPath, [...args, ...extra], { cwd:root, encoding:'utf8', stdio:'pipe' });
  try {
    assert.equal(JSON.parse(run([])).bed, null);
    const html = await readFile(file,'utf8');
    const payload = JSON.parse(html.match(/<script[^>]+id="audio-data"[^>]*>(.*?)<\/script>/s)[1]);
    assert.equal(payload.bed,null);
    assert.equal(payload.startDry,true);
    assert.throws(() => run(['--bed','rain-canopy-droplets-clean-loop']), /already occurs/);
  } finally {
    await rm(temp, {recursive:true,force:true});
  }
});
