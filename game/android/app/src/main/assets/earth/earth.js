// The real Earth behind the Golden Kingdom. Over the world's levels the track comes down from orbit,
// through the atmosphere and the clouds, to the coast of Beirut. The Earth is drawn first, from a
// camera that turns with the game's camera, then the track and the ball on top of it.
// Satellite imagery: NASA Blue Marble (public domain). Close to the ground the land is filled in with
// relief, trees and town blocks generated here, since no picture that sharp fits in a game.
(() => {
  const RE = 6371;   // km
  let THREE, ready = false, globe, cloudSphere, atmMesh, farS, nearS, farCam, nearCam, U = [], puffs, buildings, trees, whiteOut, sunGlow, stars, sky, skyU, atmU, cloudsU, region, local;
  const st = { alt: 2e4, reentry: 0, cloud: 0, street: false };
  window.EARTH = { ready: () => ready, init, frame, state: st };

  function ll(lon, lat, r) {   // degrees to a point on the sphere, in the layout of three's sphere UVs
    const ph = (lon + 180) / 360 * Math.PI * 2, th = (90 - lat) / 180 * Math.PI;
    return new THREE.Vector3(-r * Math.cos(ph) * Math.sin(th), r * Math.cos(th), r * Math.sin(ph) * Math.sin(th));
  }
  const cl = (x, a, b) => Math.min(b, Math.max(a, x)), sm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const texOf = (im, mip = true) => { const t = new THREE.Texture(im); t.anisotropy = 8; t.generateMipmaps = mip; t.needsUpdate = true; return t; };

  // shared shader pieces: noise detail that only adds what the screen can show, simple haze, and tone mapping
  const LIB = oct => `
    float hsh(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x),mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x),mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x),f.y),f.z); }
    float detail(vec3 p, float pix){ float s=0.0, a=0.5, f=0.02;
      for(int i=0;i<${oct};i++){ float w=smoothstep(pix, pix*4.0, 1.0/f); s+=a*w*(vn(p*f)-0.5); f*=2.07; a*=0.62; } return s; }
    vec3 dec(vec3 c){ return pow(c, vec3(2.2)); }
    vec3 outc(vec3 c){ c=(c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14); return pow(clamp(c,0.0,1.0), vec3(1.0/2.2)); }
    uniform vec3 sun, hazeCol; uniform float hazeK;
    vec3 haze(vec3 c, float d, vec3 wp){ float h=max(length(wp)-${RE}.0,0.0); return mix(c, hazeCol, 1.0-exp(-d*hazeK*exp(-h/8.0))); }`;
  const VS = `varying vec2 vUv; varying vec3 vW; varying vec3 vN;
    void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.0); }`;
  const uni = extra => { const u = Object.assign({ sun: { value: null }, hazeCol: { value: new THREE.Color() }, hazeK: { value: 0 } }, extra); U.push(u); return u; };

  async function init(three, renderer, quality) {
    THREE = three;
    const hi = quality === 'high', oct = hi ? 8 : quality === 'medium' ? 6 : 4, T = window.EARTH_TEX, G = window.REG;
    const [dayI, waterI, cloudsI, lightsI, regI] = await Promise.all([img(window.EARTH_DAY4K || T.day), img(T.water), img(T.clouds), img(T.lights), img(T.region)]);
    const tex = { day: texOf(dayI), water: texOf(waterI), clouds: texOf(cloudsI), lights: texOf(lightsI), region: texOf(regI) };
    const SUN = ll(18, 22, 1).normalize();   // afternoon sun over the Levant
    farS = new THREE.Scene(); nearS = new THREE.Scene();
    farCam = new THREE.PerspectiveCamera(62, 1, 1, 1e5); nearCam = new THREE.PerspectiveCamera(62, 1, 0.003, 600);

    // the globe
    const eu = uni({ day: { value: tex.day }, water: { value: tex.water }, night: { value: tex.lights }, alt: { value: 1e4 } });
    farS.add(globe = new THREE.Mesh(new THREE.SphereGeometry(RE, hi ? 256 : 160, hi ? 160 : 100), new THREE.ShaderMaterial({ uniforms: eu, vertexShader: VS,
      fragmentShader: `uniform sampler2D day, water, night; uniform float alt; varying vec2 vUv; varying vec3 vW; ${LIB(oct)}
        void main(){
          vec3 n=normalize(vW), v=normalize(cameraPosition-vW); float d=dot(n,sun), k=smoothstep(-0.12,0.2,d);
          float dist=length(cameraPosition-vW), wm=texture2D(water,vUv).r; vec3 c=dec(texture2D(day,vUv).rgb);
          c*=1.0+(1.0-wm)*detail(vW, dist*0.0012)*0.55;
          vec3 col=c*(0.03+1.35*max(d,0.0));
          vec3 h=normalize(sun+v); col+=wm*vec3(1.0,0.9,0.75)*pow(max(dot(n,h),0.0),400.0)*0.6*k + wm*vec3(0.01,0.04,0.09)*k;
          col+=dec(texture2D(night,vUv).rgb)*vec3(1.6,1.2,0.75)*2.5*(1.0-k);
          col+=vec3(0.25,0.5,1.0)*pow(1.0-max(dot(n,v),0.0),3.0)*0.6*k*smoothstep(60.0,400.0,alt);
          gl_FragColor=vec4(outc(haze(col,dist,vW)),1.0); }` })));
    // clouds over the globe
    cloudsU = uni({ map: { value: tex.clouds }, op: { value: 1 } });
    farS.add(cloudSphere = new THREE.Mesh(new THREE.SphereGeometry(RE + 7, hi ? 200 : 128, hi ? 120 : 80), new THREE.ShaderMaterial({ uniforms: cloudsU, transparent: true, depthWrite: false, vertexShader: VS,
      fragmentShader: `uniform sampler2D map; uniform float op; varying vec2 vUv; varying vec3 vW; ${LIB(Math.min(oct, 6))}
        void main(){ vec3 n=normalize(vW); float d=dot(n,sun), dist=length(cameraPosition-vW);
          float a=smoothstep(0.03,0.55,texture2D(map,vUv).r)*(0.85+0.3*detail(vW, dist*0.0012));
          gl_FragColor=vec4(outc(haze(vec3(0.05+1.2*max(d,0.0)),dist,vW)), clamp(a,0.0,1.0)*op*(0.05+0.95*smoothstep(-0.25,0.1,d))); }` })));
    // the blue rim of air seen from space
    atmU = { sun: { value: SUN }, op: { value: 1 } };
    farS.add(atmMesh = new THREE.Mesh(new THREE.SphereGeometry(RE * 1.022, 160, 100), new THREE.ShaderMaterial({ uniforms: atmU, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(position); vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.0); }`,
      fragmentShader: `uniform vec3 sun; uniform float op; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 v=normalize(cameraPosition-vW); float f=pow(1.0-abs(dot(vN,v)),2.4), lit=0.2+0.8*smoothstep(-0.3,0.4,dot(vN,sun));
          gl_FragColor=vec4(mix(vec3(0.12,0.3,1.0),vec3(0.55,0.8,1.0),f)*f*1.7*lit*op, f*lit*op); }` })));
    // sky: black space above 100 km, blue air below
    skyU = { alt: { value: 1e4 }, sun: { value: SUN }, up: { value: new THREE.Vector3() }, heat: { value: 0 } };
    sky = new THREE.Mesh(new THREE.SphereGeometry(9e4, 48, 24), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float alt, heat; uniform vec3 sun, up; varying vec3 vD;
        void main(){ float e=dot(vD,up), air=1.0-smoothstep(12.0,110.0,alt);
          vec3 c=mix(vec3(0.62,0.78,0.98), vec3(0.06,0.22,0.62), pow(clamp(e,0.0,1.0),0.45)) + vec3(1.0,0.85,0.6)*pow(max(dot(vD,sun),0.0),12.0)*0.6;
          c=c*air + vec3(1.0,0.35,0.08)*heat*0.35*(1.0-abs(e));
          gl_FragColor=vec4(pow(clamp(c,0.0,1.0),vec3(1.0/1.6)),1.0); }` }));
    sky.renderOrder = -10; sky.frustumCulled = false; farS.add(sky);
    { const p = []; for (let i = 0; i < 3000; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(8e4); p.push(v.x, v.y, v.z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true })); stars.frustumCulled = false; farS.add(stars); }
    { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,245,215,1)'); gr.addColorStop(0.25, 'rgba(255,200,120,.35)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sunGlow.frustumCulled = false; farS.add(sunGlow); }

    // the land and sea around Lebanon: a regional map with heights, and a finer patch where the ball lands
    const GN = G.n, LON = [28, 44], LAT = [27, 40];
    const hn = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vnz = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = hn(i, j), b = hn(i + 1, j), c = hn(i, j + 1), d = hn(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
    const fbm = (x, y, o) => { let s = 0, a = 0.5; for (let k = 0; k < o; k++) { s += a * (vnz(x, y) - 0.5); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };
    function heightAt(lon, lat, oct) {   // km above the sea (0 at sea) and how much of it is land
      const fx = (lon - LON[0]) / (LON[1] - LON[0]), fy = (LAT[1] - lat) / (LAT[1] - LAT[0]);
      const x = cl(fx * GN, 0, GN - 1e-6), y = cl(fy * GN, 0, GN - 1e-6), i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j;
      const bl = arr => { const at = (a, b) => arr[(j + b) * (GN + 1) + (i + a)]; return at(0, 0) * (1 - u) * (1 - v) + at(1, 0) * u * (1 - v) + at(0, 1) * (1 - u) * v + at(1, 1) * u * v; };
      let h = Math.max(0, bl(G.h) - 12) / 127 * 4.2; const land = 1 - cl((bl(G.w) / 255 - 0.35) / 0.3, 0, 1);
      h = land * Math.max(0.02, h + fbm(lon * 9, lat * 9, oct) * (0.5 + h * 0.9) + fbm(lon * 60, lat * 60, Math.max(1, oct - 3)) * 0.18 * (0.3 + h));
      return [h, land, fx, fy];
    }
    function terrain(lon0, lon1, lat0, lat1, n, oct, lift) {
      const pos = [], uv = [], wat = [], idx = [];
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        const lon = lon0 + (lon1 - lon0) * i / n, lat = lat1 - (lat1 - lat0) * j / n, [h, land, fx, fy] = heightAt(lon, lat, oct);
        const p = ll(lon, lat, RE + h * land + lift); pos.push(p.x, p.y, p.z); uv.push(fx, fy); wat.push(1 - land);
      }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('wat', new THREE.Float32BufferAttribute(wat, 1)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    const tu = uni({ day: { value: tex.region }, time: { value: 0 } });
    const terMat = new THREE.ShaderMaterial({ uniforms: tu,
      vertexShader: `attribute float wat; varying float vWat; ${VS.replace('void main(){', 'void main(){ vWat=wat;')}`,
      fragmentShader: `uniform sampler2D day; uniform float time; varying float vWat; varying vec2 vUv; varying vec3 vW; varying vec3 vN; ${LIB(oct)}
        void main(){
          vec3 up=normalize(vW), v=normalize(cameraPosition-vW); float dist=length(cameraPosition-vW), pix=dist*0.0012, hgt=length(vW)-${RE}.0; vec3 col;
          if (vWat>0.5) {   // sea: small waves that catch the sun, and the sky at a glancing angle
            vec3 wp=(vW+vec3(time*0.004,0.0,time*0.003))*40.0; float n0=detail(wp,pix*40.0), e=0.03;
            vec3 n=normalize(up+vec3(detail(wp+vec3(e,0,0),pix*40.0)-n0, detail(wp+vec3(0,e,0),pix*40.0)-n0, detail(wp+vec3(0,0,e),pix*40.0)-n0)*1.6);
            float fr=pow(1.0-max(dot(n,v),0.0),5.0)*0.9+0.04; vec3 h=normalize(sun+v);
            col=mix(vec3(0.004,0.03,0.08), vec3(0.35,0.55,0.9), fr)*(0.4+0.8*max(dot(up,sun),0.0)) + vec3(1.0,0.9,0.75)*pow(max(dot(n,h),0.0),500.0)*4.0;
          } else {
            vec3 c=dec(texture2D(day,vUv).rgb);
            float e=max(pix*1.5,0.004), d0=detail(vW,pix);
            vec3 g=vec3(detail(vW+vec3(e,0,0),pix)-d0, detail(vW+vec3(0,e,0),pix)-d0, detail(vW+vec3(0,0,e),pix)-d0)/e;
            g-=up*dot(g,up); vec3 nn=normalize(normalize(vN)-g*0.035);
            c*=1.0+d0*0.7;
            float green=clamp((c.g-max(c.r,c.b)*0.92)*14.0,0.0,1.0); vec2 km=vec2(vUv.x*1478.0, vUv.y*1446.0);
            c=mix(c, vec3(0.05,0.11,0.04), smoothstep(0.55,0.75,vn(vec3(km*9.0,0.0)))*smoothstep(0.08,0.02,pix)*(0.35+green)*0.75);
            float rock=smoothstep(0.55,0.8,1.0-dot(nn,up)); c=mix(c, vec3(0.2,0.18,0.15)*(1.0+d0), rock*0.6);
            vec2 cell=floor(km/0.07); float bld=hsh(vec3(cell,3.0)); vec2 fr=fract(km/0.07);
            float town=smoothstep(0.6,0.15,hgt)*smoothstep(0.0,0.03,hgt)*smoothstep(0.35,0.55,vn(vec3(km*0.6,7.0)))*smoothstep(0.05,0.015,pix);
            float roof=step(0.18,fr.x)*step(0.18,fr.y)*step(0.25,bld);
            c=mix(c, mix(vec3(0.32,0.32,0.33), mix(vec3(0.78,0.74,0.68),vec3(0.62,0.36,0.28),step(0.8,bld)), roof), town*0.9);
            c=mix(c, vec3(0.9,0.92,0.95), smoothstep(3.0,3.6,hgt+d0*0.6)*(1.0-rock*0.7));
            col=c*(0.1+1.45*max(dot(nn,sun),0.0));
          }
          gl_FragColor=vec4(outc(haze(col,dist,vW)),1.0); }` });
    region = new THREE.Mesh(terrain(LON[0], LON[1], LAT[0], LAT[1], hi ? 220 : 140, 4, 0), terMat); nearS.add(region);
    local = new THREE.Mesh(terrain(34.9, 36.3, 33.5, 34.3, hi ? 400 : 220, hi ? 8 : 6, 0.03), terMat); nearS.add(local);

    // Beirut and the hills behind it in 3D: town blocks on the low coastal land, pines on the green slopes
    const rc = document.createElement('canvas'); rc.width = regI.width; rc.height = regI.height; const rg = rc.getContext('2d'); rg.drawImage(regI, 0, 0);
    const rpx = rg.getImageData(0, 0, rc.width, rc.height).data, colorAt = (fx, fy) => { const i = (Math.floor(cl(fy, 0, 0.999) * rc.height) * rc.width + Math.floor(cl(fx, 0, 0.999) * rc.width)) * 4; return [rpx[i], rpx[i + 1], rpx[i + 2]]; };
    const lit = new THREE.HemisphereLight(0xdfe8ff, 0x405040, 0.75), sl = new THREE.DirectionalLight(0xfff0d8, 1.25); sl.position.copy(SUN); nearS.add(lit, sl);
    nearS.fog = new THREE.FogExp2(0x8cb0e8, 0);
    const place = (mesh, n, pick) => {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(); let k = 0, tries = 0;
      while (k < n && tries++ < n * 30) { const r = pick(); if (!r) continue;
        const [lon, lat, h, sx, sy, sz, c] = r, up = ll(lon, lat, 1).normalize();
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.35));
        p.copy(ll(lon, lat, RE + h - 0.004)); s.set(sx, sy, sz); m.compose(p, q, s); mesh.setMatrixAt(k, m); mesh.setColorAt(k, col.set(c)); k++; }
      mesh.count = k; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    buildings = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), hi ? 4000 : 1500);
    place(buildings, buildings.count, () => {
      const lon = 35.44 + Math.random() * 0.2, lat = 33.82 + Math.random() * 0.11, [h, land] = heightAt(lon, lat, 8);
      if (land < 0.9 || h > 0.32 || h < 0.025) return null;
      const w = 0.018 + Math.random() * 0.03, tall = 0.012 + Math.pow(Math.random(), 2.5) * 0.11 * (1 - h / 0.35);
      return [lon, lat, h, w, tall, w * (0.7 + Math.random() * 0.6), ['#e8e2d6', '#d8cfc0', '#c9c4bc', '#efe9df', '#b8b2aa', '#d9b99b'][Math.floor(Math.random() * 6)]];
    });
    const cone = new THREE.ConeGeometry(1, 1, 5); cone.translate(0, 0.5, 0);
    trees = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial(), hi ? 6000 : 2000);
    place(trees, trees.count, () => {
      const lon = 35.48 + Math.random() * 0.45, lat = 33.72 + Math.random() * 0.3, [h, land, fx, fy] = heightAt(lon, lat, 8);
      if (land < 0.95 || h < 0.25 || h > 2.4) return null;
      const [r, g, b] = colorAt(fx, fy); if (g < Math.max(r, b) * 0.95 && Math.random() < 0.7) return null;
      const s = 0.006 + Math.random() * 0.01; return [lon, lat, h, s, s * (2.2 + Math.random()), s, ['#1d3b1a', '#264720', '#2f5426', '#1a3317'][Math.floor(Math.random() * 4)]];
    });
    nearS.add(buildings, trees);

    // the cloud bank: soft billboards between 3 and 7 km, all in one draw call
    const pc = document.createElement('canvas'); pc.width = pc.height = 128; const pg = pc.getContext('2d');
    for (let i = 0; i < 40; i++) { const x = 64 + (Math.random() - 0.5) * 60, y = 64 + (Math.random() - 0.5) * 40, r = 15 + Math.random() * 30, gr = pg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); pg.fillStyle = gr; pg.fillRect(0, 0, 128, 128); }
    const pu = { map: { value: new THREE.CanvasTexture(pc) }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() }, op: { value: 0 }, sun: { value: SUN } };
    puffs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: pu, transparent: true, depthWrite: false,
      vertexShader: `uniform vec3 camR, camU; varying vec2 vUv; varying float vShade; varying float vD;
        void main(){ vec3 c=(modelMatrix*instanceMatrix*vec4(0,0,0,1)).xyz; float s=length(instanceMatrix[0].xyz);
          vec3 w=c+(camR*position.x*1.6+camU*position.y)*s; vUv=uv; vShade=0.75+0.25*position.y; vD=length(cameraPosition-w);
          gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0); }`,
      fragmentShader: `uniform sampler2D map; uniform float op; varying vec2 vUv; varying float vShade; varying float vD;
        void main(){ float a=texture2D(map,vUv).a*op*smoothstep(0.05,0.4,vD); gl_FragColor=vec4(vec3(0.97,0.98,1.0)*vShade, a); }` }), hi ? 1200 : 500);
    { const m = new THREE.Matrix4(); for (let i = 0; i < puffs.count; i++) {
        const lon = 33.4 + Math.random() * 2.3, lat = 33.4 + Math.random() * 1.0, s = 1.5 + Math.random() * 4;
        m.makeScale(s, s, s).setPosition(ll(lon, lat, RE + 3 + Math.random() * 4)); puffs.setMatrixAt(i, m); } }
    puffs.frustumCulled = false; nearS.add(puffs); pu.op.value = 0; puffs.material.userData.u = pu;
    // inside the cloud, everything around turns white for a moment
    whiteOut = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    whiteOut.renderOrder = 100; whiteOut.frustumCulled = false; nearS.add(whiteOut);
    for (const u of U) u.sun.value = SUN;
    renderer.compile(farS, farCam); renderer.compile(nearS, nearCam);
    ready = true;
  }

  // the flight, by progress through the world (0 = the start, 1 = the end of the last level):
  // altitude (km), longitude and latitude of the point below
  // the last level (from 0.75) is on the ground, on Beirut's seafront, which the game builds itself
  const KEY = [[0, 19000, 14, 20], [0.15, 9000, 22, 25], [0.32, 1800, 30, 30], [0.44, 160, 33.2, 32.8], [0.53, 24, 34.5, 33.6], [0.6, 6.5, 34.95, 33.8], [0.67, 2.4, 35.3, 33.86], [0.73, 0.3, 35.46, 33.89], [0.75, 0.004, 35.48, 33.9], [1, 0.004, 35.5, 33.905]];
  function flight(p) {
    let k = 0; while (k < KEY.length - 2 && p > KEY[k + 1][0]) k++;
    const [p0, a0, o0, l0] = KEY[k], [p1, a1, o1, l1] = KEY[k + 1], s = sm(p0, p1, p);
    return { alt: Math.exp(Math.log(a0) + (Math.log(a1) - Math.log(a0)) * s), lon: o0 + (o1 - o0) * s, lat: l0 + (l1 - l0) * s };
  }
  function frame(renderer, gameCam, p, time) {
    const f = flight(cl(p, 0, 1)); st.alt = f.alt;
    const up = ll(f.lon, f.lat, 1).normalize(), pos = ll(f.lon, f.lat, RE + f.alt);
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize(), north = up.clone().cross(east);
    const fwd = east.clone().multiplyScalar(0.92).add(north.multiplyScalar(0.39)).normalize(), right = fwd.clone().cross(up);
    // the game's camera, turned into the Earth's frame (game x = right, y = up, z = backward), tipped down
    // toward the globe while far away and leveling out near the ground
    const look = (10 + 68 * sm(Math.log(40), Math.log(4000), Math.log(f.alt))) * Math.PI / 180;
    const frameQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd.clone().negate()));
    const q = frameQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -look)).multiply(gameCam.quaternion);
    for (const c of [farCam, nearCam]) { c.position.copy(pos); c.quaternion.copy(q); c.fov = gameCam.fov; c.aspect = gameCam.aspect; }
    farCam.near = Math.max(0.5, f.alt * 0.3); farCam.far = 1e5;
    nearCam.near = Math.max(0.003, f.alt * 0.004); nearCam.far = f.alt > 60 ? 3500 : 700;
    farCam.updateProjectionMatrix(); nearCam.updateProjectionMatrix();
    sky.position.copy(pos); stars.position.copy(pos); skyU.alt.value = f.alt; skyU.up.value.copy(up);
    stars.material.opacity = sm(15, 120, f.alt);
    sunGlow.position.copy(pos).addScaledVector(skyU.sun.value, 6e4); sunGlow.scale.setScalar(9000 * (0.6 + 0.4 * sm(10, 200, f.alt)));
    // the air: haze near the ground, the blue rim fading, the global clouds giving way to the cloud bank
    const hk = (1 - sm(10, 120, f.alt)) * 0.0045;
    for (const u of U) { u.hazeCol.value.setRGB(0.55, 0.72, 0.95); u.hazeK.value = hk; if (u.alt) u.alt.value = f.alt; if (u.time) u.time.value = time * 30; }
    atmU.op.value = sm(40, 300, f.alt); cloudsU.op.value = sm(5, 26, f.alt);
    nearS.fog.density = f.alt < 9 ? 0.018 * (1 - sm(1.2, 9, f.alt)) + 0.003 : 0;
    const street = f.alt < 0.08; st.street = street;
    globe.visible = cloudSphere.visible = atmMesh.visible = !street;
    region.visible = f.alt < 300 && !street; local.visible = f.alt < 60 && !street; buildings.visible = trees.visible = f.alt < 12 && !street;
    const pu = puffs.material.userData.u; pu.op.value = 1 - sm(12, 25, f.alt);
    pu.camR.value.set(1, 0, 0).applyQuaternion(q); pu.camU.value.set(0, 1, 0).applyQuaternion(q);
    st.cloud = sm(3, 4, f.alt) * (1 - sm(6.5, 7.5, f.alt));
    st.reentry = sm(140, 85, f.alt) * (1 - sm(40, 22, f.alt));
    skyU.heat.value = st.reentry;
    whiteOut.material.opacity = st.cloud * 0.8; whiteOut.position.copy(pos).add(new THREE.Vector3(0, 0, -1).applyQuaternion(q).multiplyScalar(nearCam.near * 2)); whiteOut.quaternion.copy(q);
    renderer.render(farS, farCam); if (!street) { renderer.clearDepth(); renderer.render(nearS, nearCam); }
    return st;
  }
})();
