from PIL import Image, ImageDraw, ImageFont, ImageFilter
CAIRO="/root/.fonts/Cairo-Black.ttf"; EMO="/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
def emoji(ch,size):
    f=ImageFont.truetype(EMO,109); im=Image.new("RGBA",(160,160),(0,0,0,0))
    ImageDraw.Draw(im).text((80,80),ch,font=f,embedded_color=True,anchor="mm")
    im=im.crop(im.getbbox()); return im.resize((size,int(size*im.height/im.width)),Image.LANCZOS)
def text_img(txt,size,fill,stroke=8,sc=(0,0,0)):
    f=ImageFont.truetype(CAIRO,size); d=ImageDraw.Draw(Image.new("RGBA",(10,10)))
    bb=d.textbbox((0,0),txt,font=f,direction="rtl",language="ar",stroke_width=stroke)
    im=Image.new("RGBA",(bb[2]-bb[0]+20,bb[3]-bb[1]+20),(0,0,0,0))
    ImageDraw.Draw(im).text((10-bb[0],10-bb[1]),txt,font=f,fill=fill,direction="rtl",language="ar",stroke_width=stroke,stroke_fill=sc)
    return im
def shadowed(im,r=14,off=8):
    W,H=im.size; out=Image.new("RGBA",(W+2*r+off,H+2*r+off),(0,0,0,0))
    sh=Image.new("RGBA",out.size,(0,0,0,0)); a=im.split()[3].point(lambda v:int(v*0.55))
    sh.paste((0,0,0,255),(r+off,r+off),a); sh=sh.filter(ImageFilter.GaussianBlur(r)); out=Image.alpha_composite(out,sh)
    out.alpha_composite(im,(r,r)); return out
def panel(W,H,top=(18,32,110),bot=(95,30,150),border=(255,255,255)):
    g=Image.new("RGBA",(W,H)); px=g.load()
    for y in range(H):
        c=tuple(int(top[i]+(bot[i]-top[i])*y/H) for i in range(3))
        for x in range(W): px[x,y]=c+(245,)
    m=Image.new("L",(W,H),0); ImageDraw.Draw(m).rounded_rectangle((0,0,W-1,H-1),radius=34,fill=255)
    out=Image.new("RGBA",(W,H),(0,0,0,0)); out.paste(g,(0,0),m)
    ImageDraw.Draw(out).rounded_rectangle((3,3,W-4,H-4),radius=32,outline=border,width=6)
    # France tricolour strip
    d=ImageDraw.Draw(out); s=W//3
    for i,c in enumerate([(0,85,164),(255,255,255),(239,65,53)]): d.rectangle((24+i*(W-48)//3,H-30,24+(i+1)*(W-48)//3,H-20),fill=c)
    return out
def player_card(name,fn,size=74):
    W,H=380,360; p=panel(W,H); b=emoji("⚽",120); p.alpha_composite(b,((W-b.width)//2,34))
    t=text_img(name,size,(255,214,10),stroke=6)
    if t.width>W-30: t=t.resize((W-30,int(t.height*(W-30)/t.width)),Image.LANCZOS)
    p.alpha_composite(t,((W-t.width)//2,180+(120-t.height)//2)); shadowed(p).save(f"ov/{fn}.png")
player_card("كريستيانو","card_cr"); player_card("ميسي","card_messi",90); player_card("زين الدين زيدان","card_zz",64)
# match card
W,H=760,300; p=panel(W,H); f1=emoji("🇫🇷",120); f2=emoji("🇧🇷",120)
p.alpha_composite(f1,(W-60-f1.width,40)); p.alpha_composite(f2,(60,40))
x=text_img("×",90,(255,255,255),6); p.alpha_composite(x,((W-x.width)//2,40))
t=text_img("فرنسا والبرازيل 1998",74,(255,255,255),6); p.alpha_composite(t,((W-t.width)//2,160)); shadowed(p).save("ov/card_match.png")
# Cristiano + Messi card
W,H=700,250; p=panel(W,H); b=emoji("⚽",80); p.alpha_composite(b,((W-b.width)//2,30))
a=text_img("كريستيانو",72,(255,214,10),6); m=text_img("ميسي",72,(255,214,10),6)
p.alpha_composite(a,(W-40-a.width,110)); p.alpha_composite(m,(40,110)); shadowed(p).save("ov/card_crm.png")
# hook title
l1=text_img("زيدان..",150,(255,214,10),12); l2=text_img("من كوكب آخر",104,(255,255,255),10); e=emoji("👽",120)
W=max(l1.width,l2.width+e.width+20)+20; im=Image.new("RGBA",(W,l1.height+l2.height-10),(0,0,0,0))
im.alpha_composite(l1,((W-l1.width)//2,0)); x0=(W-l2.width-e.width-20)//2
im.alpha_composite(l2,(x0+e.width+20,l1.height-10)); im.alpha_composite(e,(x0,l1.height-10+(l2.height-e.height)//2))
shadowed(im).save("ov/title.png")
# freeze emoji / text
shadowed(emoji("🤯",280)).save("ov/emo_mind.png")
t=text_img("90 دقيقة",120,(74,144,255),10); e=emoji("🙏",170)
im=Image.new("RGBA",(t.width+e.width+20,max(t.height,e.height)),(0,0,0,0)); im.alpha_composite(t,(e.width+20,(im.height-t.height)//2)); im.alpha_composite(e,(0,(im.height-e.height)//2)); shadowed(im).save("ov/frz2.png")
# CTA
l1=text_img("مين برأيك أفضل لاعب",88,(255,255,255),9); l2=text_img("في التاريخ؟",88,(255,214,10),9); l3=text_img("اكتب بالتعليقات",78,(255,255,255),8); e=emoji("👇",100)
W=max(l1.width,l2.width,l3.width+e.width+16)+80; H=l1.height+l2.height+l3.height+70
p=panel(W,H,(10,20,70),(70,20,120)); y=20
for l in (l1,l2): p.alpha_composite(l,((W-l.width)//2,y)); y+=l.height-6
x0=(W-l3.width-e.width-16)//2; p.alpha_composite(l3,(x0+e.width+16,y+6)); p.alpha_composite(e,(x0,y+6+(l3.height-e.height)//2))
shadowed(p).save("ov/cta.png")
for n in ["card_cr","card_messi","card_zz","card_match","card_crm","title","emo_mind","frz2","cta"]:
    print(n, Image.open(f"ov/{n}.png").size)
