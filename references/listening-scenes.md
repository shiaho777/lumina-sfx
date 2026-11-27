# Mixing from a listener's perspective

A listening scene places sounds in metres and gives the mix a subject. Source audio, position and emphasis are independently editable. Use one source when one performance already contains the requested event. Keep UI clicks attached to the listener unless they come from a physical control in the world.

The brief resolver keeps screen feedback attached to the listener. A physical keyboard filmed across a room can take a world position. A source named as a flyby, distant take or echo already carries part of its perspective. For a new trajectory, distance or room, the resolver checks compatible alternatives and flags conflicting source evidence for review. Unannotated recordings still need a listen.

## Continuous weather and waterlines

For a long take, give one evolving rain or fire layer the duration of the shot. The renderer can carry the performance across the whole scene and keep the same result for a given seed. Inspect the dry stem across at least three nominal loop lengths. Listen for the same prominent drop, pop or swell at regular intervals.

Keep a boat on one path when a swimmer dives beneath it. Automate the layer's low-pass blend across the listener's entry and exit. Use the recorded entry once, then the recorded shedding of water once on the way out. Align the strongest change of perspective with the water contact. Audition the motor alone through both crossings, then bring the water gestures up just enough to hear their different shapes.

## From a sentence to a mix

1. Choose one listener. Describe the foreground source, the source of each background sound, the distance in metres and the material between each source and the listener. Default briefs use natural balance. The engine, rain and thunder can all run at the same time. A focus label lets you measure masking. Request directed balance if the edit calls for a gain target or a handoff.
2. Use one search phrase per audible event. Include the material/action in `query` and preferred recording characteristics in `prefer`. The agent interprets the sentence. The resolver searches the local catalog and returns a review result when the requested terms cannot be matched. Inspect any embedded sounds before adding support.
3. Save the returned `design`, inspect it, and render. Report the foreground, distance, competing sources, most crowded time and any gain lock that prevents the requested balance. Audition the complete result and its mono fold. The measured margin is a starting point for judgement.

```sh
node scripts/choose.mjs --brief references/listening-scenes/pilot.brief.json
node scripts/remix.mjs --spec references/listening-scenes/pilot-inside-canopy.json --format wav --dest ./mix --report ./mix/report.json --stems ./mix/stems
node scripts/remix.mjs --spec references/listening-scenes/orbit-and-turn.json --dest ./game/src/audio --format ts
npm run scene:install -- references/listening-scenes/orbit-and-turn.json --dest ./game/public/audio
```

For a revision, save a new scene ID and render to a new output path. A game-owned file with different bytes is protected. Scene-wide sound-design macros and style apply to each source before placement, with per-layer overrides. This keeps the dry-stem and fixed-WAV event clocks consistent. Keep labels and the render seed stable to preserve each source take. A fixed clip is one emitter. Ask for separate stems when the game needs the listener to move between objects.

## Scene fields

