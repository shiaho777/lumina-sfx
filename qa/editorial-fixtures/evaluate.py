"""Forward-test the scorer on the encoded pictures, rendered stems and final preview mixes."""
import argparse
from array import array
from collections import Counter
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
RATE = 48000
FPS = 30
SPF = RATE // FPS
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("media", type=Path, help="Output directory of make-films.mjs")
parser.add_argument("--studio", type=Path, default=HERE.parents[1], help="Lumina SFX checkout")
args = parser.parse_args()
repo = args.studio.resolve()
media = args.media.resolve()
review = Path(tempfile.mkdtemp(prefix="score-review-", dir=media))
ffmpeg = (os.environ.get("FFMPEG_PATH") or os.environ.get("FFMPEG") or shutil.which("ffmpeg")
          or str(Path.home()/".local/share/lumina-sfx/tools/ffmpeg"))
observations = json.loads((HERE/"observations.json").read_text())
expectations = json.loads((HERE/"expectations.json").read_text())


def score(*arguments):
    result = subprocess.run(
        ["node", "--experimental-strip-types", str(repo/"scripts/score-edit.mjs"), *arguments],
        env={**os.environ, "FFMPEG_PATH": ffmpeg}, capture_output=True, text=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)


def decode(path, *arguments):
    return subprocess.check_output([ffmpeg, "-v", "error", "-i", path, *arguments, "pipe:1"])


def channels(path):
    # Use the same stereo conversion for the original and its preview.
    values = array("f")
    values.frombytes(decode(path, "-vn", "-ar", str(RATE), "-ac", "2", "-f", "f32le"))
    if os.sys.byteorder != "little":
        values.byteswap()
    return values[::2], values[1::2]


def db(amplitude):
    return 20 * math.log10(max(1e-8, amplitude))


def window(signal, first, last):
    return signal[first*SPF:(last+1)*SPF]


def rms(signal):
    return math.sqrt(sum(v*v for v in signal) / max(1, len(signal)))


def peak(signal):
    return max((abs(v) for v in signal), default=0)


def audio_attacks(signal, first, last):
    # Detect separate key contacts using 5 ms RMS and a 25 ms quiet gap.
    data = window(signal, first, last)
    block = RATE // 200
    threshold = max(.0005, peak(data)*.02)
    previous_active = -RATE
    detected = []
    for i in range(0, len(data), block):
        if rms(data[i:i+block]) > threshold:
            if (i-previous_active)/RATE > .025:
                detected.append(first + i/SPF)
            previous_active = i
    return detected


def picture_events(path, film, check):
    width, height = 320, 180
    size = width * height
    raw = decode(path, "-an", "-vf", f"scale={width}:{height}", "-pix_fmt", "gray", "-f", "rawvideo")
    check(len(raw) == film["durationFrames"]*size, "Decoded source has the marked frame count")
    for event in film["events"]:
        frames = event.get("keyFrames", [event["frame"]])
        for frame in frames:
            now, prev = frame*size, (frame-1)*size
            changed = sum(abs(a-b)>12 for a,b in zip(raw[now:now+size], raw[prev:prev+size]))
            label = f"Picture {event['id']} at frame {frame}"
            if event["action"] == "hold":
                check(changed < 4, label + " stays still")
            else:
                check(changed >= 4, label + " changes")


