import json, subprocess, os, math, statistics
FPS = 30
SRC = "src.mp4"
os.makedirs("shots", exist_ok=True)
words = json.load(open("words.json"))
faces = json.load(open("face.json"))

# ---------------- shot list ----------------
# (kind, src_in, src_out, zoom, flags)  kind: v=video, f=freeze(src_in = frame time, src_out = duration)
# flags: T=zoom transition in, F=white flash, K=shake
SHOTS = [
    # HOOK
    ("v", 16.85, 18.44, 1.15, "F"), ("v", 18.44, 19.94, 1.30, ""), ("v", 19.94, 20.99, 1.45, "FK"),
    # S1
    ("v", 1.55, 4.24, 1.00, "T"), ("v", 4.24, 7.78, 1.15, ""), ("v", 7.78, 10.38, 1.30, ""),
    ("v", 10.38, 12.27, 1.15, ""), ("v", 12.27, 13.39, 1.45, "F"),
    # S2
    ("v", 16.36, 18.44, 1.00, "T"), ("v", 18.44, 20.99, 1.30, ""),
    # S3a + freeze 1 (hands on head)
    ("v", 20.99, 22.49, 1.15, ""), ("f", 22.42, 0.6, 1.15, "F"),
    # S3b
    ("v", 22.49, 25.18, 1.00, "T"), ("v", 25.18, 27.66, 1.15, ""), ("v", 27.66, 30.14, 1.00, ""),
    ("v", 30.14, 32.36, 1.15, ""), ("v", 32.36, 34.27, 1.30, ""), ("v", 34.27, 35.14, 1.45, "F"),
    ("f", 35.10, 0.6, 1.45, ""),
    # S4
    ("v", 38.36, 41.43, 1.00, "T"), ("v", 41.43, 43.73, 1.30, ""), ("v", 43.73, 44.58, 1.45, "K"),
    ("v", 44.58, 46.67, 1.15, ""),
    # S5
    ("v", 47.15, 48.49, 1.00, "T"), ("v", 48.49, 50.45, 1.30, ""),
    # S6
    ("v", 51.64, 54.58, 1.15, "T"), ("v", 54.58, 57.29, 1.30, ""),
    # S7
    ("v", 61.98, 64.18, 1.00, "T"), ("v", 64.18, 66.65, 1.30, ""), ("v", 66.65, 68.08, 1.15, ""),
    ("v", 68.08, 69.87, 1.45, "K"),
    # S8
    ("v", 72.10, 74.23, 1.15, "T"), ("v", 74.23, 76.34, 1.40, ""),
    # CTA hold
    ("c", 75.90, 2.0, 1.40, ""),
]

def face_center(a, b):
    pts = [f for f in faces if a - 0.3 <= f[0] <= b + 0.3]
    if not pts:
        pts = faces
    return statistics.median(p[1] for p in pts), statistics.median(p[2] for p in pts)

# timeline
tl = []
t = 0
for i, (k, a, b, z, fl) in enumerate(SHOTS):
    n = round((b - a) * FPS) if k == "v" else round(b * FPS)
    tl.append(dict(i=i, k=k, a=a, b=b, z=z, fl=fl, n=n, out=t / FPS))
    t += n
TOTAL = t / FPS
print("total", TOTAL)

def src2out(ts):
    for s in tl:
        if s["k"] == "v" and s["a"] - 1e-6 <= ts < s["b"] - 1e-6:
            return s["out"] + (ts - s["a"])
    return None

# ---------------- render shots ----------------
UP = 2  # pre-upscale factor 576x1024 -> 1152x2048
GRADE = "eq=contrast=1.08:saturation=1.07:gamma=0.98,unsharp=5:5:0.6:5:5:0.0"

def render(s):
    out = f"shots/{s['i']:02d}.mp4"
    if os.path.exists(out):
        return out
    a, z, fl, n = s["a"], s["z"], s["fl"], s["n"]
    if s["k"] == "v":
        cx, cy = face_center(a, s["b"])
    else:
        cx, cy = face_center(a - 0.5, a + 0.5)
    cx *= UP; cy *= UP
    # zoom expression (on = output frame index)
    zexpr = f"{z}"
    if "T" in fl:
        zexpr = f"{z}*(1+0.12*max(0,1-on/6))"
    if s["k"] in "fc":
        zexpr = f"{z}*(1+{0.05 if s['k']=='f' else 0.07}*on/{n})"
    sh_x = sh_y = "0"
    if "K" in fl:
        sh_x = "14*sin(on*1.9)*max(0,1-on/14)"
        sh_y = "10*cos(on*2.3)*max(0,1-on/14)"
    xexpr = f"max(0,min(iw-iw/zoom,{cx:.1f}-iw/zoom/2))+{sh_x}"
    yexpr = f"max(0,min(ih-ih/zoom,{cy:.1f}-0.42*ih/zoom))+{sh_y}"
    zp = f"zoompan=z='{zexpr}':x='{xexpr}':y='{yexpr}':d=1:s=1080x1920:fps={FPS}"
    vf = [f"scale={576*UP}:{1024*UP}:flags=lanczos", zp, GRADE]
    if "F" in fl:
        vf.append("fade=t=in:st=0:d=0.2:color=white")
    if s["k"] == "c":
        vf.append("eq=brightness=-0.10:saturation=0.9")
    vf.append("format=yuv420p")
    if s["k"] == "v":
        inp = ["-ss", f"{a:.3f}", "-i", SRC]
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-i", SRC, "-frames:v", "1", f"shots/frz{s['i']}.png"], check=True)
        inp = ["-loop", "1", "-framerate", str(FPS), "-i", f"shots/frz{s['i']}.png"]
    cmd = ["ffmpeg", "-v", "error", "-y", *inp, "-vf", ",".join(vf), "-frames:v", str(n), "-an",
           "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "16", out]
    subprocess.run(cmd, check=True)
    return out

if __name__ == "__main__":
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(render, tl))
    with open("shots/list.txt", "w") as f:
        for s in tl:
            f.write(f"file '{s['i']:02d}.mp4'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "shots/list.txt", "-c", "copy", "body.mp4"], check=True)
    json.dump(tl, open("timeline.json", "w"), indent=1)
    print("done")
