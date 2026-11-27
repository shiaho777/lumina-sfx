import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { planEdit, reviseEdit } from '../scripts/edit-score.mjs';
import { approvedProfile } from '../scripts/edit-family.mjs';
import { reconform } from '../scripts/edit-recut.mjs';
import { contactProbes } from '../scripts/edit-contacts.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const bank = JSON.parse(await readFile(join(root, 'catalog.json'))).sounds;
const cut = (events, extra = {}) => ({ id: 'continuity', fps: 24, durationFrames: 240, events, ...extra });
const event = (id, action, frame, extra = {}) => ({ id, action, frame, ...extra });
test('one physical control keeps its take across changes of screen and narration', () => {
  const timeline = cut(
    [
      event('a', 'tab', 20, { device: 'trackpad' }),
      event('b', 'confirm', 80, { device: 'trackpad' }),
      event('c', 'press', 110, { device: 'trackpad' }),
      event('phone', 'confirm', 140, { device: 'touch', feedback: 'subtle' }),
    ],
    { speech: [[70, 99]] },
  );
  const [a, b, c, phone] = planEdit(timeline, bank).cues;
  assert.equal(a.soundId, 'glass-trackpad-press');
  assert.equal(a.soundId, b.soundId);
  assert.equal(b.soundId, c.soundId);
  assert.equal(a.seed, c.seed);
  assert.equal(b.gainDb, a.gainDb - 6);
  assert.equal(phone.soundId, 'soft-touch-acknowledgement');
});
test('a project profile exported from an approval survives disk, recut and direct search', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'lumina-profile-test-'));
  try {
    const original = cut([event('one', 'tab', 24, { target: 'preferences' })]);
    const base = planEdit(original, bank);
    const replacement = base.cues[0].alternatives[0];
    const approved = reviseEdit(
      base,
      [{ id: 'one', soundId: replacement, trimDb: -2, shiftFrames: 2, lock: true }],
      bank,
    );
    const profile = approvedProfile(approved);
    assert.equal(profile.signatures.tab.id, replacement);
    const profilePath = join(tmp, 'profile.json');
    await writeFile(join(tmp, 'approved.json'), JSON.stringify(approved));
    execFileSync(
      process.execPath,
      ['scripts/score-edit.mjs', 'profile', join(tmp, 'approved.json'), '--out', profilePath],
      { cwd: root },
    );
    const selected = JSON.parse(
      execFileSync(process.execPath, ['scripts/choose.mjs', 'settings tab', '--profile', profilePath], {
        cwd: root,
      }),
    );
    assert.equal(selected.cues[0].id, replacement);
    const newCut = cut([event('new', 'tab', 104, { target: 'preferences' })], { fps: 48 });
    const next = planEdit(newCut, bank, profile);
    const preserved = reconform(approved, next, newCut, bank);
    assert.deepEqual(preserved.recut.retained, ['new']);
    assert.equal(preserved.cues[0].seed, approved.cues[0].seed);
    assert.equal(preserved.cues[0].syncFrame, 108);
    assert.equal(preserved.cues[0].projectTrimDb, -2);
    const ambiguous = cut([
      event('new', 'tab', 24, { target: 'preferences' }),
      event('other', 'tab', 76, { target: 'preferences' }),
    ]);
    assert.ok(
      reconform(approved, planEdit(ambiguous, bank), ambiguous, bank).cues.every(
        (c) => c.decision === 'review',
      ),
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
test('repeated original taps require a matching device and editor-confirmed reference', () => {
  const events = [
    event('constructor', 'press', 12, { device: 'mouse', sourceContact: true }),
    event('second', 'press', 24, { device: 'mouse' }),
    event('other', 'press', 36, { device: 'trackpad' }),
  ];
  const source = new Float32Array(24000);
  for (const f of [12, 24, 36])
    for (let j = 0; j < 75; j++) source[f * 500 + j] = 0.5 * Math.cos(j * 1.24) * Math.exp(-j / 14);
  const detector = contactProbes(events, 24);
  for (let i = 0; i < source.length; i += 337) detector.write(source.subarray(i, i + 337), i);
  const contacts = detector.finish();
  assert.equal(contacts.second[0].decision, 'reuse');
  assert.equal(contacts.other[0].decision, 'review');
  const p = planEdit(cut(events), bank, {}, {}, { windows: [], contacts });
  assert.deepEqual(
    p.cues.map((c) => c.decision),
    ['reuse', 'reuse', 'review'],
  );
  assert.equal(
    reviseEdit(p, [{ id: 'other', sourceDecision: 'add', lock: true }], bank).cues[2].decision,
    'play',
  );
});
test('plain brief qualifiers survive into the performance, including speech and original contact', () => {
  const p = planEdit(
    cut([
      { id: 'key', frame: 12, brief: 'mechanical keyboard click during a spoken walkthrough' },
      { id: 'reuse', frame: 80, action: 'press', brief: 'keep the original click' },
    ]),
    bank,
  );
  assert.equal(p.cues[0].soundId, 'linear-mechanical-keyboard-key-down');
  assert.equal(p.cues[0].context, 'speech');
  assert.equal(p.cues[1].decision, 'reuse');
});

test('a questionable original key does not erase its neighbours or lower the whole word', () => {
  const word = event('word', 'type', 18, { device: 'laptop', keyFrames: [18, 23, 29, 37, 46] });
  const cutaway = cut([word]);
  const original = { windows: [], contacts: { word: [{ frame: 29, decision: 'review' }] } };
  const p = planEdit(cutaway, bank, {}, {}, original);
  const before = p.cues[0];
  assert.deepEqual(before.keyDecisions, ['play', 'play', 'review', 'play', 'play']);
  const approved = reviseEdit(p, [{ id: 'word', sourceFrame: 29, sourceDecision: 'add', trimDb: -4 }], bank)
    .cues[0];
  assert.deepEqual(approved.keyDecisions, Array(5).fill('play'));
  assert.equal(approved.gainDb, before.gainDb);
  assert.equal(approved.keyGainOffsets[2], (before.keyGainOffsets?.[2] ?? 0) - 4);
  for (const i of [0, 1, 3, 4]) assert.equal(approved.keyGainOffsets[i], before.keyGainOffsets?.[i] ?? 0);
  assert.throws(() => reviseEdit(p, [{ id: 'word', sourceFrame: 23, sourceDecision: 'reuse' }], bank));
  const reuse = reviseEdit(p, [{ id: 'word', sourceFrame: 29, sourceDecision: 'reuse' }], bank).cues[0];
  assert.deepEqual(reuse.keyDecisions, ['play', 'play', 'reuse', 'play', 'play']);
});

test('a saved physical take retains its seed when the next episode has a different project ID', () => {
  const first = planEdit(cut([event('one', 'press', 10, { device: 'mouse' })]), bank);
  const accepted = reviseEdit(first, [{ id: 'one', lock: true }], bank);
  const second = planEdit(
    cut([event('undo', 'undo', 20, { device: 'mouse' }), event('pick', 'tab', 60, { device: 'mouse' })], {
      id: 'episode-two',
    }),
    bank,
    approvedProfile(accepted),
  );
  assert.ok(second.cues.every((c) => c.soundId === first.cues[0].soundId && c.seed === first.cues[0].seed));
});

test('one requested motion accent stays inside the visible seat and ordinary holds stay quiet', () => {
  const make = (accent) =>
    planEdit(
      cut([{ id: 'title', frame: 10, endFrame: 28, syncFrame: 21, brief: 'title card lands', accent }]),
      bank,
    ).cues[0];
  const title = make(true);
  assert.equal(title.action, 'land');
  assert.equal(title.soundId, 'paper-title-card-seat');
  assert.equal(title.syncFrame, 21);
  assert.equal(title.endFrame, 28);
  assert.equal(title.fitMotion, true);
  assert.equal(make(false).decision, 'silence');
});

test('a recut retains the approved quieter key; a missing original asks for a fresh listen on that key', () => {
  const word = (frame) =>
    event('line', 'type', frame, {
      label: 'air',
      device: 'laptop',
      keyFrames: [frame, frame + 5, frame + 12],
    });
  const track = (frame) => ({ windows: [], contacts: { line: [{ frame, decision: 'review' }] } });
  const original = planEdit(cut([word(18)]), bank, {}, {}, track(23));
  const next = cut([word(40)]);
  const score = () => planEdit(next, bank, {}, {}, track(45));
  const quiet = reviseEdit(
    original,
    [{ id: 'line', sourceFrame: 23, sourceDecision: 'add', trimDb: -4, lock: true }],
    bank,
  );
  const now = reconform(quiet, score(), next, bank).cues[0];
  assert.deepEqual(now.keyDecisions, ['play', 'play', 'play']);
  assert.equal(now.keyGainOffsets[1], (score().cues[0].keyGainOffsets?.[1] ?? 0) - 4);
  const reused = reviseEdit(
    original,
    [{ id: 'line', sourceFrame: 23, sourceDecision: 'reuse', lock: true }],
    bank,
  );
  const replacement = reconform(reused, planEdit(next, bank), next, bank);
  assert.deepEqual(replacement.cues[0].keyDecisions, ['play', 'review', 'play']);
  assert.deepEqual(replacement.recut.review, ['line']);
  assert.deepEqual(
    reviseEdit(replacement, [{ id: 'line', sourceFrame: 45, sourceDecision: 'add' }], bank).cues[0]
      .keyDecisions,
    ['play', 'play', 'play'],
  );
});

test('a held physical Return is one distinct wide key and an approved board remains available', () => {
  const timeline = cut([
    event('number', 'type', 10, { device: 'desktop mechanical keyboard', keyFrames: [10, 28] }),
    event('submit', 'press', 60, { device: 'desktop mechanical keyboard', key: 'Enter', endFrame: 95 }),
    event('release-hold', 'hold', 80),
    event('caption', 'press', 122, { device: 'desktop mouse', label: 'Return' }),
  ]);
  const p = planEdit(timeline, bank);
  assert.deepEqual(p.cues.map(c => c.soundId ?? c.decision), ['linear-mechanical-keyboard-key-down',
    'linear-mechanical-keyboard-return-down', 'silence', 'desktop-mouse-press']);
  const previous = bank.find(s => s.id === 'gasket-mount-keyboard-key-down');
  const profile = {signatures: {'type/mechanical': { id: previous.id, revision: previous.revision }}};
  assert.equal(planEdit(timeline, bank, profile).cues[0].soundId, previous.id);
});

test('delivery flags material drift within one device and accepts mirrored swipes and varying typing takes', async () => {
  const { signatureChanges } = await import('../scripts/edit-family.mjs');
  const base = {decision:'play', signature:'slide', action:'slide', fixedTake:true, seed:32};
  const swipes = [{...base, soundId:'silk-swipe-right', syncFrame:20},{...base, soundId:'silk-swipe-left',syncFrame:45}];
  const keys = [81,97].map((seed,i) => ({ decision:'play', soundId:'linear-mechanical-keyboard-key-down',
    seed, signature:'type/mechanical', action:'type',syncFrame:50+i*8 }));
  assert.deepEqual(signatureChanges([...swipes, ...keys]), []);
  const change = signatureChanges([...swipes, {...base, soundId:'velvet-swipe-right',syncFrame:110}]);
  assert.deepEqual(change[0].variants.map(s=>s.frames),[[20,45],[110]]);
});


test('repeat context follows a physical switch across actions and ignores contacts on a different device', () => {
  const p = planEdit(cut([
    event('open', 'tab', 10, {device:'mouse'}), event('dismiss', 'back', 16, {device:'mouse'}),
    event('desk', 'press', 100, {device:'mouse'}), event('tablet', 'press', 106, {device:'touch'}),
  ]),bank);
  assert.deepEqual(p.cues.slice(0,3).map(c=>c.context),['rapid','rapid','normal']);
  assert.equal(p.cues[3].decision,'silence');
});

test('a gamepad confirmation is one contact on its input frame, and keeps an explicit two-stage choice', () => {
  const controller = { device: 'gamepad' };
  const events = [
    event('focus-a', 'focus', 10, controller),
    event('focus-b', 'focus', 40, controller),
    event('commit', 'confirm', 70, controller),
  ];
  const [a, b, confirmation] = planEdit(cut(events), bank).cues;
  assert.equal(a.soundId, b.soundId);
  assert.equal(a.seed, b.seed);
  assert.equal(confirmation.soundId, 'menu-confirm-spring-detent');
  assert.equal(confirmation.markerSec, 0);
  const explicit = { ...events[2], soundId: 'settings-apply-overcentre-latch' };
  assert.equal(planEdit(cut([explicit]), bank).cues[0].soundId, explicit.soundId);
});

test('retiming an approved moving take starts from the original material on every edit', async () => {
  const { default: swipe } = await import('../recipes/silk-swipe-right.ts');
  const { renderChannels } = await import('../engine/render.ts');
  const direct = swipe.withGestureTiming(0.4, 0.15);
  const revised = swipe.withGestureTiming(0.5, 0.2).withGestureTiming(0.4, 0.15);
  assert.deepEqual(renderChannels(revised, { seed: 31 }), renderChannels(direct, { seed: 31 }));
});

test('two lengths of a fixed swipe render their own stereo travel and keep the gap silent', async () => {
  const { renderEdit } = await import('../scripts/edit-render.mjs');
  const slide = (id, frame, syncFrame, endFrame) => event(id, 'slide', frame, {
    syncFrame, endFrame, motion: 'follow', direction: 'right', target: 'ribbon', accent: true,
  });
  const plan = planEdit(cut([slide('slow', 12, 24, 36), slide('quick', 48, 54, 60)]), bank);
  assert.deepEqual(plan.cues.map(c => c.decision), ['play', 'play']);
  assert.equal(plan.cues[0].soundId, plan.cues[1].soundId);
  assert.equal(plan.cues[0].seed, plan.cues[1].seed);
  const dest = await mkdtemp(join(tmpdir(), 'lumina-swipe-fit-'));
  try {
    const wav = join(dest, 'follow.wav');
    const report = await renderEdit(plan, bank, wav);
    assert.equal(report.renderedTakes, 2);
    const bytes = await readFile(wav);
    const energy = (from, to) => {
      const sum = [0, 0];
      for (let i = Math.round(from * 44100 / 24); i < Math.round(to * 44100 / 24); i++) {
        for (let ear = 0; ear < 2; ear++) sum[ear] += bytes.readInt16LE(44 + i * 4 + ear * 2) ** 2;
      }
      return sum;
    };
    for (const [start, end] of [[12, 36], [48, 60]]) {
      const early = energy(start, start + 3), late = energy(end - 3, end);
      assert.ok(early[0] > early[1] && late[1] > late[0]);
    }
    assert.deepEqual(energy(36, 48), [0, 0]);
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});