def exercise(name, film, oracle):
    directory = review/name
    directory.mkdir()
    source = media/name/"source.mp4"
    timeline = directory/"timeline.json"
    timeline.write_text(json.dumps({"fps":FPS, **film}))
    failures = []
    def check(condition, description):
        if not condition:
            failures.append(description)

    picture_events(source, film, check)
    picture = score("inspect", source, "--out", directory/"inspection")
    expected_audio = name in ("estuary", "swatch")
    check(picture["audioStreams"] == int(expected_audio), "Source audio track count")
    plan = directory/"plan.json"
    stem = directory/"stem.wav"
    mix = directory/"preview.mp4"
    score("plan", timeline, "--out", plan)
    score("render", plan, "--out", stem)
    score("mix", source, "--stem", stem, "--out", mix)
    source_picture = decode(source, "-map", "0:v:0", "-c", "copy", "-f", "hash")
    mixed_picture = decode(mix, "-map", "0:v:0", "-c", "copy", "-f", "hash")
    check(source_picture == mixed_picture, "The preview preserves all encoded source picture packets")
    cues = json.loads(plan.read_text())["cues"]
    by_id = {c["id"]:c["decision"] for c in cues}
    check(Counter(c["id"] for c in cues)==Counter(e["id"] for e in film["events"]),
          "Every marked event receives exactly one decision")
    for group in oracle["groups"]:
        decisions = [by_id.get(i) for i in group]
        check(decisions.count("play")==1 and all(v in ("play","silence") for v in decisions),
              "One audible contact for " + " + ".join(group))
    for event in oracle.get("silent", []):
        check(by_id.get(event)=="silence", f"{event} stays silent")
    for event in oracle.get("optional", []):
        check(by_id.get(event) in ("silence","play"), f"{event} resolves to an editorial choice")
    for event in oracle.get("reuse", []):
        check(by_id.get(event)=="reuse", f"{event} reuses its source")

    left, right = channels(stem)
    mono = array("f", ((a+b)*.5 for a,b in zip(left,right)))
    check(abs(len(mono)-film["durationFrames"]*SPF)<=1, "Stem duration matches the frames")
    check(peak(left)<.999 and peak(right)<.999, "Stem has peak headroom")
    power = (rms(left)**2 + rms(right)**2) / 2
    fold_db = db(rms(mono)/math.sqrt(max(1e-12,power)))
    check(fold_db > -3, "Mono fold retains at least half of stereo power")
    audible = {}
    for a,b in oracle["peaks"]:
        level = db(peak(window(mono,a,b)))
        audible[f"{a}-{b}"] = round(level,1)
        check(level > -48, f"An audible event survives mono at frames {a}–{b}")
    for a,b in oracle["noAttack"]:
        # The expectation windows leave room for the previous marked contact to decay.
        level = db(peak(window(mono,a,b)))
        check(level < -48, f"An unmarked onset appears at frames {a}–{b} ({level:.1f} dBFS)")
    for event in film["events"]:
        if event["action"] == "type":
            keys = event["keyFrames"]
            attacks = audio_attacks(mono, keys[0]-2, keys[-1]+4)
            check(len(attacks)==len(keys) and all(abs(a-k)<=1 for a,k in zip(attacks,keys)),
                  "Each visible typed character gets one discrete attack within one frame")
        if event["action"] == "paste" and by_id.get(event["id"]) == "play":
            frame = event["frame"]
            attacks = audio_attacks(mono, frame-2, frame+8)
            check(len(attacks) <= 1, "Pasted text avoids a typing train")
    if oracle.get("travel"):
        early = window(left,44,48), window(right,44,48)
        late = window(left,51,55), window(right,51,55)
        check(rms(early[1])>rms(early[0]) and rms(late[0])>rms(late[1]),
              "The audible movement travels left with the picture")

    comparison = {}
    if expected_audio:
        original = channels(source)[0]
        mixed = channels(mix)[0]
        # Source-only ranges identify dialogue attenuation, fixed offsets or missing Foley.
        source_only = (0,18) if name=="estuary" else (53,56)
        a,b = source_only
        x,y = window(original,a,b), window(mixed,a,b)
        xy = sum(v*w for v,w in zip(x,y))
        xx = sum(v*v for v in x)
        yy = sum(w*w for w in y)
        correlation = xy/math.sqrt(max(1e-15,xx*yy))
        delta = db(rms(y)/max(1e-8,rms(x)))
        comparison.update(sourceCorrelation=round(correlation,4),sourceLevelChangeDb=round(delta,2))
        check(correlation > .97 and abs(delta) < 1, "Original audio survives in the preview at its source level")
    if oracle.get("quieterUnderSpeech"):
        direct = {**film, "fps":FPS, "events":[{**e, "underSpeech":False} for e in film["events"]]}
        alternative = directory/"unattenuated.json"
        alternative.write_text(json.dumps(direct))
        compare_plan, compare_stem = directory/"unattenuated-plan.json", directory/"unattenuated.wav"
        score("plan", alternative, "--out", compare_plan)
        score("render", compare_plan, "--out", compare_stem)
        score("mix", source, "--stem", compare_stem, "--out", directory/"unattenuated.mp4")
        reference = channels(compare_stem)[0]
        changes = []
        for a,b in oracle["peaks"]:
            delta = db(rms(window(left,a,b))/max(1e-8,rms(window(reference,a,b))))
            changes.append(round(delta,2))
            check(delta<=-3, f"Cue at {a}–{b} is quieter under narration")
        comparison["narratedCueDeltasDb"] = changes
    return {"failures":failures, "decisions":by_id, "monoFoldDb":round(fold_db,2),
            "peakDbfsByFrameWindow":audible, **comparison}


results = {name:exercise(name, film, expectations[name]) for name,film in observations.items()}
(review/"results.json").write_text(json.dumps(results, indent=2)+"\n")
print(review/"results.json")
for name,result in results.items():
    print(name, "PASS" if not result["failures"] else ", ".join(result["failures"]))
raise SystemExit(int(any(result["failures"] for result in results.values())))
