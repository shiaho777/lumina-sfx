# Picture scoring fixtures

Six original, four-to-five-second cuts contain 30 marked observations. Render the footage on a local machine with Node 22.12+, Python 3, Chromium or Chrome, FFmpeg with libx264, and either the macOS `say` command or eSpeak. The narrator is generated locally for the fixture. No media downloads are needed. Set `CHROME` or `FFMPEG_PATH` for executables outside the normal search paths.

From the project root, use a fresh temporary directory each time.

```sh
films=$(mktemp -d)
node qa/editorial-fixtures/make-films.mjs "$films"
python3 qa/editorial-fixtures/evaluate.py "$films"
```

The HTML contains the six scripted screen performances. The generator captures a real browser frame at each change and encodes each edit at 30 fps. The JSON observations record the editor’s picture marks. The separate expectations were written before the first scorer run. Each required group permits exactly one audible decision. `optional` permits a short cue or silence. Each `noAttack` interval leaves space for earlier contacts to decay.

| Film | Editorial question |
| --- | --- |
| Estuary | Does one tab gesture resolve to one sound under speech, and does the voice keep its original level? |
| Field Index | Do four irregularly spaced keystrokes follow the characters? Does the clipboard avoid a second typing sequence? |
| Halation | Does the sweep move left in stereo and stay audible in mono? Do the ordinary cut and end-card hold stay quiet? |
| Causeway | Do controller focus changes, acceptance and return read as distinct game actions? |
| Clay Room | Does the first tile keep its recorded contact while the second receives a new one? |
| Margin Press | Do the press and acceptance share a contact while automatic rows and a watermark stay quiet? |

Each run creates a fresh `score-review-*` directory under the media folder. Its contents include source inspections, marked timelines, plans, stems, mixed MP4s, a louder narration comparison and machine-readable results. Checks decode the actual pictures and audio, compare submitted frames with visual changes, measure speech gain and source preservation, count the typed attacks and fold stems to mono.

The first run omitted both Causeway focus contacts at frames 28 and 35. After the game-menu focus change, the same expectations passed on all six films. These checks measure timing, mixing and cue decisions. A human listening pass is needed to judge taste or match an editor’s preferred keyboard mechanism.
