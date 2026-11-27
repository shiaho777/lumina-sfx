import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cases = (await readFile(new URL('./selection-briefs.tsv', import.meta.url), 'utf8'))
  .trim()
  .split('\n')
  .map((line) => line.split('\t'));
assert.equal(cases.length, 100);
assert.equal(new Set(cases.map(([query]) => query)).size, 100);
const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url))).sounds;
const rows = [];
for (const [prompt, expected] of cases) {
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/choose.mjs', prompt], { cwd: root }));
  const cue = result.cues[0],
    sound = catalog.find((s) => s.id === cue?.id);
  const pass = expected.startsWith('!')
    ? result.decision === expected.slice(1)
    : Boolean(
        result.decision === 'single-cue' &&
        sound &&
        !sound.cleanHold &&
        !sound.auditionNote &&
        (expected.startsWith('@')
          ? sound.editorialAction === expected.slice(1)
          : new RegExp(expected).test(sound.id)),
      );
  rows.push({
    prompt,
    expected,
    decision: result.decision,
    id: sound?.id,
    ...(cue?.spatial ? { spatial: cue.spatial } : {}),
    pass,
  });
}
const passed = rows.filter((r) => r.pass).length;
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify({ passed, total: rows.length, misses: rows.filter((r) => !r.pass) }, null, 2));
process.exitCode = Number(passed !== cases.length);
