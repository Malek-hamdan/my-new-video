import json, subprocess, re
FPS = 30
tl = json.load(open("timeline.json"))
words = json.load(open("words.json"))
TOTAL = sum(s["n"] for s in tl) / FPS

def src2out(ts):
    for s in tl:
        if s["k"] == "v" and s["a"] - 1e-6 <= ts < s["b"] - 1e-6:
            return s["out"] + (ts - s["a"])
    return None

def run_end(o):
    """end (output time) of the contiguous source run that contains output time o"""
    idx = [i for i, s in enumerate(tl) if s["out"] <= o + 1e-6][-1]
    j = idx
    while j + 1 < len(tl) and tl[j + 1]["k"] == "v" and abs(tl[j + 1]["a"] - tl[j]["b"]) < 1e-3:
        j += 1
    return tl[j]["out"] + tl[j]["n"] / FPS

# ---------------- captions ----------------
YELLOW = {"كريستيانو", "ميسي", "زيدان", "زين", "الدين", "كوكب", "آخر"}
BLUE = {"1998", "90", "2002", "التسعين", "فرنسا", "والبرازيل"}
occ = []  # every on-screen occurrence of a word: (out_start, out_end, word)
for s in tl:
    if s["k"] != "v":
        continue
    for w in words:
        if s["a"] - 1e-6 <= w["s"] < s["b"] - 1e-6:
            o = s["out"] + w["s"] - s["a"]
            occ.append([o, s["out"] + min(w["e"], s["b"]) - s["a"], w["w"], w["s"], w["e"]])
occ.sort()
groups = []
i = 0
def plain(w):
    return re.sub(r"[ًٌٍَُِّْ]", "", w)
BREAK = {"ما", "المهم", "لكن", "أدري", "احنا", "قال", "أبي", "أنا", "زين", "مش"}
NUM = {"90", "التسعين"}
def can_pair(a, b):
    if b[3] - a[4] > 0.05:              # source discontinuity (a cut)
        return False
    if a[2] in NUM and b[2] == "دقيقة":
        return True
    if a[2] == "عبد" and b[2] == "الله" or a[2] == "أول" and b[2] == "ما":
        return True
    if b[2] == "عبد":
        return False
    if b[2] in BREAK or b[2] in NUM:
        return False
    return len(plain(a[2])) + len(plain(b[2])) <= 11
while i < len(occ):
    w = occ[i][2]
    if w == "زين" and i + 2 < len(occ) and occ[i + 1][2] == "الدين":
        n = 3
    elif (len(plain(w)) >= 8 or w.isdigit() and len(w) == 4) and not (i + 1 < len(occ) and w in NUM and occ[i+1][2] == "دقيقة"):
        n = 1
    elif i + 1 < len(occ) and can_pair(occ[i], occ[i + 1]):
        n = 2
    else:
        n = 1
    groups.append(occ[i:i + n]); i += n

