#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { selectRecipes, checkIsolatedRecipes, installRecipes } from './install-files.mjs';

async function main() {
  const { values, positionals } = parseArgs({
    options: { clean: { type:'boolean' }, isolated: { type:'boolean' }, dest: { type: 'string' }, project: { type: 'string' }, engine: { type: 'string' }, help: { type: 'boolean' } },
    allowPositionals: true,
  });
  if (values.help || !positionals.length) {
    console.log('node scripts/install-sfx.mjs <id> [id ...] [--clean] [--isolated] [--project GAME] [--engine web|godot|unity|unreal|python|wav] [--dest DIR]');
    if (!values.help) process.exitCode = 1;
    return;
  }
  const selected = await selectRecipes(positionals);
  if (values.clean || values.isolated) await checkIsolatedRecipes(selected, {clean:values.clean});
  const { detectProject, installEngine } = await import('./install-engine.mjs');
  const target = await detectProject(values.project ?? values.dest ?? process.cwd());
  // Preserve the existing TypeScript-only --dest interface for browser projects.
  if (!values.engine && !values.project && (!target || (values.dest && target.engine === 'web'))) {
    const dest = resolve(values.dest ?? './src/lumina-sfx');
    const written = await installRecipes(selected, dest);
    console.log(`Installed ${selected.length} recipe(s) into ${dest} (${written} files written)`);
    return;
  }
  const root = resolve(values.project ?? target?.root ?? process.cwd());
  console.log(JSON.stringify(await installEngine(selected, { root, dest: values.dest, engine: values.engine ?? target?.engine ?? 'web' }), null, 2));
}

if (!process.features.typescript && !process.execArgv.includes('--experimental-strip-types')) {
  const child = spawnSync(process.execPath, ['--experimental-strip-types', ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exitCode = child.status ?? 1;
} else {
  try { await main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
