"""Turn an audio (or video) file into a song file the game can load.

    python make_song.py <input> <n>     ->  ../android/app/src/main/assets/song<n>.js

Finds where the music actually stops (trailing silence is cut), detects the beat
times and their strength, and the melody notes (piano register onsets, which Beat Hop
puts its tiles on), and embeds a 128 kbps MP3 as base64 so the WebView can
load it from file:// without fetch. Needs ffmpeg and librosa.
"""
import base64, json, os, subprocess, sys, tempfile

import librosa
import numpy as np

src, n = sys.argv[1], int(sys.argv[2])
out = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'assets', f'song{n}.js')
tmp = tempfile.mkdtemp()
wav, mp3 = os.path.join(tmp, 'a.wav'), os.path.join(tmp, 'a.mp3')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '22050', wav], check=True)

y, sr = librosa.load(wav, sr=22050, mono=True)
rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]
rt = librosa.times_like(rms, sr=sr, hop_length=256)
end = float(rt[np.where(rms > 0.02)[0][-1]]) + 0.3          # music end, plus a short tail

tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time', tightness=200)
beats = [float(b) for b in beats if b < end - 0.2]
env = librosa.onset.onset_strength(y=y, sr=sr)
et = librosa.times_like(env, sr=sr)
strength = np.array([env[np.argmin(abs(et - b))] for b in beats])
strength = (strength / strength.max()).round(2).tolist()

# melody notes: onsets of the harmonic part in the piano register (250-3000 Hz)
yh, _ = librosa.effects.hpss(y[:int(end * sr)], margin=2.0)
mag = np.abs(librosa.stft(yh, n_fft=2048, hop_length=256))
band = mag[(librosa.fft_frequencies(sr=sr, n_fft=2048) > 250) & (librosa.fft_frequencies(sr=sr, n_fft=2048) < 3000)]
flux = np.concatenate([[0], np.maximum(0, np.diff(np.log1p(band), axis=1)).sum(0)])
flux /= flux.max()
frames = librosa.onset.onset_detect(onset_envelope=flux, sr=sr, hop_length=256, delta=0.15, wait=5)
notes = librosa.frames_to_time(frames, sr=sr, hop_length=256)
note_strength = flux[frames] / flux[frames].max()

# fast runs: stretches where the melody plays quick notes (gaps under 0.22 s, at least 4 in a row);
# Beat Hop lays a trail of small tiles there so the ball bounces on every note
quick = librosa.frames_to_time(librosa.onset.onset_detect(onset_envelope=flux, sr=sr, hop_length=256, delta=0.08, wait=3), sr=sr, hop_length=256)
runs, cur = [], [quick[0]]
for a, b in zip(quick, quick[1:]):
    if b - a < 0.22: cur.append(b)
    else:
        if len(cur) >= 4: runs.append([round(float(t), 3) for t in cur])
        cur = [b]
if len(cur) >= 4: runs.append([round(float(t), 3) for t in cur])

subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vn', '-t', f'{end:.2f}', '-af', f'afade=t=out:st={end - 0.3:.2f}:d=0.3',
                '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
audio = base64.b64encode(open(mp3, 'rb').read()).decode()
song = {'n': n, 'end': round(end, 3), 'tempo': round(float(np.atleast_1d(tempo)[0]), 1),
        'beats': [round(b, 3) for b in beats], 'strength': strength,
        'notes': [round(float(t), 3) for t in notes], 'noteStrength': note_strength.round(2).tolist(), 'runs': runs}
with open(out, 'w') as f:
    f.write('(window.SONGS = window.SONGS || [])[%d] = Object.assign(%s, {audio: "%s"});\n' % (n - 1, json.dumps(song), audio))
print(f'song{n}.js: {end:.1f} s, {song["tempo"]} BPM, {len(beats)} beats, {len(notes)} melody notes, {len(runs)} fast runs ({sum(map(len, runs))} notes), {os.path.getsize(out) // 1024} KB')