def ass_t(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def color(w):
    p = plain(w)
    if p in BLUE:
        return r"{\c&HFF904A&}" + w + r"{\c&HFFFFFF&}"
    if p in YELLOW:
        return r"{\c&H0AD6FF&}" + w + r"{\c&HFFFFFF&}"
    return w

lines = []
for k, g in enumerate(groups):
    st = g[0][0]
    en = groups[k + 1][0][0] if k + 1 < len(groups) else g[-1][1] + 0.2
    en = min(en, run_end(st), g[-1][1] + 0.35)
    en = max(en, st + 0.25)
    txt = " ".join(color(x[2]) for x in g)
    pop = r"{\fscx78\fscy78\t(0,70,\fscx110\fscy110)\t(70,140,\fscx100\fscy100)}"
    lines.append(f"Dialogue: 0,{ass_t(st)},{ass_t(en)},Cap,,0,0,0,,{pop}{txt}")

ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Cairo Black,120,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,8,3,2,60,60,560,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(lines) + "\n"
open("subs.ass", "w", encoding="utf8").write(ass)
json.dump([[round(g[0][0], 2), " ".join(x[2] for x in g)] for g in groups], open("captions.json", "w"), ensure_ascii=False, indent=0)

# ---------------- overlays ----------------
frz = [s for s in tl if s["k"] == "f"]
cta = [s for s in tl if s["k"] == "c"][0]
OV = []  # (png, start, end, x_final, y, from)  from: left/right/top/pop
def card(png, src_t, side, dur=1.2, end=None, y=250, lead=0.05):
    st = src2out(src_t) - lead
    en = end if end is not None else st + dur
    OV.append((png, st, en, side, y))
OV.append(("ov/title.png", 0.0, tl[3]["out"], "top", 70))
card("ov/card_cr.png", 6.51, "left")
card("ov/card_messi.png", 7.49, "right")
card("ov/card_zz.png", 12.27, "left", end=src2out(13.38) + 1 / FPS)
card("ov/card_match.png", 27.35, "topc", dur=1.8, y=150)
card("ov/card_zz.png", 45.43, "right", end=src2out(46.66) + 1 / FPS)
card("ov/card_crm.png", 63.02, "topc", dur=1.3, y=150)
card("ov/card_zz.png", 65.08, "left", dur=1.3)
OV.append(("ov/emo_mind.png", frz[0]["out"], frz[0]["out"] + frz[0]["n"] / FPS, "pop", 330))
OV.append(("ov/frz2.png", frz[1]["out"], frz[1]["out"] + frz[1]["n"] / FPS, "popc", 260))
OV.append(("ov/cta.png", cta["out"], TOTAL + 0.1, "ctac", 1080))

from PIL import Image
inputs = ["-i", "body.mp4"]
fc = []
last = "0:v"
for k, (png, st, en, mode, y) in enumerate(OV):
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{TOTAL:.3f}", "-i", png]
    W, H = Image.open(png).size
    T, E = st, en
    a = 0.16
    if mode == "left":
        X0, X1 = -W, 20
    elif mode == "right":
        X0, X1 = 1080, 1080 - W - 20
    else:
        X0 = X1 = (1080 - W) // 2
    if mode in ("left", "right"):
        xe = f"if(lt(t,{T+a:.3f}),{X0}+({X1}-({X0}))*(t-{T:.3f})/{a},if(gt(t,{E-a:.3f}),{X1}+(({X0})-{X1})*(t-{E-a:.3f})/{a},{X1}))"
        ye = str(y)
    elif mode in ("top", "topc"):
        xe = str(X1)
        Y0 = -H
        ye = f"if(lt(t,{T+a:.3f}),{Y0}+({y}-({Y0}))*(t-{T:.3f})/{a},if(gt(t,{E-a:.3f}),{y}+(({Y0})-{y})*(t-{E-a:.3f})/{a},{y}))" if mode == "topc" else f"if(lt(t,{T+a:.3f}),{Y0}+({y}-({Y0}))*(t-{T:.3f})/{a},{y})"
    elif mode == "pop":
        xe = str(1080 - W - 40)
        ye = f"{y}-40*max(0,1-(t-{T:.3f})/0.15)"
    elif mode == "popc":
        xe = str(X1)
        ye = f"{y}-40*max(0,1-(t-{T:.3f})/0.15)"
    else:  # cta: rise from below
        xe = str(X1)
        ye = f"if(lt(t,{T+0.2:.3f}),1920-(1920-{y})*(t-{T:.3f})/0.2,{y})"
    nxt = f"v{k}"
    fc.append(f"[{last}][{k+1}:v]overlay=x='{xe}':y='{ye}':enable='between(t,{T:.3f},{E:.3f})':eval=frame[{nxt}]")
    last = nxt
fc.append(f"[{last}]ass=subs.ass:fontsdir=/root/.fonts,format=yuv420p[vout]")
open("ov_filter.txt", "w").write(";\n".join(fc))
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex_script", "ov_filter.txt", "-map", "[vout]",
                "-r", str(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "video_final.mp4"], check=True)

# ---------------- audio ----------------
parts = []
fa = []
for k, s in enumerate(tl):
    d = s["n"] / FPS
    if s["k"] == "v":
        fa.append(f"[0:a]atrim=start={s['a']:.4f}:duration={d:.4f},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st={d-0.012:.4f}:d=0.012[a{k}]")
    else:
        fa.append(f"anullsrc=r=44100:cl=stereo,atrim=duration={d:.4f}[a{k}]")
fa.append("".join(f"[a{k}]" for k in range(len(tl))) + f"concat=n={len(tl)}:v=0:a=1,aresample=48000," +
          "highpass=f=80,lowpass=f=14000,afftdn=nr=10:nf=-45,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2," +
          "loudnorm=I=-16:TP=-2:LRA=9[vo]")
