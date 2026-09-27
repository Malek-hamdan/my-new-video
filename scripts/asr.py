import sherpa_onnx, soundfile as sf, json, numpy as np
d="sherpa-onnx-whisper-large-v3/large-v3-"
r=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=d+"encoder.int8.onnx",decoder=d+"decoder.int8.onnx",tokens=d+"tokens.txt",language="ar",task="transcribe",num_threads=4)
x,sr=sf.read("audio16.wav"); x=x.astype(np.float32)
def run(a,b):
    s=r.create_stream(); s.accept_waveform(sr,x[int(a*sr):int(b*sr)]); r.decode_stream(s); return s.result.text.strip()
res={"long":[],"chunks":[]}
for a in range(0,77,20):
    b=min(a+20,77); t=run(a,b); res["long"].append([a,b,t]); print(f"L[{a}-{b}] {t}",flush=True)
for a,b,_ in json.load(open("chunks.json")):
    t=run(a,b); res["chunks"].append([a,b,t]); print(f"C[{a:.2f}-{b:.2f}] {t}",flush=True)
json.dump(res,open("asr.json","w"),ensure_ascii=False,indent=1)
