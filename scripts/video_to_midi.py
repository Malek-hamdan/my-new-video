"""Clean up basic-pitch transcription of the uploaded Kara Sevda video audio into a playable piano MIDI.

Input: pickle of basic-pitch note events (start, end, pitch, amplitude, bends).
Quantises to a 16th grid at 82 BPM (bar length ~2.93 s measured from the bass line),
drops weak/ghost notes, splits hands at middle C, limits chord size per hand.
"""
import os, pickle, struct, sys

BPM, OFFSET, TPQ = 82, 0.30, 480
SIXTEENTH = 60 / BPM / 4
notes = pickle.load(open(sys.argv[1], 'rb'))

def q(t):
    return max(0, round((t - OFFSET) / SIXTEENTH))

cells = {}
for s, e, p, a, _ in notes:
    if a < 0.3 or e - s < 0.09:
        continue
    k0, k1 = q(s), max(q(s) + 1, q(e))
    key = (k0, p)
    if key not in cells or cells[key][1] < a:
        cells[key] = (k1, a)

rh, lh = {}, {}
for (k0, p), (k1, a) in cells.items():
    (rh if p >= 60 else lh).setdefault(k0, []).append((p, k1, a))

def thin(d, maxn, keep_top):
    out = []
    for k0, ns in d.items():
        ns.sort(key=lambda x: -x[2])
        ns = ns[:maxn]
        for p, k1, a in ns:
            out.append((k0, k1, p, int(min(110, 45 + a * 90))))
    return out

R, L = thin(rh, 3, True), thin(lh, 3, False)

def vlq(v):
    o = [v & 0x7F]; v >>= 7
    while v: o.append((v & 0x7F) | 0x80); v >>= 7
    return bytes(reversed(o))

def meta(k, d): return bytes([0xFF, k]) + vlq(len(d)) + d

def track(ev):
    ev.sort(key=lambda e: (e[0], e[1])); data, now = b'', 0
    for t, _, raw in ev: data += vlq(t - now) + raw; now = t
    data += b'\x00\xFF\x2F\x00'
    return b'MTrk' + struct.pack('>I', len(data)) + data

def nev(ns, ch):
    ev, last = [], {}
    for k0, k1, p, v in sorted(ns):
        t0, t1 = k0 * TPQ // 4, k1 * TPQ // 4
        ev += [(t0, 2, bytes([0x90 | ch, p, v])), (t1 - 1, 0, bytes([0x80 | ch, p, 0]))]
    return ev

def setup(ch, name):
    return [(0, 1, meta(3, name.encode())), (0, 1, bytes([0xC0 | ch, 0]))]

cond = [(0, 0, meta(3, b'Kara Sevda (from video, auto-transcribed)')),
        (0, 0, meta(0x58, b'\x04\x02\x18\x08')), (0, 0, meta(0x59, b'\xFD\x01')),
        (0, 0, meta(0x51, (60_000_000 // BPM).to_bytes(3, 'big')))]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'output')
t1 = [track(list(cond)), track(setup(0, 'Right Hand') + nev(R, 0)), track(setup(1, 'Left Hand') + nev(L, 1))]
open(os.path.join(out, 'kara_sevda_video.mid'), 'wb').write(b'MThd' + struct.pack('>IHHH', 6, 1, 3, TPQ) + b''.join(t1))
t0 = track(list(cond) + setup(0, 'Piano') + nev(R + L, 0))
open(os.path.join(out, 'kara_sevda_video_type0.mid'), 'wb').write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, TPQ) + t0)
print(len(R), len(L))