| Field | Behaviour |
| --- | --- |
| `schemaVersion: 2`, `id`, `layers` | Up to 32 simultaneous named layers and 120 seconds. Use an explicit layer label for repeated IDs. Scene renders cap total source frames to bound memory. |
| `viewpoint`, `listener` | Describe whose ears the mix serves. Pose uses `position: [x,y,z]`, metres, +X right, +Y up, −Z forward. Positive yaw turns right, pitch up, roll tips the right ear up. Angles use degrees. |
| `path` | Add time-ordered poses with `at` in seconds on the common scene clock. The initial pose is at zero. Source and listener may both move. Positive yaw follows the shortest turn between keys. |
| `output` | `stereo` gives speaker pan and distance, `headphones` adds measured binaural direction, `mono` folds the speaker mix. Layer timing stays sample-aligned. |
| `placement.kind` | `point` localises an object, `cone` adds facing, `area` retains a broad stereo field, `listener` follows the listener and preserves the recording. Omitted placement is listener-relative. |
| `refDistance`, `rolloff`, `air`, `spread` | Full level within the reference radius. Higher rolloff reduces distant level. Air adds distance-dependent HF loss. Spread ranges from a localised mono point at 0 to the native stereo bed at 1. |
| `innerAngle`, `outerAngle`, `outerGain` | Cone full angles and outside amplitude. Aim the source using its pose. |
| `doppler`, `obstruction`, `room` | Optional radial-velocity pitch, obstruction from 0–1 or timed pairs, and early room reflections (`small_room` or `hangar`). Obstruction can follow an opening and closing door. Game code supplies the value. |
| `balance`, `scope`, `sourcePolicy` | Natural balance keeps fixed source levels. World scope rejects menu cues. Clean selection requires isolated inputs and excludes unresolved screening leads. Choose mixed scope for requested UI. Field policy permits explicitly selected field recordings. |
| `acoustics` | Set `distanceM`, listener-relative `bearingDeg` and `elevationDeg` at emission, or supply a world position. Select `source` from turbine, vehicle, rainfall, thunder, foley or general. The presets approximate relative strength and reference radius. Through a canopy or wall, the path loses level and high frequencies. |
| `event`, `travel` | Give each physical emitter an event ID. A world mix rejects overlapping copies of a source unless they are explicitly distinct events. One-shot thunder defaults to travel time at 343 m/s. A flash at 0.85 s and a strike 686 m away give an arrival at 2.85 s. Continuous beds start already audible. |
| `focus.subjects`, `marginDb` | In directed balance, subjects are layer labels. The mixer matches overlapping shared subjects by trimming louder ones. It measures the foreground against the summed stereo background at the listener, then applies a steady background trim per section. Default aim is 8 dB. |
| `focus.moments` | Non-overlapping `{from,to,subjects,marginDb?}` sections. For a thunderclap that briefly wins, name thunder during the strike and let the base focus resume afterward. Transitions ease within 100 ms. |
| `gain`, `locked` | Gain is a linear multiplier. Lock a layer to protect its authored gain from automatic focus trimming. The final linked ceiling can attenuate the whole mix. |
| `maskEq` | A small, steady cut in a competing layer. For a low-mid engine hidden by thunder, audition `{"hz":350,"cutDb":3,"q":0.9}` on the thunder. Check the combined and phone-band margins before changing the whole bed. |
| Timing and edits | Use existing `offsetSec`, `durationSec`, `envelope`, `fitSec`, `atMarker` and `afterLayer` controls. Relative anchors still address an earlier layer. The scene clock preserves an intentional silent opening. |

The report gives planned steady margins, actual delivered margins across transitions, mono phone-band margins and the weakest overlap time. Figures use the fifth percentile of active 50 ms windows, with windows gated relative to the subject. Isolated peaks can fall below that margin. Locked beds can make it unattainable. Inspect the audible result before increasing the target.

For an outdoor-to-indoor transition, try the [walk under a steel roof](listening-scenes/rain-under-a-roof.json). The listener follows a continuous path. The exterior rain grows muffled in shelter while drops striking the overhead roof become distinct. Use this distinction for a doorway or a canopy and fit the obstruction curve to the game’s crossing.

## Playback and handoff

For a fixed scene, use the delivered WAV. Apply spatialisation once. A positioned stereo mix already contains the authored camera movement. For an interactive scene, use the dry files and pose, gain and timing data in the manifest. The solo files in a review pack include each layer's spatialisation and focus automation. Place them at their manifest offsets to audition.

After scene installation, copy the two TypeScript player files into your game source if your bundler treats the public folder as static. Deploy the manifest and WAVs together. Run preload during level loading. Resume the AudioContext on a user gesture.

```ts
import { ListeningPlayer } from './audio/orbit-and-turn/live-listening.ts';

const context = new AudioContext();
const url = new URL('/audio/orbit-and-turn/scene.json', location.origin);
const player = await ListeningPlayer.preload(context, url);
playButton.onclick = async () => {
  await context.resume();
  player.play();
};
// During gameplay, this player's poses drive the shared Web Audio listener.
player.setListener({ position: [0, 0, 0], yaw: 90 });
```

