// Merge a full default-seed screen and optional independent follow-up screens.
// Use a complete default report so removing a flag requires fresh evidence.
import { readFile } from 'node:fs/promises';
const [fullPath, ...extraPaths] = process.argv.slice(2);
if (!fullPath) throw Error('Usage: node qa/summarize-screen.mjs full.json [follow-up.json ...]');
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const bank = (await read(new URL('../catalog.json', import.meta.url))).sounds;
const full = await read(fullPath);
if (full.seed !== 104729 || full.rows.length !== bank.length) throw Error('Expected a complete default-seed screen');
const expected = new Set(bank.map(s => s.id)), entries = new Map();
for (const row of full.rows) {
  if (!expected.delete(row.id) || !/^[a-f0-9]{64}$/.test(row.hash)) throw Error('Invalid default row: ' + row.id);
  entries.set(row.id, { hash: row.hash, labels: new Set(row.flags.map(flag => flag.name)) });
}
for (const path of extraPaths) {
  const report = await read(path);
  if (report.seed === full.seed || full.classifier !== report.classifier) throw Error('Expected a second seed from the same classifier');
  const seen = new Set();
  for (const row of report.rows) {
    if (!entries.has(row.id) || seen.has(row.id)) throw Error('Invalid follow-up ID: ' + row.id);
    seen.add(row.id);
    for (const flag of row.flags) entries.get(row.id).labels.add(flag.name);
  }
}
const holds = {};
for (const id of [...entries.keys()].sort()) {
  const { labels, hash } = entries.get(id);
  if (labels.size) holds[id] = { labels: [...labels].sort(), sha256: hash };
}
console.log(JSON.stringify({method:'Machine screening leads. Apply the two-seed listening dispositions in qa/flag-auditions.json before clean selection. sha256 identifies the screened default PCM master.',holds},null,2));
