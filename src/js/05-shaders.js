/* ════════════════════════ shaders ════════════════════════ */
const VS = `#version 300 es
void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position=vec4(p*2.-1.,0.,1.); }`;

const FS_SCENE = `#version 300 es
precision highp float;
uniform sampler2D uTex,uPrev,uTex2,uCode,uGhostA,uGhostB; uniform float uImgMix,uGhostMix,uCodeAmt;
uniform vec2 uRes;
uniform vec2 uCenter; uniform vec4 uRip; uniform vec3 uPalC,uPalD; uniform vec2 uTilt; uniform float uHueAmt,uTT,uSrcZ,uSrcRot,uStretch,uTunnel;
uniform float uWarpN,uFx,uKali,uJulia,uKalZ;
uniform vec3 uKaliP,uJuliaP;   // T163 shape of the styles (ENGINE.kali / ENGINE.julia): x = input zoom (smaller = closer = bigger shapes), y = iterations, z = fold scale (Kali) / c drift (Julia); uKalZ = ENGINE.kal.zoom
uniform float uMono,uT,uTile,uTileN,uTileMode,uTileSeed,uTileSize,uWarp,uKal,uKalN,uFb,uFbHue,uHue,uPal,uSide,uBreath,uMelt,uZoom,uRot,uAber,uPulse,uBright,uAspect,uAnchor;
vec2 gX=vec2(0.),gY=vec2(0.); bool gOn=false;   // tunnel only: analytic screen gradients of the sampling coordinate, so the mip level never sees the ring wrap
vec4 texI(sampler2D t,vec2 uv){
  if(gOn){ vec2 ax=gX*vec2(1./uAspect,1.), ay=gY*vec2(1./uAspect,1.); return uImgMix<=0.?textureGrad(t,uv,ax,ay):mix(textureGrad(t,uv,ax,ay),textureGrad(uTex2,uv,ax,ay),uImgMix); }
  return uImgMix<=0.?texture(t,uv):mix(texture(t,uv),texture(uTex2,uv),uImgMix); }   // crossfade between two source images (display pass of the source only, not the feedback)
out vec4 o;
const float TAU=6.28318530718;
vec3 hueRot(vec3 c,float a){float s=sin(a),co=cos(a);const vec3 k=vec3(.57735);return c*co+cross(k,c)*s+k*dot(k,c)*(1.-co);}
vec2 rot(vec2 p,float a){float s=sin(a),c=cos(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
vec2 kal(vec2 p,float n){
  vec2 off=vec2(.12*sin(uT*.07),.1*cos(uT*.05)-.05)+uCenter; p-=off;
  float a=atan(p.y,p.x),r=length(p)*uKalZ,seg=TAU/n; a=mod(a,seg); a=abs(a-seg*.5);   // T163: uKalZ < 1 = closer (the wedges show a smaller part of the picture, so bigger)
  return r*vec2(cos(a),sin(a))+off;
}
// tiles: cut the picture into an N×N grid; each cell turns / zooms / shifts its own piece (smooth, never a flash)
float h21(vec2 i){return fract(sin(dot(i+uTileSeed,vec2(12.9898,78.233)))*43758.5453);}
vec2 tile(vec2 p){
  float N=uTileN/max(.001,uTileSize); vec2 g=p*N, id=floor(g), f=fract(g)-.5, c=(id+.5)/N;
  float h=h21(id), a, z=1.;
  if(uTileMode<.5){ a=mod(id.x+id.y,2.)*2.-1.; a*=1.57*sin(uTT*.5+h*.8); }                       // checkerboard: neighbours turn opposite ways
  else if(uTileMode<1.5){ a=1.3*sin(id.x*.55+id.y*.4+uTT*1.2); z=1.+.25*sin(id.y*.7-uTT*.9); }      // wave rolling across the grid
  else { a=(h-.5)*3.2*sin(uTT*.6+h*6.); z=1.+.4*(h-.5)*sin(uTT*.8+h*9.); c+=(vec2(h21(id+7.),h21(id+13.))-.5)*.3/N*sin(uTT*.5+h*5.); }   // shatter: every piece on its own
  return mix(p,c+rot(f,a)*z/N,uTile);
}
// styles (2D, cheap, inspired by raymarched Shadertoy fractals): the picture is re-sampled through a fractal map
const float KALI_K=2.5;   // T142: Kali response exponent, mix = uKali^KALI_K (the |.| folds are harsh: at .3 it looks like Julia at .3, 1 is unchanged; calibrated with stills)
vec2 kaliFold(vec2 p){   // Kaliset-like: fold |p+1|-1, inversion, scale, repeated
  vec2 q=p*uKaliP.x; float sc=uKaliP.z+.35*sin(uT*.13);
  for(int i=0;i<12;i++){ if(float(i)>=uKaliP.y) break; q=abs(q+1.)-1.; q/=clamp(dot(q,q),.25,1.); q*=sc; }
  return q*.35;
}
vec2 juliaWarp(vec2 p){   // a few Julia iterations: the picture is smeared along the orbit
  vec2 z=p*uJuliaP.x+vec2(.1*sin(uT*.04),-.6+.05*cos(uT*.05)), c=vec2(-.74+.08*uJuliaP.z*sin(uT*.07),.12+.1*uJuliaP.z*cos(uT*.09));   // zoomed in on the set's lower border (seen up close), drifting slowly along it
  for(int i=0;i<16;i++){ if(float(i)>=uJuliaP.y) break; z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c; }
  return z*.35/(1.+.1*dot(z,z));
}
vec4 codeS(vec2 p){ return texture(uCode,vec2(p.x/1.7778,p.y)+.5); }   // crazy live-coding text (2D canvas, whole frame, transparent background)
vec2 warp(vec2 p){
  float w=uWarp*.12, t=uT;
  for(int i=0;i<4;i++){float fi=float(i); if(fi>=uWarpN) break;
    p+=w*vec2(sin(p.y*(3.+fi)+t*(.5+.13*fi)+fi*1.7),cos(p.x*(3.+fi)-t*(.45+.11*fi)+fi*2.3));}
  p.y+=uMelt*.12*sin(p.x*5.+t*.8)*(.5+.5*sin(t*.3+p.x*2.));
  p.x+=uMelt*.05*sin(p.y*9.-t*1.1);
  return p;
}
vec3 tx(vec2 p){
  vec2 uv=vec2(p.x/uAspect,p.y)+.5; if(uFx<.5) return texI(uTex,uv).rgb;   // low quality: no colour fringing
  float d=uAber*.012; vec2 dir=normalize(p+1e-4);
  return vec3(texI(uTex,uv+dir*d).r,texI(uTex,uv).g,texI(uTex,uv-dir*d).b);
}
// everything between the coordinate map and the source anchor for ONE coordinate p: tiles, styles, kaleidoscope + warp, source sample, code text, palette, hue
vec3 layer(vec2 p,out vec4 cd){
  float n0=floor(uKalN),f=fract(uKalN);
  if(uTile>.001) p=tile(p);
  if(uKali>.001) p=mix(p,kaliFold(p),(uKali<1.?pow(uKali,KALI_K):uKali));   // T142: perceptual curve (the |.| folds make seams even at tiny mixes); P.kali stays the amount
  if(uJulia>.001) p=mix(p,juliaWarp(p),uJulia);
  vec2 pa=warp(mix(p,kal(p,n0),uKal)), pb=warp(mix(p,kal(p,n0+1.),uKal));
  vec3 c=mix(tx(pa),tx(pb),f);
  cd=vec4(0.);
  if(uCodeAmt>.001){ cd=mix(codeS(pa),codeS(pb),f); float ca=cd.a*uCodeAmt; c=mix(c*(1.-.4*ca),cd.rgb,ca); }   // the code text is part of the SOURCE: everything below (palette, hue, trails, mono) acts on it; never above 1, so the feedback stays stable
  float lum=dot(c,vec3(.299,.587,.114));
  vec3 pal=.5+.5*cos(TAU*(lum*uPalC+uHue*.2*uHueAmt+uPalD));
  c=mix(c,pal*(.55+.6*lum),uPal*.85);
  return hueRot(c,(uHue+length(p)*1.5*uPal)*uHueAmt);
}
void main(){
  vec2 fc=gl_FragCoord.xy/uRes;
  vec2 p0=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 pr=p0;   // click ripple: a soft ring of displacement that spreads from the click and fades out
  if(uRip.w>0.){ vec2 d=p0-uRip.xy; float r=length(d), ring=exp(-pow((r-uRip.z*.7)*9.,2.))*(1.-smoothstep(0.,2.,uRip.z)); pr+=d/(r+1e-4)*ring*.07; }
  pr/=1.+dot(p0,uTilt);   // camera tilt: cheap perspective, the picture leans away to one side
  vec2 p=rot(pr/uZoom,uRot);
  p*=1.+uBreath*.05*sin(length(p)*9.-uT*1.6);
  p*=1.-uPulse*.04;
  vec3 c; vec4 cd;
  if(uTunnel>.001){
    // EFFECT tunnel: log-polar infinite zoom, the picture rings itself inward forever (with a slow twist); mixed in by uTunnel.
    // The ring phase wraps (fract), so two layers one ring apart are cross-faded across the wrap (no hard seam), and each gets analytic
    // gradients of its sampling coordinate (hardware derivatives would explode at the wrap and pick the blockiest mip level)
    vec2 dpx=dFdx(p), dpy=dFdy(p);
    float r=length(p)+1e-4, r2=r*r, lr=log(r), a2=atan(p.y,p.x)+lr*.35+uT*.05, u=(lr-uT*.22)/.7, fr=fract(u), w=smoothstep(.6,1.,fr);
    vec2 e=vec2(cos(a2),sin(a2)), nn=vec2(-e.y,e.x);
    float dlx=dot(p,dpx)/r2, dly=dot(p,dpy)/r2, dax=(p.x*dpx.y-p.y*dpx.x)/r2+.35*dlx, day=(p.x*dpy.y-p.y*dpy.x)/r2+.35*dly;
    float rA=.07*exp(fr*1.95), rB=rA*exp(-1.95); vec4 cdA,cdB;
    gOn=true;
    gX=mix(dpx,rA*(1.95*dlx/.7*e+dax*nn),uTunnel); gY=mix(dpy,rA*(1.95*dly/.7*e+day*nn),uTunnel); vec3 cA=layer(mix(p,rA*e,uTunnel),cdA);
    gX=mix(dpx,rB*(1.95*dlx/.7*e+dax*nn),uTunnel); gY=mix(dpy,rB*(1.95*dly/.7*e+day*nn),uTunnel); vec3 cB=layer(mix(p,rB*e,uTunnel),cdB);
    gOn=false; c=mix(cA,cB,w); cd=mix(cdA,cdB,w);
  } else { if (uTile > .001) { gOn = true; gX = dFdx(p); gY = dFdy(p); } c = layer(p, cd); gOn = false; }
  // source anchor: the untouched image stays faintly readable in the centre, even deep inside the kaleidoscope
  // EFFECT source-stretch: the ghost is elongated along a slowly turning axis, sheared, swayed and swirled (uStretch = strength)
  vec2 ps=rot(p0/uSrcZ,uSrcRot);
  if(uStretch>.001){ float ax=uT*.05+uStretch; vec2 e=vec2(cos(ax),sin(ax)); float al=dot(ps,e), be=dot(ps,vec2(-e.y,e.x));
    float k=1.+.9*uStretch*sin(uT*.11+1.); al/=k; be*=1.+.35*uStretch*(k-1.);   // elongate along the axis, thin across
    be+=uStretch*.25*al*sin(uT*.07);                                            // shear
    ps=al*e+be*vec2(-e.y,e.x); ps+=uStretch*.08*vec2(sin(uT*.17),cos(uT*.13));   // sway
    ps=rot(ps,uStretch*.6*sin(uT*.09)*(1.-smoothstep(0.,.7,length(ps)))); }     // swirl (strongest in the centre)
  ps+=.04*vec2(sin(ps.y*5.+uT*.23),cos(ps.x*5.+uT*.19));   // the ghost of the source drifts too: slow zoom, turn and wobble
  vec3 srcA=texI(uGhostA,vec2(ps.x/uAspect,ps.y)+.5).rgb; vec3 srcB=texI(uGhostB,vec2(ps.x/uAspect,ps.y)+.5).rgb; vec3 src=mix(srcA,srcB,uGhostMix);
  float inside=(1.-smoothstep(.42*uAspect,.5*uAspect,abs(ps.x)))*(1.-smoothstep(.42,.5,abs(ps.y)));
  c=mix(c,src,uAnchor*inside);
  c=mix(c,c*.12,smoothstep(.5*uAspect,.5*uAspect+.03,abs(p0.x))*uSide);            // the poster is square: dark ghost on the sides
  // feedback: previous frame, slightly rotated/zoomed and hue-shifted → rainbow trails
  vec2 q=fc-.5; q.x*=uRes.x/uRes.y;
  q=rot(q,.004+.01*uFb)*(1.-.006-.01*uFb*sin(uT*.2));
  q.x/=uRes.x/uRes.y; q+=.5;
  vec3 pv=hueRot(texture(uPrev,q).rgb,uFbHue);
  pv=clamp(mix(vec3(dot(pv,vec3(.299,.587,.114))),pv,1.04),0.,1.);   // trails get slightly more saturated, not greyer
  c=mix(c,pv,uFb);
  c=mix(c,cd.rgb,cd.a*uCodeAmt*.6);   // crazy code: a second, lighter pass after the trails keeps the text readable (same warped coordinates, convex mix: no blow-out)
  c=mix(c,vec3(dot(c,vec3(.299,.587,.114))),uMono);
  c*=uBright;   // (the pulse flash is added in the display pass, outside the feedback loop, so it can't accumulate)
  o=vec4(c,1.);
}`;

