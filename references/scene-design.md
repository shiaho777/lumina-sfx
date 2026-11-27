# Design a playable scene

Start with what the listener should recognize, where their ears are, and what the player can change. Search by movement, material and perspective. Recording titles are searchable across the bank. The annotated cues also describe their contents and expose landmarks. A title describes a source recording and can include events outside the selected excerpt. Prefer the cue's own description and audition the excerpt.

| Scene | Editable timed mix | Live controls and events |
| --- | --- | --- |
| Wet road | [Ignition, pass, skid, barrier](scenes/wet-road-barrier.json) | [RPM, load, speed, slip and collision](scenes/wet-road-live.json) |
| Melee | [Timber check](scenes/melee-timber-check.json) and [steel parry](scenes/melee-steel-parry.json) | [Swing, wood contact, steel contact](scenes/melee-live.json) |
| Air combat | [Canopy](scenes/dogfight-cockpit.json) and [external pass](scenes/dogfight-exterior.json) | [Throttle, RPM, radar changes, burst, release and detonation](scenes/dogfight-live.json) |
| Dive | [Boat above and below water](scenes/dive-beneath-the-boat.json) | [Depth, entry and resurfacing](scenes/dive-live.json) |

For emotional direction, shared pitched accents and transitions between beds, use the [scene intent guide](scene-intent.md).

