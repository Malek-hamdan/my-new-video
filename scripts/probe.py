import sherpa_onnx, soundfile as sf, numpy as np, sys
d="sherpa-onnx-whisper-large-v3/large-v3-"
r=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=d+"encoder.int8.onnx",decoder=d+"decoder.int8.onnx",tokens=d+"tokens.txt",language="ar",task="transcribe",num_threads=4)
x,sr=sf.read("audio16.wav"); x=x.astype(np.float32)
for a,b in [tuple(map(float,p.split("-"))) for p in sys.argv[1:]]:
    seg=np.concatenate([np.zeros(sr//2,np.float32),x[int(a*sr):int(b*sr)],np.zeros(sr//2,np.float32)])
    s=r.create_stream(); s.accept_waveform(sr,seg); r.decode_stream(s); print(f"P {a}-{b}: {s.result.text}",flush=True)
