# Sound for product films and screen recordings

Cut to the gesture the viewer sees. One key-down fits one appearing character. Use key-up for a visible release, a recorded-contact typing phrase for text arriving together, or repeat individual strokes at the timestamps in the edit. Keep a held key quiet between its press and release. Space, Return and modifier chords have their own performances.

| Edit | Starting point |
| --- | --- |
| A close shot of a real keyboard | Search for its mechanism and the action, such as `office membrane return`, `laptop scissor key down` or `click jacket typed word`. |
| A cursor lands or clicks | Pick the actual input, such as a mouse press, trackpad press or stylus release. One UI activation normally needs one contact. |
| The layout moves | Use a left or right swipe for travel, a whip for a fast cut or a page wipe for a longer handoff. The swipe direction describes the direction of the sound. |
| A title settles on a frame | Ask for “title card lands”. Align the `settle` marker to the landing frame. Use a title rise for upward motion, or a logo close for an end card. Audition under dialogue or music at delivery volume. |

```sh
node scripts/search.mjs --isolated --collection "Launch video" --intent "quiet laptop keyboard key down" --limit 3
node scripts/search.mjs --isolated --intent "silk swipe left" --limit 2
node scripts/remix.mjs silk-panel-reveal --id title-arrives --fit-seconds 0.32 --isolated --format wav --dest /absolute/edit/audio
```

An energetic cut calls for a faster pass. A portal opening on camera calls for the sound of the portal. When the brief only names the medium, inspect the picture or ask what moves. The edit can stay quiet while text is being read.

| Picture cue | Listen for |
| --- | --- |
| Focus, then a tab change | A light tick on each actual focus change. The tab gets a firmer contact. Check three changes in quick succession for fatigue. |
| Apply or save | One seated click timed to acceptance. A pitched notification belongs with an arriving message or an explicit request for that color. |
| Typing, a panel slide, then a title | Type a short word, leave room, move across the frame, land once. The [three-cue product trailer](scenes/product-trailer-interface-edit.json) has independent levels and sync points. |

A listening vote applies to the take as heard. With `search.mjs --intent ... --votes votes.json --json`, check `review.currentRevision`. A remaster needs a new listen. Compare the alternatives for the same visible action over the actual edit at delivery volume.

## Score a finished edit

1. Inspect the supplied cut. `inspect` writes a contact sheet, its presentation timestamps, and a listening copy of the first original audio track when present. Open the sheet, play the audio, and scrub to individual frames for precise contacts. Use the edit's project frame rate, including fractional rates such as `"30000/1001"`. A contact sheet samples a movie and cannot infer its actions. When existing input audio is ambiguous, mark it for review.
2. Write the observed gestures into a JSON timeline. [Generate and Settings](edits/generate-settings.json) and [Palette study](edits/palette-study.json) are complete examples. The first edit needs three contacts over ten seconds. Text generation and the logo fade stay quiet. The second needs irregular mechanical typing, a pickup, a snap and an intentional sweep. Its Preview click is already in the original.
3. Render the planned stem, mix it with the source and audition the whole cut at normal listening volume. Compare the optional accent against removing it. Check a phone or mono fold for clarity. Preserve any original music, narration or Foley at normal level. A film can use a single contact or stay silent for an entire passage.

From the skill directory:

```sh
npm run score:edit -- inspect source.mp4 --out picture-review
npm run score:edit -- plan events.json --source source.mp4 --out cues.json
npm run score:edit -- render cues.json --out sfx.wav
npm run score:edit -- mix source.mp4 --stem sfx.wav --out scored.mp4
```

Planning from markers and WAV rendering use Node. With `--source`, the planner measures stereo energy and peaks in 50 ms windows around each contact using FFmpeg. Mark speech spans independently. With markers alone it can apply a 6 dB speech trim. Picture inspection and MP4 delivery additionally use local FFmpeg. Set `FFMPEG_PATH` if it is outside PATH. `mix` uses the first video and audio stream and accepts a zero-based `--audio-stream` choice for another soundtrack. It creates a new MP4 and keeps the independent SFX stem available. The output directory for inspection and the output media filenames must be new.