Call `setPlacement(label, pose)` on an active emitter and `stop()` to end playback. Equal-power speaker pan and native HRTF are selectable via the scene output. Browser and offline headphone filters have different timbres. Natural balance follows the moving camera. With directed balance, moving the listener or an emitter also updates the level of adjustable backgrounds when they begin to mask an active subject. The estimate uses dry signal power and direct-path gain. Source locks, the subject level and the authored focus timeline still apply. The background recovers as the subject falls silent. Audition the actual scene to check frequency masking and reflections.

| Delivery | Direction and distance |
| --- | --- |
| Web / Three.js | Live panners, head turns, relative motion, spread and area width. The scene owns the Web Audio listener while it runs. Use one listener owner per context. |
| Fixed WAV in any engine | Full listener/source movement, speaker or mono render, or headphone export with the bundled SADIE II human-head measurements. Include the measurement license when distributing the table. |
| Godot 4 | Play dry sources with AudioStreamPlayer3D and a native listener. The manifest already uses Godot axes and metres. Use the helper's scene_pose for facing. Use a 2D player for listener-relative UI. |
| Unity | Map XYZ with FromSceneVector, set ConfigureSceneVoice and schedule a dry AudioSource per object. Multiply authored level by SceneConeGain for a directional speaker. A native spatialiser plug-in determines live headphone response. |
| Unreal | FromSceneMetres maps to centimetres. FromSceneFacing maps angles. Use separate Audio Components and the scene offsets. Choose native attenuation/cone settings or the project's spatialisation plug-in. |
| Pygame | The helper applies stereo pan, listener yaw and distance. Use a binaural WAV for a fixed headphone scene. |

The live manifest stores arrival offsets for the authored listener trajectory. In a game with an independently moving listener, schedule new events from their emission positions and the game clock. Native engines retain their own rolloff curves and game event scheduling. The ready-made manifest player is for Web Audio. For native integration, apply the manifest's restore gain and region gains to dry files, or play the fixed export directly.

## Examples to audition

- **Natural cockpit.** Compare the [dry engine](listening-scenes/dry-cockpit.json) with the [same engine flying through weather](listening-scenes/pilot-inside-canopy.json). Only the wet scene has rain and thunder.
- **Directed comparison.** Compare [engine](listening-scenes/cockpit-engine.json) and [weather](listening-scenes/cockpit-weather.json). They use identical sources, timing and seed. [The handoff](listening-scenes/thunder-handoff.json) gives thunder a short foreground moment.
- **Different ears in the same setting.** Compare [inside the canopy](listening-scenes/pilot-inside-canopy.json) with [the beach](listening-scenes/beach-under-flightpath.json). These also change the chosen recordings.
- **Orbit and turn.** The [turbine](listening-scenes/orbit-and-turn.json) travels around and above the listener, then holds its world position as the listener turns. The orbit contains one turbine. Reuse its trajectory for any catalog source with `node scripts/remix.mjs <id> --orbit --format wav --dest ./audio`.
- **One-line edit.** Compare [fire beside wind](listening-scenes/fire-on-beach.json) with [quieter wind](listening-scenes/fire-quieter-wind.json). All crackles stay in place. [The hangar door](listening-scenes/hangar-door.json) reversibly changes the rain's brightness and early reflections on the same clock.

A [passing bell](listening-scenes/passing-bell.json) crops a single ding from a longer ring and places three contacts along one path. For vehicle load, compare [climbing](listening-scenes/hill-under-load.json) and [coasting](listening-scenes/coasting-in-gear.json). Both hold the same RPM and seed; power demand selects a different blend of motor textures.

If a distant subject disappears, solo it and check for a recording that already sounds far away. Adjust the competing beds first. If a wide source becomes thin in mono, inspect the source's native stereo fold and narrow its spread or choose a more mono-compatible recording. For moving assets with baked-in pitch changes, leave additional Doppler off.


## Longer scenes for headphones