open("voice_filter.txt", "w").write(";\n".join(fa))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "src.mp4", "-filter_complex_script", "voice_filter.txt", "-map", "[vo]", "-ar", "48000", "voice.wav"], check=True)

# SFX events: (time, name, priority, gain, offset)  offset = how far before the time the sound starts
ev = []
for s in tl:
    if "T" in s["fl"] or s["k"] == "c":
        ev.append((s["out"], "whoosh", 1, 0.32, 0.22))
    elif s["k"] == "v" and s["i"] > 0 and tl[s["i"] - 1]["k"] == "v":
        ev.append((s["out"], "whoosh", 0.5, 0.26, 0.22))
ev.append((tl[2]["out"], "boom", 5, 0.5, 0.0))            # hook: "من كوكب آخر"
ev.append((src2out(12.27), "riser", 4, 0.28, 1.5))          # before "هو زين الدين زيدان"
ev.append((frz[0]["out"], "hit", 3, 0.42, 0.0))            # freeze 1
ev.append((frz[1]["out"], "hit", 3, 0.42, 0.0))            # freeze 2
ev.append((src2out(27.35), "riser", 2, 0.24, 1.5))          # before "فرنسا والبرازيل 1998"
ev.append((src2out(43.73), "hit", 3, 0.36, 0.0))           # "جداً محظوظ" shake
ev.append((src2out(68.08), "riser", 4, 0.28, 1.5))          # before "مواليد 2002"
ev.sort(key=lambda e: -e[2])
acc = []
for e in ev:
    st, en = e[0] - e[4], e[0] + 0.3
    if all(abs(e[0] - a[0]) >= 2.7 and not (st < a[0] + 0.3 and a[0] - a[4] < en) for a in acc):
        acc.append(e)
acc.sort()
json.dump([[round(a[0], 2), a[1]] for a in acc], open("sfx_events.json", "w"))
ins = ["-i", "voice.wav", "-i", "music.wav"]
fx = []
for k, (t, nm, p, g, off) in enumerate(acc):
    ins += ["-i", f"sfx/{nm}.wav"]
    fx.append(f"[{k+2}:a]volume={g},adelay={int(max(0,t-off)*1000)}|{int(max(0,t-off)*1000)}[s{k}]")
fx.append("[0:a]asplit=2[vmix][vsc]")
fx.append(f"[1:a]atrim=duration={TOTAL:.3f},volume=-12dB,afade=t=in:d=0.3,afade=t=out:st={TOTAL-1.5:.3f}:d=1.5[mu]")
fx.append("[mu][vsc]sidechaincompress=threshold=0.02:ratio=4:attack=15:release=350:makeup=1[mud]")
fx.append("[vmix][mud]" + "".join(f"[s{k}]" for k in range(len(acc))) + f"amix=inputs={2+len(acc)}:normalize=0:duration=first[mix]")
open("mix_filter.txt", "w").write(";\n".join(fx))
subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex_script", "mix_filter.txt", "-map", "[mix]", "-ar", "48000", "mix_pre.wav"], check=True)
# isolate ducked music (for the level report)
fx2 = [f"[1:a]atrim=duration={TOTAL:.3f},volume=-12dB,afade=t=in:d=0.3,afade=t=out:st={TOTAL-1.5:.3f}:d=1.5[mu]",
       "[mu][0:a]sidechaincompress=threshold=0.02:ratio=4:attack=15:release=350:makeup=1[mud]"]
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "voice.wav", "-i", "music.wav", "-filter_complex", ";".join(fx2), "-map", "[mud]", "music_ducked.wav"], check=True)
# two-pass loudnorm to -14 LUFS
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", "mix_pre.wav", "-af", "loudnorm=I=-14:TP=-2:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(r[r.rfind("{"):])
ln = (f"loudnorm=I=-14:TP=-2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "mix_pre.wav", "-af", ln + ",aresample=48000", "mix_final.wav"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "video_final.mp4", "-i", "mix_final.wav", "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", "final.mp4"], check=True)
print("TOTAL", TOTAL)
print("SFX", [[round(a[0], 2), a[1]] for a in acc])
print("OVERLAYS", [(o[0], round(o[1], 2), round(o[2], 2)) for o in OV])
