# Compose and render music

Run these commands from the Lumina SFX directory. Composition, synthesis, analysis and WAV export run locally with Node.

```sh
npm run --silent music -- compose --style menu --key "F major" --bpm 104 --bars 8 --seed 72 --dest /absolute/game/audio
npm run --silent music -- compose --style ambient --quality studio --form intro:4,main:8,break:4,outro:4 --one-shot --dest /absolute/game/audio
npm run --silent music -- compose --style chamber --one-shot --dest /absolute/game/audio
npm run --silent music -- compose --style groove --dest /absolute/game/audio
npm run --silent music -- compose --style arcade --progression "Dm Bb Gm A7" --dest /absolute/game/audio
npm run --silent music -- compose --style cinematic --form intro:4,main:4,break:2,main:4,outro:2 --one-shot --dest /absolute/game/audio
```

The style supplies the default tempo, key, harmony and instruments. `--progression` accepts chord symbols or Roman numerals such as `"Imaj7 vi7 IVmaj7 Vsus4"`. The progression advances one chord per bar. `--form` sets the length and the role of each section. Use `--form "opening=intro:4,return=main:4"` to add section IDs to the score and report. Loops are the default. Use `--one-shot` for a standalone track that keeps its planned opening and renders the instrument releases beyond the final bar when needed.

| Style | Arrangement |
| --- | --- |
| `chamber` | Cello line, nylon-guitar arpeggios, lower cello and piano replies |
| `groove` | Tine keys, extended chords, staggered backbeat, syncopated bass and plucked replies |
| `ambient` | Held common tones, sparse answers and a longer room. See [Waterline](music/waterline-plan.json) |
| `menu`, `arcade` | Rounded melodic loop or pulse-wave arcade cue |
| `cinematic` | Piano, bowed strings, horn, guitar and tuned percussion |

`chamber`, `groove` and `ambient` default to studio quality. `--quality classic` on `ambient` selects its earlier backing and synthesis profile.

## Write a theme and arrange it

Decide where the music plays, how long it lasts, what must remain audible and how it should change between sections. Choose a short motif with a clear rhythm. Give it an exposed first statement, space for a contrasting response, and a deliberate return. Use a change in register, harmony, articulation or instrumentation to make the return meaningful. Reserve releases and breathing room around foreground game cues.

```sh
npm run --silent music -- template --style chamber --id new-cue > new-cue.plan.json
npm run --silent music -- compile new-cue.plan.json > new-cue.score.json
npm run --silent music -- instruments
npm run --silent music -- inspect references/music/observatory-plan.json
npm run --silent music -- arrange references/music/observatory-plan.json --dest /absolute/game/audio
```