| Scene | What to listen for |
| --- | --- |
| [Hearth at the lodge window](listening-scenes/hearth-at-the-lodge-window.json) | The fire stays still at the left knee. Opening the window on the right lets in rain. Two distant discharges arrive at different bearings and times. |
| [Under the launch](listening-scenes/under-the-launch.json) | The same boat moves overhead while the swimmer dives and resurfaces. The sound changes at the waterline. |
| [Last departure in the rain](listening-scenes/last-departure-in-the-rain.json) | Rain stays overhead as one turbine approaches, crosses the hangar and falls away. Its motion drives Doppler and distance. |

For a stationary source, `"acoustics": {"distanceM": 12, "direction": "rear-left"}` measures direction from the listener at emission. The eight horizontal choices run from `front` clockwise through `front-right`, `right`, `rear-right`, `rear`, `rear-left`, `left` and `front-left`. Use `overhead` or `below` for vertical placement. For other angles, provide `bearingDeg` and `elevationDeg` together with the distance. A changing listener pose rotates the heard direction. A source path supplies the changing world position of a moving object.

### Check focus on the delivered mix

The region report includes 100 ms windows measured in stereo, mono and a 300–3400 Hz phone proxy. Look at the tenth-percentile margin and the weakest window's time and masker. During a handoff, `views` includes the eased gain change and `planned` describes steady regional gains. A natural scene keeps its source levels. Directed balance trims an adjustable source where it helps meet the requested clearance. A locked background can make that clearance unreachable. Preserve the lock and audition the reported moment in the picture.


For a generic field layer, name its emitting surface when the picture supports it. A stove with a roof window can use one steady hearth and one rain-on-glass performance. A layer named for the open air keeps its open-air recording. Put the listener and the physical keys in the same small room when a distant desk is visible. A located keyboard in a named booth or office can pick up short room reflections while its direct sound stays on the correct side. Use the dry space explicitly for a dry microphone perspective. Exact source IDs and explicit layer settings remain available for authored mixes.

### Carry sound through a camera cut

Keep each running motor or weather layer on the scene clock. Put `"cut": true` on a listener path keyframe to move the ear to a new shot at that time. The renderer holds the old viewpoint up to the marked frame and blends the acoustic change over at most 8 ms. The original sample keeps playing. Actual source travel still drives Doppler. For an [example with rain on a porch and a motorcycle at a gate](listening-scenes/porch-to-roadside.json), compare the source balance just before and after 4.15 seconds.


### Preserve the mix around a masking sound

A directed brief with an explicit focus uses `focus.timing: "local"`. A brief burst of interference can have its own mix region. The surrounding rain or room tone recovers after the burst. An agent can use a focus moment to bring the thunder itself forward when the picture calls for it. Locked layers retain their gains. Existing authored designs can opt into local timing, or use `"steady"` to hold one trim per authored region. Listen to the delivered scene on each side of the overlap. The inspection report gives the interval, per-stem trims and playback margins.


## Resolving a written brief

Give each layer a descriptive name. The chooser converts it to a safe ID and updates focus, marker and level references together. Use the output IDs if you edit the design afterward.

For a van passing behind a window, request the van and tire roll as one emitter, then describe the path and obstruction on that layer. A short single call can finish naturally inside its available time window. An explicit fit or exact catalog ID retains its duration constraints. A quiet layer receives a suggested gain when you have left its gain and relative level open.

Check each `warnings` entry in the chooser output. If a source is identified and a secondary detail is undocumented, a catalog-authorized approximation identifies that detail and the evidence. For example, the basketball recording captures the ball striking a wooden court. Its cover material is undocumented. Set `exactSource: true` on the layer to require a complete source match. Even with approximate matching, a request for the wrong surface goes to review.

A partly resolved brief returns exit code 2 and `design: null`. When independent layers are playable, `audition` is a separate natural-balance design you can pass to the remix command to hear those layers. The preview omits layers whose timing or gain depends on an unresolved source. Complete the original brief before installing the scene.
