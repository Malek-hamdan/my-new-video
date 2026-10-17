"""Synthesize the bead "tick" sounds used by the app.

Each tick is a modal-synthesis model of two hard resin beads colliding: a very short
contact transient plus a handful of exponentially decaying resonant modes. A small,
dark room reverb is mixed in for the slight echo.

Usage: python3 gen_sounds.py <output_dir>
"""
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
rng = np.random.default_rng(7)


def room_ir(rt60=0.42, length=0.6, dark=3800):
    n = int(SR * length)
    t = np.arange(n) / SR
    tail = rng.standard_normal(n) * np.exp(-6.91 * t / rt60)
    tail = sosfilt(butter(2, dark, 'low', fs=SR, output='sos'), tail)
    tail = sosfilt(butter(1, 250, 'high', fs=SR, output='sos'), tail)
    tail[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    ir = tail * 0.25
    for delay, gain in [(0.011, 0.45), (0.019, 0.32), (0.027, 0.22), (0.041, 0.15)]:
        ir[int(delay * SR)] += gain
    return ir / np.max(np.abs(ir))


def click(base, decay_ms, brightness, length=0.09):
    n = int(SR * length)
    t = np.arange(n) / SR
    out = np.zeros(n)
    ratios = [1.0, 1.52, 2.27, 2.98, 3.81]
    for i, r in enumerate(ratios):
        f = base * r * (1 + rng.uniform(-0.03, 0.03))
        tau = decay_ms / 1000 / (1 + 0.55 * i)
        amp = brightness ** i * rng.uniform(0.7, 1.0)
        out += amp * np.sin(2 * np.pi * f * t + rng.uniform(0, np.pi)) * np.exp(-t / tau)
    burst_len = int(0.0012 * SR)
    burst = rng.standard_normal(burst_len) * np.hanning(burst_len * 2)[burst_len:]
    burst = sosfilt(butter(2, [1800, 9000], 'band', fs=SR, output='sos'), burst)
    out[:burst_len] += burst * 0.9
    attack = int(0.0004 * SR)
    out[:attack] *= np.linspace(0, 1, attack)
    return out


def finish(dry, ir, wet=0.22, tail=0.55):
    dry = np.concatenate([dry, np.zeros(int(SR * tail))])
    rev = fftconvolve(dry, ir)[: len(dry)]
    rev /= np.max(np.abs(rev)) + 1e-9
    mix = dry / np.max(np.abs(dry)) + wet * rev
    fade = int(0.08 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    return (mix / np.max(np.abs(mix)) * 0.89 * 32767).astype(np.int16)


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    ir = room_ir()
    for i in range(5):
        dry = click(base=rng.uniform(2550, 3050), decay_ms=rng.uniform(5.5, 8), brightness=0.62)
        wavfile.write(out / f'tick_{i + 1}.wav', SR, finish(dry, ir))
    # Heavier knock when a stage ends: the bead hits the separator (imam) bead.
    dry = click(base=1650, decay_ms=13, brightness=0.55, length=0.14)
    dry2 = np.concatenate([np.zeros(int(0.045 * SR)), click(base=1720, decay_ms=10, brightness=0.5, length=0.1) * 0.45])
    dry = np.pad(dry, (0, max(0, len(dry2) - len(dry)))) + np.pad(dry2, (0, max(0, len(dry) - len(dry2))))
    wavfile.write(out / 'separator.wav', SR, finish(dry, ir, wet=0.3, tail=0.8))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'assets/sounds')
