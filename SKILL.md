---
name: lumina-sfx
description: Create offline game audio. Find and shape effects, produce recorded or animation-driven footsteps, layer timed scenes, synthesize original cues, and compose or adapt instrumental music for gameplay. Export WAV masters, stems, or editable game audio with playback helpers.
---

# Lumina SFX

Run commands from this skill's directory with Node.js 22.12+. Use an absolute game path for `--project` or `--dest`. Search, synthesis, WAV export and QA work offline. Keep editable JSON and seeds for revisions. Include the runtime MIT notice when shipping its code and retain source credits in editable assets or delivery metadata. [License](LICENSE)

## Sound effects

```sh
node scripts/choose.mjs "settings tab" --isolated
node scripts/remix.mjs settings-tab-walnut-detent --inspect
node scripts/remix.mjs settings-tab-walnut-detent --id menu-tab --format wav --dest /absolute/game/audio
```

Describe one audible action per argument to `choose`. Use `--scene` for a fixed mix and keep live triggers independent. A `review` result identifies words the catalog could not substantiate. Use `search.mjs --intent "…" --limit 3 --json` for alternatives. Start foreground cues with `--isolated`. For atmospheres, `--background-checked` finds field recordings screened for incidental sounds. Solo the rendered take at game gain before using it.

For layered effects, write a small design using catalog IDs. Run `remix --spec design.json --inspect` to check controls, offsets, markers and fades, then render the same design. Add a layer for a distinct action, timing cue or perspective. Use `fitSec` for animation timing and named anchors for contacts and crossfades. [Editable scenes and controls](references/scene-design.md) · [Tactile menus](references/menu-design.md) · [Launch audio](references/launch-audio.md)

For an existing cue that already fits, install only the needed IDs with `node scripts/install-sfx.mjs <id> --project /absolute/game`. Choose `--engine web|godot|unity|unreal|python|wav` when needed. Bind one-shots to the actual game event and reuse persistent loop players. For live controls and source-only installs, see the [scene workflow](references/scene-design.md#wire-actions-to-the-game).

For footsteps, use `footsteps` to render a contact or timed route, or `FootstepPlayer` to trigger each plant from animation. Choose the ground under each foot and keep one player's alternating history across surfaces. Use `transitionSteps` to ease into a new gait in an authored route. [Movement guide](references/footsteps.md)

## Music

```sh
npm run --silent music -- template --style chamber --id opening > plan.json
npm run --silent music -- inspect plan.json
npm run --silent music -- arrange plan.json --dest /absolute/game/audio
```

Choose the palette for the cue. Use `chamber` for acoustic interplay, `groove` for syncopated keys and drums, `ambient` for a sustained bed, `menu` or `arcade` for game loops, and `cinematic` for the large ensemble. Edit motifs, keys and chords in the plan. Add an instrument via `parts` and put `carry: true` on a statement that needs to sustain into the next section. Check harmony, register and motif entries before export. [Music workflow](references/music-workflow.md)

To play a catalog effect as music, declare a `recipe` instrument in `parts`. Use `note: "hit"` for percussion or set `root` to transpose a known pitch. Set `backing: false` to use only your declared parts. [Catalog-only score](references/music/catalog-miniature-plan.json)

For gameplay-driven music, route states to named sections. Run `music -- inspect routing.json` to see where state changes land, then `music -- adaptive routing.json --dest /absolute/game/audio`. Use `scene:preview` to combine music with catalog cues and existing layered designs. Use `alignMarker` to land a sound's contact on a beat. [Shared scene workflow](references/music-workflow.md#review-the-cue-in-its-game-mix) · [Adaptive routing](references/music-workflow.md#adapt-music-to-the-game)

## Verify and invent

Use `audition` for level-matched listening and read the actual export report for timing, peaks and loop bounds. Check short effects in succession, transitions with nearby effects, and stems when the source of a problem is unclear. [Listening workflow](references/scene-design.md#listen-in-context)

When the bank lacks a performance, use the [synthesis cookbook](references/sound-design-cookbook.md) and [source inventory](sources/recordings.json). Export a `SoundRecipe` with exactly `ctx.frames` finite samples and use the supplied seed for variation. Test the resulting file before wiring the event.

```sh
npm run --silent qa -- --file /absolute/game/src/audio/recipes/new-cue.ts --both-levels --extremes
```

For a studio addition, put the recipe in `recipes/`, add a `review` ticket with its collection and run `npm run catalog`. Raise the ticket revision after changing a reviewed cue so it gets a fresh listening pass. Release checksums live in [qa/release-masters.json](qa/release-masters.json).