The chamber and groove templates alternate theme and answer between instruments and finish with a cadence. The [Waterline plan](music/waterline-plan.json) adds an electric piano to the ambient palette. The [Observatory plan](music/observatory-plan.json) uses piano, horn and cello for three treatments of one cinematic theme. `instruments` gives the valid track IDs for each palette, playable registers and available articulations. [Phrase and cadence examples](https://viva.pressbooks.pub/openmusictheory/chapter/hybrid-phrase-level-forms/)

| Plan field | Edit |
| --- | --- |
| `style`, `key`, `bpm`, `loop` | Choose the backing palette, key, tempo and playback mode |
| `motifs` | Name reusable note lists. Give each event an absolute `note` or one-based scale `degree` with optional `octave` and `accidental`. Each beat is relative to the motif's start |
| `sections[]` | Give each section an `id`, a `role` and one `chords` entry per bar. An optional `key` changes the local key from that section onward |
| `statements[]` | Place a `motif` on a `track` at a section-relative `beat` or one-based `bar`. Set optional `transpose` in semitones, `stretch`, velocity `strength` or `articulation`. `carry: true` lets a note that begins here sustain into the following section |
| `mute`, `layer` | Mute backing tracks in a section with `mute`. A statement replaces its track's stock notes in that section by default. Set `layer: true` to add to the backing |
| `parts` | Add named instruments to the palette. For example, `{"signal":"electric-piano"}` adds a track that statements and mix settings can address |
| `backing` | Set `false` to use only the instruments declared under `parts` |
| `mix` | Override `gainDb`, `pan`, `reverb`, `dynamics`, `expression` or piano `pedal` by track ID |

Before rendering, run `inspect` and check section lengths, intended motif statements, instrument registers, and peak written polyphony. A typo in a plan field stops compilation with the source path. Investigate a large note count on a sustained lead or several full-register accompaniment parts playing underneath it. Revise the smallest relevant section or track and retain the plan as the editable source. Use `compile` for an editable resolved score when you only need to check note and chord placement.

### Play sound effects as instruments

In `parts`, use `{"keys":{"instrument":"recipe","recipe":"menu-confirm-pluck","root":"C5"}}` to play a catalog recipe on the music clock. Name the sounding reference pitch as `root`, then write ordinary notes or scale degrees. The recipe renderer shifts pitch independently of duration. Leave out the root for a drum-like or environmental source and write `"note":"hit"`. Use `params` on the part for the recipe's native controls.

Note duration gates the sound. A one-shot can end earlier on its own, and a loop repeats while the note is held. A short fade closes a cropped take or loop. Track pan, gain, expression and room work on recipe parts as on built-in instruments. The export report names each catalog source and keeps its recording credits. In [Pocket Workshop](music/catalog-miniature-plan.json), a menu pluck supplies lead and bass, a wooden step and detent supply the rhythm, and rain carries across phrases. All five tracks use catalog recipes.

### Change key while keeping the motif

Resolve Roman numerals against the section's key. Use absolute chord symbols for explicitly borrowed chords. A degree event such as `{"degree":3,"octave":4,"beat":1,"duration":0.5}` sounds F4 in D minor and A4 in F major. Its rhythm stays at the motif's written position. Use an absolute note for a pitch you want to keep across both keys. Pick a playable octave for the receiving track.

Use `@pivot` in the final bar before a new key to choose a common triad with small voice movements into the written entry chord. When the two keys have no common major or minor triad, the compiler uses the new key's dominant seventh. Use `@dominant` when the dominant is the intended cue, and begin the new section on the chord you want it to resolve to. An explicit chord preserves your own modulation. Use `inspect` to confirm the resolved bridge, entry chord and shared pitches. [Modulation example](music/common-ground-plan.json) · [Common-chord modulation](https://milnepublishing.geneseo.edu/fundamentals-function-form/chapter/28-modulation/)

## Orchestrate a cinematic cue

The cinematic preset opens with piano, carries the theme into a horn lead over short string figures, cello and guitar, and uses tuned and untuned percussion to mark entrances. Its break reduces the ensemble before the reprise. Edit the score to carry your own motif between sections. Play the individual stems to check how their registers, articulations and balances work together.

```sh
npm run --silent music -- instruments
```

The inventory lists each instrument's recommended register and accepted articulations. Piano, bowed strings, cello, violin, horn, electric guitar, timpani and percussion are synthesized by the project from the score. All presets render with Node alone. Add a solo violin with `"parts":{"lead":"violin"}` and target `lead` in a statement. Use `strings` for a section and `cello` for a low solo line.

Studio piano uses velocity-dependent hammer excitation, two-stage decay and detuned unison strings above the lowest keys. For an exposed line, vary `velocity` to change both impact and tone. Give bass notes more space to ring and use lighter velocities for inner chord tones. [Piano hammer and string modeling](https://www.dafx.de/papers/DAFX02_Bank_Sujbert_piano_synthesis.pdf)

Studio bowed strings approximate the string's grip and release at the bow, the force it transfers to the bridge, and the resonances that radiate from the instrument. The first note of a phrase builds its bow contact. Adjacent `legato` notes enter with the bow already engaged. Use `dynamics` to change bow pressure over a phrase and `expression` for level adjustments. [Bowed-string onsets](https://www.knutsacoustics.com/files/starting-transients-guettler.pdf) · [Measured violin body and bridge response](https://strad3d.org/files/bissinger/BissingerStructAcousticModel_vn_rad_prof.pdf)

Studio horn separates the breath at the start of a note, the lip vibration and the sound radiated by the bell. A rising `dynamics` curve brings out upper harmonics as well as volume. Join notes on a single line with `legato` and leave gaps where the player should breathe. [Brass acoustics](https://phys.unsw.edu.au/jw/brassacoustics.html)

Studio guitars model where the string is plucked and how it loses energy after the stroke. The nylon guitar radiates through the soundboard and air cavity. The electric guitar senses the string at two pickup positions and sends all notes on one track through one amplifier. Keep notes of a chord on the same track for shared distortion. Change `velocity` for a softer stroke or more drive, and use track `gainDb` to balance the amplified result. [Acoustic guitar response](https://aaltodoc.aalto.fi/bitstreams/e198ec92-e1f8-4a20-aa79-0e2984c1835c/download) · [Magnetic pickup measurements](https://www.eecs.qmul.ac.uk/~simond/pub/2017/MohamadHarteDixon-ICASSP2017.pdf)

The studio electric piano combines a tine with a slower-decaying resonance, the hammer's short impact modes, and a magnetic pickup that responds to changing flux. Use light velocities for warm chord tones and harder strikes for a brighter attack. [Tine and pickup modeling](https://www.dafx17.eca.ed.ac.uk/papers/DAFx17_paper_79.pdf)

Studio synth bass keeps a steady fundamental under a velocity-sensitive filter sweep. The pad opens slowly and moves across slightly detuned oscillators. The pluck uses a short FM transient that resolves to a stable pitch. Chip lead uses a band-limited pulse whose duty cycle changes with the stroke. [Time-varying FM spectra](https://people.ece.cornell.edu/land/courses/ece4760/Math/GCC644/FM_synth/Chowning.pdf)

Studio instruments use eased attack and release edges. The attack and handoff in a fast bowed or horn phrase fit the written note length. Nearby repetitions of the same pitch get a fresh attack with a shorter preceding tail. Note variation follows the track, pitch and onset on the source score, so edits earlier in a part and adaptive crops preserve the following notes' excitation.

| Control | Use |
| --- | --- |
| `sustain` | Hold the written length with the instrument's natural attack and release |
| `short` | Play a detached note. Use for string ostinati under sustained melody |
| `swell` | Build intensity across a held note. Use for strings, cello, violin, horn or pad |
| `accent` | Use a faster, stronger onset. Use for accents and section entrances |
| `mute` | Dampen a nylon or electric guitar note. Use for short muted figures and palm-muted rhythms |
| `legato` | Connect adjacent pitches in a single line on strings, cello, violin or horn. Studio bowed voices and horn join different pitches with a short blend. Write the previous note through the next onset and leave a gap between phrases |
| `reverb` | Send a track to its stereo room at a level from 0 to 1. Start with 0.15–0.35 |
| `dynamics` | Shape pressure and tone on strings, cello, violin and horn. Write absolute-score `[beat, value]` pairs between 0 and 1 |
| `expression` | Ride the dry part's gain before its room send. Write the same kind of curve. Zero mutes the part |
| `pedal` | Lift and restore the piano dampers with absolute-score pairs such as `[[0.2,1],[3.92,0]]`. A new strike of the same pitch releases the previous key's held note |

Set the score's `room` to `studio` for a short space or `hall` for a longer tail. Tracks with a reverb send use the hall by default. The room is printed into each exported stem. One-shots keep the room tail, and loops carry reflections across the seam.

Write pedal-up events around harmony changes to keep the bass definition. Studio mode lets a small bank of modeled strings resonate with the sounding notes while the pedal is down. A loop needs an up event in each cycle. Each adaptive clip lifts its dampers at its own boundary and lets its release tail decay. [Piano sustain-pedal research](https://research.aalto.fi/en/publications/analysis-and-modeling-of-piano-sustain-pedal-effects/)

## Review the cue in its game mix

```sh
npm run --silent scene:preview -- references/music/observatory-preview.json --dest /absolute/game/audio
npm run --silent scene:preview -- references/scenes/waterline-dive-preview.json --dest /absolute/game/audio
npm run --silent audition -- take-a.plan.json take-b.plan.json --at 10 --out /absolute/game/audio/compare.html
```

An audio preview combines a local score, plan or adaptive routing file with the project's regular recipe IDs and layered sound designs. Use `id` for a catalog cue or `design` for an existing remix JSON file relative to the preview. Set each event's `atSec` or `atBeat`. With `alignMarker`, that time locates the named marker within the effect. Use `durationSec` to extend an ambience loop and `duckMusicDb` on an event that needs priority. Read the report's event and marker frames, recipe mix roles, source credits, music and SFX levels and final peak. [Catalog cue example](music/observatory-preview.json) · [Adaptive music with a layered dive](scenes/waterline-dive-preview.json)

Scores and mixed scenes share the DSP, meter, master processor and WAV encoder in `engine/`. A sound design uses the same recipe renderer when you audition it, export it separately, or put it in a mixed scene. Listen to the scene master to check the cue in context. Deliver the score's master or adaptive bank alongside the game's selected SFX when the game mixes them at runtime.

The audition desk accepts plans and resolved scores and uses one loudness-matched excerpt per candidate when music is present. Give the two versions distinct IDs and set `--at` to a comparable musical passage. Compare the arrangement and sound separately by rendering the same score with `--quality classic` and `--quality studio` under different IDs. Listen for note attacks, repeated articulations, exposed transitions, masking, and tail behavior. The measurement report helps locate issues. The listener decides timbre, groove and musical intent.

## Adapt music to the game

```sh
npm run --silent music -- inspect references/music/common-ground-adaptive.json
npm run --silent music -- adaptive references/music/waterline-adaptive.json --dest /absolute/game/audio
npm run --silent music -- adaptive references/music/observatory-adaptive.json --dest /absolute/game/audio
npm run --silent scene:preview -- references/music/observatory-adaptive-scene.json --dest /absolute/game/audio
```

Inspect a routing file to check section lengths, transition defaults and reserved ending bars before synthesis. If the file includes preview changes, the inspection shows the same beat and sample-frame positions, clip offsets, chord decisions and fades as the exported report. Levels and boundary jumps are measured on the WAV after rendering.

Map each game state to a named section of an existing score or plan. Sections share one beat grid and level calibration. A repeating state keeps its phrase running until a change is due. A state in `oneShot` plays once and leaves its release tail. Plans export harmony by bar. When all routed sections have that information, new banks default to `entry: "harmonic"`. Use `entry: "phase"` for deliberately locked variants that share phrase landmarks.

| Routing field | Behavior |
| --- | --- |
| `initial`, `states` | Map state IDs to score section IDs and select the initial state |
| `defaults`, `transitions` | Use `at: "now"`, `"beat"`, `"bar"` or `"end"`. Per-edge rules use `from` and `to`. `entry: "phase"` keeps the outgoing section's relative beat when entering the destination |
| `entry: "harmonic"`, `waitBars` | At each candidate beat prefer equal harmony, then a chord extension over the same bass that preserves all of at least three notes in the smaller chord. Choose the nearest destination bar within each match type. Wait up to one source bar by default, or set 0–4. At `"now"`, the decision is immediate. If no match is available, release the old chord before the new section enters. Harmonic banks apply the same overlap check at self-loop boundaries |
| `fadeBeats` | Set the maximum handoff length. The player uses the outgoing audio available past the cut |
| `intensity`, `hysteresis` | Map normalized game intensity to ascending `{min, state}` bands starting at zero. The margin keeps near-threshold changes from triggering repeated transitions |
| `preview.changes` | List ordered `{beat, state}` or `{beat, intensity}` entries. Override a transition on a specific change when needed |
| `preview.beats`, `preview.finish` | Set the musical length in beats and reserve full bars for a closing one-shot. The closing tail is included by default. Set `keepTail: false` for an exact-length file |

Use the exported browser helper with the same unlocked Web Audio context as the game's SFX. Serve the manifest and section WAVs as game assets.

```ts
import { AdaptiveMusicPlayer } from './audio/observatory-adaptive/adaptive-player.ts';

const music = await AdaptiveMusicPlayer.load(audioContext, '/audio/observatory-adaptive/manifest.json');
music.start();

const onThreatChanged = (intensity: number) => music.setIntensity(intensity);
const onEnterShelter = () => music.setState('shelter', { at: 'bar', entry: 'start' });
const onLeaveRoom = () => music.setState('release', { at: 'end' });
```

State requests return the scheduled beat. A new request replaces the pending transition. Use `{ beat: 24 }` to request a change no earlier than beat 24, or `{ at: "now" }` for a time-critical handoff. Playback protects events already queued on the audio clock. Call `dispose()` when leaving the scene. The preview uses the same state director and writes switch frames, phase offsets, overlap, chord decisions and sample steps in its report. [Intensity routing](music/observatory-adaptive.json) · [Harmonic routing](music/common-ground-adaptive.json) · [FMOD transition authoring](https://www.fmod.com/docs/2.04/studio/authoring-events.html)

Each section clip renders the notes held across its written start before cutting it to the selected bar. This preserves the held tone and its advanced envelope when entering from the original timeline. `inspect` lists carried notes by track, and the routing report marks a chord-extension overlap with `shared: true`. [Waterline handoff](music/waterline-adaptive.json)

## Check the drums before the full mix

Use `kick` or `low-drum` for the low impulse, `snare` for the drumhead and wire response, and `tom` for moving fills. In studio mode, the strike drives coupled heads and the shell, and movement of the resonant head excites the snare wires. `hat` uses quick plate contacts and rapid damping. `crash` builds a longer wash from a bank of uneven resonances. Give exposed hits enough written duration for the body to ring and use lighter velocities for ghost notes. [Tom-tom measurements](https://www.speech.kth.se/qpsr/1997/1997_38_1_059-065.pdf) · [Snare acoustics research](https://www.pure.ed.ac.uk/ws/portalfiles/portal/11222120/1.3651240.pdf) · [Hi-hat plate modeling](https://www.jstage.jst.go.jp/article/ast/44/5/44_E2293/_article)

```sh
npm run --silent music -- render references/music/drum-check.json --dest /absolute/game/audio
npm run --silent music -- render references/music/drum-check.json --quality classic --id drum-check-classic --dest /absolute/game/audio
npm run --silent audition -- /absolute/game/audio/drum-check-classic/score.json /absolute/game/audio/drum-check/score.json --out /absolute/game/audio/drum-review.html
```

## Edit or write a score

Copy the exported score, edit the part you want to change and export it under a new project ID.

```sh
npm run --silent music -- render /absolute/path/edited-score.json --id menu-v2 --dest /absolute/game/audio
```

The same score and seed reproduce the render. Every project goes into `<dest>/<id>/`. An identical export can reuse its directory. Use a different ID or destination for a changed export. Add `--no-stems` when the stereo master and report are sufficient.

This one-bar example starts with half a beat of rest and lets the final note ring out.

```json
{
  "version": 1,
  "id": "gentle-confirmation",
  "key": "C major",
  "bpm": 110,
  "bars": 1,
  "beatsPerBar": 4,
  "seed": 104729,
  "loop": false,
  "master": { "targetLufs": -18, "ceilingDbtp": -1 },
  "tracks": [
    {
      "id": "melody",
      "instrument": "pluck",
      "gainDb": -8,
      "pan": 0.1,
      "notes": [
        { "beat": 0.5, "duration": 0.4, "note": "E4", "velocity": 0.65 },
        { "beat": 1, "duration": 0.4, "note": "G4", "velocity": 0.7 },
        { "beat": 1.5, "duration": 1.3, "note": "C5", "velocity": 0.8 }
      ]
    }
  ]
}
```

- `beat` starts at zero. Fractional beats control timing within the beat. `duration` is the note's held time in beats. Write each attack separately for repeated pitches, pickups and ornaments. When transcribing, compare the lead and accompaniment events separately before adjusting the mix. Overlapping notes form chords. Loops wrap releases across the boundary.
- Pitched notes accept names such as `Bb3` or MIDI integers from 0 to 127. A `drums` track uses `kick`, `snare`, `hat`, `low-drum`, `tom` and `crash`. A `timpani` track uses pitched notes. Add `"articulation": "short"` to a supported note to change its performance.
- Each track has a unique lowercase hyphenated ID. Velocity is 0–1 and defaults to 0.8. Pan is −1 to 1 and defaults to center. Track gain defaults to 0 dB. Use `notes: []` for a silent track.
- A score supports 30–300 BPM, 2–12 beats per bar, up to 16 tracks and up to 300 seconds including one-shot tails. The composer writes 4/4. In an edited score, optional sections label contiguous bars as `{"role":"intro","bars":4}` and must cover the score. Change the note events to edit the music in those bars.

## Read the export

- `master.wav` is the mastered stereo mix. `studio` writes deterministically dithered 48 kHz, 24-bit PCM and uses the studio instrument models. It is the default for plans. Saved scores without a quality setting and the `classic` profile use 44.1 kHz, 16-bit PCM. The default target is −18 LUFS with a −1 dBTP ceiling. Read `master.integratedLufs`, `master.truePeakDbtp` and the limiter and trim values to see the delivered level.
- `stem-<id>.wav` is the track after pan, track gain and any room send, before the master processing. Each stem starts at frame zero. If a stem needed gain reduction to fit PCM, `tracks[].wavTrimDb` records the adjustment.
- `report.json` includes RMS by track, bar and section, spectrum bands, stereo correlation and asset hashes. For a loop, use the exact `loop.startFrame` and exclusive `loop.endFrame` at the reported sample rate. `loop.boundaryJumpDbfs` measures the sample step across the seam. An intentional opening note can raise `startRmsDbfs` relative to `endRmsDbfs`.

## Design references

The workflow uses recurring motifs and section-level intent from symbolic music research, separate timbre and expression controls from orchestral programming, and event-priority ducking from game-audio production. Listening comparisons complement signal checks for judging sound quality. [MusicFrameworks](https://arxiv.org/abs/2109.00663) · [Music Transformer](https://arxiv.org/abs/1809.04281) · [Orchestral dynamics and expression](https://support.spitfireaudio.com/en/articles/11816091-what-is-the-difference-between-dynamics-vibrato-and-expression) · [Physically informed piano synthesis](https://home.mit.bme.hu/~bank/publist/jasp03.pdf) · [Audiokinetic game-audio mixing](https://info.audiokinetic.com/gamesoundcon-2025) · [ITU listening assessment](https://www.itu.int/rec/r-rec-bs.1534/en)
