import numpy as np, soundfile as sf, json
x,sr=sf.read("audio16.wav"); x=x[:int(77*sr)]
hop=160; fr=len(x)//hop
e=np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2)+1e-12) for i in range(fr)])
db=20*np.log10(e); sm=np.convolve(db,np.ones(5)/5,'same')
# cut at local min in window [start+1.8s, start+3.5s]
cuts=[0]; t=0
while True:
    a=cuts[-1]+180; b=cuts[-1]+350
    if b>=fr: break
    i=a+int(np.argmin(sm[a:b])); cuts.append(i)
cuts.append(fr)
out=[(cuts[i]*hop/sr,cuts[i+1]*hop/sr,float(sm[cuts[i+1]-1] if i+1<len(cuts)-1 else 0)) for i in range(len(cuts)-1)]
json.dump(out,open("chunks.json","w"))
print(len(out)); print([round(c[2],1) for c in out])
# also print dips below -40 dB
print("min db",sm.min(), "pct", np.percentile(sm,[5,25,50]))