| Timeline field | How to spot it |
| --- | --- |
| `id`, `fps`, `durationFrames`, `events` | Use a stable project name, the edit clock and an ordered list of observations. Frame zero is the first video frame. `format` can describe a product, trailer or game menu. |
| Event `id`, `frame`, `action` | Give the action a durable ID. Contacts include `press`, `tab`, `toggle-on`, `toggle-off`, `drag`, `snap`, `confirm`, `back`, `undo` and `redo`. A `label` records what appears on screen. |
| `gesture` | Share this ID between a physical press and its UI consequences. The scorer also recognizes an unambiguous simultaneous press and state change, or successive events on the same named `target` within 80 ms. The most informative change owns the contact. A separate accented movement deserves its own ID when the picture supports it. |
| `type`, `paste`, `stream` | For visible typing, give `keyFrames` as the observed absolute frame of each contact and specify the physical `device`. A paste gets one gesture. Streamed or autofilled text stays quiet. |
| Project or event `device`, `feedback`, `avoid` | Specify mouse, trackpad, mechanical keyboard, touchscreen, onscreen keyboard, stylus or pen side button. A paired state inherits the device. Use `feedback: "subtle"` for deliberate digital feedback, `"none"` for silence, or `avoid: ["chime"]` to veto a timbre. |
| Event `physicalContact` | Mark true for a close shot where the finger pad or stylus tip should be heard striking glass. Use `sourceContact: true` when the original already carries that contact. A stylus with an unidentified mechanism goes to review. |
| `context`, `maxAddedContacts` | `rapid`, `hero` and `speech` rank compatible takes using measured brightness and decay. The planner infers rapid repeats and marked speech. A timeline-wide contact limit reserves higher-priority gestures and keeps manual typing phrases intact. |
| `sourceContact`, `speech` | Use `true` for a contact already in the original or `"uncertain"` to flag a listening decision. Optional project `speech` ranges are half-open frame pairs. `underSpeech: true` softens an individual cue. |
| `syncFrame`, `endFrame`, `direction` | Set the seat or apex to a picture frame. For a moving panel give left/right travel and the motion interval. A brief accent can occupy just the fastest part of a long move. |
| `accent`, `muted` | Optical cuts, panel motion and logos default to quiet. Use `accent: true` for an intentional editorial gesture. Controller focus changes can use a light detent. Passive cursor travel stays quiet. |
| `soundId` | An explicitly selected clean catalog ID can override the product palette for a specific event. Use this when the object, character or visual style warrants it. |

The plan reports `play`, `reuse`, `silence` or `review` per event. Resolve outstanding reviews against the picture before delivery. A project profile can set `palette`, `keyboard`, `useCase`, a relative vote file and `bindings` such as `{"tab":"settings-tab-walnut-detent"}` for a preferred candidate. A specified device on camera takes precedence. Rejections are scoped to the use case and source revision.

To judge a tab, open `listen.html` from the command below. Switch mixes at the same picture time. Only the named cue changes. Alternatives are matched on their measured active level over 35 ms. The omission leaves the original soundtrack audible. **Save choice** downloads a cue-specific change for `revise --changes`. When the cue has one eligible take, the desk compares it with omission.

```sh
npm run score:edit -- audition cues.json --cue settings-tab --source source.mp4 --out tab-listen
```

Approve a cue with `{"id":"settings-tab","lock":true}`. Revisions by action skip locked cues. Use `{"id":"settings-tab","character":"less-bright"}` for a single sharp contact. The scorer selects a compatible darker take or attenuates the high frequencies on the selected take. An explicit `lock:false` reopens an approved decision.

For a targeted revision, an array such as `[{"action":"tab","trimDb":-3},{"id":"reveal","mute":true}]` softens all tab contacts and removes one sweep. A cue ID also accepts `soundId`, `gainDb` or `shiftFrames`. The other performances retain their event time, gain and seed.

```sh
npm run score:edit -- revise cues.json --changes changes.json --out revised-cues.json
npm run score:edit -- render revised-cues.json --out revised-sfx.wav
npm run score:edit -- mix source.mp4 --stem revised-sfx.wav --out revised.mp4
npm run score:edit -- compare scored.mp4 --against revised.mp4 --out compare.html
```

Open the local comparison desk to switch between the two complete mixes at the same point in the picture. Reveal the choices after listening. Keep the quieter version whenever its gesture is equally clear.

## Decide what belongs in the mix

Solo the closest complete performance first. For an indoor wooden step, try `indoor-hardwood-shoe-step` or `hardwood-footstep`. The heel and sole already belong to one step. For a walk, time several takes to the visible feet. A creaky old house can warrant `indoor-floorboard-brief-flex` on a particular weight shift. A normal floor needs no extra cue.