Use `scene:preview` to play a score, plan or adaptive routing alongside catalog recipes and existing remix JSON designs. Place effects in seconds or musical beats. Use `alignMarker` to land a contact at that time and `duckMusicDb` to give the event priority. The preview exports the mix and aligned music and SFX buses. [Music and SFX preview example](music-workflow.md#review-the-cue-in-its-game-mix)

## Print a timed scene

```sh
node scripts/remix.mjs --spec references/scenes/dive-beneath-the-boat.json --inspect
node scripts/remix.mjs --spec references/scenes/dive-beneath-the-boat.json --format wav --extremes --dest /absolute/game/audio
```

Inspect a recipe ID or design before exporting. The JSON gives each group's layer offsets and ends, source seek and playback speed, crossfades, markers, and native control ranges with the selected defaults. Layer times and markers are local to their group, before group-wide speed and room processing. `outputDurationSec` includes that processing. Listening and `--extremes` check the rendered sound.

- Anchor an arrival with `"atMarker":{"layer":1,"name":"closest","shiftSec":-0.1}`. Layer numbers start at one. This cue enters 100 ms before the first layer's closest pass. Anchors resolve after that layer's seek and speed adjustments. Override timing with an explicit offset only when it stands alone.
- Use `fitSec` on a layer or `--fit-seconds 0.18` on a single recipe to fit an animation. Add `afterLayer.crossfadeSec` when one layer should carry into the next.
- Use `fromMarker` to seek into a take. Use `durationSec` to crop a one-shot or hold a repeating loop for a fixed time. Cropped edges receive short fades. A bounded loop prints as a one-shot.
- Write `envelope` as increasing pairs of local playback seconds and linear gain. Between points the engine interpolates power. Pair complementary fades over uncorrelated sounds such as wet tire spray and friction. For two copies of the same recording, listen for a hollow or doubled attack. Use one copy where it carries the event.
- Muffle a source across a transition with `"muffle":{"cutoffHz":300,"envelope":[[0,0],[0.4,1]]}`. The second number is the filtered fraction. Keep local bubbles and the actual hydrophone track audible when filtering the surface boat.
- Set the design's `style` to `natural`, `cinematic`, or `arcade`. Explicit design macros override preset fields. Use the native recipe controls for performance differences such as force. Mastering and pitch processing can shift a transient slightly. Landmarks describe authored timing in the base performance, with the current seed and controls determining the exact audible accent.
- Export a design as TypeScript to retain its editable layers, credits, and qualified landmarks such as `layer2.contact`. For deeper arrangements, import that recipe into another call to `composeRecipe` in the target game. In a CLI design, a layer can also supply `"design":"wet-road-barrier.json"` or an inline design object in place of `id`. Paths resolve relative to the containing file. A nested export embeds its arrangement in the game recipe. [Five-source road and glass example](scenes/barrier-and-broken-glass.json)

Native controls in `params` shape the action. The macros at the root of [catalog.json](../catalog.json) cover attack (`punch`), low-end weight (`size`), perspective (`distance`), room (`space`, `wetness`), saturation (`grit`), pace (`speed`) and independent pitch (`pitchShift`). Layer gains are linear. Leave an audible layer at zero and use `under` to keep an ambience bed below its focus. [Mood and relative gain examples](scene-intent.md)

Render as `ts` for editable playback or `wav` for PCM and sample-accurate loops. `ogg` and `opus` require local FFmpeg. Preserve the delivery metadata for recording credits.

## Wire actions to the game

```sh
npm run scene:install -- references/scenes/wet-road-live.json --dest /absolute/game/src/audio
```

The Web Audio installer generates a scene factory and copies the recipes and local runtime it imports. It detects conflicts with edited game files. Create the scene after audio is unlocked, and reuse it for the lifetime of the vehicle.

For individual IDs, use `node scripts/install-sfx.mjs <id> --project /absolute/game`. You can select `web`, `godot`, `unity`, `unreal`, `python` or `wav` with `--engine`. For a source-only Web Audio install, pass `--dest /absolute/game/src/audio` and import the installed recipe and `SfxPlayer` from `./audio/engine/index.ts`.

```ts
import createRoad from './audio/scenes/wet-road-live.ts';

const road = createRoad(audioContext);
road.start();
road.trigger('ignition');
// On simulation updates, supply normalized telemetry in [0, 1].
road.set('rpm', rpmNormalized);
road.set('load', throttle);
road.set('speed', speedNormalized);
road.set('slip', tireSlip);
// On the game's actual barrier collision:
road.trigger('collision');
// On scene exit:
road.dispose();
```

RPM changes the rate of persistent engine voices, load blends idle and exhaust, speed brings in road noise, and slip sustains tire friction. A miss in the melee scene emits only `swing`. Emit `wood` or `steel` at the animation contact frame if the game registers contact. The dive scene keeps both motor textures running while depth changes their balance and filters the surface recording. Emit `entry` and `surface` once per crossing. In a native game, export the referenced stems through the engine installer and bind the same events and normalized controls to its mixer.

## Listen in context

```sh
npm run audition -- knife-pass-by-the-sleeve references/scenes/melee-timber-check.json references/scenes/melee-steel-parry.json --bed light-rain-loop --out /absolute/review/melee.html
npm run audition -- knife-pass-by-the-sleeve --styles --out /absolute/review/styles.html
```

Open the HTML and press Space. The desk shuffles candidates and hides their names. Every take is matched to the same weighted active level. A normal review contains only the chosen performances. Supply `--bed <loop-id>` to compare them with a shared background. The desk rejects a bed already present in a candidate. Test recognition in quiet, on the simulated mono phone speaker, and across ten seeded performances. Excerpts are limited to twelve seconds per take. Y or N saves a vote and plays the next candidate. Use `--isolated` to start the comparison dry and restrict the foreground candidates to isolated recipes. Add a short recognition guess or reason before voting. Export votes to retain the observations with the actual cue IDs. Browser storage is local to the desk. Pass an exported vote file to `node scripts/search.mjs knife --votes /absolute/review/votes.json --json` to rank matching catalog cues by the listener’s decisions and return the reason and listening context. Test custom designs and style variants by their own IDs.

Keep a quiet footstep quiet in the shipped mix. Matching playback level in the listening desk serves comparison only. Use balanced game roles and the game bus gain for delivery. Automated QA measures signal integrity. Blind recognition and repetition votes supply the perceptual evidence.


For the flight scene, fire radar cues only when a contact changes state. Trigger the burst, release and detonation independently from gameplay. The canopy engine keeps running as RPM and throttle change. Use the exterior cannon and the pass design for a spectator camera. The radar tones are original game feedback. [Audition acquisition, lock, and loss in sequence](scenes/radar-state-preview.json).

Engine textures retain the median spectrum and persistent tonal peaks of credited motor recordings. Their new phase and time history remove the field recording’s sequence of events. Gun and blast attacks use up to 34 ms of source audio with authored bodies and tails. The water entry, surfacing, and radar layers are synthesized. To check the isolated assets against their transforms and dependency lists, run `node --experimental-strip-types qa/isolation.test.mjs`.
