import numpy as np, soundfile as sf
sr=48000; rng=np.random.default_rng(7)
def env(n,a,d): 
    t=np.arange(n)/sr; return np.minimum(t/a,1)*np.exp(-t/d)
def lp(x,k):  # one-pole lowpass
    y=np.zeros_like(x); c=0
    for i in range(len(x)): c+=k*(x[i]-c); y[i]=c
    return y
# ---------- music: 124 BPM, minor, driving ----------
bpm=124; beat=60/bpm; dur=80; N=int(dur*sr); m=np.zeros((N,2))
def add(sig,t,g=1.0,pan=0.0):
    i=int(t*sr)
    if i>=N: return
    j=min(N,i+len(sig)); s=sig[:j-i]*g
    m[i:j,0]+=s*(1-pan)*0.5*2**0.5; m[i:j,1]+=s*(1+pan)*0.5*2**0.5
n=int(0.35*sr); t=np.arange(n)/sr
kick=np.sin(2*np.pi*(45*t+ (120/18)*(1-np.exp(-18*t))))*np.exp(-t/0.12)
n2=int(0.2*sr); clap=lp(rng.standard_normal(n2),0.5)*env(n2,0.001,0.05)
hat=rng.standard_normal(int(0.05*sr)); hat=(hat-lp(hat,0.3))*env(len(hat),0.0005,0.012)
roots=[57,53,48,55]  # A F C G (Am-F-C-G)
f=lambda n_:440*2**((n_-69)/12)
bars=int(dur/(4*beat))+1
for b in range(bars):
    t0=b*4*beat; r=roots[b%4]
    for k in range(4):
        add(kick,t0+k*beat,0.9)
        if k in (1,3): add(clap,t0+k*beat,0.35)
        for h in range(2): add(hat,t0+k*beat+h*beat/2+beat/4,0.18,0.3 if h else -0.3)
        # offbeat bass
        nb=int(beat/2*sr); tb=np.arange(nb)/sr
        bs=np.sign(np.sin(2*np.pi*f(r-12)*tb))*0.5+np.sin(2*np.pi*f(r-12)*tb)
        add(lp(bs,0.08)*env(nb,0.005,0.12),t0+k*beat+beat/2,0.35)
    # pad chord (minor/major triad) with pluck arps
    chord=[r,r+(3 if r in (57,) else 4),r+7]
    for s in range(8):
        nn=chord[s%3]+12; na=int(beat/2*sr); ta=np.arange(na)/sr
        pl=(np.sin(2*np.pi*f(nn)*ta)+0.4*np.sin(2*np.pi*2*f(nn)*ta))*env(na,0.002,0.09)
        add(pl,t0+s*beat/2,0.12,0.4*(-1)**s)
    npd=int(4*beat*sr); tp=np.arange(npd)/sr
    pad=sum(np.sin(2*np.pi*f(c)*tp*(1+d)) for c in chord for d in (-0.003,0.003))
    add(pad*np.minimum(tp/0.3,1)*np.minimum((4*beat-tp)/0.3,1),t0,0.03)
m=np.tanh(m*1.2); m/=np.max(np.abs(m)); sf.write("music.wav",m*0.9,sr)
# ---------- SFX ----------
def whoosh(d=0.45):
    n=int(d*sr); x=rng.standard_normal(n); t=np.arange(n)/sr
    k=0.02+0.35*np.sin(np.pi*t/d)**2; y=np.zeros(n); c=0
    for i in range(n): c+=k[i]*(x[i]-c); y[i]=c
    y*=np.sin(np.pi*t/d)**2; return y/np.abs(y).max()
def boom(d=1.4):
    n=int(d*sr); t=np.arange(n)/sr
    y=np.sin(2*np.pi*(38*t+(90/10)*(1-np.exp(-10*t))))*np.exp(-t/0.45)
    y+=lp(rng.standard_normal(n),0.15)*np.exp(-t/0.08)*0.6
    y=np.tanh(y*1.8); return y/np.abs(y).max()
def riser(d=1.5):
    n=int(d*sr); t=np.arange(n)/sr; fr=200*(8**(t/d))
    y=np.sin(2*np.pi*np.cumsum(fr)/sr)*0.4
    nz=rng.standard_normal(n); k=0.03+0.4*(t/d); z=np.zeros(n); c=0
    for i in range(n): c+=k[i]*(nz[i]-c); z[i]=c
    y=(y+z*1.2)*(t/d)**2; return y/np.abs(y).max()
def hit(d=0.6):
    n=int(d*sr); t=np.arange(n)/sr
    y=np.sin(2*np.pi*60*t)*np.exp(-t/0.15)+rng.standard_normal(n)*np.exp(-t/0.03)*0.7
    return np.tanh(y*1.5)/1.2
for nm,s in [("whoosh",whoosh()),("boom",boom()),("riser",riser()),("hit",hit()),("pop",np.sin(2*np.pi*900*np.arange(int(.08*sr))/sr)*np.exp(-np.arange(int(.08*sr))/sr/0.02))]:
    sf.write(f"sfx/{nm}.wav",np.stack([s,s],1)*0.9,sr)
print("ok")
