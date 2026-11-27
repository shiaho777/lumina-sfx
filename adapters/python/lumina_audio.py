"""Pygame stereo mixer for selective Lumina WAV pools (signed 16-bit PCM)."""
from array import array
from collections import OrderedDict
from math import cos, dist, radians, sin, sqrt
from pathlib import Path
from random import Random
import pygame


class SoundBank:
    def __init__(self, directory, listener=(0, 0, 0)):
        if not pygame.mixer.get_init():
            pygame.mixer.init(44100, -16, 2)
        self.rate, fmt, self.channels = pygame.mixer.get_init()
        if fmt != -16 or self.channels != 2:
            raise ValueError("Initialize pygame.mixer with signed 16-bit stereo")
        self.root = Path(directory)
        self.listener = listener
        self.listener_yaw = 0.0
        self.pools = {}
        self.cursor = {}
        self.cache = OrderedDict()
        self.random = Random()
        self.loops = {}
        self.loop_levels = {}

    def register(self, cue):
        from json import loads
        manifest = loads((self.root / "manifest.json").read_text())
        files = manifest["sounds"][cue]["files"]
        self.pools[cue] = [pygame.mixer.Sound(str(self.root / f["path"])) for f in files]
        self.cursor[cue] = 0

    def _pitched(self, cue, slot, rate):
        key = (cue, slot, round(rate * 48))
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        source = array("h", self.pools[cue][slot].get_raw())
        step = max(1, key[2]) / 48
        frames = len(source) // 2
        out = array("h")
        for i in range(max(1, int(frames / step))):
            pos = min(frames - 1, i * step)
            j = int(pos)
            weight = pos - j
            for ch in (0, 1):
                a = source[2*j + ch]
                b = source[2*min(j+1, frames-1) + ch]
                out.append(round(a + weight * (b - a)))
        sound = pygame.mixer.Sound(buffer=out.tobytes())
        self.cache[key] = sound
        if len(self.cache) > 48:
            self.cache.popitem(last=False)
        return sound

    def set_listener_pose(self, position, yaw_degrees=0.0):
        """Metres, +X right, -Z forward. Refresh all running loops on a head turn."""
        self.listener = position
        self.listener_yaw = radians(yaw_degrees)
        for channel, (_, _, _, source, volume, _) in self.loops.items():
            self._position(channel, source, self.loop_levels.get(channel, volume))

    def _position(self, channel, position, volume):
        distance = dist(position, self.listener)
        right = (position[0] - self.listener[0])*cos(self.listener_yaw) + (position[2] - self.listener[2])*sin(self.listener_yaw)
        pan = max(-1, min(1, right / max(0.05, distance)))
        gain = min(1, max(0, volume)) / max(1, distance)
        channel.set_volume(gain * sqrt((1-pan)/2), gain * sqrt((1+pan)/2))

    def play(self, cue, position=(0, 0, 0), volume=1, loop=False):
        if cue not in self.pools:
            self.register(cue)
        channel = pygame.mixer.find_channel()
        if channel is None:
            return None
        slot = self.cursor[cue]
        self.cursor[cue] = (slot + 1) % len(self.pools[cue])
        jitter = self.random.uniform(0.972, 1.028)
        channel.play(self._pitched(cue, slot, jitter), loops=-1 if loop else 0)
        self._position(channel, position, volume)
        if loop:
            self.loop_levels[channel] = volume
            self.loops[channel] = (cue, slot, jitter, position, volume, round(jitter*48))
        return channel

    def update_loop(self, channel, rpm=0.4, weather=1, position=None):
        cue, slot, jitter, old_position, volume, previous = self.loops[channel]
        position = old_position if position is None else position
        rate = jitter * (0.72 + 0.7 * min(1, max(0, rpm)))
        step = round(rate * 48)
        if step != previous:
            channel.play(self._pitched(cue, slot, rate), loops=-1, fade_ms=18)
        self.loop_levels[channel] = volume * min(1, max(0, weather))
        self._position(channel, position, self.loop_levels[channel])
        self.loops[channel] = (cue, slot, jitter, position, volume, step)

    def stop(self, channel):
        if channel is not None:
            channel.fadeout(25)
            self.loops.pop(channel, None)
            self.loop_levels.pop(channel, None)
