#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publishAsset } from './audio-export.mjs';
import { selectionProfile, listeningVotes } from './selection-profile.mjs';
import { clock, observeEdit, scoreObservedEdit, reviseEdit } from './edit-score.mjs';

const usage =
  'score-edit.mjs inspect VIDEO --out DIR | plan TIMELINE --out PLAN [--profile FILE] [--source VIDEO] | audition PLAN --source VIDEO (--cue ID | --signature FAMILY) [--alternative ID | --quieter] [--source-frame FRAME] --out DIR | profile APPROVED_PLAN --out STYLE | recut TIMELINE --previous OLD_PLAN --source VIDEO --out PLAN | revise PLAN --changes FILE --out NEW_PLAN | render PLAN --out STEM.wav | mix VIDEO --stem STEM.wav --out PREVIEW.mp4 [--audio-stream 0] [--fit-picture] | audit PLAN --source SOURCE.mp4 --stem STEM.wav --mix SCORED.mp4 --out REPORT.json | probe MEDIA --at SECONDS[,SECONDS...] [--window-ms 180] --out REPORT.json | compare MIX_A.mp4 --against MIX_B.mp4 --out DESK.html';
async function main() {
  const {
    values: v,
    positionals: [command, file, ...rest],
  } = parseArgs({
    allowPositionals: true,
    options: {
      at: { type: 'string' },
      'window-ms': { type: 'string' },
      'fit-picture': { type: 'boolean' },
      quieter: { type: 'boolean' },
      'source-frame': { type: 'string' },
      previous: { type: 'string' },
      source: { type: 'string' },
      cue: { type: 'string' },
      signature: { type: 'string' },
      alternative: { type: 'string' },
      against: { type: 'string' },
      out: { type: 'string' },
      profile: { type: 'string' },
      changes: { type: 'string' },
      stem: { type: 'string' },
      mix: { type: 'string' },
      'audio-stream': { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (v.help) {
    console.log(usage);
    return;
  }
  if (!file || !v.out || rest.length) throw Error(usage);
  if (command === 'probe') {
    if (!v.at || v.at.split(',').some(t => !t.trim())) throw Error(usage);
    const { probeStereo } = await import('./edit-delivery.mjs');
    const result = await probeStereo(file, v.at.split(',').map(Number),
      Number(v['window-ms'] ?? 180), Number(v['audio-stream'] ?? 0));
    await publishAsset(resolve(v.out), Buffer.from(JSON.stringify(result, null, 2) + '\n'));
    console.log(JSON.stringify(result));
    return;
  }
  if (command === 'compare') {
    if (!v.against) throw Error(usage);
    const { comparePictures } = await import('./edit-media.mjs');
    console.log(JSON.stringify(await comparePictures(file, v.against, v.out)));
    return;
  }
  if (command === 'inspect' || command === 'mix') {
    const { inspectPicture, mixPicture } = await import('./edit-media.mjs');
    if (command === 'mix' && !v.stem) throw Error(usage);
    console.log(
      JSON.stringify(
        command === 'inspect'
          ? await inspectPicture(file, v.out)
          : await mixPicture(file, v.stem, v.out, Number(v['audio-stream'] ?? 0), v['fit-picture']),
      ),
    );
    return;
  }
  const read = async (f) => JSON.parse(await readFile(f, 'utf8'));
  const input = await read(file);
  if (command === 'audit') {
    if (!v.source || !v.stem || !v.mix) throw Error(usage);
    const { auditDelivery } = await import('./edit-delivery.mjs');
    const result = await auditDelivery(input, v.source, v.stem, v.mix, Number(v['audio-stream'] ?? 0));
    await publishAsset(resolve(v.out), Buffer.from(JSON.stringify(result, null, 2) + '\n'));
    console.log(
      JSON.stringify({
        file: resolve(v.out),
        mixPeakDbfs: result.mixPeakDbfs,
        markedContacts: result.cues.length,
        warnings: result.warnings,
      }),
    );
    return;
  }
  const { sounds } = await read(new URL('../catalog.json', import.meta.url));
  if (command === 'profile') {
    const { approvedProfile } = await import('./edit-family.mjs');
    await publishAsset(resolve(v.out), Buffer.from(JSON.stringify(approvedProfile(input), null, 2) + '\n'));
    console.log(JSON.stringify({ file: resolve(v.out) }));
    return;
  }
  if (command === 'audition') {
    if (!v.source || Boolean(v.cue) === Boolean(v.signature)) throw Error(usage);
    const { auditionCue } = await import('./edit-audition.mjs');
    console.log(
      JSON.stringify(
        await auditionCue(
          input,
          sounds,
          v.source,
          v.cue,
          v.alternative,
          v.out,
          Number(v['audio-stream'] ?? 0),
          {
            quieter: v.quieter,
            signature: v.signature,
            sourceFrame: v['source-frame'] === undefined ? undefined : Number(v['source-frame']),
          },
        ),
      ),
    );
    return;
  }
  if (command === 'render') {
    const { renderEdit } = await import('./edit-render.mjs');
    console.log(JSON.stringify(await renderEdit(input, sounds, v.out)));
    return;
  }
  let result;
  if (command === 'plan' || command === 'recut') {
    const profile = await selectionProfile(v.profile),
      { votes = {} } = await listeningVotes(profile.votes);
    const { fps, durationFrames } = clock(input);
    const { withPictureTravel } = await import('./edit-region.mjs');
    const observed = observeEdit(await withPictureTravel(input, v.source, fps, durationFrames), sounds);
    const track =
      v.source &&
      (await (
        await import('./edit-track.mjs')
      ).measureTrack(v.source, Number(v['audio-stream'] ?? 0), observed.events, fps, observed.device));
    result = scoreObservedEdit(observed, sounds, profile, votes, track);
    if (command === 'recut') {
      if (!v.previous) throw Error('Supply --previous PLAN for the prior cut');
      const { reconform } = await import('./edit-recut.mjs');
      result = reconform(await read(v.previous), result, input, sounds);
    }
  } else if (command === 'revise' && v.changes) result = reviseEdit(input, await read(v.changes), sounds);
  else throw Error(usage);
  await publishAsset(resolve(v.out), Buffer.from(JSON.stringify(result, null, 2) + '\n'));
  console.log(
    JSON.stringify({ file: resolve(v.out), decisions: result.cues.map((c) => [c.id, c.decision]) }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
