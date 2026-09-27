import numpy as np, soundfile as sf, json
x,sr=sf.read("audio16.wav"); hop=160
db=20*np.log10(np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2)+1e-12) for i in range(len(x)//hop)]))
def snap(t,r=0.15):
    a,b=int((t-r)*100),int((t+r)*100); return round((a+int(np.argmin(db[a:b])))/100,2)
edl=[("H",17.04,20.61),("S1",1.59,13.50),("S2",16.35,20.61),("S3a",21.07,24.87),("S3b",25.96,35.13),
     ("S4",38.35,46.66),("S5",47.02,50.89),("S6",51.35,56.99),("S7",61.97,69.76),("S8",72.09,74.63)]
out=[(n,snap(a),snap(b)) for n,a,b in edl]
json.dump(out,open("edl.json","w")); print(out, sum(b-a for _,a,b in out))