For a fire in a thunderstorm, start with close crackle and one distant roll. The [two-layer design](scenes/fireside-distant-thunder.json) is ready to render. Add wind if it is an audible part of the brief. Place it after the named fire in the layer list, and start it well below the fire:

```json
{ "id": "slow-wind-gusts-loop", "role": "bed", "durationSec": 10, "params": { "swell": 0.2 },
  "under": { "layer": "fire", "byDb": 16 } }
```

When a loop tagged wind or breeze is explicitly assigned the bed role after a foreground marked `focus`, the mixer defaults to 16 dB below that first focus. An explicit gain or `under` overrides that default. Wind can still be the foreground when the scene calls for it.

`under` caps the stem's measured active level relative to an earlier named layer (or its one-based index). The renderer measures the selected take after gain, filters, fades and envelopes. It applies one downward trim across the whole stem, preserving its dynamics and stereo image. Already quiet stems keep their authored gain. This is a relationship across the cue; use an envelope for a specific gust timed to a picture cut. If the additional bed obscures either subject even at low gain, leave it out.

## Pick and audition at the speed of the edit

```sh
node scripts/choose.mjs "thocky mechanical keyboard click" --isolated
node scripts/choose.mjs "silk swipe left" "settings tab" --isolated
node scripts/choose.mjs "fire crackle" "distant thunder" --scene
```

Each quoted phrase describes one audible requirement. In a fixed scene, the selector first looks for a single performance whose `contains` metadata covers every requested component. For example `"heel" "sole" --scene --isolated` selects one indoor step. Put material and direction in the same phrase as the gesture. A keyboard playing under narration still needs a keyboard cue; use gain and filtering to place it under the voice. The selector checks wording against catalog metadata. Its result is a shortlist decision, and an unmatched word is a reason to inspect the candidate.

For a single tab change, compare the chosen cue solo and at the fastest repeat rate players can trigger. Keep one contact per state change. For a shot with both camera movement and a control seating, audition the contact alone first, then compare the version with the swipe at matched foreground level. Keep the second layer if it makes the movement or seating clearer. Align the swipe apex and contact marker to picture. Saved scenes have authored timing; independent game events still need independent triggers.

## Keep an interface consistent

Use `--palette soft` for felt, wood and damped contacts, or `--palette crisp` for glass, porcelain and brighter switches. A project can save its choice and its blind listening votes in a small JSON file.

```json
{"palette":"soft","useCase":"settings","votes":"settings-votes.json"}
```

The votes path is relative to the profile. Omit it until you have votes. Use `scripts/choose.mjs --profile /path/to/project-audio.json "drag handle grabs"` or pass the same profile to search. Create votes with `npm run audition -- settings-tab-walnut-detent settings-subtab-porcelain-tip --clean --use-case settings --out /tmp/settings.html`. Votes apply to that use and recipe revision. A brief can override the project palette.

Use one accepted input event for a timeline tick. Pair grab with release, and choose a snap only when the object actually seats. `silence` skips an uneventful gesture. `review` carries the words that still need a performance. For a version 2 scene, run `npm run compare -- /path/to/scene.json --omit wind --clean --out /tmp/without-wind.html` to hear whether the named support layer improves the mix. The level-matched blind desk compares both renders.

Intent search groups close takes that were checked in listening pairs. Pass `--all-takes` when choosing round-robin variants. Left and right swipes remain available independently. Field ambience can surface when its incidental birds or insects are requested. The clean source policy continues to require isolated inputs.

## Carry an approved sound into the next edit

Pick one click for the physical device and one swipe material for the edit. Opposite swipe directions can use paired takes. Give a particular control its own `family` only when it needs a distinct identity. A held control produces one contact. A typed word uses its observed key-down frames and a little variation from one key to the next.

Pass the source movie when planning. The scorer checks short windows around marked inputs. An identical waveform from the same mechanism can reuse a confirmed original contact. An isolated impulse can also be speech or percussion. A `review` cue stays quiet until you compare the original and added versions. An explicit source observation overrides the detector.

```sh
node scripts/score-edit.mjs plan timeline.json --source cut.mp4 --out score.json
node scripts/score-edit.mjs audition score.json --source cut.mp4 --cue apply --out audition
node scripts/score-edit.mjs revise score.json --changes approved-changes.json --out approved.json
node scripts/score-edit.mjs profile approved.json --out project-audio.json
node scripts/score-edit.mjs recut new-timeline.json --previous approved.json --profile project-audio.json --source new-cut.mp4 --out recut-score.json
```

