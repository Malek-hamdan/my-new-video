import sherpa_onnx, soundfile as sf, json, numpy as np, sys
d="sherpa-onnx-whisper-large-v3/large-v3-"
r=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=d+"encoder.int8.onnx",decoder=d+"decoder.int8.onnx",tokens=d+"tokens.txt",language="ar",task="transcribe",num_threads=4)
x,sr=sf.read("audio16.wav"); x=x.astype(np.float32)
out=[]
for a in np.arange(0,72,5.0):
    b=min(a+9,76.9); s=r.create_stream(); s.accept_waveform(sr,x[int(a*sr):int(b*sr)]); r.decode_stream(s)
    t=s.result.text.strip(); out.append([float(a),float(b),t]); print(f"W[{a:.0f}-{b:.1f}] {t}",flush=True)
json.dump(out,open("asr2.json","w"),ensure_ascii=False,indent=1)
