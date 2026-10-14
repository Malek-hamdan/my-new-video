"""Generate a sad/romantic piano MIDI in the style of the Kara Sevda theme.

Original composition (A minor, ~68 BPM), not a transcription. Writes:
  output/kara_sevda_style_piano.mid         (Type 1: RH + LH tracks)
  output/kara_sevda_style_piano_type0.mid   (Type 0: single track, max compatibility)
No dependencies.
"""
import os
import random
import struct

TPQ = 480
random.seed(7)

NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6,
        'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def p(name):
    n, o = name[:-1], int(name[-1])
    return 12 * (o + 1) + NOTE[n]


def vlq(v):
    out = [v & 0x7F]
    v >>= 7
    while v:
        out.append((v & 0x7F) | 0x80)
        v >>= 7
    return bytes(reversed(out))


# Melody per bar: list of (note, beats). 'R' = rest.
A = [
    ('Am', [('A4', 1), ('C5', 1), ('E5', 1.5), ('D5', .5)]),
    ('F',  [('C5', 1.5), ('B4', .5), ('A4', 2)]),
    ('C',  [('G4', 1), ('C5', 1), ('E5', 1), ('G5', 1)]),
    ('G',  [('F5', 1.5), ('E5', .5), ('D5', 2)]),
    ('Am', [('E5', 1), ('A5', 1), ('G5', 1.5), ('E5', .5)]),
    ('F',  [('F5', 1), ('E5', 1), ('C5', 1), ('A4', 1)]),
    ('E',  [('B4', 1.5), ('G#4', .5), ('B4', 1), ('D5', 1)]),
    ('Am', [('C5', 1), ('B4', 1), ('A4', 2)]),
]
B = [
    ('F',  [('A5', 1.5), ('G5', .5), ('F5', 1), ('C5', 1)]),
    ('G',  [('D5', 1), ('G5', 1), ('B5', 1.5), ('A5', .5)]),
    ('Em', [('G5', 1.5), ('E5', .5), ('B4', 2)]),
    ('Am', [('C5', 1), ('E5', 1), ('A5', 2)]),
    ('Dm', [('F5', 1), ('A5', 1), ('D6', 1.5), ('C6', .5)]),
    ('G',  [('B5', 1), ('A5', 1), ('G5', 1), ('D5', 1)]),
    ('C',  [('E5', 1.5), ('G5', .5), ('C6', 2)]),
    ('E',  [('B5', 1), ('G#5', 1), ('E5', 2)]),
]
CHORD = {  # root (LH bass octave) and quality
    'Am': ('A2', 'm'), 'F': ('F2', 'M'), 'C': ('C3', 'M'), 'G': ('G2', 'M'),
    'E': ('E2', 'M'), 'Em': ('E2', 'm'), 'Dm': ('D2', 'm'),
}

# Sections: (bars, rh_dynamic, lh_dynamic, rh_octave_doubling)
INTRO = [(c, [('R', 4)]) for c in ['Am', 'F', 'C', 'G']]
SECTIONS = [
    (INTRO, 0, 42, False),
    (A, 62, 44, False),
    (B, 74, 52, False),
    (A, 70, 50, False),
    (B, 92, 64, True),   # climax
    (A, 56, 40, False),  # soft return
]

rh, lh = [], []  # (abs_tick, dur_ticks, pitch, vel)
cc = []          # (abs_tick, controller, value) for LH channel
bar = 0
BAR = 4 * TPQ


def hv(v):  # humanised velocity
    return max(20, min(120, v + random.randint(-4, 4)))


