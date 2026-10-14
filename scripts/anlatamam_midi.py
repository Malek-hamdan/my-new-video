"""Kara Sevda - Anlatamam (Toygar Isikli), piano.

Note-for-note from the sheet transcribed by Beytullah Alemdar (truongca.com/pdf/29357).
Form: bars 1-4 intro, |: 5-15, 1st ending 16 :|, 2nd ending 17-18.
Sheet tempo q=55; played at q=72 (TEMPO). 4/4, key Eb major / C minor (3 flats). Sheet has no dynamics marks;
velocities below are an interpretive choice. Pedal follows the sheet's per-bar brackets.
Writes output/kara_sevda_anlatamam.mid (Type 1) and ..._type0.mid. No dependencies.
"""
import os
import struct

TPQ = 480
TEMPO = 72
BAR = 4 * TPQ
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
FLATS = {'B', 'E', 'A'}  # key signature


def p(name):  # 'D5' -> MIDI, key-signature flats applied
    n, o = name[0], int(name[1:])
    return 12 * (o + 1) + NOTE[n] - (1 if n in FLATS else 0)


def seq(items):  # [(pitch|'R', beats)] -> [(offset_beats, beats, pitch)]
    out, t = [], 0.0
    for n, b in items:
        if n != 'R':
            out.append((t, b, p(n)))
        t += b
    assert abs(t - 4) < 1e-9, (items, t)
    return out


INTRO_RH = seq([('R', .5), ('D5', .25), ('C5', .25), ('D5', .5), ('C5', .25),
                ('E5', 2), ('R', .25)])
HEAD = [('R', .5), ('D5', .25), ('C5', .25), ('D5', .5), ('E5', .25), ('F5', .5), ('G5', .5)]
THEME = seq(HEAD + [('F5', .5), ('E5', .25), ('D5', .25), ('C5', .25)])
THEME_HI = seq(HEAD + [('A5', .5), ('G5', .25), ('F5', .25), ('E5', .25)])
RUN_UP = seq(HEAD + [('A5', .5), ('B5', .25), ('C6', .25), ('D6', .25)])
TREM_C = seq([(n, .25) for n in
              'D6 C6 C6 D6 C6 C6 D6 C6 C6 D6 C6 C6 F6 E6 D6 C6'.split()])
TREM_D = seq([(n, .25) for n in
              'E6 D6 D6 E6 D6 D6 E6 D6 D6 E6 D6 D6 G6 F6 E6 D6'.split()])


def arp(root, fifth, octv):  # LH eighth-note pattern, played twice per bar
    pat = [root, fifth, octv, fifth] * 2
    return [(i * .5, .5, p(n)) for i, n in enumerate(pat)]


def whole(*names, beats=4):
    return [(0, beats, p(n)) for n in names]


PULSE_F = [(t, d, p(n)) for t, d in [(0, 1), (1, 1), (2, .5), (2.5, .5), (3, .5), (3.5, .5)]
           for n in ('F2', 'F3')]

# (rh, lh, rh_vel, lh_vel, pedal)
bars = {
    1: (INTRO_RH, whole('C3', 'C4'), 58, 44, False),
    2: (INTRO_RH, whole('B2', 'B3'), 58, 44, False),
    3: (INTRO_RH, whole('A2', 'A3'), 60, 46, False),
    4: (INTRO_RH, whole('G2', 'G3'), 60, 46, False),
    5: (THEME, arp('C3', 'G3', 'C4'), 68, 50, True),
    6: (THEME, arp('B2', 'F3', 'B3'), 68, 50, True),
    7: (THEME, arp('A2', 'E3', 'A3'), 70, 52, True),
    8: (THEME_HI, arp('G2', 'D3', 'G3'), 74, 54, True),
    9: (THEME, arp('C3', 'G3', 'C4'), 72, 52, True),
    10: (THEME, arp('B2', 'F3', 'B3'), 72, 52, True),
    11: (THEME_HI, arp('A2', 'E3', 'A3'), 76, 56, True),
    12: (RUN_UP, arp('G2', 'D3', 'G3'), 80, 58, True),
    13: (TREM_C, arp('F2', 'C3', 'F3'), 86, 62, True),
    14: (TREM_C, arp('A2', 'E3', 'A3'), 86, 62, True),
    15: (TREM_D, arp('G2', 'D3', 'G3'), 88, 64, True),
    16: (whole('C6'), PULSE_F, 86, 62, True),
    # 2nd ending: C6 whole tied to half (6 beats), bass F2+F3 tied over both bars
    # 2nd ending: RH as written (C6 tied 6 beats, then D6-C6-Eb6).
    # LH deviates from the sheet on request: instead of tied F whole notes it keeps
    # bar 16's F pulse so the rhythm drives through to the last beat.
    17: (whole('C6', beats=6), PULSE_F, 100, 70, True),
    18: ([(2, .125, p('D6')), (2.125, .125, p('C6')), (2.25, 1.5, p('E6'))],
         PULSE_F[:-2] + [(3.5, .5, p('F2')), (3.5, .5, p('F3'))], 106, 76, True),
}
ORDER = [1, 2, 3, 4] + list(range(5, 17)) + list(range(5, 16)) + [17, 18]

