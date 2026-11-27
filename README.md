# Lumina SFX

An offline sound studio for coding agents. Find a sound among 2,882 editable effects, layer it with others, and export a WAV or wire it into your game. Compose instrumental game music and export an editable score, stereo WAV and track stems.

Describe where the listener is and what they should hear first. A pilot can follow an engine through rain while someone on the beach hears the same aircraft pass overhead. Choose a speaker mix, binaural headphone WAV or independently moving game emitters. [Spatial audio and scene mixing](references/listening-scenes.md)

**New in v1.5.0** — Hear footsteps circle the listener on headphones, move from open rain into shelter, or sync a recorded swipe to a moving panel. [Watch the demo](https://github.com/LuminaBench/lumina-sfx/releases/download/v1.5.0/LuminaSFXv1.5.mp4) · [Release notes](references/v1.5-release.md)

This development fork maintains the native instrument models, editable music scores, and adaptive music workflow. LuminaBench maintains the original repository and sound library. [Upstream repository](https://github.com/LuminaBench/lumina-sfx) · [Music workflow](references/music-workflow.md)

## Listen

| Preview | In the mix |
| --- | --- |
| [▶ Music example](https://cdn.jsdelivr.net/gh/shiaho777/lumina-sfx@studio/.github/previews/music-example.m4a) · 15 s | Piano, solo violin and layered strings synthesized in Lumina. |
| [▶ Upwind](https://cdn.jsdelivr.net/gh/shiaho777/lumina-sfx@studio/.github/previews/upwind.m4a) · 20 s | An original piano and violin hook grows into strings and timpani. [Editable arrangement](references/music/upwind-plan.json) |
| [▶ Heavy rain and close thunder](https://cdn.jsdelivr.net/gh/LuminaBench/lumina-sfx@9451678849c2d3af804f4c8d347f0ae9cc015b28/.github/previews/storm-front.mp3) · 5 s | A gust moves through heavy rain. A close thunderclap breaks over it. |
| [▶ Three shots on steel](https://cdn.jsdelivr.net/gh/LuminaBench/lumina-sfx@9451678849c2d3af804f4c8d347f0ae9cc015b28/.github/previews/pistol-steel-ricochet.mp3) · 2.85 s | Three sharp reports, each answered by a steel impact and a ricochet. |
| [▶ Fireside storm](https://cdn.jsdelivr.net/gh/LuminaBench/lumina-sfx@9451678849c2d3af804f4c8d347f0ae9cc015b28/.github/previews/fireside-distant-thunder.mp3) · 10 s | The fire crackles up close. Thunder rolls in the distance. |

For a demo video, the skill can spot gestures to picture, reuse a recorded click and deliver a separate effects track. [Score a demo edit](references/launch-audio.md#score-a-finished-edit)

## Install

With Git and Node.js 22.12 or newer installed, run this command and select your coding agent.

```sh
npx skills add LuminaBench/lumina-sfx -g
```

Open a fresh agent session in your project and try this prompt.

> Use lumina-sfx to make three clicks for my settings menu. Give me a WAV of each so I can pick one to fit the animation.

<details>
<summary>Update or remove Lumina SFX</summary>

**Update**

```sh
npx skills update lumina-sfx -g
```

Open a fresh agent session after updating. WAVs and recipes already copied into a game keep their existing version. Ask your agent to re-export the cues you want to refresh.

**Remove**

```sh
npx skills remove lumina-sfx -g
```

</details>

## Use it in a project

Export WAVs for any audio editor, or install playback helpers for Web Audio / Three.js, Godot 4, Unity, Unreal Engine 5 and Python / Pygame. Web projects can also use the editable TypeScript recipes.

- **Game music.** Arrange chamber, groove, ambient, menu, arcade or cinematic cues. Export a stereo master and stems, or build an adaptive bank that changes sections on the musical clock. Compare scores on the audition desk and preview them with catalog effects. [Music workflow](references/music-workflow.md)
- **Menus and launch videos.** Fit a click, a typed word or a directional swipe to a cut. [Menu examples](references/menu-design.md) · [Launch audio](references/launch-audio.md)
- **Movement.** Make an eight-step walk on hardwood, run from metal stairs onto snow, or trigger one recorded step per animation marker. [Footstep controls and examples](references/footsteps.md)
- **Games and ambience.** Blend a car engine with road noise, or let a thunderstorm build around a campfire. [Scene recipes](references/scene-design.md) · [Mood and crossfades](references/scene-intent.md)

<details>
<summary>CLI commands for search, remix, export and QA</summary>

Run these from the installed skill directory or a clone of this repository. Replace the example game paths with your own.

```sh
node scripts/choose.mjs "thocky mechanical keyboard click" --isolated
node scripts/choose.mjs "settings tab" --palette soft
node scripts/choose.mjs "fire crackle" "distant thunder" --scene
node scripts/search.mjs rain --loop
node scripts/search.mjs moored hull --background-checked
node scripts/remix.mjs --spec references/scenes/fireside-distant-thunder.json --inspect
node scripts/remix.mjs plant-large-seeds --id greenhouse-seeds --space small_room --wetness 0.25 --format wav --dest /path/to/game/audio
npm run --silent music -- inspect references/music/common-ground-adaptive.json
npm run --silent music -- arrange references/music/upwind-plan.json --no-stems --dest /path/to/game/audio
node scripts/install-sfx.mjs grass-footstep gravel-footstep --engine godot --project /path/to/game
npm run --silent qa -- grass-footstep --both-levels --extremes
```

QA writes a 44.1 kHz, 16-bit preview under `qa/output/master-wav/` and checks peak level, loudness, onset and applicable loop boundaries. WAV and editable TypeScript exports run offline with Node alone. Ogg Vorbis and Opus use a local FFmpeg encoder.

For per-layer gain, timing and sound-design controls, see the [agent workflow](SKILL.md) and [sound-design cookbook](references/sound-design-cookbook.md).

</details>

## License

You can render, modify and ship the sounds in personal or commercial games, apps, videos and demos for free, with no royalties or audio credit required. The engine and tools use MIT, and the sound library license prohibits redistributing, rebranding or reselling the bank or rendered collections as a competing SFX pack, sample library, training dataset or Agent Skill. [Full license](LICENSE)

---

**Support** · [LuminaBench](https://luminabench.com) · [Sponsor LuminaBench on GitHub](https://github.com/sponsors/LuminaBench)