for bars, rh_v, lh_v, octv in SECTIONS:
    n = len(bars)
    for i, (ch, mel) in enumerate(bars):
        start = bar * BAR
        # phrase arc: swell into middle of the 8-bar phrase, relax at end
        arc = [0, 2, 4, 6, 6, 4, 2, -2][i % 8] if n == 8 else 0
        t = start
        for name, beats in mel:
            d = int(beats * TPQ)
            if name != 'R':
                v = hv(rh_v + arc + (4 if beats >= 1.5 else 0))
                rh.append((t, int(d * 0.95), p(name), v))
                if octv:
                    rh.append((t, int(d * 0.95), p(name) - 12, hv(v - 14)))
            t += d
        # LH flowing eighth-note arpeggio
        root, q = CHORD[ch]
        r = p(root)
        third = 3 if q == 'm' else 4
        pattern = [0, 7, 12, 12 + third, 19, 12 + third, 12, 7]
        for k, iv in enumerate(pattern):
            accent = 6 if k == 0 else (2 if k == 4 else 0)
            lh.append((start + k * TPQ // 2, TPQ // 2, r + iv,
                       hv(lh_v + arc // 2 + accent)))
        # sustain pedal: lift and re-press each bar
        cc.append((start, 64, 0))
        cc.append((start + 20, 64, 127))
        bar += 1

# Ending: Am chord held (bar after last section)
end = bar * BAR
for name in ['A1', 'A2', 'E3', 'A3', 'C4']:
    lh.append((end, BAR * 2, p(name), hv(48)))
for name in ['E4', 'A4', 'C5']:
    rh.append((end, BAR * 2, p(name), hv(54)))
cc.append((end, 64, 0))
cc.append((end + 20, 64, 127))
cc.append((end + BAR * 2, 64, 0))

# Tempo map: 68 BPM, ritardando over the final phrase
BPM = 68
tempo = [(0, BPM)]
last_phrase = end - 8 * BAR
tempo.append((last_phrase, 66))
for k, b in enumerate([64, 60, 56, 52]):
    tempo.append((end - (4 - k) * BAR // 2, b))
tempo.append((end, 50))


def tempo_ev(tick, bpm):
    us = int(60_000_000 / bpm)
    return (tick, 0, b'\xFF\x51\x03' + us.to_bytes(3, 'big'))


def track_bytes(events):
    events = sorted(events, key=lambda e: (e[0], e[1]))
    data, now = b'', 0
    for tick, _, raw in events:
        data += vlq(tick - now) + raw
        now = tick
    data += vlq(0) + b'\xFF\x2F\x00'
    return b'MTrk' + struct.pack('>I', len(data)) + data


def meta_text(kind, s):
    b = s.encode()
    return bytes([0xFF, kind]) + vlq(len(b)) + b


def note_events(notes, chan):
    ev = []
    for t, d, n, v in notes:
        ev.append((t + d, 0, bytes([0x80 | chan, n, 0])))   # offs first
        ev.append((t, 2, bytes([0x90 | chan, n, v])))
    return ev


def setup(chan, name):
    return [(0, 1, meta_text(0x03, name)),
            (0, 1, bytes([0xC0 | chan, 0])),          # Acoustic Grand Piano
            (0, 1, bytes([0xB0 | chan, 7, 110]))]


conductor = [(0, 0, meta_text(0x03, 'Kara Sevda style - piano')),
             (0, 0, b'\xFF\x58\x04\x04\x02\x18\x08'),     # 4/4
             (0, 0, b'\xFF\x59\x02\x00\x01')]             # A minor
conductor += [tempo_ev(t, b) for t, b in tempo]

cc_ev = [(t, 1, bytes([0xB0 | 1, c, v])) for t, c, v in cc]
cc_ev0 = [(t, 1, bytes([0xB0, c, v])) for t, c, v in cc]

out = os.path.join(os.path.dirname(__file__), '..', 'output')
os.makedirs(out, exist_ok=True)

# Type 1: conductor + RH (ch 0) + LH (ch 1)
t1 = [track_bytes(conductor),
      track_bytes(setup(0, 'Right Hand') + note_events(rh, 0)),
      track_bytes(setup(1, 'Left Hand') + note_events(lh, 1) + cc_ev)]
with open(os.path.join(out, 'kara_sevda_style_piano.mid'), 'wb') as f:
    f.write(b'MThd' + struct.pack('>IHHH', 6, 1, len(t1), TPQ) + b''.join(t1))

# Type 0: everything on one track, channel 0
t0 = track_bytes(conductor + setup(0, 'Piano') + note_events(rh + lh, 0) + cc_ev0)
with open(os.path.join(out, 'kara_sevda_style_piano_type0.mid'), 'wb') as f:
    f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, TPQ) + t0)

print(f'bars={bar + 2} rh_notes={len(rh)} lh_notes={len(lh)}')
