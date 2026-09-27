import cv2, json, numpy as np
cap=cv2.VideoCapture("src.mp4"); fc=cv2.CascadeClassifier(cv2.data.haarcascades+"haarcascade_frontalface_default.xml")
out=[]; i=0
while True:
    ok,f=cap.read()
    if not ok or i>=int(76.9*30): break
    if i%5==0:
        g=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY); fs=fc.detectMultiScale(g,1.1,5,minSize=(80,80))
        if len(fs):
            x,y,w,h=max(fs,key=lambda r:r[2]*r[3]); out.append([i/30,float(x+w/2),float(y+h/2),float(w),float(h)])
    i+=1
json.dump(out,open("face.json","w")); a=np.array(out)
print(len(out), "cx",a[:,1].min(),a[:,1].mean(),a[:,1].max(),"cy",a[:,2].min(),a[:,2].mean(),a[:,2].max(),"w",a[:,3].mean(),"h",a[:,4].mean())