rh, lh, ped = [], [], []
SECOND_PASS = 16  # index in ORDER where the repeat starts
for i, b in enumerate(ORDER):
    start = i * BAR
    r, l, rv, lv, pedal = bars[b]
    if SECOND_PASS <= i < SECOND_PASS + 11:  # repeat keeps building, never drops back
        rv, lv = rv + 14, lv + 10
    for notes, v, dst in ((r, rv, rh), (l, lv, lh)):
        for t, d, n in notes:
            accent = 6 if t in (0, 2) else 0
            dst.append((start + int(t * TPQ), int(d * TPQ * 0.98), n, min(127, v + accent)))
    if pedal and b != 18:
        ped += [(start, 0), (start + 10, 127)]
end = len(ORDER) * BAR
ped.append((end, 0))


def vlq(v):
    out = [v & 0x7F]
    v >>= 7
    while v:
        out.append((v & 0x7F) | 0x80)
        v >>= 7
    return bytes(reversed(out))


def meta(kind, data):
    return bytes([0xFF, kind]) + vlq(len(data)) + data


def track(events):
    events.sort(key=lambda e: (e[0], e[1]))
    data, now = b'', 0
    for tick, _, raw in events:
        data += vlq(tick - now) + raw
        now = tick
    data += b'\x00\xFF\x2F\x00'
    return b'MTrk' + struct.pack('>I', len(data)) + data


def notes(ns, ch):
    ev = []
    for t, d, n, v in ns:
        ev.append((t, 2, bytes([0x90 | ch, n, v])))
        ev.append((t + d, 0, bytes([0x80 | ch, n, 0])))
    return ev


def setup(ch, name):
    return [(0, 1, meta(0x03, name.encode())), (0, 1, bytes([0xC0 | ch, 0])),
            (0, 1, bytes([0xB0 | ch, 7, 110]))]


def pedal(ch):
    return [(t, 1, bytes([0xB0 | ch, 64, v])) for t, v in ped]


conductor = [(0, 0, meta(0x03, b'Kara Sevda - Anlatamam (Toygar Isikli)')),
             (0, 0, meta(0x58, b'\x04\x02\x18\x08')),
             (0, 0, meta(0x59, b'\xFD\x00')),                       # 3 flats, major
             (0, 0, meta(0x51, (60_000_000 // TEMPO).to_bytes(3, 'big')))]

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'output')
t1 = [track(list(conductor)), track(setup(0, 'Right Hand') + notes(rh, 0)),
      track(setup(1, 'Left Hand') + notes(lh, 1) + pedal(1))]
with open(os.path.join(out, 'kara_sevda_anlatamam.mid'), 'wb') as f:
    f.write(b'MThd' + struct.pack('>IHHH', 6, 1, 3, TPQ) + b''.join(t1))
t0 = track(list(conductor) + setup(0, 'Piano') + notes(rh + lh, 0) + pedal(0))
with open(os.path.join(out, 'kara_sevda_anlatamam_type0.mid'), 'wb') as f:
    f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, TPQ) + t0)
print(f'bars={len(ORDER)} rh={len(rh)} lh={len(lh)}')