The audition desk saves a revision ballot. On a source-transient review it can select the original or the added take. A project profile saves the material, source revision, tone and intended trim for locked playing cues. The new cut still measures its own soundtrack. Keep event IDs stable across edits. A renamed event can use `previousId`. An unambiguous action and target also match. Conflicting matches go to review. Picture offsets carry over in seconds when frame rate changes.

Use `brief` for a frame-marked cue such as “mechanical keyboard click during a spoken walkthrough”. Use `keyFrames` for an observed word, `underSpeech` for an exact narration span, and `sourceContact: true` for a known original. When a later press matches a confirmed take from the same device and family, the source scan can reuse it even if the stereo placement changes. Give distinct switches on the same device their own `family` when the difference matters. Explicit timing and device observations take precedence.

## Check the picture you will ship

Use the same approved project profile when cutting a second video. It carries the selected take, seed for repeated switches and transitions, gain trim and treble trim. Let keyboard letters vary within the selected keyboard. A single tap on a phone defaults to silence unless the picture or brief calls for physical or audible feedback.

Align an accented title landing to its visible seat with `syncFrame`. Set `endFrame` to the end of its motion so its fade ends before the following reading hold. Set `accent: true` for a title, wipe, reveal or rise you want to hear. Keep quiet movement explicit.

```sh
node scripts/score-edit.mjs mix original.mp4 --stem sound.wav --out scored.mp4
node scripts/score-edit.mjs audit plan.json --source original.mp4 --stem sound.wav --mix scored.mp4 --out levels.json
node scripts/score-edit.mjs audition plan.json --source original.mp4 --cue name --source-frame 87 --quieter --out listen-to-key
```

The mixer reads the encoded true peak. If AAC overshoots, it applies a fixed delivery trim and encodes again. Its JSON reports the trim and final dBTP. For an independent world scene with a tail longer than the picture, pass `--fit-picture` to fade the stem at the cut. Ordinary edit stems must match the picture clock.

The delivery audit reads the original, authored stem and finished audio together. For each planned contact it reports the measured change in level after encoding, the surrounding original level and a mono phone-band reading. Values in dBFS describe the digital signal. Listen to flagged windows against the picture for masking and excessive prominence. When an original tap falls on a word being typed, audition that frame on its own. The quieter choice trims only that key and retains all neighbouring strokes.


### Reversals, scale and quiet feedback

Use the same target ID for both directions of a panel. Score the visible motion interval for each direction. If the viewer reverses before the first apex, the edit suppresses its unplayed accent. A later reversal ends the previous accent at the turn. Different panels may move together.

A restrained title landing has one recorded paperboard contact. A cinematic impact or hero reveal can use the wider swell and landing. A room full of short physical controls can keep one recognisable switch. For a controller, ordinary focus moves receive less emphasis than the final acceptance. On a phone, request subtle feedback on the specific deliberate action that warrants it. The scorer measures the local soundtrack to leave extra space around that tick in a quiet edit. Explicitly approved project trims take effect after this adjustment.


Use the exported movie to check a claimed direction change or missing click. A listener or online audio preview may fold stereo to mono. Query the start of a pass, the outer marker and the return with `node scripts/score-edit.mjs probe scored.mp4 --at 0.2,3.5,7.3 --window-ms 180 --out stereo.json`. Each window reports decoded channel levels, right minus left in dB, stereo and mono RMS, and peak. In a mixed scene the readings describe everything audible in that window. Probe the positioned solo as well when another sound overlaps. A left/right energy difference cannot establish perceived elevation or front/back localization.

### Apply feedback to one device throughout a film

Read the `signature` from a playing cue. To lower the mouse clicks across navigation and take the sharp edge off the same switch, pass `[{"signature":"press/mouse","trimDb":-3,"character":"less-bright"}]` to `revise --changes`. A family edit applies to unlocked additions. Original contacts, named exceptions and other input devices retain their own decisions. A replacement from the listed swipe alternatives uses the matching left or right take at the speed of the picture.

Mark narrated frame ranges and supply the original movie when planning. Around each marked key the scorer measures how much of the soundtrack sits in the 1.8–4.7 kHz band and how bright the selected attack is. It can trim a competing key by up to a further 4 dB. Listen through the affected word at delivery level to judge intelligibility.


### Match the actual hardware

For a held mechanical Return, mark one physical `press` with `key: "Enter"`. Use `keyFrames` for the visible letters and digits. The ordinary mechanical board uses recorded linear switch travel and a wider Return from the same keyboard model. A UI button labelled Return follows its input device. The trackpad contact and release use individual halves of a MacBook trackpad recording. A filmed tablet nib uses a drawing-tablet recording and a small panel resonance.

