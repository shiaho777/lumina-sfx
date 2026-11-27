---
name: lumina-sfx
metadata:
  version: "1.5.0"
description: Find, sculpt, layer, invent and verify offline game sound effects. Use for picture-synced demo edits, screen recordings, launch videos, keyboards, swipes, tactile menus, non-vocal alerts, scene focus, listener perspective, 3D headphone audio, moving emitters, timed focus handoffs, mood-aware scene mixing, crossfades, timed audio chains, Web Audio and Three.js, Godot, Unity, Unreal, Pygame, WAV or Opus delivery, animation-driven footsteps, recorded Foley, weather, vehicles, impacts, farming, animals, reactive UI, custom audio recipes, instrumental game music, and adaptive music.
---

# Lumina SFX

Run the studio commands from this skill's directory using Node.js 22.12+. Pass the absolute game path to `--project` or `--dest`. Core search, WAV rendering, selective install and QA work offline from the checkout. The game uses the assets or code you install. The user can keep their existing audio manager. When shipping runtime code, include its MIT notice. The sound license permits commercial project use without audio attribution and restricts competing library distribution. [License](LICENSE)

## Score a video edit

For a product demo, screen recording or trailer, inspect the picture and listen to its original audio first. With a clip, use `npm run score:edit -- inspect clip.mp4 --out picture-review`; with an editor timeline, use its frame rate and event markers directly. If neither is available, ask for the clip or the timed actions. Use [the picture-scoring workflow](references/launch-audio.md#score-a-finished-edit) to mark visible gestures, render a separate SFX track and audition it under the original soundtrack. For a disputed pan or level, probe the delivered stereo file at the marked times. Identify the device and the audible result. A button label describes the interface. An ordinary screen-recorded tap can stay quiet. For a close shot where the pen nib or fingertip audibly strikes glass, mark `physicalContact: true`. Pass the movie to `plan --source` for local level measurements and mark speech intervals by ear. Spot manual typing, paste and streamed output separately. Use a cue audition to compare takes and omission in picture. Lock approved cues during later edits. For a marked mechanical Return, use `key: "Enter"` on the physical press. The scorer keeps that key down through the hold. In the final audit, inspect `signatureChanges` for unexpected changes to one recurring device or transition. When a creator asks for quieter or softer clicks across a demo, revise the device signature in the plan. A relative level or treble trim keeps its recorded take throughout the edit.

When several controls share a switch, audition their busiest passage with `score:edit -- audition` and `--signature`. Compare the full family, a quieter family and silence on the same picture. A saved quiet choice can apply to later cuts. For moving sources, use the emitter path for travel past the listener and the performance control for a change in wheel or motor speed.

Use one switch for the same mouse, one digital tick for one touchscreen and one material for a panel in both directions. Identify a moving panel with the same `target` throughout a reversal and mark its visible `endFrame`. A short title settling can use a single paper contact. Reserve the swelling title hit for a visibly featured reveal. During a quiet screen recording, compare subtle digital feedback at delivered level against leaving it silent.

For a deliberate horizontal panel swipe, pass the element’s frame-stamped x positions in `travel`, or mark its `travelRegion` in the finished picture and pass `--source`. The scorer aligns the swell to peak travel speed and follows the element across stereo. An ordinary unaccented page change stays quiet. [Motion tracking fields](references/launch-audio.md#follow-a-moving-element)

## Place the listener and choose what matters

For a brief with perspective, masking or movement, translate the user's sentence into a version 2 listening scene. Name the listener, foreground, supports and event times. Give explicit descriptions such as “faint”, “equally clear” or “let the thunder cover it once” precedence over word order. “Bring it forward in the mix” changes emphasis. “Move it in front of me” changes position. State an assumed viewpoint in the scene. A menu press usually needs one listener-relative cue.

Search for the source **as heard from this viewpoint**. A canopy-interior turbine suits a pilot. Exterior exhaust suits the listener below. Start from dry, isolated sources for moving emitters. Inspect recorded pass-bys for baked-in motion and `contains` for embedded weather. Make every extra layer justify itself.

Choose the listener the player actually controls. In first person use the current head/camera pose. In third person use the active camera or the game’s chosen listening point. In a top-down game keep screen controls at the listener and place game objects in the world. A roof crossing can fade open rainfall behind the shelter while bringing up drops on the roof above. Use dry mono game inputs when the host engine already spatialises them. For a headphone walk around the player, use the [footstep route or live player](references/footsteps.md) with headphone output.

For a single sound, start with `node scripts/choose.mjs "rain only" --clean`. Plain “rain”, “thunder”, “cockpit” and “fire” each resolve to one dry performance. A named location sets the listening position. Add another emitter when the brief calls for a second audible event. A steady loop supplies its own variation, and a recorded performance can already include a contact and its decay. Inspect `components`, `contains` and review flags before adding layers.

For a scene brief, describe the object and its performance in `query`. Put its path, obstruction and duration on the layer. Read the chooser's warnings before delivery. An `approximation` names a detail the original recording cannot verify. Use `exactSource: true` on a layer when that detail matters. If the decision is `review`, `audition` can preview independently playable layers while you resolve the missing source. Use the complete `design` for the finished scene. [Scene briefs](references/listening-scenes.md#resolving-a-written-brief)

For a moving scene, locate each physical source once. For example, a nearby turbine can stay behind the pilot while thunder starts 650 metres front-left and rain hits the canopy. Use `acoustics.distanceM` and `acoustics.direction` for fixed sources or a world-space `placement.path` for motion. Set `balance: "natural"` to preserve the resulting distance and obstruction cues. Render the dry solo if a layer seems to have an unwanted sound.

For long rain, flame or a steady motor, prefer a catalog loop with `sustainMode: "evolving"` and set the layer's `durationSec` to the full shot. For immersion or a window opening, keep the same emitter running and automate its `muffle` or `placement.obstruction`. Time a single recorded crossing gesture to contact. Audition the quiet foreground and the exposed background for several original loop lengths. Listen for a returning drip, a doubled splash or a sharp tick that gives away a join.

Use the [listening scene guide](references/listening-scenes.md) to resolve a brief, render headphones/stereo/mono, inspect the combined bed at the listener, or install independent live emitters. Name each layer once and keep its label across edits. Across a picture cut, keep running sources on the same timeline and mark the new listener position with `cut: true`. Choose and save the simplest scene that meets the brief. For “a jet in a storm” start with the engine as the subject. For “a storm with a barely audible jet” prioritise the weather, set the jet's distance from the viewpoint and audition its quiet level. For interactive games the listener and emitters can move after playback starts. Natural balance follows distance. Directed balance can ease down an adjustable background when a moving camera brings it over the subject. Preserve locks and report audible conflicts.

When a finished recipe includes more than the shot needs, try `node scripts/search.mjs --parts ocean-breaker-at-a-rock-ledge --intent "breaking surf" --json`. This finds isolated one-component performances using recordings credited to the larger recipe. Audition the candidate at scene gain.

For a series of demos, save an approved physical click or swipe with `score-edit.mjs profile` and reuse that profile across episodes. Keep the same switch for navigation, confirmation and Undo on the same mouse. A phone screen can stay quiet through all three. Add a tick when the brief calls for feedback. Use `recut` for a new edit, and `audition --source-frame FRAME --quieter` when a single keystroke might already be audible. Check the exported picture with `score-edit.mjs audit` and listen to marked moments against the original at normal and low levels. [Picture scoring guide](references/launch-audio.md#carry-an-approved-sound-into-the-next-edit)

## 1. Search for the closest performance

For footsteps, choose the delivery first. One plant, a timed walk and a live animation marker use the same recorded takes. Use the [movement guide](references/footsteps.md) for surface selection, alternating feet, turns, wetness and listener direction. A change of ground keeps the character’s stride history. For a walk that breaks into a run, use a route with `transitionSteps` to let pace and effort change together.

Choose the audible event before choosing layers. For a concrete brief, use `node scripts/choose.mjs "settings tab" --isolated`. Give it one short phrase per requested sound. Keep controller bindings, narrative motivation and delivery instructions separate from the audible description. A `single-cue` result is ready to audition. A `review` result shows words the catalog could not substantiate. Inspect those or invent the missing performance. For a fixed environment use `--scene`; a saved arrangement qualifies only when its source layers cover the requested cues without extras. For live actions, keep their triggers independent.

For recurring sessions, reuse a project selection profile with its palette and use-specific votes. Resolve an unchanged screen or explicitly silent gesture as silence. When a brief returns review, ask about the missing physical action. For a product trailer or interface, name the action on screen. Try `node scripts/choose.mjs "title card lands" --clean`. The returned `editorial.action` explains whether the cue fits a press, tab change, swipe or title landing. Use one contact per input. Treat “high energy” as a faster edit. Use a portal or shield when that object appears or the creator asks for its sound. A quiet cut can stay silent. The [launch audio guide](references/launch-audio.md) includes a timed example and review guidance. When a cue has a `spatial.design`, save that object as a scene and pass it to `scripts/remix.mjs --spec`. An explicit pass-by can move any selected source. A short contact sounds once during its own travel. When the agent returns a `spatial.file`, render that file instead.

Start with the game event, surface, perspective and foreground/background role. For everyday requests use `--intent "clicky switch settings tabs" --limit 3` to rank partial matches and synonyms. Optionally add `--exclude "arcade jingle"` to filter matching metadata words. Add `--designs` to find multi-layer JSON arrangements and pass the returned file to remix with `--spec`. Plain positional search requires all supplied words. Broaden the query if the first one returns nothing. Each catalog entry supplies an ID, duration, loop flag, tags, controls, and recording credits when relevant. Search also matches credited recording titles. For annotated cues, inspect `contains`, `perspective`, and `markers` to choose a specific moment in the performance.

```sh
node scripts/search.mjs seed planting --json
node scripts/search.mjs rain --loop --json
node scripts/search.mjs --collection "Farm · Harvest" --json
```

For a scene, establish who is listening and list only the requested physical events. Start a realistic mix with `balance: "natural"`, `scope: "world"` and `sourcePolicy: "clean"`. Give each emitter a location and its own acoustic path. Naming a foreground subject measures how well it carries. A pilot in a dry cockpit needs one engine. For a jet in a thunderstorm, keep that same engine running, add one rain performance on the canopy and place the thunder at its actual range. Schedule the flash at emission. The sound arrives later. Reserve directed focus or a handoff for an explicit editorial request. [Listening scenes and example brief](references/listening-scenes.md)

Use `node scripts/search.mjs --clean --intent "canopy droplets"` for independent stems. A review result from `choose.mjs --brief` identifies a missing or overlapping event. Review `missing[].candidates` for material, isolation or timing evidence. Keep the IDs in `resolvedLayers` for the layers that already fit. Audition or create the missing performance before rendering the complete scene. Field recordings can contain multiple events. Check their solo before adding them to a scene. For a headphone preview of one selected sound, use `node scripts/remix.mjs <id> --orbit --format wav --dest ./audio`.

For a foreground game effect, search with `--isolated` first. That subset uses designed sounds, stationary textures measured from real motors, and tightly cropped impact attacks. If the isolated subset lacks the performance you need, try `--background-checked` to find field cues screened for speech and keyboard-like sounds across four seeds at three parameter settings. This filter matches the reviewed audio fingerprint and omits cues with an outstanding listening note. An unfiltered JSON search includes the cue’s `auditionNote` when relevant. Solo the actual export at game gain, especially after changing pitch, extending a tail, or looping a quiet passage. For other field recordings, audition the source for conversation, typing, traffic, and room sound before choosing it. Keep incidental sounds out of the asset and add ambience separately in the game. Pass `--clean` through install, remix or the listening desk to require isolated sources without open review flags. The listening desk adds a comparison background only when `--bed` is supplied.

```sh
node scripts/search.mjs interceptor --isolated
node scripts/search.mjs moored hull --background-checked --json
node scripts/remix.mjs --spec references/scenes/dogfight-cockpit.json --isolated --format wav --dest /absolute/game/audio
```

For a close match, install only the required IDs. Playback helpers accept three-variant pools, positions, and live loop controls. The game still needs to call the helper on its actual success, collision, movement or state transition. Use one persistent player per repeating event where appropriate.

```sh
node scripts/install-sfx.mjs plant-large-seeds light-rain-loop --project /absolute/path/to/game
node scripts/install-sfx.mjs plant-large-seeds --engine wav --dest /absolute/path/to/game/audio
```

Supported explicit engines are `web`, `godot`, `unity`, `unreal`, `python` and `wav`. Check the installed adapter's README for scene setup. For a source-only TypeScript installation in a web game use `node scripts/install-sfx.mjs plant-large-seeds --dest /absolute/path/to/game/src/audio`. The importer copies shared dependencies once and detects conflicting edits. Installed audio is a game-owned snapshot.

## 2. Sculpt and remix

Try the closest complete performance on its own. Search results are alternatives. Add a layer only for a distinct requested action, missing timing cue or audible perspective. A wooden-floor step already includes the sole. Start a fireside thunderstorm with fire and thunder; give optional wind an explicit `under` level relative to the fire. For keyboard and pointer gestures, transition sync points, and measured background levels, see [launch audio](references/launch-audio.md).

Start a scene by identifying its foreground, listener position, background and emotional change. Use a `calm` or `dramatic` mood with an explicit layer role and native performance controls when appropriate. For a sustained handoff, join two layers with `afterLayer.crossfadeSec`. Tune pitched layers to a shared `tonicHz` only when their source pitches are known. Check the same seed and timing in both moods. [Scene intent, tuning and blind comparisons](references/scene-intent.md)

For settings tabs, focused controls, inventory drops and non-vocal game feedback, see [tactile menus and event hooks](references/menu-design.md). Use a short physical confirmation for local success. Give advisory and warning states distinct non-vocal rhythms. Keep high-priority events intelligible above weather and motion beds. Use the recipe's native parameters for the action itself. Use macros for the listener's perspective, scale and room. Their exact schema is available at the root of [catalog.json](catalog.json).

| Control | Range | Meaning |
| --- | --- | --- |
| `punch` | 0–1 | Emphasize the attack |
| `size` | 0–1, neutral 0.5 | Weight in the low band |
| `distance` | 0–1 | Muffle and soften the direct signal, add a return |
| `space` | `dry`, `small_room`, `hallway`, `outdoor_open`, `canyon_echo`, `underwater` | Reflection timing and coloration. Existing `outdoor` and `cavern` presets also work |
| `wetness` | 0–1, default 0.5 | Level of treatment. Zero suppresses reflections and underwater coloring |
| `grit` | 0–1 | Blend in saturation |
| `speed` | 0.25–4× | Pace and duration |
| `pitchShift` | −24 to +24 semitones | Pitch independent of pace |

```sh
node scripts/remix.mjs plant-large-seeds --id greenhouse-seeds --params '{"force":0.3}' --space small_room --wetness 0.25 --format wav --dest /absolute/game/audio
```

Fit a one-shot to an animation with `--fit-seconds 0.18`. For 2–4 layers, use a JSON design. A layer can use `fitSec` for a full retime, `durationSec` to crop or sustain a loop, and `afterLayer` to follow or overlap a named predecessor. Gains are linear. Offsets are seconds. Leave one audible layer at zero. The first layer supplies the mix and spectral brief. Each layer accepts its own `params` and `macros`. An all-loop stack with zero offsets and unbounded layers stays loopable. Use cue landmarks, gain envelopes, and a gradual filter change to join events. The scene guide includes nested JSON arrangements, ready-to-render designs, live event installers, and a blind listening desk. [Scene design](references/scene-design.md)

```json
{
  "id": "sowing-by-hand",
  "layers": [
    { "id": "plant-large-seeds", "params": { "force": 0.35 } },
    { "id": "grass-footstep", "gain": 0.14, "offsetSec": 0.12 }
  ],
  "macros": { "space": "outdoor_open", "wetness": 0.18 }
}
```

```sh
node scripts/remix.mjs --spec /absolute/path/design.json --format ts --extremes --dest /absolute/game/src/audio
```

Use `remix --spec design.json --inspect` to check layer timing, markers and controls before rendering. The tool runs QA before publishing. Use `ts` for editable playback, `wav` for PCM or sample-accurate looping, `ogg` for Vorbis and `opus` for compact delivery. Both compressed formats require local FFmpeg. Read the JSON result for the file, checksum and errors. Editable recipes retain their credits. For exported audio preserve the manifest or the credits returned by the remix CLI.

## Music

```sh
npm run --silent music -- template --style chamber --id opening > plan.json
npm run --silent music -- inspect plan.json
npm run --silent music -- arrange plan.json --dest /absolute/game/audio
```

Choose the palette for the cue. Use `chamber` for acoustic interplay, `groove` for syncopated keys and drums, `ambient` for a sustained bed, `menu` or `arcade` for game loops, and `cinematic` for the large ensemble. Edit motifs, keys and chords in the plan. Add an instrument via `parts` and put `carry: true` on a statement that needs to sustain into the next section. Check harmony, register and motif entries before export. [Music workflow](references/music-workflow.md)

To play a catalog effect as music, declare a `recipe` instrument in `parts`. Use `note: "hit"` for percussion or set `root` to transpose a known pitch. Set `backing: false` to use only your declared parts. [Catalog-only score](references/music/catalog-miniature-plan.json)

For gameplay-driven music, route states to named sections. Run `music -- inspect routing.json` to see where state changes land, then `music -- adaptive routing.json --dest /absolute/game/audio`. Use `scene:preview` to combine music with catalog cues and existing layered designs. Use `alignMarker` to land a sound's contact on a beat. [Shared scene workflow](references/music-workflow.md#review-the-cue-in-its-game-mix) · [Adaptive routing](references/music-workflow.md#adapt-music-to-the-game)

## 3. Invent, verify and wire it in

For interactive actions, trigger the movement from player input and the contact from the game event. Keep continuous loops running as speed, load or depth changes. Compare candidates with a shared background and ten seeded performances using `npm run audition`.

Use the [cookbook](references/sound-design-cookbook.md) to start a genuinely new cue. Choose relevant recorded transients from the [source inventory](sources/recordings.json). If an inventory entry has `supersededBy`, use that repaired recording for new layers. Each recipe default-exports a `SoundRecipe`. Size the output to `ctx.frames`, use `ctx.sampleRate` and derive variation from the supplied seed. Return finite PCM samples. Test the actual file before adding it to the game.

```sh
npm run --silent qa -- --file /absolute/game/src/audio/recipes/sowing-by-hand.ts --both-levels --extremes
```

For a studio addition, create an isolated recipe under `recipes/`, add a `review` ticket with its collection, and run `npm run catalog`. A revised reviewed cue gets a higher ticket revision so the local desk asks for a fresh vote. The compact release checksum set is in [qa/release-masters.json](qa/release-masters.json).

For browser playback, import the installed recipe and reuse a player after the browser's first audio gesture. Fixed seeds reproduce a render. Calling `play()` cycles variants and adds small pitch and filter changes.

```ts
import seeds from './audio/recipes/plant-large-seeds.ts';
import { SfxPlayer } from './audio/engine/index.ts';

const planting = new SfxPlayer(audioContext, seeds, { level: 'balanced' });
planting.prime();
// In the game's successful-planting handler:
planting.play();
```

`SfxBedBlend` crossfades two weather loops. For event priority and vehicle roles, see [event audio](references/event-audio.md) and the [vehicle map](references/3d-audio-map.json).
