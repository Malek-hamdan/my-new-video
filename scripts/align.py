import numpy as np, soundfile as sf, json, re
x,sr=sf.read("audio16.wav"); hop=160
e=np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2)+1e-12) for i in range(len(x)//hop)])
db=20*np.log10(e); db=np.convolve(db,np.ones(3)/3,'same')
words=[]
def w8(w):  # syllable-ish weight
    w=re.sub(r'[ًٌٍَُِّْ]','',w)
    if w.isdigit(): return 8 if len(w)==4 else 4
    return max(1.5,len(w)*0.8)
for line in open("transcript.txt",encoding="utf8"):
    a,b,t=line.strip().split("|"); a=float(a); b=float(b); ws=t.split()
    fa,fb=int(a*100),int(b*100); seg=db[fa:fb]
    thr=np.percentile(seg,30); v=(seg>thr).astype(float)+0.05  # voiced weight
    cv=np.cumsum(v); cv/=cv[-1]
    wt=np.array([w8(w) for w in ws]); cw=np.concatenate([[0],np.cumsum(wt)/wt.sum()])
    ts=[a+np.searchsorted(cv,c)/100 for c in cw]; ts[0]=a; ts[-1]=b
    for i,w in enumerate(ws): words.append({"w":w,"s":round(float(ts[i]),2),"e":round(float(ts[i+1]),2)})
json.dump(words,open("words.json","w"),ensure_ascii=False,indent=0)
for i,w in enumerate(words): print(i,w["s"],w["e"],w["w"])