The final `audit` groups audible cues by their saved signature and reports material or fixed-take changes with frame numbers. Left and right performances of the same swipe material can share a signature, as can fresh strokes on one keyboard. Mark a genuinely different control with its own `family`. Rapid mouse actions can cross tabs, confirmations and toggles while keeping one switch.

### Moving surfaces and touch feedback

Use the same `target` for both directions when a strip or drawer reverses. Supply each visible leg’s start, accent and end frames. A native sweep can spend longer around the turn while keeping its material and pitch. Set `motion: "follow"` for a continuously audible stroke across its full visible span, or `motion: "accent"` for a short independent accent. For full-span motion, put the sync frame inside the leg. A product demo can keep a long drag silent.

An ordinary touchscreen can stay silent. `feedback: "subtle"` requests one local electronic pulse. `physicalContact: true` requests close Foley from the finger or pen in the shot. For a hardware keyboard, `key: "Space"` selects the wide key’s recorded downstroke. A printed “Space” label and an onscreen keyboard are different events.


### Review a recurring sound in context

Read the cue's `signature` from the plan. The desk opens on the five seconds with the most editable contacts from that family. The transport can also play the full cut. The three mixes share the original soundtrack's playback level. They contain the chosen take, the family omitted, and the family 4 dB lower. Locked exceptions and recorded contacts retain their decisions.

```sh
node scripts/score-edit.mjs audition score.json --source demo.mp4 --signature press/mouse --out mouse-review
node scripts/score-edit.mjs revise score.json --changes cue-choice.json --out approved.json
node scripts/score-edit.mjs profile approved.json --out project-audio.json
```

A saved family-wide mute appears in `quietSignatures` in the project profile. A mute on one cue applies to that edit. A later event with an explicitly requested sound can override the family default.

A profile's `votes` field accepts one path or an ordered list of listening exports. Use `npm run audition -- … --use-case product --context speech` for a listening judgment specific to narration. The other contexts are `normal`, `rapid` and `hero`. Record why the take worked or failed in the desk. Search reports the applicable decision and reason. A current, more specific judgment wins, with later files breaking ties.


For a burst of physical selections, score each visible press and listen through the complete run. The planner can apply one additional trim of up to 3 dB across a rapid switch family. The number of audible presses in its busiest second sets the trim. Isolated presses keep their ordinary level. A featured close-up or marked speech passage keeps its own treatment. The plan reports `densityTrimDb` on affected contacts. When the exported movie has a second distinct attack 60–180 ms after an isolated physical press, its audit can flag `secondAttack` with the likely source. Play that moment in picture before deciding whether to reuse or soften it.

A fully reused soundtrack can survive a final export without another generation of AAC compression. When the studio WAV is exactly silent, the selected original soundtrack spans the picture and the existing true peak is within the delivery ceiling, the mixer attempts to copy the original audio and video packets. The mix receipt reports `audioEncoding: "copy"` when this succeeds.

### Follow a moving element

Mark one horizontal leg with its first frame, end frame and a stable target. Use `accent: true` when the slide deserves sound. For a motion graphic or web animation, supply samples of the same element's x position in pixels or normalized coordinates. Include the start and end. The accent follows the fastest interval and the stereo image follows the measured travel, including asymmetric easing.

```json
{"id":"next-page","action":"slide","target":"gallery","accent":true,"frame":18,"endFrame":42,"travel":[{"frame":18,"x":600},{"frame":22,"x":480},{"frame":27,"x":180},{"frame":34,"x":40},{"frame":42,"x":0}]}
```

For a finished movie, replace `travel` with `"travelRegion":{"x":68,"y":241,"width":1144,"height":350}` using the viewport's coordinates in the decoded picture. Run the ordinary `plan --source` command. The tracker estimates horizontal shifts between frames inside that region. Choose an area that moves with the panel. A dissolve, untextured hold or conflicting direction can require review. Split a reversal into two legs. Mark an explicit `syncFrame` to seat a deliberately stylized cue. With `motion:"accent"` the designer can still use a short accent instead of following the whole movement.

The desktop mouse performances have separately recorded downstrokes and releases. The linear mechanical letters, Space and Return use recordings of one Keychron K10 model from the same recordist. In a routine walkthrough, reuse one mouse take and vary the letters within the one keyboard.