const FS_SHOW = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform float uT,uAber,uPulse,uHi,uFx,uDark,uBlaze,uStrobe,uRate,uCells,uGrid,uGlitch,uGSeed,uNeg,uPh,uCol,uCacc,uCph;
out vec4 o;
float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes, d=uv-.5; float r=length(d);
  float ab=.002+uAber*.004+uPulse*.003+uHi*.002;
  // intro glitch (generated only, display pass only): 0.5 s slots, a glitch shows in the first 0.15 s of a slot; slots are picked by the seed (uGSeed), so it is a pure function of uT
  vec2 uvg=uv; float rgbK=0.;
  if(uGlitch>.001){
    float sl=floor(uT*2.), ph=fract(uT*2.), sd=uGSeed;
    if(ph<.3 && h1(vec2(sl,sd))<.08+.75*uGlitch){
      int nb=1+int(h1(vec2(sl,sd+1.))*2.99);   // 1-3 thin horizontal slices, shifted sideways
      for(int k=0;k<3;k++){ if(k<nb){ float fk=float(k)*5.+2.;
        float yb=h1(vec2(sl,sd+fk)), hb=.004+.012*h1(vec2(sl,sd+fk+1.));
        if(abs(uv.y-yb)<hb) uvg.x+=(h1(vec2(sl,sd+fk+2.))-.5)*.03*uGlitch; } }
      if(h1(vec2(sl,sd+20.))<.4) rgbK=.002+.006*uGlitch;   // brief RGB split
      if(h1(vec2(sl,sd+30.))<.15) uvg+=(vec2(h1(vec2(sl,sd+31.)),h1(vec2(sl,sd+32.)))-.5)*.012*uGlitch;   // tiny position jump
    }
  }
  vec3 c=rgbK>0.?vec3(texture(uTex,uvg+vec2(rgbK,0.)).r,texture(uTex,uvg).g,texture(uTex,uvg-vec2(rgbK,0.)).b):uFx<.5?texture(uTex,uvg).rgb:vec3(texture(uTex,uvg+d*ab).r,texture(uTex,uvg).g,texture(uTex,uvg-d*ab).b);
  c=clamp(c,0.,1.); float L=dot(c,vec3(.299,.587,.114)); c=mix(vec3(L),c,1.8); c=clamp(c,0.,1.); c=mix(c,c*c*(3.-2.*c),.5);   // colour grade: richer, less pastel
  c+=uPulse*.05; c*=1.-.55*smoothstep(.45,1.05,r*1.2);
  // moods (display pass only, nothing here feeds back): dark = only the brightest bits survive, blaze = brighter and more saturated (T160: only a small white lift), strobe = fast white / dark alternation
  float th=uDark*.45; c=max(c-th,0.)/(1.-th); c*=1.+.5*uDark;
  if(uBlaze>.001){ float Lb=dot(c,vec3(.299,.587,.114)); c=max(mix(vec3(Lb),c,1.+.4*uBlaze),0.); c=c*(1.+.6*uBlaze)+uBlaze*.08; }
  // T161: uPh = the strobe phase in cycles (computed on the CPU, a closed form of the time, so it can accelerate); uNeg = the flash is the inverted image instead of white (the off half is the plain picture)
  c=mix(c,fract(uPh)<.5?(uNeg>.5?1.-c:vec3(1.)):(uNeg>.5?c:c*.12),uStrobe*.85);
  if(uCells>.001){   // strobe grid: an N x N grid (N = uGrid, 3..10), ~30% random cells (re-rolled ~every second, a pure function of uT) flash white / dark / inverted at 8-14 Hz, the rest is untouched
    float N=max(3.,uGrid); vec2 cl=floor(uv*N); float id=cl.x+N*cl.y, ep=floor(uT/1.05); float total=N*N; int n=int(floor(total*0.3+0.5)); if(n<1) n=1; float sel=0.;
    for(int k=0;k<30;k++){ if(k<n && floor(h1(vec2(ep,float(k)))*total)==id) sel=1.; }
    float hh=h1(vec2(ep,id+20.)), ph=uCacc>.5?uCph*(.8+.4*hh)+hh*3.:uT*(8.+6.*hh)+hh*3.;   // T161: accelerating = the cell clock is the CPU ramp phase (uCph), each cell at 0.8-1.2 x its rate
    float on=step(fract(ph),.5), md=floor(h1(vec2(ep,id+40.))*3.);
    vec3 fl=md<.5?vec3(1.):md<1.5?vec3(.02):1.-c;
    if(uCol>.5){ float hc=floor(h1(vec2(id+7.,floor(ph)))*6.); fl=clamp(abs(fract(vec3(hc/6.)+vec3(0.,.6667,.3333))*6.-3.)-1.,0.,1.); }   // coloured: red / yellow / green / cyan / blue / magenta from the cell and its flash count
    c=mix(c,fl,uCells*sel*on);
  }
  if(uFx>.5){ float g=fract(sin(dot(gl_FragCoord.xy+uT*91.,vec2(12.9898,78.233)))*43758.5453); c+=(g-.5)*(.05+.05*uHi); }
  o=vec4(c,1.);
}`;

