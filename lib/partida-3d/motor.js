// PITCH ENGINE PRO — motor 3D da partida.
//
// GERADO por scripts/converter-motor-3d.py a partir de simulacao-partida-3d.html.
// NAO EDITE A MAO: rode o script de novo. Ele existe para que a conversao seja
// auditavel e repetivel — se chegar uma versao nova do HTML, e um comando.
//
// O QUE MUDOU em relacao ao HTML original (e so isto):
//
//   1. `THREE` global          -> import de 'three'
//   2. `sRGBEncoding`          -> `SRGBColorSpace` (removido no r152; sem a troca
//                                 o jogo renderiza com as cores lavadas)
//   3. loop e listeners        -> cancelaveis, senao sair da tela deixa a WebGL
//                                 viva e entrar de novo cria um segundo motor
//   4. boot pelo botao "GO"    -> `iniciar()`, porque quem decide a hora agora
//                                 e o React
//
// Fisica, IA, regras, arbitragem, replay e render continuam BYTE A BYTE iguais
// ao original. Se algo divergir do HTML, e bug da conversao, nao do motor.
//
// O HUD e desenhado pelo React (components/partida/campo-3d.tsx). O motor
// escreve nos elementos por id quando eles existem; quando nao existem, o helper
// `$` devolve um objeto inerte (`DEAD`) e a simulacao segue. Esse cuidado ja
// vinha do autor original — foi o que tornou esta migracao segura.

import * as THREE from "three"

/**
 * Cria uma instancia do motor. Os tipos publicos estao em motor.d.ts.
 * @param {import("./motor").OpcoesMotor} opcoes
 * @returns {import("./motor").Motor}
 */
export function criarMotor(opcoes) {
  // Estado do ciclo de vida. Fica no fecho da funcao, e nao no escopo do modulo,
  // para que duas instancias do motor nunca disputem as mesmas variaveis.
  let _destruido = false
  let _rafId = null
  const _timers = []
  const _listeners = []

  /** addEventListener que lembra do que registrou, para destruir() limpar. */
  function _on(alvo, evento, fn, opts){
    alvo.addEventListener(evento, fn, opts)
    _listeners.push([alvo, evento, fn])
  }

  // O motor original procurava o palco pelo id "stage". Agora ele vem por
  // parametro: o React e dono do DOM e pode montar a partida em qualquer lugar.
  const _palco = opcoes.palco

  // Formacao vinda do 2D, convertida em `formacaoDo2D`. Fica `null` quando a
  // tela nao passa nada, e o motor usa a `FORMATION` embutida — um 3D sem
  // formacao nao pode acontecer so porque o dado nao chegou.
  let _formacaoAtiva = null
  const QUALITY_INICIAL = opcoes.qualidade
    ?? (matchMedia?.("(pointer:coarse)").matches ? "mid" : "high")


/* ============================================================================
   PITCH ENGINE PRO
   Simulação a passo fixo de 60 Hz com render interpolado.
   Camadas: Audio · Tex · Gfx(post) · World · Ball · Player · Brain · Rules
            · Director · Replay · Hud
   ============================================================================ */

const CFG={
  pitch:{ L:105, W:68 },
  goal:{ w:7.32, h:2.44, depth:2.0 },
  ball:{
    r:0.11, m:0.43,      // bola tamanho 5 oficial
    spinDecay:0.28,      // 1/s — decaimento da rotação no ar
    e:0.62,              // restituição na grama
    mu:0.42,             // atrito tangencial no quique
    roll:0.55            // resistência ao rolamento (m/s²)
  },
  air:{ rho:1.225, wind:2.6, windDir:0.7, gust:.35 },
  speed:{ run:6.3, sprint:8.4, gk:5.4, accel:11.5, turn:7.2 },
  time:{ half:45 },      // relógio 1:1 — o que acelera é a simulação, não o cronômetro
  rules:{ offside:true },
  /* equilíbrio ofensivo/defensivo — os três números que mais mexem no placar.
     shotConf: confiança mínima para finalizar (maior = menos chutes)
     tackleRate: tentativas de carrinho por segundo por marcador
     gkReach: alcance do goleiro em pé, em metros */
  balance:{ shotConf:.46, shotLane:2.3, tackleRate:.10, gkReach:1.52 },
  teams:{
    home:{ tag:'BAY', kit:'#e0402a', trim:'#7d1a0e', shorts:'#f4f6f8', socks:'#e0402a',
           gk:'#39d17f', dir: 1, name:'MANDANTE' },
    away:{ tag:'TOT', kit:'#eef2f6', trim:'#1b2a5e', shorts:'#e7ecf1', socks:'#1b2a5e',
           gk:'#f2d032', dir:-1, name:'VISITANTE' },
    ref:{ tag:'ARB', kit:'#16181d', trim:'#f2d032', shorts:'#16181d', socks:'#16181d',
          gk:'#16181d', dir:1, name:'ARBITRAGEM' }
  }
};
const HALF_L=CFG.pitch.L/2, HALF_W=CFG.pitch.W/2, STEP=1/60;

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[(Math.random()*a.length)|0];
const dist2=(a,b)=>{const x=a.x-b.x,z=a.z-b.z;return x*x+z*z;};
const dist=(a,b)=>Math.sqrt(dist2(a,b));
const damp=(c,t,r,dt)=>lerp(c,t,1-Math.exp(-r*dt));
const angleDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=6.283185;while(d<-Math.PI)d+=6.283185;return d;};
/* Acesso a DOM à prova de nulo: o HUD é cosmético e não deve derrubar a
   simulação se o ambiente higienizar algum elemento. Elemento ausente devolve
   um objeto inerte em vez de null. */
const DEAD={style:{},textContent:'',innerHTML:'',value:'',disabled:false,
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  firstChild:{nodeValue:''},addEventListener(){},removeEventListener(){},
  appendChild(){},getBoundingClientRect(){return {left:0,top:0,width:0,height:0};},
  getContext(){return null;},setAttribute(){},getAttribute(){return null;}};
DEAD.firstElementChild=DEAD;
const $=id=>document.getElementById(id)||DEAD;
let QUALITY=QUALITY_INICIAL;
const Q={ high:{grass:64000,shadow:4096,post:true,crowd:1,px:2},
          mid :{grass:22000,shadow:1024,post:true,crowd:.7,px:1.5},
          low :{grass:0,    shadow:1024,post:false,crowd:.5,px:1} };
const qq=()=>Q[QUALITY];

/* ============================================================================
   ÁUDIO PROCEDURAL — nada de arquivos: tudo sintetizado
   ============================================================================ */
const Audio2={
  ok:false, muted:false, ctx:null, master:null, crowdGain:null, swell:0, target:.16,
  init(){
    try{
      const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
      const ctx=new AC(); this.ctx=ctx;
      const master=ctx.createGain(); master.gain.value=.85; master.connect(ctx.destination);
      this.master=master;

      // ruído marrom em buffer longo → base da torcida
      const len=ctx.sampleRate*6, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
      let last=0;
      for(let i=0;i<len;i++){
        const w=Math.random()*2-1;
        last=(last+.021*w)/1.021; d[i]=last*3.2;
      }
      const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=520; bp.Q.value=.55;
      const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=140;
      const cg=ctx.createGain(); cg.gain.value=.16;
      src.connect(bp); bp.connect(hp); hp.connect(cg); cg.connect(master);
      src.start();
      this.crowdGain=cg;

      // modulação lenta: a torcida respira
      const lfo=ctx.createOscillator(), lg=ctx.createGain();
      lfo.frequency.value=.07; lg.gain.value=.05;
      lfo.connect(lg); lg.connect(cg.gain); lfo.start();

      this.ok=true;
    }catch(e){ this.ok=false; }
  },
  resume(){ if(this.ok&&this.ctx.state==='suspended') this.ctx.resume(); },
  env(node,g0,g1,t0,t1){
    const t=this.ctx.currentTime;
    node.gain.setValueAtTime(g0,t);
    node.gain.exponentialRampToValueAtTime(Math.max(1e-4,g1),t+t1);
    return t;
  },
  noise(dur,freq,type,gain,q){
    if(!this.ok||this.muted) return;
    const ctx=this.ctx, n=Math.floor(ctx.sampleRate*dur);
    const b=ctx.createBuffer(1,n,ctx.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const s=ctx.createBufferSource(); s.buffer=b;
    const f=ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq; f.Q.value=q||1;
    const g=ctx.createGain(); g.gain.value=gain;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  },
  tone(freq,dur,gain,type,slide){
    if(!this.ok||this.muted) return;
    const ctx=this.ctx, o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type||'sine'; o.frequency.value=freq;
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),ctx.currentTime+dur);
    g.gain.value=gain;
    g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(ctx.currentTime+dur+.02);
  },
  kick(power){ const p=clamp(power/28,.2,1);
    this.noise(.09,900+p*700,'bandpass',.16*p,1.2); this.tone(105,.12,.10*p,'sine',58); },
  post(){ this.tone(760,.5,.16,'triangle',520); this.noise(.2,2200,'bandpass',.07,4); },
  net(){ this.noise(.34,3100,'highpass',.06,.7); },
  whistle(long){
    const d=long?.85:.32;
    this.tone(2380,d,.055,'square',2280);
    this.tone(3110,d,.03,'square',3010);
    this.noise(d,2600,'bandpass',.03,7);
  },
  cheer(v){ this.swell=Math.max(this.swell,v); },
  step(dt,excite){
    if(!this.ok) return;
    this.swell=Math.max(0,this.swell-dt*.55);
    const g=clamp(.13+excite*.16+this.swell*.5,0,.72)*(this.muted?0:1);
    this.crowdGain.gain.value=damp(this.crowdGain.gain.value,g,2.4,dt);
  }
};

/* ============================================================================
   TEXTURAS PROCEDURAIS
   ============================================================================ */
const Tex={};
function cv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

/* mapa de normais derivado de um mapa de altura por Sobel */
function normalFromHeight(hc,strength){
  const w=hc.width,h=hc.height;
  const src=hc.getContext('2d').getImageData(0,0,w,h).data;
  const out=cv(w,h), oc=out.getContext('2d'), img=oc.createImageData(w,h);
  const H=(x,y)=>src[((y+h)%h*w+(x+w)%w)*4]/255;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const dx=(H(x+1,y)-H(x-1,y))*strength, dy=(H(x,y+1)-H(x,y-1))*strength;
    let nx=-dx, ny=-dy, nz=1;
    const l=Math.hypot(nx,ny,nz);
    const i=(y*w+x)*4;
    img.data[i  ]=(nx/l*.5+.5)*255;
    img.data[i+1]=(ny/l*.5+.5)*255;
    img.data[i+2]=(nz/l*.5+.5)*255;
    img.data[i+3]=255;
  }
  oc.putImageData(img,0,0);
  return out;
}

function buildPitchTexture(){
  // resolução maior no nível alto: linha de 12 cm passa de ~2 px para ~3 px
  const PW=132, PH=90, PX=(QUALITY==='high'?3072:2048), PZ=Math.round(PX*PH/PW);
  const K=Math.min(1.6,(PX/2048)*(PX/2048));    // densidade acompanha a área
  const c=cv(PX,PZ), g=c.getContext('2d');
  const u=PX/PW, X=x=>(x+PW/2)*u, Z=z=>(z+PH/2)*u, M=m=>m*u;

  g.fillStyle='#24451c'; g.fillRect(0,0,PX,PZ);

  // faixas de corte: alternam claro/escuro porque as folhas ficam deitadas p/ lados opostos
  const bands=14, bw=CFG.pitch.L/bands;
  for(let i=0;i<bands;i++){
    const dark=i%2===0;
    const gr=g.createLinearGradient(X(-HALF_L+i*bw),0,X(-HALF_L+(i+1)*bw),0);
    gr.addColorStop(0,   dark?'#2f6224':'#3d7c2d');
    gr.addColorStop(.5,  dark?'#336a27':'#427f30');
    gr.addColorStop(1,   dark?'#2f6224':'#3d7c2d');
    g.fillStyle=gr;
    g.fillRect(X(-HALF_L+i*bw), Z(-HALF_W-4.5), M(bw)+1, M(CFG.pitch.W+9));
  }
  g.fillStyle='rgba(6,20,4,.22)';
  g.fillRect(0,0,PX,Z(-HALF_W-4.5)); g.fillRect(0,Z(HALF_W+4.5),PX,PZ);

  // manchas de irrigação/luz
  for(let i=0;i<3200*K;i++){
    const x=Math.random()*PX,y=Math.random()*PZ,r=rnd(8,74);
    g.fillStyle=`rgba(${Math.random()<.5?'236,255,214':'12,34,8'},${rnd(.006,.032)})`;
    g.beginPath(); g.ellipse(x,y,r,r*rnd(.25,1),Math.random()*3.14,0,6.2832); g.fill();
  }
  // fibra
  for(let i=0;i<86000*K;i++){
    const x=Math.random()*PX,y=Math.random()*PZ;
    g.fillStyle=`rgba(${Math.random()<.5?'214,252,186':'16,42,12'},${rnd(.02,.085)})`;
    g.fillRect(x,y,rnd(.8,2.2),rnd(2,8));
  }
  // desgaste nas áreas e no meio-campo
  const wear=(cx,cz,rx,rz,amt)=>{
    for(let i=0;i<amt;i++){
      const a=Math.random()*6.2832, r=Math.sqrt(Math.random());
      const x=cx+Math.cos(a)*rx*r, z=cz+Math.sin(a)*rz*r;
      g.fillStyle=`rgba(96,84,52,${rnd(.02,.07)})`;
      g.fillRect(X(x),Z(z),rnd(2,6),rnd(2,6));
    }
  };
  wear(-HALF_L+9,0,9,14,4200*K); wear(HALF_L-9,0,9,14,4200*K);
  wear(0,0,13,10,2600*K);

  // demarcação
  g.strokeStyle='rgba(250,253,255,.94)'; g.fillStyle='rgba(250,253,255,.94)';
  g.lineWidth=Math.max(2.4,M(.12));
  const rect=(x,z,w,h)=>g.strokeRect(X(x),Z(z),M(w),M(h));
  rect(-HALF_L,-HALF_W,CFG.pitch.L,CFG.pitch.W);
  g.beginPath(); g.moveTo(X(0),Z(-HALF_W)); g.lineTo(X(0),Z(HALF_W)); g.stroke();
  g.beginPath(); g.arc(X(0),Z(0),M(9.15),0,6.2832); g.stroke();
  g.beginPath(); g.arc(X(0),Z(0),M(.3),0,6.2832); g.fill();
  for(const s of [-1,1]){
    rect(s>0?HALF_L-16.5:-HALF_L,-20.16,16.5,40.32);
    rect(s>0?HALF_L-5.5:-HALF_L,-9.16,5.5,18.32);
    const px=s*(HALF_L-11);
    g.beginPath(); g.arc(X(px),Z(0),M(.3),0,6.2832); g.fill();
    g.beginPath();
    g.arc(X(px),Z(0),M(9.15), s>0?Math.PI/2+.93:-Math.PI/2+.93, s>0?Math.PI*1.5-.93:Math.PI/2-.93);
    g.stroke();
    for(const t of [-1,1]){
      g.beginPath(); g.arc(X(s*HALF_L),Z(t*HALF_W),M(1),0,6.2832); g.stroke();
      // marca de 9,15 m no canto
      g.beginPath(); g.moveTo(X(s*(HALF_L-.2)),Z(t*(HALF_W-9.15)));
      g.lineTo(X(s*(HALF_L-.9)),Z(t*(HALF_W-9.15))); g.stroke();
    }
  }
  // pisadas
  for(let i=0;i<2600*K;i++){
    const s=Math.random()<.5?-1:1;
    const x=rnd(s*HALF_L,s*(HALF_L-24)), z=rnd(-24,24);
    g.fillStyle=`rgba(24,54,18,${rnd(.03,.1)})`;
    g.fillRect(X(x),Z(z),rnd(2,5),rnd(4,10));
  }

  const t=new THREE.CanvasTexture(c);
  /* filtragem anisotrópica no máximo que a GPU suporta: é o que mantém a
     marcação nítida no ângulo rasante da câmera de transmissão. */
  t.anisotropy=(renderer&&renderer.capabilities&&renderer.capabilities.getMaxAnisotropy)
               ?renderer.capabilities.getMaxAnisotropy():8;
  t.colorSpace=THREE.SRGBColorSpace;
  return {map:t,PW,PH};
}

function grassMaps(){
  const hc=cv(256,256), g=hc.getContext('2d');
  g.fillStyle='#6a6a6a'; g.fillRect(0,0,256,256);
  for(let i=0;i<14000;i++){
    const v=Math.random()<.5?255:0, x=Math.random()*256, y=Math.random()*256;
    g.strokeStyle=`rgba(${v},${v},${v},${rnd(.06,.3)})`; g.lineWidth=rnd(.7,1.7);
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+rnd(-1.5,1.5),y-rnd(2,7)); g.stroke();
  }
  const nrm=new THREE.CanvasTexture(normalFromHeight(hc,2.6));
  nrm.wrapS=nrm.wrapT=THREE.RepeatWrapping; nrm.repeat.set(90,60);

  const rc=cv(256,256), rg=rc.getContext('2d');
  rg.fillStyle='#c8c8c8'; rg.fillRect(0,0,256,256);
  for(let i=0;i<3000;i++){
    const v=(rnd(.55,1)*255)|0;
    rg.fillStyle=`rgba(${v},${v},${v},.5)`;
    rg.beginPath(); rg.arc(Math.random()*256,Math.random()*256,rnd(3,22),0,6.2832); rg.fill();
  }
  const rgh=new THREE.CanvasTexture(rc);
  rgh.wrapS=rgh.wrapT=THREE.RepeatWrapping; rgh.repeat.set(24,16);
  return {normal:nrm,rough:rgh};
}

function netTexture(){
  const c=cv(64,64), g=c.getContext('2d');
  g.strokeStyle='rgba(255,255,255,.9)'; g.lineWidth=1.9;
  for(let i=0;i<=64;i+=8){
    g.beginPath(); g.moveTo(i,0); g.lineTo(i,64); g.stroke();
    g.beginPath(); g.moveTo(0,i); g.lineTo(64,i); g.stroke();
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}

function crowdTexture(density){
  const c=cv(512,256), g=c.getContext('2d');
  g.fillStyle='#12171f'; g.fillRect(0,0,512,256);
  // assentos
  for(let y=4;y<256;y+=8){
    g.fillStyle='rgba(255,255,255,.03)'; g.fillRect(0,y,512,4);
  }
  const pal=['#d94a2e','#f2f5f7','#1b2a5e','#2b3340','#d3a02a','#8c96a5','#0f151f','#b5543a','#e7ecf1'];
  for(let y=6;y<256;y+=8){
    for(let x=3;x<512;x+=7){
      if(Math.random()>density*.86) continue;
      g.fillStyle=pick(pal);
      g.fillRect(x+rnd(-1,1),y+rnd(-1,1),rnd(3,5),rnd(4,6));
      if(Math.random()<.1){ g.fillStyle='rgba(255,240,200,.5)';
        g.fillRect(x+rnd(-1,1),y-2,2,2); }          // pontos claros: rostos/celulares
    }
    g.fillStyle='rgba(0,0,0,.3)'; g.fillRect(0,y+6,512,2);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

function adsTexture(rep){
  const c=cv(2048,128), g=c.getContext('2d');
  const brands=[['PITCH ENGINE','#0b0f15','#ffb020'],['ZYNTRA ERP','#0f1c33','#8fd6ff'],
                ['ATLASCODE','#08160f','#5ef0a8'],['105 × 68','#1a0f1e','#ff6a12'],
                ['THREE.JS','#f3f6f8','#0c1015'],['FORTALEZA','#141821','#ffffff']];
  let x=0,i=0;
  while(x<2048){
    const [txt,bg,fg]=brands[i++%brands.length], w=rnd(300,430);
    g.fillStyle=bg; g.fillRect(x,0,w,128);
    const gr=g.createLinearGradient(x,0,x,128);
    gr.addColorStop(0,'rgba(255,255,255,.14)'); gr.addColorStop(.5,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.fillRect(x,0,w,128);
    g.fillStyle=fg; g.font='700 44px Arial Narrow, Arial';
    g.textAlign='center'; g.textBaseline='middle';
    g.fillText(txt,x+w/2,70);
    x+=w;
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=THREE.RepeatWrapping; t.repeat.set(rep||2,1);
  return t;
}

function skyTexture(){
  const c=cv(1024,512), g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,512);
  gr.addColorStop(0,'#0f3b78'); gr.addColorStop(.30,'#3f7fc4');
  gr.addColorStop(.52,'#8fbdda'); gr.addColorStop(.62,'#cfe0e9');
  gr.addColorStop(1,'#e8eff2');
  g.fillStyle=gr; g.fillRect(0,0,1024,512);
  // nuvens: blobs suaves em camadas
  g.globalCompositeOperation='lighter';
  for(let layer=0;layer<3;layer++){
    const yBase=90+layer*54, alpha=.05-layer*.012;
    for(let i=0;i<130;i++){
      const x=Math.random()*1024, y=yBase+rnd(-30,42), r=rnd(24,110);
      const rg2=g.createRadialGradient(x,y,1,x,y,r);
      rg2.addColorStop(0,`rgba(255,255,255,${alpha*3})`);
      rg2.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=rg2; g.beginPath(); g.ellipse(x,y,r,r*.42,0,0,6.2832); g.fill();
    }
  }
  // brilho do sol
  const sx=712, sy=118;
  const sg=g.createRadialGradient(sx,sy,2,sx,sy,190);
  sg.addColorStop(0,'rgba(255,246,220,.95)'); sg.addColorStop(.12,'rgba(255,232,180,.4)');
  sg.addColorStop(1,'rgba(255,220,160,0)');
  g.fillStyle=sg; g.beginPath(); g.arc(sx,sy,190,0,6.2832); g.fill();
  g.globalCompositeOperation='source-over';
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

function numberTexture(n,fg,bg){
  const c=cv(128,128), g=c.getContext('2d');
  g.fillStyle=bg; g.fillRect(0,0,128,128);
  g.fillStyle=fg; g.font='800 82px Arial Narrow, Arial';
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText(String(n),64,72);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

function ballTexture(){
  const c=cv(1024,512), g=c.getContext('2d');
  g.fillStyle='#f8fafc'; g.fillRect(0,0,1024,512);
  // painéis curvos escuros
  g.fillStyle='#171c24';
  const panels=[[120,120],[380,90],[640,150],[900,110],[240,300],[520,330],[790,300],
                [90,430],[430,470],[700,440],[980,380]];
  for(const [x,y] of panels){
    g.beginPath();
    const n=6, R=rnd(52,72);
    for(let k=0;k<=n;k++){
      const a=k/n*6.2832+.3, r=R*rnd(.72,1);
      const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r*.62;
      k?g.lineTo(px,py):g.moveTo(px,py);
    }
    g.closePath(); g.fill();
  }
  // costuras
  g.strokeStyle='rgba(0,0,0,.3)'; g.lineWidth=3.2;
  for(let i=0;i<512;i+=64){ g.beginPath(); g.moveTo(0,i); g.lineTo(1024,i); g.stroke(); }
  for(let i=0;i<1024;i+=128){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,512); g.stroke(); }
  // grafismo
  g.fillStyle='#ff6a12'; g.font='800 56px Arial Narrow, Arial'; g.textAlign='center';
  g.fillText('PITCH',300,250); g.fillText('ENGINE',760,420);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

function flagTexture(kit,trim){
  const c=cv(64,64), g=c.getContext('2d');
  g.fillStyle=kit; g.fillRect(0,0,64,64);
  g.fillStyle=trim; for(let i=0;i<64;i+=16) g.fillRect(0,i,64,8);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* ============================================================================
   RENDERER + PÓS-PROCESSAMENTO PRÓPRIO
   cena → RT → acumulação temporal (motion blur) → bright → blur H/V → composição
   ============================================================================ */
let renderer, scene, camera;
const SUN=new THREE.Vector3(95,62,-72);

const VS_QUAD=`
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;

const Gfx={
  post:false, first:true, t:0,
  init(){
    this.post=qq().post;
    if(!this.post) return;
    try{
      const w=Math.floor(innerWidth*renderer.getPixelRatio());
      const h=Math.floor(innerHeight*renderer.getPixelRatio());
      const par={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
                 format:THREE.RGBAFormat,stencilBuffer:false};
      // RT com depth texture: é o depth que permite profundidade de campo de verdade
      this.rtScene=new THREE.WebGLRenderTarget(w,h,par);
      this.depth=new THREE.DepthTexture(w,h);
      this.rtScene.depthTexture=this.depth;
      this.rtScene.depthBuffer=true;
      this.accA=new THREE.WebGLRenderTarget(w,h,par);
      this.accB=new THREE.WebGLRenderTarget(w,h,par);
      const bw=Math.max(2,w>>1), bh=Math.max(2,h>>1);
      this.bA=new THREE.WebGLRenderTarget(bw,bh,par);
      this.bB=new THREE.WebGLRenderTarget(bw,bh,par);
      this.dA=new THREE.WebGLRenderTarget(bw,bh,par);   // cena desfocada (bokeh)
      this.dB=new THREE.WebGLRenderTarget(bw,bh,par);
      this.sA=new THREE.WebGLRenderTarget(bw,bh,par);   // oclusão de ambiente
      this.sB=new THREE.WebGLRenderTarget(bw,bh,par);

      this.qCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      this.qScene=new THREE.Scene();
      this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());
      this.quad.frustumCulled=false; this.qScene.add(this.quad);

      this.mAcc=new THREE.ShaderMaterial({
        uniforms:{tNew:{value:null},tOld:{value:null},k:{value:1}},
        vertexShader:VS_QUAD,
        fragmentShader:`
          uniform sampler2D tNew,tOld; uniform float k; varying vec2 vUv;
          void main(){
            vec3 a=texture2D(tOld,vUv).rgb, b=texture2D(tNew,vUv).rgb;
            gl_FragColor=vec4(mix(a,b,k),1.0);
          }`});

      this.mBright=new THREE.ShaderMaterial({
        uniforms:{tDiffuse:{value:null},thr:{value:.88},knee:{value:.16}},
        vertexShader:VS_QUAD,
        fragmentShader:`
          uniform sampler2D tDiffuse; uniform float thr,knee; varying vec2 vUv;
          void main(){
            vec3 c=texture2D(tDiffuse,vUv).rgb;
            float l=dot(c,vec3(0.2126,0.7152,0.0722));
            gl_FragColor=vec4(c*smoothstep(thr,thr+knee,l),1.0);
          }`});

      this.mBlur=new THREE.ShaderMaterial({
        uniforms:{tDiffuse:{value:null},dir:{value:new THREE.Vector2()}},
        vertexShader:VS_QUAD,
        fragmentShader:`
          uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
          void main(){
            vec3 s=texture2D(tDiffuse,vUv).rgb*0.2270270;
            s+=texture2D(tDiffuse,vUv+dir*1.3846).rgb*0.3162162;
            s+=texture2D(tDiffuse,vUv-dir*1.3846).rgb*0.3162162;
            s+=texture2D(tDiffuse,vUv+dir*3.2307).rgb*0.0702702;
            s+=texture2D(tDiffuse,vUv-dir*3.2307).rgb*0.0702702;
            gl_FragColor=vec4(s,1.0);
          }`});

      /* oclusão de ambiente em espaço de tela: reconstrói a posição de vista a
         partir do depth, estima a normal por diferenças finitas e mede quanto do
         hemisfério está bloqueado. É o que "assenta" jogador no gramado. */
      this.mSSAO=new THREE.ShaderMaterial({
        uniforms:{tDepth:{value:null},uProjInv:{value:new THREE.Matrix4()},
                  uRes:{value:new THREE.Vector2(1,1)},uNear:{value:.4},uFar:{value:900},
                  uRadius:{value:11.0},uStrength:{value:1.45}},
        vertexShader:VS_QUAD,
        fragmentShader:`
          uniform sampler2D tDepth; uniform mat4 uProjInv; uniform vec2 uRes;
          uniform float uNear,uFar,uRadius,uStrength; varying vec2 vUv;
          vec3 viewPos(vec2 uv){
            float d=texture2D(tDepth,uv).x;
            vec4 c=vec4(uv*2.0-1.0,d*2.0-1.0,1.0);
            vec4 v=uProjInv*c;
            return v.xyz/v.w;
          }
          void main(){
            vec3 P=viewPos(vUv);
            float depth=-P.z;
            if(depth>200.0||depth<0.05){ gl_FragColor=vec4(1.0); return; }
            vec2 px=1.0/uRes;
            vec3 Px=viewPos(vUv+vec2(px.x,0.0))-P;
            vec3 Py=viewPos(vUv+vec2(0.0,px.y))-P;
            vec3 n=normalize(cross(Px,Py));
            if(n.z<0.0) n=-n;
            float ang=fract(sin(dot(vUv,vec2(12.9898,78.233)))*43758.5453)*6.2832;
            float ca=cos(ang), sa=sin(ang);
            float r=uRadius/max(depth,1.0)*0.06;
            float occ=0.0;
            for(int i=0;i<8;i++){
              float a=float(i)*0.7854;
              vec2 o=vec2(cos(a)*ca-sin(a)*sa, cos(a)*sa+sin(a)*ca);
              float sc=(i<4)?0.5:1.0;
              vec3 S=viewPos(vUv+o*r*sc)-P;
              float l=length(S);
              occ+=max(0.0,dot(n,S/max(l,1e-4))-0.09)/(1.0+l*l*0.55);
            }
            float ao=1.0-clamp(occ*uStrength*0.125,0.0,0.74);
            gl_FragColor=vec4(vec3(ao),1.0);
          }`});

      this.mComp=new THREE.ShaderMaterial({
        uniforms:{tDiffuse:{value:null},tBloom:{value:null},tBlur:{value:null},
                  tDepth:{value:null},tAO:{value:null},uAo:{value:.8},
                  uNear:{value:.4},uFar:{value:900},uFocus:{value:30},uDof:{value:.62},
                  bloom:{value:.16},vig:{value:.30},grain:{value:.020},
                  ca:{value:.0042},time:{value:0}},
        vertexShader:VS_QUAD,
        fragmentShader:`
          uniform sampler2D tDiffuse,tBloom,tBlur,tDepth,tAO;
          uniform float uNear,uFar,uFocus,uDof,uAo;
          uniform float bloom,vig,grain,ca,time; varying vec2 vUv;
          // reconstrói distância linear a partir do depth buffer
          float zdist(vec2 uv){
            float z=texture2D(tDepth,uv).x;
            return (2.0*uNear*uFar)/(uFar+uNear-(2.0*z-1.0)*(uFar-uNear));
          }
          void main(){
            vec2 uv=vUv, d=uv-0.5; float r2=dot(d,d);
            // aberração cromática cresce nas bordas, como lente de transmissão
            vec3 c;
            c.r=texture2D(tDiffuse,uv+d*ca*r2*4.0).r;
            c.g=texture2D(tDiffuse,uv).g;
            c.b=texture2D(tDiffuse,uv-d*ca*r2*4.0).b;
            // profundidade de campo: círculo de confusão pela distância ao plano focal
            float zz=zdist(uv);
            float coc=clamp(abs(zz-uFocus)/max(uFocus,6.0)*uDof,0.0,1.0);
            coc*= zz>uFocus ? 1.0 : 0.45;
            c=mix(c,texture2D(tBlur,uv).rgb,coc*0.88);
            // oclusão multiplica a luz difusa antes do brilho
            float ao=texture2D(tAO,uv).r;
            c*=mix(1.0,ao,uAo*(1.0-coc*0.7));
            c+=texture2D(tBloom,uv).rgb*bloom;
            // grade: saturação, contraste em S e sombras levemente frias
            float l=dot(c,vec3(0.2126,0.7152,0.0722));
            c=mix(vec3(l),c,1.14);
            c=clamp((c-0.5)*1.07+0.5,0.0,4.0);
            c+=vec3(-0.006,0.001,0.016)*(1.0-smoothstep(0.0,0.4,l));
            c*=1.0-vig*smoothstep(0.10,0.92,r2*1.7);
            float n=fract(sin(dot(uv*vec2(97.31,71.17)+time,vec2(12.9898,78.233)))*43758.5453);
            c+=(n-0.5)*grain;
            gl_FragColor=vec4(pow(max(c,0.0),vec3(0.4545)),1.0);
          }`});
    }catch(e){ console.warn('pós-processamento desativado:',e.message); this.post=false; }
  },
  resize(){
    if(!this.post) return;
    const w=Math.floor(innerWidth*renderer.getPixelRatio());
    const h=Math.floor(innerHeight*renderer.getPixelRatio());
    for(const rt of [this.rtScene,this.accA,this.accB]) rt.setSize(w,h);
    for(const rt of [this.bA,this.bB,this.dA,this.dB,this.sA,this.sB])
      rt.setSize(Math.max(2,w>>1),Math.max(2,h>>1));
    this.first=true;
  },
  blit(mat,target){
    this.quad.material=mat;
    renderer.setRenderTarget(target||null);
    renderer.clear();
    renderer.render(this.qScene,this.qCam);
  },
  render(dt,camSpeed){
    if(!this.post){ renderer.setRenderTarget(null); renderer.render(scene,camera); return; }
    this.t+=dt;
    renderer.setRenderTarget(this.rtScene); renderer.clear(); renderer.render(scene,camera);

    // motion blur temporal: guarda mais histórico quando a câmera corre
    const k=this.first?1:clamp(1-clamp(camSpeed*.016,0,.34),.62,1);
    this.mAcc.uniforms.tNew.value=this.rtScene.texture;
    this.mAcc.uniforms.tOld.value=this.accA.texture;
    this.mAcc.uniforms.k.value=k;
    this.blit(this.mAcc,this.accB);
    const tmp=this.accA; this.accA=this.accB; this.accB=tmp;
    this.first=false;

    this.mBright.uniforms.tDiffuse.value=this.accA.texture;
    this.blit(this.mBright,this.bA);
    const bw=this.bA.width, bh=this.bA.height;
    for(let i=0;i<2;i++){
      this.mBlur.uniforms.tDiffuse.value=this.bA.texture;
      this.mBlur.uniforms.dir.value.set((1.4+i)/bw,0); this.blit(this.mBlur,this.bB);
      this.mBlur.uniforms.tDiffuse.value=this.bB.texture;
      this.mBlur.uniforms.dir.value.set(0,(1.4+i)/bh); this.blit(this.mBlur,this.bA);
    }
    // oclusão de ambiente a partir do depth, depois suavizada
    const sw=this.sA.width, sh=this.sA.height;
    this.mSSAO.uniforms.tDepth.value=this.depth;
    this.mSSAO.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
    this.mSSAO.uniforms.uRes.value.set(sw,sh);
    this.blit(this.mSSAO,this.sA);
    this.mBlur.uniforms.tDiffuse.value=this.sA.texture;
    this.mBlur.uniforms.dir.value.set(1.1/sw,0); this.blit(this.mBlur,this.sB);
    this.mBlur.uniforms.tDiffuse.value=this.sB.texture;
    this.mBlur.uniforms.dir.value.set(0,1.1/sh); this.blit(this.mBlur,this.sA);

    // cena desfocada em meia resolução para o bokeh do fundo
    const dw=this.dA.width, dh=this.dA.height;
    this.mBlur.uniforms.tDiffuse.value=this.accA.texture;
    this.mBlur.uniforms.dir.value.set(1.6/dw,0); this.blit(this.mBlur,this.dB);
    this.mBlur.uniforms.tDiffuse.value=this.dB.texture;
    this.mBlur.uniforms.dir.value.set(0,1.6/dh); this.blit(this.mBlur,this.dA);
    this.mBlur.uniforms.tDiffuse.value=this.dA.texture;
    this.mBlur.uniforms.dir.value.set(2.8/dw,0); this.blit(this.mBlur,this.dB);
    this.mBlur.uniforms.tDiffuse.value=this.dB.texture;
    this.mBlur.uniforms.dir.value.set(0,2.8/dh); this.blit(this.mBlur,this.dA);

    this.mComp.uniforms.tDiffuse.value=this.accA.texture;
    this.mComp.uniforms.tBloom.value=this.bA.texture;
    this.mComp.uniforms.tBlur.value=this.dA.texture;
    this.mComp.uniforms.tDepth.value=this.depth;
    this.mComp.uniforms.tAO.value=this.sA.texture;
    this.mComp.uniforms.uFocus.value=Director.focus||30;
    this.mComp.uniforms.time.value=this.t;
    this.blit(this.mComp,null);
  }
};

function initRenderer(){
  renderer=new THREE.WebGLRenderer({antialias:!qq().post,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,qq().px));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const host=_palco;
  if(host&&host.appendChild) host.appendChild(renderer.domElement);

  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.4,900);
  camera.position.set(-42,18,28); camera.lookAt(0,0,0);

  _on(window,'resize',()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
    Gfx.resize();
  });
}

function buildSky(){
  const tex=skyTexture();
  const sky=new THREE.Mesh(new THREE.SphereGeometry(620,40,24),
    new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,fog:false}));
  scene.add(sky);
  /* iluminação por imagem: o céu vira o mapa de ambiente da cena, então cada
     material recebe reflexo especular coerente com a abóbada. É o que separa
     "modelo iluminado" de "objeto no lugar". */
  try{
    const pm=new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    const env=pm.fromEquirectangular(tex);
    scene.environment=env.texture;
    Tex.env=env.texture;
    pm.dispose();
  }catch(e){ console.warn('IBL indisponível:',e.message); }
}

function buildLights(){
  /* Orçamento de luz refeito. Antes: sol 2,45 + hemisférica 0,62 + 2 preenchimentos
     = irradiância muito acima de 1 sobre um gramado de albedo alto, o que estourava
     o branco e alimentava o bloom. Agora o sol domina e o resto só preenche sombra. */
  scene.add(new THREE.HemisphereLight(0xbcd4ee,0x2c5423,.34));
  const sun=new THREE.DirectionalLight(0xfff2dc,1.80);
  sun.position.copy(SUN);
  sun.castShadow=true;
  const S=qq().shadow;
  sun.shadow.mapSize.set(S,S);
  const c=sun.shadow.camera;
  c.left=-112; c.right=112; c.top=88; c.bottom=-88; c.near=1; c.far=430;
  sun.shadow.bias=-0.0009; sun.shadow.normalBias=.03;
  scene.add(sun);
  const bounce=new THREE.DirectionalLight(0x9fc2e8,.14);
  bounce.position.set(-70,34,64); scene.add(bounce);
  const rim=new THREE.DirectionalLight(0xffe9c4,.10);
  rim.position.set(-40,12,-90); scene.add(rim);
}

function buildPitch(){
  const {map,PW,PH}=buildPitchTexture();
  Tex.pitch=map; Tex.PW=PW; Tex.PH=PH;
  const gm=grassMaps();
  const mat=new THREE.MeshStandardMaterial({
    map, normalMap:gm.normal, roughnessMap:gm.rough,
    normalScale:new THREE.Vector2(.85,.85), roughness:.92, metalness:0
  });
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),mat);
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

  const apron=new THREE.Mesh(new THREE.PlaneGeometry(230,170),
    new THREE.MeshStandardMaterial({color:0x1d3a17,roughness:1}));
  apron.rotation.x=-Math.PI/2; apron.position.y=-.03; apron.receiveShadow=true; scene.add(apron);

  /* brilho anisotrópico: as faixas mudam de tom conforme o ângulo da câmera,
     porque as folhas estão deitadas para lados opostos */
  const sheen=new THREE.Mesh(new THREE.PlaneGeometry(CFG.pitch.L,CFG.pitch.W,1,1),
    new THREE.ShaderMaterial({
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false,
      uniforms:{uCam:{value:new THREE.Vector3()},bands:{value:14}},
      vertexShader:`
        varying vec3 vW;
        void main(){
          vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz;
          gl_Position=projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader:`
        uniform vec3 uCam; uniform float bands; varying vec3 vW;
        void main(){
          float bw=105.0/bands;
          float idx=floor((vW.x+52.5)/bw);
          float sgn=mod(idx,2.0)*2.0-1.0;
          vec3 V=normalize(uCam-vW);
          vec3 lay=normalize(vec3(sgn*0.94,0.34,0.0));
          float f=pow(clamp(dot(lay,V),0.0,1.0),3.5);
          float fade=1.0-smoothstep(60.0,190.0,length(uCam-vW));
          gl_FragColor=vec4(vec3(0.62,0.86,0.55)*f*0.065*fade,1.0);
        }`
    }));
  sheen.rotation.x=-Math.PI/2; sheen.position.y=.012; sheen.renderOrder=1;
  scene.add(sheen);
  World.sheen=sheen;
}

/* ---------- grama instanciada com vento e reposicionamento em anel ---------- */
function buildGrass(){
  const n=qq().grass;
  if(!n||!qq().post) return;
  const PATCH=48, RANGE=23;
  const g=new THREE.InstancedBufferGeometry();
  const pos=new Float32Array([-0.5,0,0, 0.5,0,0, -0.32,0.55,0, 0.32,0.55,0, 0,1,0]);
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setIndex([0,1,3, 0,3,2, 2,3,4]);
  const iPos=new Float32Array(n*3), iScale=new Float32Array(n*2),
        iRot=new Float32Array(n), iPhase=new Float32Array(n), iTint=new Float32Array(n);
  for(let i=0;i<n;i++){
    iPos[i*3]=rnd(-PATCH/2,PATCH/2); iPos[i*3+1]=0; iPos[i*3+2]=rnd(-PATCH/2,PATCH/2);
    iScale[i*2]=rnd(.014,.024); iScale[i*2+1]=rnd(.026,.044);
    iRot[i]=rnd(0,6.2832); iPhase[i]=rnd(0,6.2832); iTint[i]=Math.random();
  }
  g.setAttribute('iPos',new THREE.InstancedBufferAttribute(iPos,3));
  g.setAttribute('iScale',new THREE.InstancedBufferAttribute(iScale,2));
  g.setAttribute('iRot',new THREE.InstancedBufferAttribute(iRot,1));
  g.setAttribute('iPhase',new THREE.InstancedBufferAttribute(iPhase,1));
  g.setAttribute('iTint',new THREE.InstancedBufferAttribute(iTint,1));
  g.instanceCount=n;

  const mat=new THREE.ShaderMaterial({
    uniforms:{
      uTime:{value:0}, uCenter:{value:new THREE.Vector2()},
      uPatch:{value:PATCH}, uRange:{value:RANGE},
      uMap:{value:Tex.pitch}, uSun:{value:SUN.clone().normalize()},
      uWind:{value:new THREE.Vector2()},
      uFog:{value:new THREE.Color(0xc4d8e6)}, uExp:{value:1.06},
      uPW:{value:Tex.PW}, uPH:{value:Tex.PH}
    },
    vertexShader:`
      attribute vec3 iPos; attribute vec2 iScale;
      attribute float iRot, iPhase, iTint;
      uniform float uTime,uPatch,uRange,uExp,uPW,uPH;
      uniform vec2 uCenter, uWind; uniform sampler2D uMap; uniform vec3 uSun;
      varying vec3 vCol; varying float vFog;
      void main(){
        vec2 p=iPos.xz;
        p=uCenter+mod(p-uCenter+uPatch*0.5,uPatch)-uPatch*0.5;
        float k=1.0-smoothstep(uRange*0.68,uRange,length(p-uCenter));
        k*=step(abs(p.x),62.0)*step(abs(p.y),43.0);
        vec3 lp=position;
        lp.x*=iScale.x;
        lp.y*=iScale.y*k;
        float w=sin(uTime*1.7+iPhase+p.x*0.24+p.y*0.19);
        float gust=sin(uTime*0.31+p.x*0.045)*0.5+0.5;
        lp.x+=w*(0.30+gust*0.55)*pow(position.y,2.0)*iScale.y;
        lp.z+=cos(uTime*2.1+iPhase)*0.22*pow(position.y,2.0)*iScale.y;
        float s=sin(iRot), co=cos(iRot);
        vec3 wp=vec3(p.x+lp.x*co-lp.z*s, lp.y, p.y+lp.x*s+lp.z*co);
        // as lâminas deitam a favor do vento, com rajada modulada
        float bend=pow(position.y,2.0)*iScale.y*(1.0+0.35*sin(uTime*1.9+iPhase));
        wp.x+=uWind.x*bend*0.9; wp.z+=uWind.y*bend*0.9;
        vec2 uv=vec2((wp.x+uPW*0.5)/uPW, 1.0-(wp.z+uPH*0.5)/uPH);
        vec3 base=pow(texture2D(uMap,uv).rgb,vec3(2.2));
        base*=0.90+iTint*0.20;              // variação sutil, não confete
        float ao=0.72+0.28*position.y;
        float ndl=clamp(dot(normalize(vec3(s*0.75,0.62,co*0.75)),uSun),0.0,1.0);
        /* a lâmina é uma perturbação do gramado, não um objeto com luz própria:
           por isso a modulação é fraca e ancorada na cor amostrada do campo. */
        vCol=base*ao*(0.86+0.26*ndl)*uExp;
        vec4 mv=modelViewMatrix*vec4(wp,1.0);
        vFog=0.0;                     // sem neblina: ar limpo
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      uniform vec3 uFog; varying vec3 vCol; varying float vFog;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
      void main(){ gl_FragColor=vec4(mix(aces(vCol),pow(uFog,vec3(2.2)),vFog),1.0); }`
  });
  const mesh=new THREE.Mesh(g,mat);
  mesh.frustumCulled=false; mesh.position.y=.004;
  scene.add(mesh);
  World.grass=mesh;
}

/* ============================================================================
   ESTÁDIO, TRAVES COM REDE DEFORMÁVEL, BOLA
   ============================================================================ */
const World={ ballShadow:null, nets:[], flags:[], grass:null, sheen:null };

function buildGoals(){
  const netTex=netTexture();
  const postMat=new THREE.MeshStandardMaterial({color:0xf8fbfd,roughness:.28,metalness:.2});
  const {w,h,depth}=CFG.goal;

  for(const s of [-1,1]){
    const G=new THREE.Group(); G.position.set(s*HALF_L,0,0); scene.add(G);
    for(const t of [-1,1]){
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,h,16),postMat);
      p.position.set(0,h/2,t*w/2); p.castShadow=true; G.add(p);
    }
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,w,16),postMat);
    bar.rotation.x=Math.PI/2; bar.position.y=h; bar.castShadow=true; G.add(bar);
    // suportes traseiros
    for(const t of [-1,1]){
      const b=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,Math.hypot(depth,h),10),postMat);
      b.position.set(s*depth/2,h/2,t*w/2);
      b.rotation.z=Math.PI/2-Math.atan2(h,depth)*(s>0?1:-1);
      b.rotation.y=s>0?0:Math.PI; G.add(b);
    }

    const mk=(gw,gh,segw,segh)=>{
      const t2=netTex.clone(); t2.needsUpdate=true; t2.repeat.set(gw*3.2,gh*3.2);
      return new THREE.Mesh(new THREE.PlaneGeometry(gw,gh,segw,segh),
        new THREE.MeshStandardMaterial({map:t2,transparent:true,alphaTest:.3,
          side:THREE.DoubleSide,roughness:.85,color:0xeef4f9}));
    };
    const back=mk(w,h,18,12);
    back.position.set(s*depth,h/2,0); back.rotation.y=Math.PI/2; G.add(back);
    const top=mk(w,depth,18,6);
    top.rotation.x=Math.PI/2; top.position.set(s*depth/2,h,0); G.add(top);
    for(const t of [-1,1]){
      const side=mk(depth,h,8,10);
      side.position.set(s*depth/2,h/2,t*w/2); G.add(side);
    }
    const geo=back.geometry;
    const base=geo.attributes.position&&geo.attributes.position.array
             ? Float32Array.from(geo.attributes.position.array) : null;
    World.nets.push({mesh:back,base,geo,t:9,imp:new THREE.Vector2()});
  }
}

/* onda amortecida na rede quando a bola entra */
function hitNet(side,z,y,power){
  const net=World.nets[side<0?0:1];
  if(!net||!net.base) return;
  net.t=0; net.imp.set(z,y); net.power=clamp(power/26,.3,1.4);
}
function updateNets(dt){
  for(const n of World.nets){
    if(!n.base||n.t>2.2) continue;
    n.t+=dt;
    const arr=n.geo.attributes.position.array;
    const decay=Math.exp(-n.t*3.1);
    for(let i=0;i<arr.length;i+=3){
      const x=n.base[i], y=n.base[i+1];
      const d=Math.hypot(x-n.imp.x, y-(n.imp.y-CFG.goal.h/2));
      const bump=Math.exp(-d*d*.55)*Math.cos(n.t*17-d*2.1)*decay*.42*(n.power||1);
      arr[i+2]=n.base[i+2]+bump;
    }
    n.geo.attributes.position.needsUpdate=true;
    if(n.geo.computeVertexNormals) n.geo.computeVertexNormals();
  }
}

function buildStadium(){
  const crowd=crowdTexture(qq().crowd);
  const struct=new THREE.MeshStandardMaterial({color:0x1b212b,roughness:.88});
  const roofMat=new THREE.MeshStandardMaterial({color:0x252d38,roughness:.55,metalness:.3});
  const glass=new THREE.MeshStandardMaterial({color:0x0e1620,roughness:.2,metalness:.6});

  function stand(len,off,rotY){
    const G=new THREE.Group(); G.rotation.y=rotY;
    const v=new THREE.Vector3(0,0,-off).applyAxisAngle(new THREE.Vector3(0,1,0),rotY);
    G.position.set(v.x,0,v.z);

    const c=crowd.clone(); c.needsUpdate=true; c.repeat.set(len/8,3.4);
    const slope=new THREE.Mesh(new THREE.PlaneGeometry(len,28),
      new THREE.MeshStandardMaterial({map:c,roughness:.96}));
    slope.rotation.x=-Math.PI/2+1.0; slope.position.set(0,11,-10); G.add(slope);

    const lower=new THREE.Mesh(new THREE.BoxGeometry(len,4.4,8),struct);
    lower.position.set(0,2.2,1.6); lower.receiveShadow=true; lower.castShadow=true; G.add(lower);
    const back=new THREE.Mesh(new THREE.BoxGeometry(len,26,2.4),struct);
    back.position.set(0,13,-22.5); back.castShadow=true; G.add(back);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(len,1.3,26),roofMat);
    roof.position.set(0,26.5,-10.5); roof.castShadow=true; G.add(roof);
    const fascia=new THREE.Mesh(new THREE.BoxGeometry(len,2.2,.5),glass);
    fascia.position.set(0,24.4,2.2); G.add(fascia);
    for(let i=-len/2+8;i<len/2;i+=16){
      const col=new THREE.Mesh(new THREE.BoxGeometry(1,26,1),struct);
      col.position.set(i,13,-22); G.add(col);
    }
    scene.add(G);
  }
  stand(158,60,0); stand(158,60,Math.PI);
  stand(120,84,Math.PI/2); stand(120,84,-Math.PI/2);

  // placas de publicidade
  const mk=(len,rep)=>new THREE.MeshStandardMaterial({map:adsTexture(rep),roughness:.45,
      emissive:0x11151d,emissiveIntensity:.14});
  for(const s of [-1,1]){
    const b=new THREE.Mesh(new THREE.BoxGeometry(126,1.1,.32),mk(126,2.6));
    b.position.set(0,.55,s*(HALF_W+6.5)); b.rotation.y=s>0?Math.PI:0;
    b.castShadow=true; scene.add(b);
  }
  for(const s of [-1,1]){
    const b=new THREE.Mesh(new THREE.BoxGeometry(78,1.1,.32),mk(78,1.6));
    b.position.set(s*(HALF_L+8),.55,0); b.rotation.y=s>0?-Math.PI/2:Math.PI/2;
    b.castShadow=true; scene.add(b);
  }

  // bandeirinhas de canto
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const G=new THREE.Group(); G.position.set(sx*HALF_L,0,sz*HALF_W);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.5,8),
      new THREE.MeshStandardMaterial({color:0xf4f7fa,roughness:.5}));
    pole.position.y=.75; pole.castShadow=true; G.add(pole);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(.42,.3,6,3),
      new THREE.MeshStandardMaterial({map:flagTexture('#ffb020','#e0402a'),
        side:THREE.DoubleSide,roughness:.8}));
    flag.position.set(sx*.2,1.3,0); G.add(flag);
    World.flags.push(flag);
    scene.add(G);
  }

  // bancos de reservas
  for(const s of [-1,1]){
    const G=new THREE.Group(); G.position.set(s*13,0,-(HALF_W+5.2));
    const shell=new THREE.Mesh(new THREE.BoxGeometry(11,2.5,3),glass);
    shell.position.y=1.3; shell.castShadow=true; G.add(shell);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(10,.4,1.1),
      new THREE.MeshStandardMaterial({color:0x2a3442,roughness:.8}));
    seat.position.set(0,.75,.8); G.add(seat);
    scene.add(G);
  }

  // refletores
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const G=new THREE.Group(); G.position.set(sx*76,0,sz*54);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.5,.9,48,10),struct);
    mast.position.y=24; mast.castShadow=true; G.add(mast);
    const rig=new THREE.Mesh(new THREE.BoxGeometry(12,5,1),
      new THREE.MeshStandardMaterial({color:0xf6faff,emissive:0xffffff,
        emissiveIntensity:.30,roughness:.35}));
    rig.position.y=49; rig.lookAt(0,0,0); G.add(rig);
    scene.add(G);
  }

  // telão simples atrás de um dos gols
  const screen=new THREE.Mesh(new THREE.BoxGeometry(26,13,1),
    new THREE.MeshStandardMaterial({color:0x05070c,emissive:0x1b2740,emissiveIntensity:.25,roughness:.4}));
  screen.position.set(0,26,-(HALF_W+40)); scene.add(screen);
}

/* flashes de câmera na arquibancada: três grupos piscando fora de fase */
function buildFlashes(){
  World.flashes=[];
  for(let g=0;g<3;g++){
    const n=260, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      let x,z,y;
      if(Math.random()<.5){
        x=rnd(-72,72); const zz=rnd(HALF_W+8,HALF_W+27);
        z=(Math.random()<.5?-1:1)*zz; y=5+(zz-HALF_W-8)*.55;
      } else {
        z=rnd(-46,46); const xx=rnd(HALF_L+10,HALF_L+30);
        x=(Math.random()<.5?-1:1)*xx; y=5+(xx-HALF_L-10)*.55;
      }
      pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    const pts=new THREE.Points(geo,new THREE.PointsMaterial({
      color:0xfff4dc,size:.62,transparent:true,opacity:0,depthWrite:false,
      sizeAttenuation:true,fog:false}));
    pts.frustumCulled=false; scene.add(pts); World.flashes.push(pts);
  }
  World.flash=0;
}

/* público volumétrico: milhares de corpos instanciados em uma única draw call.
   A textura plana resolve de longe, mas some no close; isto não. */
function buildCrowdVolume(){
  if(QUALITY==='low') return;
  const N=QUALITY==='high'?4600:2200;
  const geo=new THREE.BoxGeometry(.40,.68,.32);
  /* vertexColors é obrigatório: sem ele o three calcula instanceColor no vertex
     shader mas não aplica no fragment, e a torcida sai toda branca. */
  const mat=new THREE.MeshStandardMaterial({roughness:.93,metalness:0,vertexColors:true});
  const mesh=new THREE.InstancedMesh(geo,mat,N);
  const m=new THREE.Matrix4(), q=new THREE.Quaternion(),
        sc=new THREE.Vector3(1,1,1), pos=new THREE.Vector3(), col=new THREE.Color();
  const axis=new THREE.Vector3(0,1,0);
  const pal=[0xd94a2e,0xf2f5f7,0x1b2a5e,0x2b3340,0xd3a02a,0x8c96a5,0x141821,0xb5543a,0xe7ecf1];
  let i=0;
  const rows=14;
  for(let side=0;side<4&&i<N;side++){
    const long=side<2, sgn=(side%2)?1:-1;
    for(let r=0;r<rows&&i<N;r++){
      const off=(long?24:32)+r*1.35, y=5.4+r*1.34;
      const len=long?150:104, step=1.15;
      for(let t=-len/2;t<len/2&&i<N;t+=step){
        if(Math.random()<.14) continue;
        if(long){ pos.set(t+rnd(-.2,.2),y+rnd(-.07,.07),sgn*(HALF_W+off+rnd(-.25,.25))); }
        else { pos.set(sgn*(HALF_L+off+rnd(-.25,.25)),y+rnd(-.07,.07),t*.85+rnd(-.2,.2)); }
        q.setFromAxisAngle(axis,long?0:Math.PI/2);
        sc.set(1,rnd(.86,1.16),1);
        m.compose(pos,q,sc);
        mesh.setMatrixAt(i,m);
        col.setHex(pal[(Math.random()*pal.length)|0]);
        if(mesh.setColorAt) mesh.setColorAt(i,col);
        i++;
      }
    }
  }
  mesh.count=i;
  if(mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
  mesh.frustumCulled=false;
  scene.add(mesh);
  World.crowd=mesh;
}

function buildBall(){
  const m=new THREE.Mesh(new THREE.SphereGeometry(CFG.ball.r,32,24),
    new THREE.MeshStandardMaterial({map:ballTexture(),roughness:.30,metalness:.04,
      envMapIntensity:.9}));
  m.castShadow=true; scene.add(m); Ball.mesh=m;

  const c=cv(128,128), g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,2,64,64,62);
  gr.addColorStop(0,'rgba(0,0,0,.6)'); gr.addColorStop(.55,'rgba(0,0,0,.22)');
  gr.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=gr; g.fillRect(0,0,128,128);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
  sh.rotation.x=-Math.PI/2; sh.position.y=.03; sh.renderOrder=2; scene.add(sh);
  World.ballShadow=sh;

  // rastro do chute
  const trailGeo=new THREE.BufferGeometry();
  const N=28, tp=new Float32Array(N*3);
  trailGeo.setAttribute('position',new THREE.Float32BufferAttribute(tp,3));
  const trail=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({
    color:0xffffff,transparent:true,opacity:.24}));
  trail.frustumCulled=false; scene.add(trail);
  Ball.trail={mesh:trail,geo:trailGeo,buf:tp,N,hist:[]};
}

/* ============================================================================
   BOLA — arrasto quadrático, efeito Magnus, quique com atrito e transferência
   de rotação, rolamento puro, colisão com trave e desvio em jogador
   ============================================================================ */
const Ball={
  pos:new THREE.Vector3(0,CFG.ball.r,0), prev:new THREE.Vector3(0,CFG.ball.r,0),
  vel:new THREE.Vector3(), spin:new THREE.Vector3(),
  owner:null, lastTouch:null, cool:0, grounded:true, mesh:null, trail:null,
  offside:null, lastKick:null, shotBy:null, grace:0, shotCool:0,
  apex:0, dist:0, v0:0, subs:1, kickFrom:null, kickBy:null
};

/* ----------------------------------------------------------------------------
   AERODINÂMICA
   Cd não é constante: na transição laminar→turbulenta (a "crise do arrasto")
   ele cai de ~0,47 para ~0,16 em torno de 13 m/s. É por isso que um chute forte
   mantém velocidade e um passe fraco morre depressa.
   A sustentação de Magnus usa Cl proporcional ao spin específico S = rω/v.
   ---------------------------------------------------------------------------- */
const Aero={
  A:Math.PI*CFG.ball.r*CFG.ball.r,
  wind:new THREE.Vector3(), base:new THREE.Vector3(), t:0,
  init(){
    const a=CFG.air.windDir, m=CFG.air.wind;
    this.base.set(Math.cos(a)*m,0,Math.sin(a)*m);
    this.wind.copy(this.base);
  },
  Cd(v){ return 0.16+0.31/(1+Math.exp((v-13.5)/1.15)); },
  k(v){ return 0.5*CFG.air.rho*this.Cd(v)*this.A/CFG.ball.m; },
  Cl(spin,v){ return Math.min(0.33, 0.9*CFG.ball.r*spin/Math.max(v,.5)); },
  step(dt){
    this.t+=dt;
    const g=CFG.air.gust;
    const s=1+Math.sin(this.t*.23)*g+Math.sin(this.t*.71+1.3)*g*.5;
    this.wind.set(this.base.x*s,0,this.base.z*s);
  },
  speed(){ return Math.hypot(this.wind.x,this.wind.z); }
};

function kick(from,dirV,power,loft,side,top){
  const d=dirV.clone().setY(0);
  if(d.lengthSq()<1e-6) d.set(from?Math.sin(from.face):1,0,from?Math.cos(from.face):0);
  d.normalize();
  Ball.owner=null; Ball.lastTouch=from; Ball.cool=.26;
  Ball.vel.set(d.x*power,loft,d.z*power);
  Ball.apex=Ball.pos.y; Ball.dist=0; Ball.v0=Math.hypot(power,loft);
  Ball.kickFrom=Ball.pos.clone(); Ball.kickBy=from;
  Ball.pos.y=Math.max(Ball.pos.y,CFG.ball.r+.02);
  Ball.grounded=false;
  // rotação: lateral em torno de Y (curva) e top/backspin em torno do eixo transversal
  const rx=-d.z, rz=d.x;
  Ball.spin.set(rx*(top||0),(side||0),rz*(top||0));
  if(from){ from.kickT=.26; from.pose='kick'; from.poseT=.26; }
  Audio2.kick(power);
}

function ballDribble(p,dt){
  const f=new THREE.Vector3(Math.sin(p.face),0,Math.cos(p.face));
  const sp=p.vel.length();
  /* a bola é empurrada a cada passada e o jogador a alcança de novo:
     a distância até o pé oscila em serra, em vez de ficar colada */
  const saw=((p.phase/Math.PI)%2)*.5;
  const tgt=p.pos.clone().addScaledVector(f,.38+clamp(sp*.05,0,.24)
            +saw*.13*clamp(sp/4,0,1));
  Ball.prev.copy(Ball.pos);
  Ball.pos.x=damp(Ball.pos.x,tgt.x,24,dt);
  Ball.pos.z=damp(Ball.pos.z,tgt.z,24,dt);
  Ball.pos.y=CFG.ball.r+Math.abs(Math.sin(p.phase*.8))*.04;
  Ball.vel.set(p.vel.x,0,p.vel.z);
  Ball.spin.set(-p.vel.z/CFG.ball.r,0,p.vel.x/CFG.ball.r);
}

function ballBounce(){
  const r=CFG.ball.r, B=Ball, C=CFG.ball;
  B.pos.y=r;
  const vy=-B.vel.y;
  if(vy>.55){
    B.vel.y=vy*C.e;
    // velocidade do ponto de contato: v + ω × (0,-r,0)
    let cx=B.vel.x+B.spin.z*r, cz=B.vel.z-B.spin.x*r;
    const cl=Math.hypot(cx,cz);
    if(cl>1e-4){
      const jn=(1+C.e)*vy;
      const jt=Math.min(C.mu*jn, cl/3.5);
      const ux=cx/cl, uz=cz/cl, Jx=-jt*ux, Jz=-jt*uz;
      B.vel.x+=Jx; B.vel.z+=Jz;
      const I=.4*r;
      B.spin.x+= -Jz/I; B.spin.z+= Jx/I;
    }
    B.grounded=false;
    if(vy>2.2) Audio2.noise(.06,260,'lowpass',.05*clamp(vy/9,.2,1),1);
  } else {
    B.vel.y=0; B.grounded=true;
  }
}

/* um subpasso do integrador: aero + gravidade + solo + traves + desvio */
function ballIntegrate(h){
  const B=Ball, C=CFG.ball, r=C.r, v=B.vel, w=B.spin;

  // velocidade relativa ao ar (o vento entra aqui, não como força separada)
  const rx=v.x-Aero.wind.x, ry=v.y-Aero.wind.y, rz=v.z-Aero.wind.z;
  const vr=Math.hypot(rx,ry,rz);
  if(vr>.05){
    const ad=Aero.k(vr)*vr*h;
    v.x-=rx*ad; v.y-=ry*ad; v.z-=rz*ad;
    const sr=Math.hypot(w.x,w.y,w.z);
    if(sr>1&&vr>1){
      const aM=.5*CFG.air.rho*Aero.A*Aero.Cl(sr,vr)*vr*vr/C.m*h;
      let cx=w.y*rz-w.z*ry, cy=w.z*rx-w.x*rz, cz=w.x*ry-w.y*rx;
      const cl=Math.hypot(cx,cy,cz)||1;
      v.x+=cx/cl*aM; v.y+=cy/cl*aM; v.z+=cz/cl*aM;
    }
  }
  v.y-=9.81*h;
  B.pos.addScaledVector(v,h);
  w.multiplyScalar(Math.exp(-C.spinDecay*h));
  B.dist+=Math.hypot(v.x,v.y,v.z)*h;
  if(B.pos.y>B.apex) B.apex=B.pos.y;

  if(B.pos.y<=r) ballBounce();
  if(B.grounded){
    if(B.shotBy&&Math.hypot(v.x,v.z)<3) B.shotBy=null;   // a bola morreu: não foi ao gol
    const rr=C.roll*h, hv=Math.hypot(v.x,v.z);
    if(hv>rr){ v.x-=v.x/hv*rr; v.z-=v.z/hv*rr; } else { v.x=0; v.z=0; }
    w.x=v.z/r; w.z=-v.x/r; w.y*=Math.exp(-3.2*h);
  }

  // traves e travessão
  for(const s of [-1,1]){
    const gl=s*HALF_L;
    if(Math.abs(B.pos.x-gl)<.5+r){
      for(const t of [-1,1]){
        const pz=t*CFG.goal.w/2;
        const dx=B.pos.x-gl, dz=B.pos.z-pz, d=Math.hypot(dx,dz);
        if(d<.06+r && B.pos.y<CFG.goal.h){
          const nx=dx/(d||1), nz=dz/(d||1);
          const dot=v.x*nx+v.z*nz;
          if(dot<0){
            v.x-=2*dot*nx*.72; v.z-=2*dot*nz*.72;
            B.pos.x=gl+nx*(.07+r); B.pos.z=pz+nz*(.07+r);
            Audio2.post(); Toast.show('NA TRAVE','',1000);
          }
        }
      }
      if(Math.abs(B.pos.z)<CFG.goal.w/2 && Math.abs(B.pos.y-CFG.goal.h)<.06+r && v.y>0){
        v.y=-v.y*.6; B.pos.y=CFG.goal.h-.07-r;
        Audio2.post(); Toast.show('NO TRAVESSÃO','',1000);
      }
    }
  }

  // desvio em jogador: bloqueio de chute/passe
  const sp=Math.hypot(v.x,v.z);
  if(sp>8 && B.cool<=0){
    for(const p of players){
      if(p===B.lastTouch) continue;
      const dx=B.pos.x-p.pos.x, dz=B.pos.z-p.pos.z, d=Math.hypot(dx,dz);
      if(d<.46 && B.pos.y<1.85){
        const nx=dx/(d||1), nz=dz/(d||1);
        const dot=v.x*nx+v.z*nz;
        if(dot<0){
          v.x-=2*dot*nx*.55; v.z-=2*dot*nz*.55;
          v.x+=p.vel.x*.45; v.z+=p.vel.z*.45;
          v.y=Math.max(v.y,rnd(.6,2.6));
          B.cool=.14; B.lastTouch=p; B.shotBy=null;
          Stats.block(p.team);
          Audio2.noise(.07,420,'bandpass',.09,1.4);
        }
        break;
      }
    }
  }
}

/* passo da bola: subdivide para que nenhum subpasso ande mais de 5 cm.
   Sem isso, a 30 m/s a bola pularia 50 cm por quadro e atravessaria a trave. */
function ballStep(dt){
  const B=Ball;
  if(B.cool>0) B.cool-=dt;
  if(B.grace>0) B.grace-=dt;
  if(B.shotCool>0) B.shotCool-=dt;
  if(B.owner){ ballDribble(B.owner,dt); return; }
  B.prev.copy(B.pos);
  const sp=B.vel.length();
  const n=clamp(Math.ceil(sp*dt/.05),1,12);
  B.subs=n;
  const h=dt/n;
  for(let i=0;i<n;i++) ballIntegrate(h);
}

/* previsão de trajetória: integra uma cópia do estado com a MESMA física.
   É o que a linha pontilhada do modo análise desenha. */
function predictTrajectory(out,dur){
  const C=CFG.ball, r=C.r, h=1/60;
  let px=Ball.pos.x,py=Ball.pos.y,pz=Ball.pos.z;
  let vx=Ball.vel.x,vy=Ball.vel.y,vz=Ball.vel.z;
  let wx=Ball.spin.x,wy=Ball.spin.y,wz=Ball.spin.z;
  let n=0;
  for(let t=0;t<dur;t+=h){
    const rx=vx-Aero.wind.x, ry=vy-Aero.wind.y, rz=vz-Aero.wind.z;
    const vr=Math.hypot(rx,ry,rz);
    if(vr>.05){
      const ad=Aero.k(vr)*vr*h;
      vx-=rx*ad; vy-=ry*ad; vz-=rz*ad;
      const sr=Math.hypot(wx,wy,wz);
      if(sr>1&&vr>1){
        const aM=.5*CFG.air.rho*Aero.A*Aero.Cl(sr,vr)*vr*vr/C.m*h;
        let cx=wy*rz-wz*ry, cy=wz*rx-wx*rz, cz=wx*ry-wy*rx;
        const cl=Math.hypot(cx,cy,cz)||1;
        vx+=cx/cl*aM; vy+=cy/cl*aM; vz+=cz/cl*aM;
      }
    }
    vy-=9.81*h;
    px+=vx*h; py+=vy*h; pz+=vz*h;
    const decay=Math.exp(-C.spinDecay*h); wx*=decay; wy*=decay; wz*=decay;
    if(py<=r){ py=r; vy=-vy*C.e; vx*=.86; vz*=.86; if(Math.abs(vy)<.5) break; }
    if(n%2===0&&n/2<out.length/3){
      const i=(n/2|0)*3; out[i]=px; out[i+1]=py; out[i+2]=pz;
    }
    n++;
    if(Math.abs(px)>HALF_L+4||Math.abs(pz)>HALF_W+4) break;
  }
  return Math.min(out.length/3, Math.max(2,(n/2|0)));
}

/* onde a bola cruza o plano x = gx, integrando a física real (inclui a curva).
   O goleiro usa isto com um erro de leitura: ele lê bem, mas não é oráculo. */
function predictAtPlane(gx){
  const C=CFG.ball, r=C.r, h=1/120;
  let px=Ball.pos.x,py=Ball.pos.y,pz=Ball.pos.z;
  let vx=Ball.vel.x,vy=Ball.vel.y,vz=Ball.vel.z;
  let wx=Ball.spin.x,wy=Ball.spin.y,wz=Ball.spin.z;
  for(let t=0;t<2.2;t+=h){
    const rx=vx-Aero.wind.x, ry=vy-Aero.wind.y, rz=vz-Aero.wind.z;
    const vr=Math.hypot(rx,ry,rz);
    if(vr>.05){
      const ad=Aero.k(vr)*vr*h;
      vx-=rx*ad; vy-=ry*ad; vz-=rz*ad;
      const sr=Math.hypot(wx,wy,wz);
      if(sr>1&&vr>1){
        const aM=.5*CFG.air.rho*Aero.A*Aero.Cl(sr,vr)*vr*vr/C.m*h;
        const cx=wy*rz-wz*ry, cy=wz*rx-wx*rz, cz=wx*ry-wy*rx;
        const cl=Math.hypot(cx,cy,cz)||1;
        vx+=cx/cl*aM; vy+=cy/cl*aM; vz+=cz/cl*aM;
      }
    }
    vy-=9.81*h;
    const ox=px;
    px+=vx*h; py+=vy*h; pz+=vz*h;
    const d=Math.exp(-C.spinDecay*h); wx*=d; wy*=d; wz*=d;
    if(py<=r){ py=r; vy=-vy*C.e; vx*=.86; vz*=.86; }
    if((ox-gx)*(px-gx)<=0) return {z:pz,y:py,t:t};
  }
  return null;
}

/* ============================================================================
   JOGADOR — malha detalhada + máquina de poses
   ============================================================================ */
const NAMES=['SILVA','MOURA','KLOSE','ARNOLD','VIEIRA','HOJBJERG','DAVIES','ROCHA','LENNART',
  'SANÉ','PEREIRA','BRAGA','WINTER','MARTINS','KOVAC','OLSEN','DUARTE','FALK','ROMANO','NUNES',
  'BAUER','COSTA','ELIAS','GRIMM','TAVARES','WEBER'];

/**
 * Converte um slot do 2D (lib/formations.ts) para o sistema do motor 3D.
 *
 * `faixaY` e o intervalo de profundidade REALMENTE ocupado pela formacao — nao
 * o campo teorico. Sem isso o goleiro sairia da area, porque os slots do 2D
 * param em y=92 e o campo vai a 133.
 */
function slotDo2D(slot, faixaY){
  const [yMin, yMax] = faixaY
  const t = (slot.y - yMin) / Math.max(1, yMax - yMin)   // 0 = ataque, 1 = defesa
  return {
    r: slot.pos,
    x: X_ATAQUE + t * (X_DEFESA - X_ATAQUE),
    z: ((slot.x - 50) / 100) * FATOR_LARGURA,
  }
}

/** Extremos que o 3D ja usava: goleiro no fundo, atacante na frente. */
const X_DEFESA = -0.474
const X_ATAQUE = 0.216
/** x=85 no 2D (ponta) deve virar z=0,30 no 3D, onde o lateral ficava. */
const FATOR_LARGURA = 0.857

/**
 * Monta a formacao do 3D a partir dos slots do 2D.
 *
 * Recebe a lista no formato de `lib/formations.ts`. Se vier vazia ou invalida,
 * devolve `null` e o motor mantem a formacao embutida — um 3D sem formacao nao
 * pode acontecer so porque a tela nao passou o dado.
 */
function formacaoDo2D(slots){
  if(!Array.isArray(slots) || slots.length !== 11) return null
  const ys = slots.map(s => s.y)
  const faixa = [Math.min(...ys), Math.max(...ys)]
  if(faixa[1] - faixa[0] < 1) return null
  return slots.map(s => slotDo2D(s, faixa))
}

const FORMATION=[
  {r:'GOL',x:-.474,z:0},
  {r:'LE',x:-.335,z:-.30},{r:'ZAG',x:-.378,z:-.10},{r:'ZAG',x:-.378,z:.10},{r:'LD',x:-.335,z:.30},
  {r:'MEI',x:-.150,z:-.20},{r:'VOL',x:-.222,z:0},{r:'MEI',x:-.150,z:.20},
  {r:'PE',x:.132,z:-.29},{r:'ATA',x:.216,z:0},{r:'PD',x:.132,z:.29}
];
const NUMS=[1,6,4,3,2,8,5,10,11,9,7];
/* perfil por posição: [velocidade, passe, finalização, desarme, resistência] */
const ATTR={ GOL:[.52,.60,.28,.90,.82], ZAG:[.72,.62,.34,.90,.80],
             LE:[.87,.66,.42,.80,.86], LD:[.87,.66,.42,.80,.86],
             VOL:[.74,.80,.52,.86,.88], MEI:[.80,.90,.66,.66,.84],
             PE:[.94,.72,.70,.52,.80], PD:[.94,.72,.70,.52,.80],
             ATA:[.88,.70,.92,.46,.78] };
let players=[], teams={home:[],away:[]};

class Player{
  constructor(team,idx){
    this.team=team; this.kit=CFG.teams[team]; this.dir=this.kit.dir;
    this.def=(_formacaoAtiva||FORMATION)[idx]; this.role=this.def.r; this.gk=this.role==='GOL';
    this.num=NUMS[idx]; this.name=NAMES[(idx+(team==='home'?0:11))%NAMES.length];
    this.pos=this.slot().clone(); this.prev=this.pos.clone();
    this.vel=new THREE.Vector3();
    this.face=this.dir>0?Math.PI/2:-Math.PI/2; this.facePrev=this.face;
    this.phase=Math.random()*6.28; this.stam=1; this.think=Math.random()*.4;
    this.kickT=0; this.pose='run'; this.poseT=0; this.lean=0; this.turn=0;
    const a=ATTR[this.role]||ATTR.MEI;
    const j=()=>rnd(-.09,.09);
    this.at={ pace:clamp(a[0]+j(),.3,1), pass:clamp(a[1]+j(),.3,1),
              shoot:clamp(a[2]+j(),.2,1), tackle:clamp(a[3]+j(),.3,1),
              endur:clamp(a[4]+j(),.4,1) };
    this.energy=1;                       // reserva do jogo inteiro (fadiga acumulada)
    this.height=rnd(.95,1.06)*(.98+this.at.pace*.04); this.build=rnd(.94,1.08);
    this.mesh=this.buildMesh(); scene.add(this.mesh);
  }
  slot(){ return new THREE.Vector3(this.def.x*CFG.pitch.L*this.dir,0,this.def.z*CFG.pitch.W*this.dir); }

  buildMesh(){
    const G=new THREE.Group();
    const kitCol=this.gk?this.kit.gk:this.kit.kit;
    const skin=pick([0xf5cfaa,0xe0ac7e,0xb98055,0x7d5138,0x9a663f,0xc78f61]);
    const M=(c,r)=>new THREE.MeshStandardMaterial({color:c,roughness:r,envMapIntensity:.7});
    const mKit=M(kitCol,.72), mTrim=M(this.gk?'#10161e':this.kit.trim,.7),
          mShorts=M(this.gk?'#141a24':this.kit.shorts,.76), mSkin=M(skin,.58),
          mSock=M(this.gk?'#141a24':this.kit.socks,.8), mBoot=M(0x0d1116,.4);
    const B=this.build;

    /* Tronco humano é achatado à frente e atrás (~36 cm de largura por ~24 de
       profundidade) e afunila na cintura. Um cilindro redondo é o que dava o
       aspecto de cápsula. */
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(.212*B,.152*B,.56,20),mKit);
    torso.position.y=1.20; torso.scale.z=.68; torso.castShadow=true; G.add(torso);
    const shoulders=new THREE.Mesh(new THREE.SphereGeometry(.215*B,20,12),mKit);
    shoulders.scale.set(1.02,.58,.66); shoulders.position.y=1.455;
    shoulders.castShadow=true; G.add(shoulders);
    const pect=new THREE.Mesh(new THREE.SphereGeometry(.155*B,16,10),mKit);
    pect.scale.set(1.12,.72,.62); pect.position.set(0,1.34,.045); G.add(pect);
    const detail=QUALITY==='high';
    if(detail){
      const collar=new THREE.Mesh(new THREE.TorusGeometry(.075,.022,8,14),mTrim);
      collar.rotation.x=Math.PI/2; collar.position.y=1.55; G.add(collar);
    }
    const hips=new THREE.Mesh(new THREE.CylinderGeometry(.172*B,.196*B,.25,20),mShorts);
    hips.position.y=.955; hips.scale.z=.74; hips.castShadow=true; G.add(hips);
    if(detail){
      const hem=new THREE.Mesh(new THREE.CylinderGeometry(.2*B,.2*B,.03,16),mTrim);
      hem.position.y=.84; G.add(hem);
    }

    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.055,.064,.085,12),mSkin);
    neck.position.y=1.558; G.add(neck);
    // cabeça ~23 cm: antes estava com 24,4 e puxava a silhueta para o caricato
    const head=new THREE.Mesh(new THREE.SphereGeometry(.113,20,16),mSkin);
    head.position.y=1.672; head.scale.set(.92,1.09,.99); head.castShadow=true;
    const hair=new THREE.Mesh(new THREE.SphereGeometry(.117,18,12),
      M(pick([0x141010,0x33241a,0x0e0c0b,0x6a4a29,0x241a14]),.92));
    hair.scale.set(1,.72,1.02); hair.position.y=.032; head.add(hair);
    const ear=(sd)=>{ const e=new THREE.Mesh(new THREE.SphereGeometry(.026,8,6),mSkin);
      e.scale.set(.5,1,.8); e.position.set(sd*.104,-.01,0); head.add(e); };
    ear(-1); ear(1);
    const headPivot=new THREE.Group(); headPivot.position.y=0; headPivot.add(head); G.add(headPivot);
    this.headPivot=headPivot;

    const back=new THREE.Mesh(new THREE.PlaneGeometry(.25,.25),
      new THREE.MeshBasicMaterial({map:numberTexture(this.num,this.gk?'#0b0f14':this.kit.trim,kitCol)}));
    back.position.set(0,1.25,-.19*B-.005); back.rotation.y=Math.PI; G.add(back);

    const seg=(len,r1,r2,m)=>{
      const s=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,14),m);
      s.position.y=-len/2; s.castShadow=true; return s;
    };
    this.legs=[];
    for(const sd of [-1,1]){
      const hip=new THREE.Group(); hip.position.set(sd*.105*B,.9,0);
      hip.add(seg(.5,.080*B,.060*B,mSkin));
      // perna do calção: cobre o terço superior da coxa, como no uniforme real
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.108*B,.093*B,.19,14),mShorts);
      leg.position.y=-.085; leg.scale.z=.86; leg.castShadow=true; hip.add(leg);
      const knee=new THREE.Group(); knee.position.y=-.5;
      knee.add(seg(.42,.062*B,.05*B,mSock));
      if(detail){
        const stripe=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.05,10),mTrim);
        stripe.position.y=-.12; knee.add(stripe);
      }
      const boot=new THREE.Group(); boot.position.y=-.42;
      const b1=new THREE.Mesh(new THREE.BoxGeometry(.098,.062,.20),mBoot);
      b1.position.z=.035; b1.castShadow=true; boot.add(b1);
      const toe=new THREE.Mesh(new THREE.BoxGeometry(.082,.042,.075),mBoot);
      toe.position.set(0,-.008,.165); boot.add(toe);      // bico
      const heel=new THREE.Mesh(new THREE.BoxGeometry(.086,.05,.055),mBoot);
      heel.position.set(0,.004,-.075); boot.add(heel);
      if(detail){
        const sole=new THREE.Mesh(new THREE.BoxGeometry(.105,.02,.26),M(0xf2f5f8,.5));
        sole.position.set(0,-.038,.05); boot.add(sole);
      }
      knee.add(boot);
      hip.add(knee); hip.userData={knee,boot};
      G.add(hip); this.legs.push(hip);
    }
    this.arms=[];
    for(const sd of [-1,1]){
      const sh=new THREE.Group(); sh.position.set(sd*.222*B,1.425,0);
      sh.add(seg(.29,.058*B,.045*B,mKit));
      if(detail){                       // punho da manga
        const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.049*B,.049*B,.03,12),mTrim);
        cuff.position.y=-.275; sh.add(cuff);
      }
      const el=new THREE.Group(); el.position.y=-.29;
      el.add(seg(.28,.045*B,.038*B,this.gk?mKit:mSkin));
      const hand=new THREE.Mesh(new THREE.SphereGeometry(this.gk?.062:.048,10,8),
        this.gk?M(0xf2f5f8,.5):mSkin);
      hand.position.y=-.29; el.add(hand);
      sh.add(el); sh.userData={el};
      sh.rotation.z=sd*.17;
      G.add(sh); this.arms.push(sh);
    }
    if(this.num===10||this.num===5){
      const band=new THREE.Mesh(new THREE.TorusGeometry(.058,.016,6,12),M(0xffb020,.6));
      band.rotation.y=Math.PI/2; band.position.set(-.235*B,1.28,0); G.add(band);
    }
    G.scale.setScalar(this.height);
    this.torso=torso; this.shoulders=shoulders; this.hips=hips;
    return G;
  }

  get maxSpeed(){
    if(this.gk) return CFG.speed.gk*(.9+this.at.pace*.2);
    const top=7.35+this.at.pace*1.85;               // 7,4 a 9,2 m/s de pico
    const base=this.sprint?top:top*.75;
    const ballPenalty=Ball.owner===this?.93:1;
    // estamina de curto prazo × energia acumulada do jogo
    return base*(.76+.24*this.stam)*(.82+.18*this.energy)*ballPenalty;
  }

  /* aceleração e giro limitados: momento de verdade, sem virar 180° a 8 m/s */
  moveTo(t,dt,urgency){
    const dx=t.x-this.pos.x, dz=t.z-this.pos.z, d=Math.hypot(dx,dz);
    let wx=0,wz=0;
    if(d>.1){
      const want=Math.min(this.maxSpeed, d*3.4+1.1)*(urgency||1);
      wx=dx/d*want; wz=dz/d*want;
    }
    this.steer(wx,wz,dt);
  }
  steer(wx,wz,dt){
    const sp=Math.hypot(this.vel.x,this.vel.z);
    const acc=CFG.speed.accel*(1-clamp(sp/(this.maxSpeed+.001),0,.55));
    let ax=wx-this.vel.x, az=wz-this.vel.z;
    const al=Math.hypot(ax,az);
    if(al>1e-4){
      const step=Math.min(al,acc*dt);
      this.vel.x+=ax/al*step; this.vel.z+=az/al*step;
    }
    const sp2=Math.hypot(this.vel.x,this.vel.z);
    if(sp2>this.maxSpeed){ const k=this.maxSpeed/sp2; this.vel.x*=k; this.vel.z*=k; }
  }

  step(dt){
    this.prev.copy(this.pos); this.facePrev=this.face;
    if(this.poseT>0){ this.poseT-=dt; if(this.poseT<=0) this.pose='run'; }
    if(this.kickT>0) this.kickT-=dt;
    if(this.crossT>0) this.crossT-=dt;
    if(this.headT>0) this.headT-=dt;

    if(this.pose==='tackle'){
      const f=Math.pow(.965,dt*60);
      this.vel.x*=f; this.vel.z*=f;
    }
    this.pos.addScaledVector(this.vel,dt);
    this.pos.x=clamp(this.pos.x,-HALF_L-4,HALF_L+4);
    this.pos.z=clamp(this.pos.z,-HALF_W-4,HALF_W+4);

    const sp=Math.hypot(this.vel.x,this.vel.z);
    if(sp>.4 && this.pose!=='dive'){
      const want=Math.atan2(this.vel.x,this.vel.z);
      const d=angleDiff(want,this.face);
      const rate=CFG.speed.turn/(1+sp*.16);
      const step=clamp(d,-rate*dt,rate*dt);
      this.face+=step;
      this.turn=damp(this.turn,step/Math.max(dt,1e-3),8,dt);
    } else this.turn=damp(this.turn,0,8,dt);

    const rec=.045*(.7+.3*this.at.endur);
    const drain=this.sprint&&sp>5.8?-.075/(.6+.4*this.at.endur):(sp>5?-.014:rec);
    this.stam=clamp(this.stam+drain*dt,0,1);
    // fadiga do jogo: cai devagar e não recupera — no 2º tempo todos correm menos
    this.energy=clamp(this.energy-dt*(sp>6?.00034:.00011)/(.55+.45*this.at.endur),.45,1);
    /* cadência derivada da distância percorrida: é isso que impede o pé de
       patinar. Ciclo completo (duas passadas) cresce com a velocidade. */
    /* fração do ciclo em apoio: alta ao andar (apoio duplo), baixa ao sprintar
       (existe fase de voo). O percurso do pé no apoio é limitado pelo alcance
       real da perna — pedir mais que isso é o que fazia o pé patinar. */
    this.duty=clamp(.58-.035*sp,.30,.58);
    /* percurso do pé no apoio, limitado ao que a perna alcança sem o quadril
       afundar mais de ~8 cm. Uma única fonte de verdade para cadência e render. */
    let strd=clamp(.30+.075*sp,.34,.78);
    if(sp<.7) strd*=clamp(sp/.7,0,1);
    this.stride=strd;
    const cyc=Math.max(.12,strd/this.duty);
    if(sp>.25) this.phase+=6.2832*(sp*dt)/cyc;
    else this.phase+=dt*1.15;
    this.lean=damp(this.lean, clamp(-this.turn*sp*.014,-.34,.34), 7, dt);
  }

  /* pose visual — roda no render, com interpolação do passo fixo */
  render(a){
    const x=lerp(this.prev.x,this.pos.x,a), z=lerp(this.prev.z,this.pos.z,a);
    const face=this.facePrev+angleDiff(this.face,this.facePrev)*a;
    const sp=Math.hypot(this.vel.x,this.vel.z);
    const amp=clamp(sp/7.4,0,1);
    const g=this.mesh, L=this.legs, A=this.arms;
    let y=0, rotX=0, rotZ=this.lean;

    if(this.pose==='dive'){
      const t=1-clamp(this.poseT/.9,0,1);
      const s=Math.sin(t*Math.PI);
      y=s*.75; rotZ=this.diveSide*lerp(0,1.5,clamp(t*2,0,1));
      L[0].rotation.x=-.5; L[1].rotation.x=-.2;
      L[0].userData.knee.rotation.x=.4; L[1].userData.knee.rotation.x=.5;
      A[0].rotation.x=A[1].rotation.x=-2.4;
      A[0].userData.el.rotation.x=A[1].userData.el.rotation.x=-.1;
    } else if(this.pose==='tackle'){
      const t=1-clamp(this.poseT/.7,0,1);
      rotX=-lerp(0,1.15,clamp(t*3,0,1));
      y=-.28*clamp(t*3,0,1);
      L[0].rotation.x=-.9; L[1].rotation.x=.55;
      L[0].userData.knee.rotation.x=.15; L[1].userData.knee.rotation.x=.9;
      A[0].rotation.x=-1.1; A[1].rotation.x=-.4;
    } else if(this.pose==='header'){
      const t=1-clamp(this.poseT/.6,0,1);
      y=Math.sin(t*Math.PI)*.52;
      rotX=lerp(.3,-.45,t);
      L[0].rotation.x=-.5+t*.3; L[1].rotation.x=-.2;
      L[0].userData.knee.rotation.x=.9; L[1].userData.knee.rotation.x=.6;
      A[0].rotation.x=A[1].rotation.x=-1.5;
    } else if(this.pose==='maos_cabeca'){
      // Lamento: maos na cabeca, tronco curvado. Para quem perdeu o gol feito
      // ou sofreu.
      const t = 1 - clamp(this.poseT/2.2, 0, 1)
      const sobe = clamp(t*4, 0, 1)
      A[0].rotation.x = A[1].rotation.x = -2.4*sobe
      A[0].rotation.z = -0.75*sobe; A[1].rotation.z = 0.75*sobe
      A[0].userData.el.rotation.x = A[1].userData.el.rotation.x = -1.5*sobe
      rotX = 0.22*sobe
      y = -0.04*sobe
    } else if(this.pose==='reclamar'){
      // Protesto: um braco aberto para o lado, corpo virado, gesticulando.
      const s = Math.sin(this.phase*3.1)
      A[0].rotation.x = -1.1 + s*0.45
      A[0].rotation.z = -1.05
      A[0].userData.el.rotation.x = -0.5 + s*0.4
      A[1].rotation.x = -0.35
      A[1].rotation.z = 0.2
      rotZ = this.lean + s*0.06
      rotX = -0.08
    } else if(this.pose==='maos_quadril'){
      // Cansaco/resignacao: maos na cintura, respirando. E a pose de quem
      // espera a bola voltar para o meio depois de um gol sofrido.
      const r = Math.sin(this.phase*1.3)*0.03
      A[0].rotation.x = A[1].rotation.x = -0.15
      A[0].rotation.z = -1.15; A[1].rotation.z = 1.15
      A[0].userData.el.rotation.x = A[1].userData.el.rotation.x = -1.9
      rotX = 0.05 + r
      y = r*0.3
    } else if(this.pose==='aponta'){
      // Cobranca ao companheiro, ou pedido de bola. Um braco estendido a frente.
      const s = Math.sin(this.phase*2.4)
      A[0].rotation.x = -1.55 + s*0.12
      A[0].rotation.z = -0.28
      A[0].userData.el.rotation.x = -0.1
      A[1].rotation.x = 0.25
      rotX = -0.05
    } else if(this.pose==='celebrate'){
      const s=Math.sin(this.phase*2.2);
      y=Math.abs(Math.sin(this.phase*2.2))*.16;
      A[0].rotation.x=A[1].rotation.x=-2.9;
      A[0].rotation.z=-.5+s*.2; A[1].rotation.z=.5-s*.2;
      A[0].userData.el.rotation.x=A[1].userData.el.rotation.x=-.2;
      L[0].rotation.x=s*.5; L[1].rotation.x=-s*.5;
      L[0].userData.knee.rotation.x=Math.max(0,-s)*.7;
      L[1].userData.knee.rotation.x=Math.max(0,s)*.7;
      rotX=-.1;
    } else {
      /* Locomoção por cinemática inversa. Em vez de girar a coxa por um seno,
         define-se ONDE o pé deve estar e resolve-se a cadeia coxa+canela.
         Durante o apoio o pé recua exatamente o que o corpo avança, então ele
         fica parado no gramado — é o que elimina o efeito de patinação. */
      const co=Math.cos(this.phase);
      const L1=.5, L2=.42, hipY=.9;
      const hs=this.height||1;
      const D=this.duty||.4, TP=6.2832*D, REACH=L1+L2-.012;
      const stride=(this.stride||.7)/hs;

      // 1) onde cada pé deve estar neste instante do ciclo
      const st=[];
      for(let li=0;li<2;li++){
        const u=(((this.phase+(li?Math.PI:0))%6.2832)+6.2832)%6.2832;
        if(u<TP){                            // apoio: pé recua junto ao solo
          const t=u/TP;
          st.push({fz:stride*.5-stride*t, lift:.04*Math.max(0,(t-.74)/.26), on:true});
        } else {                             // balanço: pé sobe e volta à frente
          const t=(u-TP)/(6.2832-TP);
          st.push({fz:-stride*.5+stride*t, lift:(.06+.17*amp)*Math.sin(Math.PI*t), on:false});
        }
      }

      /* 2) o quadril sobe e desce comandado pela perna de apoio: é assim que o
         corpo humano alcança a passada sem esticar a perna além do possível.
         Como a IK nunca satura, o pé de apoio fica realmente parado no chão. */
      let fyN=REACH;
      for(const g of st) if(g.on) fyN=Math.min(fyN,Math.sqrt(Math.max(.14,REACH*REACH-g.fz*g.fz)));
      y=(fyN-hipY)*hs;

      // 3) cadeia coxa+canela resolvida para cada perna
      for(let li=0;li<2;li++){
        const g=st[li];
        const fy=clamp(hipY+(y-g.lift)/hs,.34,REACH);
        const sgn=-g.fz;                     // eixo do rig: +rotação leva o pé para trás
        const d=clamp(Math.hypot(sgn,fy),Math.abs(L1-L2)+.02,REACH);
        const th=Math.acos(clamp((L1*L1+L2*L2-d*d)/(2*L1*L2),-1,1));
        const gg=Math.acos(clamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1));
        const a1=Math.atan2(sgn,fy)-gg, a2=Math.PI-th;
        L[li].rotation.x=a1;
        L[li].userData.knee.rotation.x=a2;
        L[li].userData.boot.rotation.x=clamp(-(a1+a2),-.45,.45);
      }

      const sw=Math.sin(this.phase);
      A[0].rotation.x=-sw*(.25+amp*.55); A[1].rotation.x=sw*(.25+amp*.55);
      A[0].rotation.z=-.12-amp*.1; A[1].rotation.z=.12+amp*.1;
      A[0].userData.el.rotation.x=-.42-amp*.4;
      A[1].userData.el.rotation.x=-.42-amp*.4;
      this.hips.rotation.y=co*.1*amp;
      this.shoulders.rotation.y=-co*.14*amp;
      rotX=clamp(sp*.026,0,.19);

      /* chute: o contato acontece no INÍCIO da animação, porque é nesse quadro
         que o impulso foi aplicado à bola. O resto é acompanhamento. */
      if(this.kickT>0){
        const u=clamp(1-this.kickT/.26,0,1);
        const ang=u<.45?lerp(-.5,-1.55,u/.45):lerp(-1.55,-.12,(u-.45)/.55);
        L[1].rotation.x=ang;
        L[1].userData.knee.rotation.x=Math.max(0,.55-u*.55);
        L[1].userData.boot.rotation.x=clamp(-ang*.35,-.4,.4);
        rotX-=.16*(1-Math.abs(u*2-1));
      }
    }
    g.position.set(x,y,z);
    g.rotation.set(rotX,face,rotZ);
    this.torso.rotation.x=rotX*.35;
    // cabeça acompanha a bola
    if(this.headPivot){
      const want=Math.atan2(Ball.pos.x-x,Ball.pos.z-z)-face;
      this.headPivot.rotation.y=damp(this.headPivot.rotation.y,clamp(angleDiff(want+face,face),-1,1),1,.16);
    }
  }
}

/* ============================================================================
   CAMADAS DE ANÁLISE — trajetória prevista, linha de impedimento,
   vetores de velocidade e forma tática das equipes
   ============================================================================ */
const Overlay={
  init(){
    const line=(n,color)=>{
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(n*3),3));
      const m=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,
        opacity:.85,depthTest:false}));
      m.frustumCulled=false; m.renderOrder=8; m.visible=false; scene.add(m);
      return m;
    };
    this.pred=line(48,0xffe08a);
    this.predBuf=this.pred.geometry.attributes.position.array;
    this.offH=line(2,0xff5a3c); this.offA=line(2,0x7fd0ff);
    this.hullH=line(14,0xff8a5c); this.hullA=line(14,0x8fd6ff);

    const vg=new THREE.BufferGeometry();
    this.vecBuf=new Float32Array(22*2*3);
    vg.setAttribute('position',new THREE.Float32BufferAttribute(this.vecBuf,3));
    this.vec=new THREE.LineSegments(vg,new THREE.LineBasicMaterial({
      color:0xffffff,transparent:true,opacity:.5,depthTest:false}));
    this.vec.frustumCulled=false; this.vec.renderOrder=8; this.vec.visible=false;
    scene.add(this.vec);

    this.labels=[];
    for(const p of players){
      const c=cv(256,64), g2=c.getContext('2d');
      g2.fillStyle='rgba(8,12,18,.72)'; g2.fillRect(0,0,256,64);
      g2.fillStyle='#ffb020'; g2.font='700 34px Arial Narrow, Arial';
      g2.textBaseline='middle'; g2.fillText(String(p.num),10,34);
      g2.fillStyle='#f3f6f8'; g2.font='600 30px Arial Narrow, Arial';
      g2.fillText(p.name,62,34);
      const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,
        depthTest:false,opacity:.92}));
      sp.scale.set(3.0,.75,1); sp.renderOrder=9; sp.visible=false;
      scene.add(sp); this.labels.push(sp);
    }
  },
  setLine(m,pts){
    const a=m.geometry.attributes.position.array;
    const n=Math.min(pts.length,a.length/3);
    for(let i=0;i<n;i++){ a[i*3]=pts[i][0]; a[i*3+1]=pts[i][1]; a[i*3+2]=pts[i][2]; }
    m.geometry.attributes.position.needsUpdate=true;
    if(m.geometry.setDrawRange) m.geometry.setDrawRange(0,n);
  },
  /* casco convexo (monotone chain): a "forma" que a equipe ocupa em campo */
  hull(list){
    const pts=list.map(p=>[p.pos.x,p.pos.z]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const lo=[],up=[];
    for(const q of pts){
      while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0) lo.pop();
      lo.push(q);
    }
    for(let i=pts.length-1;i>=0;i--){
      const q=pts[i];
      while(up.length>=2&&cross(up[up.length-2],up[up.length-1],q)<=0) up.pop();
      up.push(q);
    }
    return lo.concat(up.slice(1)).map(q=>[q[0],.05,q[1]]);
  },
  update(){
    if(Show.predict&&!Ball.owner&&Ball.vel.length()>4){
      const n=predictTrajectory(this.predBuf,1.6);
      this.pred.geometry.attributes.position.needsUpdate=true;
      if(this.pred.geometry.setDrawRange) this.pred.geometry.setDrawRange(0,n);
      this.pred.visible=true;
    } else this.pred.visible=false;

    if(Show.offside){
      const lh=Officials.lineOf('home'), la=Officials.lineOf('away');
      this.setLine(this.offH,[[lh,.06,-HALF_W],[lh,.06,HALF_W]]);
      this.setLine(this.offA,[[la,.06,-HALF_W],[la,.06,HALF_W]]);
      this.offH.visible=this.offA.visible=true;
    } else this.offH.visible=this.offA.visible=false;

    if(Show.vectors){
      const a=this.vecBuf;
      for(let i=0;i<players.length;i++){
        const p=players[i], k=i*6;
        a[k]=p.pos.x; a[k+1]=.1; a[k+2]=p.pos.z;
        a[k+3]=p.pos.x+p.vel.x*.42; a[k+4]=.1; a[k+5]=p.pos.z+p.vel.z*.42;
      }
      this.vec.geometry.attributes.position.needsUpdate=true;
      this.vec.visible=true;
    } else this.vec.visible=false;

    if(Show.hull){
      this.setLine(this.hullH,this.hull(teams.home.filter(p=>!p.gk)));
      this.setLine(this.hullA,this.hull(teams.away.filter(p=>!p.gk)));
      this.hullH.visible=this.hullA.visible=true;
    } else this.hullH.visible=this.hullA.visible=false;

    for(let i=0;i<this.labels.length;i++){
      const sp=this.labels[i];
      sp.visible=Show.labels;
      const pl=players[i];
      if(!pl){ sp.visible=false; continue; }
      if(Show.labels) sp.position.set(pl.pos.x,2.35,pl.pos.z);
    }
  }
};

/* ============================================================================
   ESTATÍSTICAS, PARTIDA E IA
   ============================================================================ */
const Stats={
  d:{home:{shots:0,tgt:0,pass:0,att:0,blk:0},away:{shots:0,tgt:0,pass:0,att:0,blk:0}},
  shot(t){ this.d[t].shots++; Ball.shotBy=t; Ball.shotCool=.7; },
  turnover(t){ this.d[t].turn=(this.d[t].turn||0)+1; },
  onTarget(t){ if(t) this.d[t].tgt++; Ball.shotBy=null; },
  block(t){ this.d[t].blk++; },
  attempt(t){ this.d[t].att++; },
  complete(t){ this.d[t].pass++; }
};

/**
 * A bola estava mesmo indo para o gol de `time`?
 *
 * Sem isto, `Stats.onTarget` contava qualquer toque do goleiro como "no alvo" —
 * inclusive ele saindo para pegar bola solta. A taxa media ficava em 67%,
 * quando o futebol real fica perto de 33%.
 */
function indoAoGol(time){
  if(!Ball.shotBy) return null
  const alvo = goalCenter(Ball.shotBy)
  const v = Ball.vel
  // Parada ou quase: nao ia a lugar nenhum.
  const vel = Math.hypot(v.x, v.z)
  if(vel < 3) return null
  // A bola precisa estar se aproximando do gol, e nao passando ao largo.
  const dx = alvo.x - Ball.pos.x, dz = alvo.z - Ball.pos.z
  const dlen = Math.hypot(dx, dz) || 1
  const cos = (v.x * dx + v.z * dz) / (vel * dlen)
  if(cos < 0.3) return null                  // indo claramente para outro lado
  // Enquadrada com a meta. O gol tem 7,32 m (+-3,66) e a folga cobre o efeito
  // Magnus, que curva a bola no caminho — a projecao reta subestima quem
  // entraria. Este numero foi CALIBRADO medindo a taxa "no gol/finalizacoes":
  // 6,5 zerava a estatistica; 11 devolvia 67%; ~5 chega perto dos 33% reais.
  const t = dlen / vel
  const zNoGol = Ball.pos.z + v.z * t
  if(Math.abs(zNoGol) > 5) return null
  // Altura: bola por cima do travessao (2,44 m) nao e chute no gol.
  const yNoGol = Ball.pos.y + Ball.vel.y * t - 4.9 * t * t
  if(yNoGol > 3.2) return null
  return Ball.shotBy
}


/**
 * Quanto cada funcao acompanha o Z da bola, de 0 (segura a posicao) a 1 (cola).
 *
 * O motor usava .32 para todo mundo, e os 10 colapsavam na mesma faixa. Quem
 * abre o campo e o ponta: se ele persegue a bola, o time joga num corredor so.
 */
const DISCIPLINA_Z = {
  GOL: 0.10,
  ZAG: 0.34,           // acompanha: e a funcao dele
  LE: 0.26, LD: 0.26,  // lateral sobe pela beirada, nao pelo meio
  VOL: 0.30,
  MEI: 0.22,
  PE: 0.10, PD: 0.10,  // ponta MANTEM a largura — e o que abre linha de passe
  ATA: 0.16,
}

/** Largura minima que cada funcao respeita, em fracao da meia-largura do campo. */
const LARGURA_MIN = { PE: 0.62, PD: 0.62, LE: 0.52, LD: 0.52 }

const Match={
  t:0, half:1, score:{home:0,away:0}, phase:'kickoff', wait:1.4,
  possession:'home', possT:{home:1,away:1}, humanTeam:'none', controlled:null,
  paused:false, stoppage:0, setType:null, cards:{home:0,away:0}, fouls:{home:0,away:0},
  reds:{home:0,away:0}, steps:0,
  counter:null                     // janela de transição após tomada de bola
};
/* velocidade da SIMULAÇÃO (a física roda igual; muda quanto tempo simulado
   cabe em cada segundo real). 1x = tempo real. */
const Sim={ list:[.15,.5,1,2,4,8], i:2, get speed(){ return this.list[this.i]; },
  shift(d){ this.i=clamp(this.i+d,0,this.list.length-1); } };
const goalCenter=t=>new THREE.Vector3(CFG.teams[t].dir*HALF_L,1.1,0);
const ownGoal=t=>new THREE.Vector3(-CFG.teams[t].dir*HALF_L,0,0);
const opponents=t=>t==='home'?teams.away:teams.home;
const hudTeam=()=>teams[Match.humanTeam]?Match.humanTeam:'home';

function spawnTeams(){
  for(const t of ['home','away'])
    for(let i=0;i<11;i++){ const p=new Player(t,i); players.push(p); teams[t].push(p); }
  Match.controlled=teams.home[9];
  $('tagH').textContent=CFG.teams.home.tag; $('tagA').textContent=CFG.teams.away.tag;
  $('tagHc').style.background=CFG.teams.home.kit;
  $('tagAc').style.background=CFG.teams.away.kit;
}

function laneRisk(from,to,team){
  const sx=to.x-from.x, sz=to.z-from.z, L=Math.hypot(sx,sz);
  if(L<1) return 99;
  const ux=sx/L, uz=sz/L; let risk=0;
  for(const o of opponents(team)){
    const rx=o.pos.x-from.x, rz=o.pos.z-from.z;
    const along=rx*ux+rz*uz;
    if(along<0||along>L) continue;
    const lat=Math.abs(rx*uz-rz*ux);
    risk+=clamp(3.4-lat,0,3.4)*(1-along/L*.3);
  }
  return risk;
}

/* impedimento: guarda quem estava além da penúltima defesa no momento do passe */
function snapOffside(team){
  if(!CFG.rules.offside){ Ball.offside=null; return; }
  const d=CFG.teams[team].dir;
  const vals=opponents(team).map(o=>o.pos.x*d).sort((a,b)=>b-a);
  const line=vals[1]!==undefined?vals[1]:vals[0];
  const lim=Math.max(line,Ball.pos.x*d,0);
  const set=new Set(teams[team].filter(m=>m.pos.x*d>lim+.45));
  Ball.offside=set.size?{team,set}:null;
}

/* resolve v0 para a bola chegar a `arrive` m/s depois de L metros rolando:
   integrando dv/dx = -(k·v² + r0)/v  →  k·v² + r0 = (k·v0² + r0)·e^(-2kL)   */
function passPower(L,arrive){
  const r0=CFG.ball.roll, va=arrive||5;
  // k depende da velocidade, então itera: estima v0, recalcula k, repete
  let k=Aero.k(10), v0=8;
  for(let i=0;i<3;i++){
    v0=Math.sqrt(Math.max(1,((k*va*va+r0)*Math.exp(2*k*L)-r0)/k));
    k=Aero.k(v0*.72);
  }
  return clamp(v0,6,32);
}
function passTo(p,m,lofted){
  // ANTECIPACAO PELO TEMPO DE VOO REAL.
  //
  // Mirar `vel * 0.46` assumia que a bola chega em meio segundo. Num passe de
  // 20 m ela leva ~3,9 s, e o companheiro ja andou ~16 m — o passe ia para
  // onde ele esteve. Estimamos o voo pela distancia e miramos o ponto futuro.
  //
  // Duas passadas: a primeira estima o tempo pela distancia atual, a segunda
  // corrige com a distancia ate o ponto ja antecipado. Converge o bastante
  // sem custar iteracao no laco de fisica.
  let alvo = m.pos.clone();
  for(let i=0;i<2;i++){
    const dParcial = Math.max(3, alvo.distanceTo(p.pos));
    const vMedia = lofted ? 12 : Math.max(4.5, 3.6 + dParcial*0.055);
    const tVoo = clamp(dParcial / vMedia, 0.2, 2.4);
    alvo = m.pos.clone().addScaledVector(m.vel, tVoo);
  }
  const to=alvo.sub(p.pos).setY(0);
  const L=Math.max(3,to.length());
  let power,loft;
  if(lofted){                    // balístico: escolhe o tempo de voo e resolve vy/vx
    const t=clamp(L/15,.55,1.9);
    loft=9.81*t/2; power=L/t*1.12;
  } else {
    power=passPower(L,clamp(3.6+L*.04,3.6,5.6)); loft=.32;
  }
  // erro angular e de força conforme a qualidade de passe, cansaço e fadiga
  const q=p.at.pass*(.76+.24*p.stam)*(.88+.12*p.energy);
  const ang=(1-q)*rnd(-.16,.16);   // ~2-5° conforme qualidade, cansaço e pressão
  const cs=Math.cos(ang), sn=Math.sin(ang);
  to.set(to.x*cs-to.z*sn,0,to.x*sn+to.z*cs);
  power*=1+(1-q)*rnd(-.12,.12);
  kick(p,to,power,loft, lofted?rnd(-12,12):rnd(-5,5), 0);
  Ball.lastKick={team:p.team,to:m};
  Stats.attempt(p.team);
  if((m.pos.x-p.pos.x)*p.dir>2) snapOffside(p.team); else Ball.offside=null;
}

function decide(p){
  const gc=goalCenter(p.team), gd=dist(p.pos,gc);
  const press=opponents(p.team).reduce((n,o)=>n+(dist2(o.pos,p.pos)<10?1:0),0);

  // encostado na lateral e pressionado: joga fora e ganha tempo
  if(Math.abs(p.pos.z)>29&&press>=2&&Math.random()<.06){
    const sz=Math.sign(p.pos.z)||1;
    kick(p,new THREE.Vector3(rnd(-4,4),0,sz*8),rnd(9,14),rnd(1,3),0,0);
    Ball.offside=null; Ball.lastKick=null; p.think=.6; return;
  }
  // dentro da própria área não se constrói: afasta. É o que impede o pinball na área.
  const og=ownGoal(p.team);
  if(p.pos.x*-p.dir>HALF_L-16.5&&Math.abs(p.pos.z)<20.16){
    const sz=(Math.sign(p.pos.z)||1);
    kick(p,new THREE.Vector3(p.dir*26,0,sz*30-p.pos.z),rnd(23,28),rnd(7,9.5),0,0);
    Ball.offside=null; Ball.lastKick=null; Ball.shotBy=null; p.think=.8; return;
  }
  // sob pressão perto da própria área: afasta o perigo
  if(dist(p.pos,ownGoal(p.team))<27&&press>=2){
    // sem saída: joga longe, e às vezes fora mesmo — é o que um zagueiro faz
    const far=Math.random()<.35;
    const tz=(Math.sign(p.pos.z)||1)*(far?rnd(36,44):rnd(10,26));
    const d=new THREE.Vector3(p.dir*(far?18:34),0,tz-p.pos.z);
    kick(p,d,rnd(21,27),rnd(6.5,9),0,0);
    Ball.offside=null; Ball.lastKick=null; p.think=.7; return;
  }

  if(gd<25 && Math.abs(p.pos.z)<27){
    const risk=laneRisk(p.pos,gc,p.team);
    /* confiança para finalizar: qualidade de chute × ângulo/distância × pressão.
       Sem isso a IA chuta de qualquer lugar e o volume de finalizações dobra. */
    const conf=p.at.shoot*(1-gd/26)*(1-clamp(press*.2,0,.62))
               *(1-clamp(Math.abs(p.pos.z)/30,0,.55));
    if(risk<CFG.balance.shotLane&&conf>CFG.balance.shotConf&&Ball.shotCool<=0){
      const side=Math.sign(-p.pos.z)||(Math.random()<.5?-1:1);
      const aimZ=clamp(side*rnd(1.1,3.2),-3.3,3.3);
      const d=new THREE.Vector3(gc.x-p.pos.x,0,aimZ-p.pos.z);
      const sp=Math.hypot(p.vel.x,p.vel.z);
      const acc=clamp(1-gd/46,.2,1)*(1-clamp(press*.13,0,.45))
                *(1-clamp(sp/9,0,1)*.26)*(.72+.28*p.stam);
      const err=(1-acc)*rnd(-8.2,8.2)*(1.12-p.at.shoot*.62);
      d.z+=err;
      const curl=(Math.random()<.3?side*rnd(14,40):side*rnd(2,12))*(gd>17?1:.4);
      kick(p,d,clamp(gd*.92+rnd(7,12),17,31),rnd(1.2,3.3),curl,rnd(-10,5));
      Stats.shot(p.team);
      Audio2.cheer(.4); Ball.offside=null; p.think=.85; return;
    }
  }
  // cruzamento da ponta
  if(Math.abs(p.pos.z)>18.5 && (gc.x-p.pos.x)*p.dir<24 && press>=1
     && !(p.crossT>0)){
    // só cruza se houver alguém de fato na área
    const box=teams[p.team].filter(m=>m!==p&&!m.gk&&Math.abs(m.pos.z)<14
              &&(gc.x-m.pos.x)*p.dir<18&&(m.pos.x-p.pos.x)*p.dir>-3);
    if(box.length){ passTo(p,pick(box),true); p.think=.65; p.crossT=6; return; }
  }
  // enfiada: bola no espaço à frente de quem está em movimento
  if(Math.random()<.45){
    for(const m of teams[p.team]){
      if(m===p||m.gk) continue;
      if((m.pos.x-p.pos.x)*p.dir<1.5) continue;
      const ahead=new THREE.Vector3(clamp(m.pos.x+p.dir*7.5,-HALF_L+3,HALF_L-3),0,
                                    m.pos.z+m.vel.z*.5);
      const L=dist(p.pos,ahead);
      if(L<9||L>36) continue;
      if(laneRisk(p.pos,ahead,p.team)>1.15) continue;
      const rel=ahead.clone().sub(p.pos).setY(0);
      kick(p,rel,passPower(L,5.5),.3,rnd(-4,4),rnd(2,7));
      Ball.lastKick={team:p.team,to:m}; Stats.attempt(p.team);
      snapOffside(p.team);
      Events.add('Enfiada de '+p.name);
      p.think=.5; return;
    }
  }
  let best=null,bs=-1e9;
  for(const m of teams[p.team]){
    if(m===p||m.gk) continue;
    const d=dist(p.pos,m.pos); if(d<4||d>44) continue;
    const fwd=(m.pos.x-p.pos.x)*p.dir;
    const risk=laneRisk(p.pos,m.pos,p.team);
    const crowd=opponents(p.team).reduce((n,o)=>n+(dist2(o.pos,m.pos)<28?1:0),0);
    const closer=Math.max(0,dist(p.pos,gc)-dist(m.pos,gc))*.5;
    const ctr2=Match.counter;
    const bonus=(ctr2&&ctr2.team===p.team)?fwd*.55:0;   // transição: vertical vale mais
    const s=fwd*.8-risk*3.2-crowd*2.3-d*.15+closer+(m.role==='ATA'?4:0)+bonus;
    if(s>bs){bs=s;best=m;}
  }
  const forced=press>=2||p.stam<.24;
  if(best&&bs>(forced?-7:4.5)){
    passTo(p,best,laneRisk(p.pos,best.pos,p.team)>2.7);
    p.think=rnd(.28,.55); return;
  }
  p.think=rnd(.20,.45);
}

function tryHeader(p){
  const b=Ball;
  if(p.headT>0) return false;                     // não cabeceia duas vezes seguidas
  if(b.owner||b.pos.y<1.2||b.pos.y>2.2) return false;
  if(dist(p.pos,b.pos)>.85) return false;
  const sp=Math.hypot(b.vel.x,b.vel.z);
  if(sp<3) return false;
  p.pose='header'; p.poseT=.6; p.headT=1.2;
  const att=Match.possession===p.team||dist(p.pos,goalCenter(p.team))<30;
  const tgt=att?goalCenter(p.team):goalCenter(p.team==='home'?'away':'home');
  const d=new THREE.Vector3(tgt.x-p.pos.x,0,(att?rnd(-3,3):rnd(-20,20))-p.pos.z);
  kick(p,d,att?rnd(12,19):rnd(11,17),rnd(2.2,4.6),rnd(-10,10),0);
  // só conta como finalização se foi de fato uma tentativa ao gol
  if(att&&dist(p.pos,tgt)<17&&Ball.shotCool<=0) Stats.shot(p.team);
  Audio2.noise(.06,700,'bandpass',.08,2);
  return true;
}

function gkBrain(p,dt){
  const g=ownGoal(p.team), b=Ball;
  const dGoal=dist(b.pos,g);
  const speed=Math.hypot(b.vel.x,b.vel.z);
  const shot=!b.owner&&speed>8.5&&(b.vel.x*(g.x>0?1:-1))>0;

  if(shot&&dGoal<34&&p.pose!=='dive'){
    const hit=predictAtPlane(g.x);
    if(!hit){ p.react=undefined; }
    const t=hit?hit.t:Math.abs((g.x-b.pos.x)/(b.vel.x||1e-3));
    // erro de leitura: quanto mais rápido o chute, menos tempo para ler a curva
    const rerr=clamp(.34-t*.16,.07,.34);
    const zAt=(hit?hit.z:b.pos.z+b.vel.z*t)+rnd(-rerr,rerr);
    const yAt=hit?hit.y:b.pos.y+b.vel.y*t-4.905*t*t;
    const off=zAt-p.pos.z;
    // latência de reação: chute de perto não dá tempo de reagir
    if(p.react===undefined||p.reactFor!==b.lastTouch){ p.react=rnd(.15,.26); p.reactFor=b.lastTouch; }
    p.react-=dt;
    if(p.react<=0&&t<1.15&&Math.abs(zAt)<8.6&&yAt<3.1&&Math.abs(off)>.6){
      p.pose='dive'; p.poseT=.9; p.diveSide=off>0?-1:1;
      p.vel.set(0,0,clamp(off/Math.max(t,.2),-12.5,12.5));
      Audio2.cheer(.2);
    }
  }
  // saída em bola aérea: cruzamento na pequena área é do goleiro
  const aerial=!b.owner&&b.pos.y>.7&&b.pos.y<2.75&&dist(b.pos,g)<8.2;
  if(aerial&&p.pose!=='dive'){
    p.sprint=true;
    p.moveTo(new THREE.Vector3(b.pos.x,0,b.pos.z),dt,1.3);
    if(dist(p.pos,b.pos)<2.05&&b.cool<=0){
      b.owner=p; b.lastTouch=p; b.vel.set(0,0,0); b.spin.set(0,0,0);
      b.offside=null; Stats.onTarget(indoAoGol(p.team));
      Events.add('Saída de '+p.name); Toast.show('SAIU DO GOL','',900);
    }
  } else if(p.pose!=='dive'){
    // fecha o ângulo: posiciona-se na reta entre a bola e o centro do gol
    const dx=b.pos.x-g.x, dz=b.pos.z-g.z;
    const L=Math.max(.001,Math.hypot(dx,dz));
    const depth=clamp(1.05+(1-clamp(dGoal/34,0,1))*3.5,1.05,4.5);
    const t=new THREE.Vector3(g.x+dx/L*depth,0,clamp(dz/L*depth,-6.4,6.4));
    p.moveTo(t,dt,1);
  }
  // alcance: em pé é o vão dos braços; no voo, só para o lado do salto
  let grab=CFG.balance.gkReach;
  if(p.pose==='dive'){
    const sideOk=Math.sign(b.pos.z-p.pos.z)===-p.diveSide||Math.abs(b.pos.z-p.pos.z)<.7;
    grab=sideOk?2.35:1.1;
  }
  if(!b.owner&&b.cool<=0&&dist(p.pos,b.pos)<grab&&b.pos.y<2.45){
    b.lastTouch=p; b.offside=null;
    const _alvoDoChute = indoAoGol(p.team);
    if(speed>19&&Math.random()<.58){        // chute forte: espalma para fora
      b.vel.set(p.dir*rnd(13,21),rnd(4,7),rnd(-17,17));  // espalma para longe/lateral
      b.spin.multiplyScalar(.3); b.cool=.3;
      Stats.onTarget(_alvoDoChute);
      Events.add('Defesa de '+p.name); Toast.show('ESPALMOU','',1100); Audio2.cheer(.55); Audio2.noise(.08,520,'bandpass',.09,2);
    } else {
      b.owner=p; b.spin.set(0,0,0); b.vel.set(0,0,0);
      if(speed>11){ Stats.onTarget(_alvoDoChute); Toast.show('DEFENDEU','',1100); Audio2.cheer(.5); }
    }
  }
  if(Ball.owner===p){
    p.think-=dt;
    if(p.think<=0){
      let best=null,bs=-1e9;
      for(const m of teams[p.team]){
        if(m.gk) continue;
        const s=(m.pos.x-p.pos.x)*p.dir-Math.abs(m.pos.z)*.22-laneRisk(p.pos,m.pos,p.team)*4.5;
        if(s>bs){bs=s;best=m;}
      }
      if(best){ passTo(p,best,dist(p.pos,best.pos)>26); }
      p.think=1.3;
    }
  }
}

function brain(dt){
  const b=Ball;
  if(Match.counter&&(Match.counter.t-=dt)<=0) Match.counter=null;
  const ctr=Match.counter;
  if(b.owner) Match.possession=b.owner.team;
  Match.possT[Match.possession]+=dt;

  let chasers;
  if(b.owner){
    // três homens na pressão quando o perigo está perto da própria meta
    const dg=dist(b.pos,ownGoal(opponents(Match.possession)[0].team));
    const nP=dg<38?3:2;
    chasers=new Set(opponents(Match.possession).filter(p=>!p.gk)
      .sort((a,b2)=>dist2(a.pos,b.pos)-dist2(b2.pos,b.pos)).slice(0,nP));
  } else {
    // bola livre: os dois mais próximos de cada time vão à disputa
    chasers=new Set();
    for(const t of ['home','away']){
      const l=teams[t].filter(x=>!x.gk)
        .sort((a,b2)=>dist2(a.pos,b.pos)-dist2(b2.pos,b.pos));
      if(l[0]) chasers.add(l[0]); if(l[1]) chasers.add(l[1]);
    }
  }
  const human=Match.controlled;

  for(const p of players){
    p.sprint=false;
    if(p.gk){ gkBrain(p,dt); p.step(dt); continue; }
    if(p.pose==='tackle'||p.pose==='header'||p.pose==='celebrate'){ p.step(dt); continue; }
    if(tryHeader(p)){ p.step(dt); continue; }

    if(b.owner===p){
      if((p.think-=dt)<=0) decide(p);
      const gc=goalCenter(p.team);
      const near=opponents(p.team).reduce((r,o)=>{const d=dist2(o.pos,p.pos);
        return (!r||d<r.d)?{o,d}:r;},null);
      const t=new THREE.Vector3(gc.x,0,clamp(p.pos.z*.72,-25,25));
      if(near&&near.d<30){
        const s=Math.sign(p.pos.z-near.o.pos.z)||1;
        t.z=clamp(p.pos.z+s*8,-31,31);
      }
      p.sprint=p.stam>.3;
      p.moveTo(t,dt,1);
      p.step(dt); continue;
    }

    let target;
    if(chasers.has(p)){
      target=b.pos.clone().addScaledVector(b.vel,.24);
      p.sprint=p.stam>.2;
      if(b.owner&&b.owner.team!==p.team){
        const d=dist(p.pos,b.owner.pos);
        // carrinho: resolve na hora em desarme limpo, falta ou nada
        if(d<2.4&&p.pose==='run'&&Math.random()<dt*CFG.balance.tackleRate){
          p.pose='tackle'; p.poseT=.7;
          const r=Math.random(), skill=.30+p.at.tackle*.44;
          if(r<skill) steal(p,b.owner);
          else if(r<skill+.20) Rules.foul(p,b.owner);
        }
        if(d<1.45&&b.cool<=0&&Math.random()<dt*.34*(.55+p.at.tackle*.9)) steal(p,b.owner);
      }
    } else {
      const s=p.slot(), att=Match.possession===p.team;
      const push=clamp(b.pos.x*(att?.66:.52),-31,31);
      const line=att?5*p.dir:-3*p.dir;
      target=new THREE.Vector3(
        clamp(s.x+push+line,-HALF_L+3,HALF_L-3),0,
        clamp((() => {
          // Cada funcao acompanha a bola no seu proprio grau. O ponta segura a
          // largura em vez de perseguir — e o que abre o campo e cria a linha
          // de passe que nao existia.
          const dz = DISCIPLINA_Z[p.role] ?? 0.24
          let z = s.z + (b.pos.z - s.z) * dz
          const wmin = LARGURA_MIN[p.role]
          if(wmin && att){
            // Em posse, quem e de beirada NAO fecha para o meio.
            const lado = Math.sign(s.z) || 1
            if(Math.abs(z) < HALF_W * wmin) z = lado * HALF_W * wmin
          }
          return z
        })(),-HALF_W+2,HALF_W-2));
      if(att&&(p.role==='ATA'||p.role==='PE'||p.role==='PD')){
        // em transição os homens de frente disparam; fora dela, mantêm a forma
        const surge=(ctr&&ctr.team===p.team)?15:7;
        target.x=clamp(target.x+p.dir*surge,-HALF_L+6,HALF_L-6);
        // respeita a linha do último defensor para não ficar impedido
        if(CFG.rules.offside){
          const dv=p.dir;
          const vals=opponents(p.team).map(o=>o.pos.x*dv).sort((x,y)=>y-x);
          const lineX=(vals[1]!==undefined?vals[1]:vals[0])-.7;
          if(target.x*dv>lineX) target.x=lineX*dv;
        }
        p.sprint=(ctr&&ctr.team===p.team)?p.stam>.22:(dist(p.pos,target)>9&&p.stam>.34);
      }
      /* marcação individual no próprio terço: o defensor se coloca ENTRE o
         atacante e o gol. É o que elimina a cabeçada livre na área. */
      const ownG=ownGoal(p.team);
      const inOwnHalf=p.pos.x*(-p.dir)>-10;
      const marker=p.role==='ZAG'||p.role==='LE'||p.role==='LD'||
                   (p.role==='VOL'&&dist(p.pos,ownG)<40);
      if(!att&&inOwnHalf&&marker){
        let m=null,bd=1e9;
        for(const o of opponents(p.team)){
          if(o.gk) continue;
          if(dist(o.pos,ownG)>42) continue;
          const d=dist2(o.pos,p.pos);
          if(d<bd){ bd=d; m=o; }
        }
        if(m){
          const ux=ownG.x-m.pos.x, uz=ownG.z-m.pos.z, L=Math.hypot(ux,uz)||1;
          target=new THREE.Vector3(clamp(m.pos.x+ux/L*1.7,-HALF_L+1,HALF_L-1),0,
                                   clamp(m.pos.z+uz/L*1.7,-HALF_W+1,HALF_W-1));
          p.sprint=bd>36&&p.stam>.3;
        }
      }
      if(!b.owner&&dist2(p.pos,b.pos)<210&&b.pos.y<1.6){ target=b.pos.clone(); p.sprint=p.stam>.28; }
    }
    p.moveTo(target,dt,1);
    p.step(dt);
  }

  // separação de corpos com empurrão
  for(let i=0;i<players.length;i++) for(let j=i+1;j<players.length;j++){
    const a=players[i],c=players[j];
    const dx=a.pos.x-c.pos.x, dz=a.pos.z-c.pos.z, d2=dx*dx+dz*dz;
    if(d2<.62&&d2>1e-6){
      const d=Math.sqrt(d2), f=(0.79-d)/d*.46;
      a.pos.x+=dx*f; a.pos.z+=dz*f; c.pos.x-=dx*f; c.pos.z-=dz*f;
    }
  }

  // domínio da bola: só com a bola em altura de controle
  if(!b.owner&&b.cool<=0&&b.pos.y<.62){
    let best=null,bd=1.3;
    for(const p of players){
      if(p.pose==='dive') continue;
      const d=dist(p.pos,b.pos);
      const reach=(b.lastKick&&b.lastKick.to===p)?1.75:(p.pose==='tackle'?1.7:1.3);
      if(d<reach&&d<bd+.5){ bd=d; best=p; }
    }
    if(best) takeBall(best);
  }
  if(Match.phase==='play'&&b.owner&&b.owner.team===Match.humanTeam&&Input.active)
    Match.controlled=b.owner;
}

function takeBall(p){
  const b=Ball;
  // impedimento
  if(b.offside&&b.offside.team===p.team&&b.offside.set.has(p)){
    b.offside=null;
    Officials.raiseFlag();
    Rules.setPiece(p.team==='home'?'away':'home',p.pos.x,p.pos.z,'IMPEDIMENTO');
    return;
  }
  if(b.lastKick){
    if(b.lastKick.team===p.team) Stats.complete(p.team);
    b.lastKick=null;
  }
  if(b.lastTouch&&b.lastTouch.team!==p.team) b.offside=null;
  // primeiro toque: bola forte pode escapar do controle e virar bola dividida
  const inc=b.vel.length();
  if(inc>9.5){
    const ctrl=p.at.pass*(.78+.22*p.stam);
    if(Math.random()>ctrl*.94){
      b.owner=null; b.lastTouch=p; b.cool=.22; b.shotBy=null;
      b.vel.multiplyScalar(.34); b.vel.y=Math.max(b.vel.y,.4);
      p.think=.35;
      return;
    }
  }
  const roubo=b.lastTouch&&b.lastTouch.team!==p.team;
  b.owner=p; b.lastTouch=p; b.spin.multiplyScalar(.2); b.shotBy=null;
  if(roubo){ Match.counter={team:p.team,t:4.5}; Stats.turnover(p.team); }
  if(p.team===Match.humanTeam&&Input.active) Match.controlled=p;
}

function steal(p,from){
  Match.counter={team:p.team,t:4.5};              // abre a transição
  Stats.turnover(p.team);
  Ball.owner=p; Ball.lastTouch=p; Ball.cool=.2; Ball.offside=null; Ball.lastKick=null;
  from.think=.55;
  // desarme desleal — dentro da própria área o defensor é muito mais cauteloso
  const dv=CFG.teams[from.team].dir;
  const inBox=from.pos.x*dv>HALF_L-16.5&&Math.abs(from.pos.z)<20.16;
  if(Math.random()<(inBox?.03:.14)){
    Rules.foul(p,from);
    return;
  }
  if(p.team===Match.humanTeam&&Input.active) Match.controlled=p;
  Audio2.noise(.08,300,'bandpass',.07,1.6);
}

/* ============================================================================
   ARBITRAGEM — árbitro na diagonal, assistentes na linha de impedimento
   ============================================================================ */
const Officials={
  ref:null, a1:null, a2:null, list:[],
  init(){
    const mk=()=>{ const o=new Player('ref',6); o.num=0; o.role='ARB'; o.at.pace=.78;
                   o.at.endur=1; o.gk=false; return o; };
    this.ref=mk(); this.a1=mk(); this.a2=mk();
    this.a1.pos.set(-26,0,-(HALF_W+1.2)); this.a2.pos.set(26,0,HALF_W+1.2);
    for(const o of [this.ref,this.a1,this.a2]){ o.prev.copy(o.pos); this.list.push(o); }
    // bandeira nas mãos dos assistentes
    for(const a of [this.a1,this.a2]){
      const f=new THREE.Mesh(new THREE.PlaneGeometry(.34,.24),
        new THREE.MeshStandardMaterial({color:0xf2d032,side:THREE.DoubleSide,roughness:.7}));
      f.position.set(0,-.34,.16);
      a.arms[1].userData.el.add(f); a.flag=f; a.flagT=0;
    }
  },
  /* linha do penúltimo defensor de um time, contando do próprio gol */
  lineOf(team){
    const d=CFG.teams[team].dir;
    const xs=teams[team].map(o=>o.pos.x*-d).sort((a,b)=>b-a);
    return -d*(xs[1]!==undefined?xs[1]:xs[0]);
  },
  raiseFlag(){ const a=Ball.pos.z<0?this.a1:this.a2; a.flagT=2.4; },
  step(dt){
    const b=Ball.pos;
    // árbitro: seis a doze metros da bola, na diagonal, nunca em cima da jogada
    const off=new THREE.Vector3(b.x-this.ref.pos.x,0,b.z-this.ref.pos.z);
    const d=Math.hypot(off.x,off.z);
    const want=new THREE.Vector3(
      clamp(b.x-Math.sign(b.x||1)*3,-HALF_L+4,HALF_L-4),0,
      clamp(b.z+(b.z>0?-9:9),-HALF_W+3,HALF_W-3));
    this.ref.sprint=d>18;
    this.ref.moveTo(want,dt,1); this.ref.step(dt);

    // assistentes: cada um patrulha meio campo, alinhado à linha de impedimento
    const lh=this.lineOf('home'), la=this.lineOf('away');
    const t1=new THREE.Vector3(clamp(Math.max(lh,Math.min(0,b.x)),-HALF_L+.5,-.5),0,-(HALF_W+1.2));
    const t2=new THREE.Vector3(clamp(Math.min(la,Math.max(0,b.x)),.5,HALF_L-.5),0,HALF_W+1.2);
    this.a1.sprint=Math.abs(t1.x-this.a1.pos.x)>9;
    this.a2.sprint=Math.abs(t2.x-this.a2.pos.x)>9;
    this.a1.moveTo(t1,dt,1); this.a1.step(dt);
    this.a2.moveTo(t2,dt,1); this.a2.step(dt);
    for(const a of [this.a1,this.a2]) if(a.flagT>0) a.flagT-=dt;
  },
  render(alpha){
    for(const o of this.list) o.render(alpha);
    // braço da bandeira levantado sobrepõe a pose de corrida
    for(const a of [this.a1,this.a2]){
      if(a.flagT>0){ a.arms[1].rotation.x=-2.75; a.arms[1].userData.el.rotation.x=0; }
    }
  }
};

/* ============================================================================
   REGRAS
   ============================================================================ */
const Rules={
  kickoff(team){
    for(const p of players){
      const s=p.slot();
      p.pos.set(s.x*(p.team===team?.88:1),0,s.z);
      if(p.role==='ATA'&&p.team===team) p.pos.set(p.dir*-1.6,0,rnd(-1,1));
      p.prev.copy(p.pos); p.vel.set(0,0,0);
      p.face=p.dir>0?Math.PI/2:-Math.PI/2; p.facePrev=p.face;
      p.pose='run'; p.poseT=0;
    }
    Ball.pos.set(0,CFG.ball.r,0); Ball.prev.copy(Ball.pos);
    Ball.vel.set(0,0,0); Ball.spin.set(0,0,0);
    Ball.owner=null; Ball.cool=.3; Ball.offside=null; Ball.lastKick=null; Ball.shotBy=null;
    Match.possession=team; Match.phase='kickoff'; Match.wait=1.5;
    const mine=teams[Match.humanTeam];
    Match.controlled=mine?(mine.find(p=>p.role==='ATA')||mine[9]):null;
  },
  /* falta: decide cartão, checa se foi dentro da área e escolhe pênalti ou tiro livre */
  foul(offender,victim){

  // Duas faltas do MESMO jogador em menos de 2,5 s do jogo quase sempre sao o
  // mesmo encontrao contado varias vezes — os corpos se atravessam e o contato
  // persiste por varios quadros. Sem esta janela a contagem inflava 4x.
  if(offender._ultimaFalta && Match.t - offender._ultimaFalta < 2.5) return
  offender._ultimaFalta = Match.t
    const byTeam=offender.team, atk=byTeam==='home'?'away':'home';
    Match.fouls[byTeam]++;
    const x=victim.pos.x, z=victim.pos.z;
    const d=CFG.teams[atk].dir;
    const inBox=x*d>HALF_L-16.5&&Math.abs(z)<20.16;
    const r=Math.random();
    let card='';
    if(r<.0035) card='VERMELHO';
    else if(r<.075+Match.fouls[byTeam]*.004){
      offender.yellow=(offender.yellow||0)+1;
      card=offender.yellow>=2?'VERMELHO (2º amarelo)':'AMARELO';
      Match.cards[byTeam]++;
    }
    Audio2.whistle(false);
    Events.add((card?'Cartão '+card.toLowerCase()+' — ':'Falta de ')+offender.name);
    if(card){
      Toast.card('CARTÃO '+card.split(' ')[0],offender.name+' · '+CFG.teams[byTeam].tag,2800);
      if(card.indexOf('VERMELHO')===0) this.expel(offender);
    }
    if(inBox){ this.penalty(atk); return; }
    this.setPiece(atk,x,z,'FALTA');
  },
  /* expulsão de verdade: o jogador sai do campo e a equipe joga com um menos */
  expel(p){
    const t=teams[p.team], i=t.indexOf(p);
    if(i>=0) t.splice(i,1);
    const j=players.indexOf(p);
    if(j>=0) players.splice(j,1);
    if(p.mesh&&p.mesh.parent) scene.remove(p.mesh);
    if(Ball.owner===p) Ball.owner=null;
    Match.reds[p.team]=(Match.reds[p.team]||0)+1;
    Replay.len=0; Replay.head=0;              // índices do buffer mudaram
    Events.add('EXPULSO: '+p.name+' — '+CFG.teams[p.team].tag+' com '+t.length);
    Audio2.whistle(true);
  },
  /* pênalti: área esvaziada, cobrador escolhido pela finalização, chute roteirizado */
  penalty(team){
    const d=CFG.teams[team].dir;
    const sx=d*(HALF_L-11);
    Ball.pos.set(sx,CFG.ball.r,0); Ball.prev.copy(Ball.pos);
    Ball.vel.set(0,0,0); Ball.spin.set(0,0,0);
    Ball.owner=null; Ball.cool=.4; Ball.offside=null; Ball.lastKick=null;
    const taker=teams[team].filter(p=>!p.gk).sort((a,b)=>b.at.shoot-a.at.shoot)[0];
    taker.pos.set(sx-d*2.2,0,0); taker.prev.copy(taker.pos);
    taker.vel.set(0,0,0); taker.face=d>0?Math.PI/2:-Math.PI/2; taker.pose='run'; taker.poseT=0;
    for(const p of players){
      if(p===taker) continue;
      if(p.gk){
        const g=ownGoal(p.team);
        if(Math.sign(g.x)===Math.sign(sx)){ p.pos.set(g.x+ (g.x>0?-.4:.4),0,rnd(-.4,.4)); p.prev.copy(p.pos); }
        continue;
      }
      // fora da área, atrás da marca
      if(p.pos.x*d>HALF_L-17.5||Math.abs(p.pos.x-sx)<4){
        p.pos.set(sx-d*rnd(6,13),0,clamp(p.pos.z+rnd(-6,6),-24,24));
        p.prev.copy(p.pos); p.vel.set(0,0,0);
      }
    }
    Match.possession=team; Match.phase='penalty'; Match.wait=2.4; Match.penTaker=taker;
    Audio2.whistle(false); Audio2.cheer(.5);
    Events.add('Pênalti para '+CFG.teams[team].tag);
    Toast.card('PÊNALTI',CFG.teams[team].tag,2800);
  },
  setPiece(team,x,z,label){
    const bx=clamp(x,-HALF_L+.6,HALF_L-.6), bz=clamp(z,-HALF_W+.6,HALF_W-.6);
    Ball.pos.set(bx,CFG.ball.r,bz); Ball.prev.copy(Ball.pos);
    Ball.vel.set(0,0,0); Ball.spin.set(0,0,0);
    Ball.offside=null; Ball.lastKick=null; Ball.shotBy=null; Ball.cool=.2;
    // tiro de meta é do goleiro; os outros, de quem está mais perto
    const list=label==='TIRO DE META'
      ? teams[team].filter(p=>p.gk)
      : teams[team].filter(p=>!p.gk)
          .sort((a,b)=>dist2(a.pos,Ball.pos)-dist2(b.pos,Ball.pos));
    const taker=list[0];
    if(taker){
      // no lateral o cobrador fica FORA do campo, como manda a regra
      const outZ=label==='LATERAL'?Math.sign(bz||1)*.9:0;
      taker.pos.set(bx-CFG.teams[team].dir*(label==='LATERAL'?0:.55),0,bz+outZ);
      taker.prev.copy(taker.pos);
      // encara o campo, para a bola no pé não ficar do lado de fora
      if(label==='LATERAL') taker.face=bz>0?Math.PI:0;
      else if(label==='ESCANTEIO') taker.face=Math.atan2(-Math.sign(bx)*1,-Math.sign(bz||1)*.6);
      else taker.face=CFG.teams[team].dir>0?Math.PI/2:-Math.PI/2;
      taker.vel.set(0,0,0); taker.pose='run'; taker.poseT=0; taker.think=.9;
      Ball.owner=taker; Ball.lastTouch=taker;
      if(team===Match.humanTeam&&Input.active) Match.controlled=taker;
    }
    // afasta os adversários da bola
    for(const o of opponents(team)){
      if(o.gk) continue;
      const dx=o.pos.x-bx, dz=o.pos.z-bz, d=Math.hypot(dx,dz);
      if(d<7&&d>1e-3){
        o.pos.x=bx+dx/d*7; o.pos.z=bz+dz/d*7;
        o.pos.x=clamp(o.pos.x,-HALF_L-2,HALF_L+2); o.pos.z=clamp(o.pos.z,-HALF_W-2,HALF_W+2);
        o.prev.copy(o.pos); o.vel.set(0,0,0);
      }
    }
    // escanteio: ataque povoa a área, defesa marca, goleiro na linha
    if(label==='ESCANTEIO'){
      const opp=team==='home'?'away':'home';
      const d=CFG.teams[team].dir, gx=d*(HALF_L-6);
      const atk=teams[team].filter(o=>!o.gk&&o!==taker).slice(0,5);
      atk.forEach((o,i)=>{
        o.pos.set(gx-d*rnd(0,7),0,clamp(-Math.sign(bz)*(2+i*2.6)+rnd(-1,1),-14,14));
        o.prev.copy(o.pos); o.vel.set(0,0,0); o.face=Math.atan2(-d,0);
      });
      const def=teams[opp].filter(o=>!o.gk).slice(0,5);
      def.forEach((o,i)=>{
        const m=atk[i];
        if(m){ o.pos.set(m.pos.x+d*1.3,0,m.pos.z+rnd(-.8,.8)); }
        else { o.pos.set(gx-d*2,0,rnd(-8,8)); }
        o.prev.copy(o.pos); o.vel.set(0,0,0);
      });
      const gk=teams[opp].find(o=>o.gk);
      if(gk){ gk.pos.set(d*(HALF_L-1.4),0,clamp(bz*.1,-1.5,1.5)); gk.prev.copy(gk.pos); }
    }
    // barreira a 9,15 m quando a falta é em zona de finalização
    if(label==='FALTA'){
      const opp=team==='home'?'away':'home';
      const g=ownGoal(opp);
      const dx=g.x-bx, dz=g.z-bz, L=Math.hypot(dx,dz)||1;
      if(L<32){
        const wall=teams[opp].filter(o=>!o.gk)
          .sort((a,b)=>dist2(a.pos,Ball.pos)-dist2(b.pos,Ball.pos)).slice(0,4);
        const px=-dz/L, pz=dx/L;                      // perpendicular à reta bola-gol
        wall.forEach((o,i)=>{
          const k=(i-(wall.length-1)/2)*.48;
          o.pos.set(bx+dx/L*9.15+px*k,0,bz+dz/L*9.15+pz*k);
          o.prev.copy(o.pos); o.vel.set(0,0,0);
          o.face=Math.atan2(-dx,-dz);
        });
      }
    }
    Match.possession=team; Match.phase='set'; Match.wait=1.6; Match.setType=label;
    Audio2.whistle(false);
    if(label!=='LATERAL') Events.add(label.charAt(0)+label.slice(1).toLowerCase()+' · '+CFG.teams[team].tag);
    Toast.show(label,CFG.teams[team].tag+' cobra',1500);
  },
  /* cada bola parada tem cinemática própria: é isso que faz um escanteio
     parecer um escanteio e não um passe qualquer */
  deliver(){
    const t=Ball.owner, type=Match.setType;
    if(!t||!type) return;
    // a bola sai do pé do cobrador já dentro das linhas, com meio segundo de graça
    Ball.pos.z=clamp(Ball.pos.z,-HALF_W+.35,HALF_W-.35);
    Ball.pos.x=clamp(Ball.pos.x,-HALF_L+.35,HALF_L-.35);
    Ball.prev.copy(Ball.pos);
    Ball.grace=.55;
    const d=t.dir, gc=goalCenter(t.team), gd=dist(t.pos,gc);

    if(type==='ESCANTEIO'){
      // cruzamento alto para o primeiro ou segundo pau
      const near=Math.random()<.55;
      const aim=new THREE.Vector3(d*(HALF_L-(near?5.5:10.5)),0,
                                  Math.sign(-t.pos.z)*rnd(0,4.5));
      const rel=aim.sub(t.pos).setY(0);
      const L=Math.max(6,rel.length());
      const ft=clamp(L/13,.8,1.7);
      kick(t,rel,L/ft*1.1,9.81*ft/2,Math.sign(t.pos.z)*rnd(14,34),0);
      Ball.lastKick={team:t.team,to:null}; Stats.attempt(t.team);
      Events.add('Escanteio cobrado por '+t.name);
    } else if(type==='LATERAL'){
      // arremesso: curto, alto e sem rotação
      const mate=teams[t.team].filter(m=>m!==t&&!m.gk)
        .sort((a,b)=>dist2(a.pos,t.pos)-dist2(b.pos,t.pos))[0];
      if(mate){
        const rel=mate.pos.clone().sub(t.pos).setY(0);
        const L=Math.max(4,rel.length());
        const ft=clamp(L/9,.6,1.2);
        kick(t,rel,L/ft,9.81*ft/2,0,0);
        Ball.lastKick={team:t.team,to:mate}; Stats.attempt(t.team);
      }
    } else if(type==='TIRO DE META'){
      // recuo longo para o meio-campo
      const mate=teams[t.team].filter(m=>!m.gk)
        .sort((a,b)=>(b.pos.x-a.pos.x)*d)[0];
      const rel=(mate?mate.pos.clone():new THREE.Vector3(d*8,0,0)).sub(t.pos).setY(0);
      const L=Math.max(20,rel.length());
      const ft=clamp(L/17,1.1,2);
      kick(t,rel,L/ft*1.08,9.81*ft/2,rnd(-8,8),0);
      Ball.lastKick={team:t.team,to:mate}; Stats.attempt(t.team);
    } else if(type==='FALTA'){
      if(gd<30&&t.at.shoot>.45){
        // chute direto: por cima da barreira, com curva
        const aim=new THREE.Vector3(gc.x-t.pos.x,0,
                    clamp(-Math.sign(t.pos.z)*rnd(.8,2.9)-t.pos.z,-6,6));
        const side=Math.sign(aim.z||1)*rnd(26,52);
        kick(t,aim,clamp(gd*.78+rnd(9,13),19,29),rnd(3.4,5.2),side,rnd(-14,-4));
        Stats.shot(t.team);
        Events.add('Falta batida por '+t.name);
      } else {
        const mate=teams[t.team].filter(m=>m!==t&&!m.gk)
          .sort((a,b)=>(b.pos.x-a.pos.x)*d)[0];
        if(mate) passTo(t,mate,gd<46);
      }
    }
    Match.setType=null;
  },
  goal(team,power){
    Match.score[team]++;
    Stats.onTarget(Ball.shotBy||team);
    const side=CFG.teams[team].dir;
    hitNet(side,Ball.pos.z,Ball.pos.y,power||18);
    Audio2.cheer(1); Audio2.net(); Audio2.whistle(false);
    Events.add('GOL de '+(Ball.lastTouch?Ball.lastTouch.name:'—')+' ('+CFG.teams[team].tag+')');
    Toast.show('GOL',CFG.teams.home.tag+' '+Match.score.home+' — '
      +Match.score.away+' '+CFG.teams.away.tag,2600);
    const sc=Ball.lastTouch;
    if(sc){ sc.pose='celebrate'; sc.poseT=4.2; }
    for(const m of teams[team]) if(m!==sc&&!m.gk&&Math.random()<.6){ m.pose='celebrate'; m.poseT=3.6; }
    Match.phase='goal'; Match.wait=2.9; Match.conceded=team==='home'?'away':'home';
    Director.shake=1;
  },
  step(dt){
    if(Match.phase==='goal'){
      Match.stoppage+=dt;
      if((Match.wait-=dt)<=0){ Replay.play(); }
      return;
    }
    if(Match.phase==='penalty'){
      Match.stoppage+=dt;
      if((Match.wait-=dt)<=0){
        const t=Match.penTaker, d=t.dir;
        const side=Math.random()<.5?-1:1;
        const aim=new THREE.Vector3(d*HALF_L-t.pos.x,0,side*rnd(1.6,3.1)-t.pos.z);
        kick(t,aim,rnd(22,27),rnd(.9,2.4),side*rnd(10,26),0);
        Stats.shot(t.team);
        Match.phase='play'; Audio2.cheer(.6);
      }
      return;
    }
    if(Match.phase==='kickoff'||Match.phase==='set'){
      Match.stoppage+=dt*.7;      // acréscimos vêm das paradas de verdade
      if((Match.wait-=dt)<=0){
        const wasSet=Match.phase==='set';
        Match.phase='play';
        if(Match.wait>-9) Audio2.whistle(false);
        if(wasSet) this.deliver();
      }
      return;
    }
    if(Match.phase!=='play') return;

    /* relógio canônico: vem da contagem de passos do integrador, não do dt.
       Um passo = 1/60 s de jogo, sempre, em qualquer máquina. */
    Match.steps++; Match.t=Match.steps/60;
    const H=CFG.time.half*60;
    if(Match.half===1&&Match.t>=H+Match.stoppage){
      Match.half=2; Match.steps=H*60; Match.t=H; Match.stoppage=0;
      Audio2.whistle(true); Events.add('Intervalo');
      Toast.card('INTERVALO',CFG.teams.home.tag+' '+Match.score.home+'-'+Match.score.away+' '+CFG.teams.away.tag,3000);
      this.kickoff('away'); return;
    }
    if(Match.half===2&&Match.t>=2*H+Match.stoppage){
      Match.phase='end'; Audio2.whistle(true);
      Toast.card('FIM DE JOGO',CFG.teams.home.tag+' '+Match.score.home+'-'
        +Match.score.away+' '+CFG.teams.away.tag,12000);
      return;
    }

    const b=Ball;
    /* gol por cruzamento de segmento: testa se o trecho percorrido no passo
       cruzou o plano da linha dentro da meta. Checar só a posição final falha
       quando a bola anda meio metro por quadro. */
    for(const s of [-1,1]){
      const gx=s*HALF_L, p0=b.prev, p1=b.pos;
      if((p0.x-gx)*(p1.x-gx)<=0 && Math.sign(p1.x-p0.x)===s && p1.x!==p0.x){
        const u=(gx-p0.x)/(p1.x-p0.x);
        if(u>=0&&u<=1){
          const cz=lerp(p0.z,p1.z,u), cy=lerp(p0.y,p1.y,u);
          if(Math.abs(cz)<CFG.goal.w/2-.02&&cy<CFG.goal.h-.02&&cy>0){
            b.pos.set(gx+s*.35,cy,cz);
            this.goal(s>0?'home':'away',Math.hypot(b.vel.x,b.vel.z)); return;
          }
        }
      }
    }
    // rede: mantém a bola dentro do gol
    if(Math.abs(b.pos.x)>HALF_L+CFG.goal.depth-.1&&Math.abs(b.pos.z)<CFG.goal.w/2){
      b.vel.x*=-.2; b.pos.x=Math.sign(b.pos.x)*(HALF_L+CFG.goal.depth-.12);
    }
    // fora de campo (não se julga durante a reposição)
    if(b.grace<=0&&(Math.abs(b.pos.z)>HALF_W+.1||Math.abs(b.pos.x)>HALF_L+.1)){
      const lt=b.owner||b.lastTouch;
      const to=lt?(lt.team==='home'?'away':'home'):'home';
      const lateral=Math.abs(b.pos.z)>HALF_W;
      let label='LATERAL', x=b.pos.x, z=b.pos.z;
      if(!lateral){
        /* quem tocou por último decide: se foi o ATACANTE que pôs para fora
           sobre a linha de fundo adversária, é tiro de meta para o defensor;
           se foi o DEFENSOR, é escanteio para o atacante. */
        const lastDir=CFG.teams[lt?lt.team:'home'].dir;
        const attackerPutOut=Math.sign(b.pos.x)===lastDir;
        if(attackerPutOut){
          label='TIRO DE META';
          x=Math.sign(b.pos.x)*(HALF_L-5.2); z=clamp(b.pos.z,-8,8);
        } else {
          label='ESCANTEIO';
          x=Math.sign(b.pos.x)*(HALF_L-.4); z=Math.sign(b.pos.z||1)*(HALF_W-.4);
        }
      }
      this.setPiece(to,x,z,label);
    }
  }
};

/* ============================================================================
   REPLAY — buffer circular de 6 s a 30 Hz
   ============================================================================ */
const Replay={
  active:false, t:0, tick:0, cap:200, len:0, head:0, buf:null, stride:0, speed:.55, dur:0,
  init(){ this.stride=3+players.length*6; this.buf=new Float32Array(this.cap*this.stride); },
  record(){
    if(!this.buf) return;
    if(++this.tick%2) return;
    const o=this.head*this.stride, b=this.buf;
    b[o]=Ball.pos.x; b[o+1]=Ball.pos.y; b[o+2]=Ball.pos.z;
    for(let i=0;i<players.length;i++){
      const p=players[i], k=o+3+i*6;
      b[k]=p.pos.x; b[k+1]=p.pos.z; b[k+2]=p.face; b[k+3]=p.phase;
      b[k+4]=Math.hypot(p.vel.x,p.vel.z);
      b[k+5]=p.pose==='celebrate'?5:p.pose==='dive'?3:p.pose==='tackle'?2:0;
    }
    this.head=(this.head+1)%this.cap;
    this.len=Math.min(this.len+1,this.cap);
  },
  play(){
    if(this.len<20){ Rules.kickoff(Match.conceded||'away'); return; }
    this.active=true; this.t=0;
    this.frames=Math.min(this.len,150);
    this.dur=this.frames/30/this.speed;
    $('replay').classList.add('on');
    $('hud').classList.add('hidden');
  },
  stop(){
    this.active=false;
    $('replay').classList.remove('on'); $('hud').classList.remove('hidden');
    this.len=0; this.head=0;
    Rules.kickoff(Match.conceded||'away');
  },
  step(dt){
    this.t+=dt;
    if(this.t>=this.dur){ this.stop(); return; }
    const f=this.t/this.dur*(this.frames-1);
    const i0=Math.floor(f), i1=Math.min(this.frames-1,i0+1), a=f-i0;
    const start=(this.head-this.frames+this.cap*2)%this.cap;
    const o0=((start+i0)%this.cap)*this.stride, o1=((start+i1)%this.cap)*this.stride;
    const b=this.buf;
    Ball.prev.set(b[o0],b[o0+1],b[o0+2]);
    Ball.pos.set(lerp(b[o0],b[o1],a),lerp(b[o0+1],b[o1+1],a),lerp(b[o0+2],b[o1+2],a));
    for(let i=0;i<players.length;i++){
      const p=players[i], k0=o0+3+i*6, k1=o1+3+i*6;
      p.prev.set(b[k0],0,b[k0+1]);
      p.pos.set(lerp(b[k0],b[k1],a),0,lerp(b[k0+1],b[k1+1],a));
      p.facePrev=b[k0+2]; p.face=b[k0+2]+angleDiff(b[k1+2],b[k0+2])*a;
      p.phase=b[k0+3]; p.vel.set(b[k0+4],0,0);
      const code=b[k0+5];
      p.pose=code===5?'celebrate':code===3?'dive':code===2?'tackle':'run';
      if(p.pose!=='run') p.poseT=.5;
    }
  }
};

/* ============================================================================
   ENTRADA
   ============================================================================ */
const Input={active:false};      /* não há jogador controlado: isto é uma simulação */
const Show={ predict:false, offside:false, vectors:false, hull:false, labels:false };
function flashSpeed(){ Toast.show(Sim.speed+'\u00d7','velocidade da simulação',900); }

const Ctrl={
  init(){
    _on(window,'keydown',e=>{
      const c=e.code;
      if(c==='Space'){ Match.paused=!Match.paused;
        Toast.show(Match.paused?'PAUSA':'','',Match.paused?9e5:1); e.preventDefault(); }
      if(c==='ArrowRight'){ Sim.shift(1); flashSpeed(); e.preventDefault(); }
      if(c==='ArrowLeft'){ Sim.shift(-1); flashSpeed(); e.preventDefault(); }
      if(c==='KeyC') Director.cycle();
      if(c==='KeyF'){ Director.free=false; Toast.show('CÂMERA AUTOMÁTICA','',1000); }
      if(c==='KeyH') $('hud').classList.toggle('hidden');
      if(c==='KeyE'){ $('hud').classList.toggle('painel');
        Toast.show('PAINÉIS '+($('hud').classList.contains('painel')?'ON':'OFF'),'',800); }
      if(c==='KeyM'){ Audio2.muted=!Audio2.muted;
        Toast.show(Audio2.muted?'SOM DESLIGADO':'SOM LIGADO','',900); }
      if(c==='KeyT'){ Show.predict=!Show.predict; Toast.show('TRAJETÓRIA '+(Show.predict?'ON':'OFF'),'',800); }
      if(c==='KeyI'){ Show.vectors=!Show.vectors; Toast.show('VETORES '+(Show.vectors?'ON':'OFF'),'',800); }
      if(c==='KeyL'){ Show.offside=!Show.offside; Toast.show('LINHA DE IMPEDIMENTO '+(Show.offside?'ON':'OFF'),'',800); }
      if(c==='KeyU'){ Show.hull=!Show.hull; Toast.show('FORMA DAS EQUIPES '+(Show.hull?'ON':'OFF'),'',800); }
      if(c==='KeyN'){ Show.labels=!Show.labels; Toast.show('NOMES '+(Show.labels?'ON':'OFF'),'',800); }
      if(c==='KeyR'){
        Stats.d.home={shots:0,tgt:0,pass:0,att:0,blk:0};
        Stats.d.away={shots:0,tgt:0,pass:0,att:0,blk:0};
        Match.score.home=Match.score.away=0; Match.t=0; Match.steps=0;
        Match.half=1; Match.stoppage=0;
        Match.cards.home=Match.cards.away=0; Match.fouls.home=Match.fouls.away=0;
        Match.possT.home=Match.possT.away=1;
        for(const p of players){ p.energy=1; p.stam=1; }
        Rules.kickoff('home'); Toast.show('REINÍCIO','',1200);
      }
      if(c.indexOf('Digit')===0){
        const n=parseInt(c.slice(5),10);
        if(n>=1&&n<=4){ Director.mode=n-1; Director.free=false;
          $('cam').textContent=Director.names[Director.mode]; }
      }
    },{passive:false});

    // mouse: arrastar orbita em torno da bola, roda aproxima
    const el=renderer.domElement;
    let drag=false, lx=0, ly=0;
    _on(el,'mousedown',e=>{ drag=true; lx=e.clientX; ly=e.clientY; });
    _on(window,'mouseup',()=>{ drag=false; });
    _on(window,'mousemove',e=>{
      if(!drag) return;
      Director.free=true;
      Director.yaw-=(e.clientX-lx)*.006;
      Director.pitch=clamp(Director.pitch+(e.clientY-ly)*.004,.06,1.32);
      lx=e.clientX; ly=e.clientY;
    });
    _on(el,'wheel',e=>{
      Director.free=true;
      Director.dist=clamp(Director.dist*(1+Math.sign(e.deltaY)*.12),6,120);
      e.preventDefault();
    },{passive:false});
  }
};

/* ============================================================================
   DIREÇÃO DE CÂMERA
   ============================================================================ */
const Director={
  mode:0, names:['DINÂMICA','TRANSMISSÃO','TELE','AÉREA'],
  cena:null, cenaT:0,
  look:new THREE.Vector3(0,1,0), shake:0, speed:0, last:new THREE.Vector3(),
  free:false, yaw:2.4, pitch:.42, dist:26,
  lag:new THREE.Vector3(), fov:36, nz:0,
  cycle(){ this.mode=(this.mode+1)%4; this.free=false; $('cam').textContent=this.names[this.mode]; },
  update(dt){
    if(this.cenaT > 0){ this.cenaT -= dt; if(this.cenaT <= 0) this.cena = null }
    const b=Ball.pos, dir=CFG.teams[Match.possession].dir;
    let want, look, rate=2.7;

    /* o operador não é instantâneo: ele persegue a bola com atraso.
       Esse atraso é o que faz a imagem parecer filmada e não calculada. */
    this.lag.x=damp(this.lag.x,b.x,7.5,dt);
    this.lag.y=damp(this.lag.y,b.y,7.5,dt);
    this.lag.z=damp(this.lag.z,b.z,7.5,dt);
    const lg=this.lag;

    if(this.free&&!Replay.active&&Match.phase!=='goal'){
      const cp=Math.cos(this.pitch), sp2=Math.sin(this.pitch);
      want=new THREE.Vector3(b.x+Math.cos(this.yaw)*cp*this.dist,
                             1.2+sp2*this.dist,
                             b.z+Math.sin(this.yaw)*cp*this.dist);
      look=new THREE.Vector3(b.x,b.y+.4,b.z);
      this.applyCam(want,look,5.5,dt,true);
      return;
    }

    if(Replay.active){
      const a=Replay.t*.42;
      want=new THREE.Vector3(b.x-Math.cos(a)*17,3.4+Math.sin(a*.8)*1.8,b.z-Math.sin(a)*17);
      look=new THREE.Vector3(b.x,1.15,b.z); rate=4.2;
    } else if(Match.phase==='goal'){
      const a=performance.now()*.0006;
      want=new THREE.Vector3(b.x-dir*12+Math.sin(a)*8,5.4,b.z+Math.cos(a)*14);
      look=new THREE.Vector3(b.x,1.7,b.z); rate=3.6;
    } else if(Director.cena && Director.cenaT > 0){
      // Enquadramento da cena encenada. `alvo` e o ponto de interesse (a bola,
      // ou quem esta reagindo); `aperto` fecha o plano conforme a cena avanca.
      const c = Director.cena
      const foco = c.alvo || b
      const t = 1 - clamp(Director.cenaT / (c.dur || 1), 0, 1)
      const aperto = c.fecha ? (1 - t * 0.45) : 1
      const ang = c.ang + t * (c.giro || 0)
      const rai = (c.raio || 16) * aperto
      want = new THREE.Vector3(
        foco.x + Math.cos(ang) * rai,
        (c.alt || 4.2) * aperto + 0.8,
        foco.z + Math.sin(ang) * rai)
      look = new THREE.Vector3(foco.x, (c.olha ?? 1.2), foco.z)
      rate = c.rate || 3.2
    } else switch(this.mode){
      case 0:
        want=new THREE.Vector3(clamp(lg.x,-46,46)-dir*24,15,clamp(lg.z,-20,20)*.5+14);
        look=new THREE.Vector3(lg.x+dir*12,1.5,lg.z*.6); break;
      case 1:
        want=new THREE.Vector3(clamp(lg.x,-33,33),28,56);
        look=new THREE.Vector3(clamp(lg.x,-40,40)*.9,.5,lg.z*.32); break;
      case 2:
        want=new THREE.Vector3(clamp(lg.x,-40,40),13,32);
        look=new THREE.Vector3(lg.x,1.1,lg.z*.75); break;
      default:
        want=new THREE.Vector3(b.x*.5,70,12);
        look=new THREE.Vector3(b.x*.5,0,b.z*.7);
    }
    this.applyCam(want,look,rate,dt,false);
  },
  applyCam(want,look,rate,dt,isFree){
    this.last.copy(camera.position);
    camera.position.x=damp(camera.position.x,want.x,rate,dt);
    camera.position.y=damp(camera.position.y,want.y,rate,dt);
    camera.position.z=damp(camera.position.z,want.z,rate,dt);
    this.look.x=damp(this.look.x,look.x,4.4,dt);
    this.look.y=damp(this.look.y,look.y,4.4,dt);
    this.look.z=damp(this.look.z,look.z,4.4,dt);

    // tremor de mão: dois senos incomensuráveis, amplitude proporcional ao zoom
    this.nz+=dt;
    if(!isFree){
      const amp=.0016*(42-this.fov);
      this.look.x+=Math.sin(this.nz*1.7)*amp+Math.sin(this.nz*4.3)*amp*.4;
      this.look.y+=Math.sin(this.nz*2.3+1.1)*amp*.7;
    }
    if(this.shake>0){
      this.shake-=dt*1.5; const sh=this.shake*.3;
      camera.position.x+=rnd(-sh,sh); camera.position.y+=rnd(-sh,sh);
    }
    camera.lookAt(this.look);

    // zoom: o operador fecha o enquadramento quando a jogada está longe
    const d=Math.hypot(camera.position.x-this.look.x,camera.position.y-this.look.y,
                       camera.position.z-this.look.z);
    const wantFov=isFree?38:clamp(40-(d-24)*.30,17,42);
    if(Math.abs(wantFov-this.fov)>.02){
      this.fov=damp(this.fov,wantFov,1.6,dt);
      camera.fov=this.fov; camera.updateProjectionMatrix();
    }
    this.speed=Math.hypot(camera.position.x-this.last.x,camera.position.y-this.last.y,
                          camera.position.z-this.last.z)/Math.max(dt,1e-3);
    this.focus=d;
  }
};

/* ============================================================================
   HUD
   ============================================================================ */
const Events={
  items:[], dirty:true,
  add(txt){
    const m=Math.floor(clamp(Match.t,0,1e6)/60)+1;
    this.items.unshift('<li><b>'+m+"'</b>"+txt+'</li>');
    if(this.items.length>6) this.items.pop();
    this.dirty=true;
  },
  render(){
    if(!this.dirty) return;
    $('log').innerHTML=this.items.join('');
    this.dirty=false;
  }
};

/* Dois canais de evento, como numa transmissão:
   show()  → aviso discreto para lance de rotina (lateral, escanteio, defesa)
   card()  → cartela de lance decisivo (gol, cartão, pênalti, intervalo, fim) */
const Toast={
  el:null, t:0, cardEl:null, ct:0,
  show(big,small,ms){
    if(!this.el) this.el=$('toast');
    if(!big){ this.el.classList.remove('on'); this.t=0; return; }
    this.el.innerHTML=big+(small?' <small>'+small+'</small>':'');
    this.el.classList.add('on'); this.t=(ms||1500)/1000;
  },
  card(title,sub,ms){
    if(!this.cardEl) this.cardEl=$('card');
    const el=this.cardEl;
    if(el===DEAD){ this.show(title,sub,ms); return; }
    el.innerHTML='<b>'+title+'</b>'+(sub?'<span>'+sub+'</span>':'');
    el.classList.add('on'); this.ct=(ms||2600)/1000;
  },
  update(dt){
    if(this.t>0){ this.t-=dt; if(this.t<=0) this.el.classList.remove('on'); }
    if(this.ct>0){ this.ct-=dt; if(this.ct<=0&&this.cardEl) this.cardEl.classList.remove('on'); }
  }
};

let rc=null;
function drawRadar(){
  if(!rc){
    const cvs=document.getElementById('radar');
    rc=cvs&&cvs.getContext?cvs.getContext('2d'):null;
    if(!rc){ drawRadar=function(){}; return; }   // ambiente sem canvas 2D: desiste
  }
  const W=560,H=248;
  rc.clearRect(0,0,W,H);
  rc.fillStyle='rgba(6,10,15,.5)';
  rc.beginPath(); rc.moveTo(18,0); rc.lineTo(W-18,0); rc.lineTo(W,H); rc.lineTo(0,H);
  rc.closePath(); rc.fill();

  const cx=W/2, top=28, hgt=H-56, hw=W/2-28;
  const P=(x,z)=>{
    const d=(clamp(z,-HALF_W,HALF_W)+HALF_W)/(2*HALF_W), sc=lerp(.56,1,d);
    return [cx+clamp(x,-HALF_L,HALF_L)/HALF_L*hw*sc, top+d*hgt];
  };
  const poly=(pts,cl)=>{
    rc.beginPath();
    pts.forEach((p,i)=>{const q=P(p[0],p[1]); i?rc.lineTo(q[0],q[1]):rc.moveTo(q[0],q[1]);});
    if(cl) rc.closePath(); rc.stroke();
  };
  rc.strokeStyle='rgba(226,239,250,.32)'; rc.lineWidth=1.5;
  poly([[-HALF_L,-HALF_W],[HALF_L,-HALF_W],[HALF_L,HALF_W],[-HALF_L,HALF_W]],true);
  poly([[0,-HALF_W],[0,HALF_W]]);
  for(const s of [-1,1]){
    poly([[s*HALF_L,-20.16],[s*(HALF_L-16.5),-20.16],[s*(HALF_L-16.5),20.16],[s*HALF_L,20.16]]);
    poly([[s*HALF_L,-3.66],[s*(HALF_L+2),-3.66],[s*(HALF_L+2),3.66],[s*HALF_L,3.66]]);
  }
  const c=[]; for(let i=0;i<=26;i++){const a=i/26*6.2832;c.push([Math.cos(a)*9.15,Math.sin(a)*9.15]);}
  poly(c,true);

  const mine='home';
  const m=players.map(p=>{
    const q=P(p.pos.x,p.pos.z);
    return {x:q[0],y:q[1],d:(clamp(p.pos.z,-HALF_W,HALF_W)+HALF_W)/(2*HALF_W),p};
  }).sort((a,b)=>a.d-b.d);
  for(const k of m){
    const r=lerp(3.2,5.6,k.d), own=k.p.team===mine;
    rc.fillStyle=own?'#ffb020':'#eef2f6';
    rc.strokeStyle='rgba(0,0,0,.55)'; rc.lineWidth=1;
    rc.beginPath();
    if(own){ rc.moveTo(k.x,k.y-r*1.2); rc.lineTo(k.x+r,k.y+r*.85); rc.lineTo(k.x-r,k.y+r*.85); rc.closePath(); }
    else rc.arc(k.x,k.y,r*.88,0,6.2832);
    rc.fill(); rc.stroke();
    if(k.p===Ball.owner){
      rc.strokeStyle='#ff6a12'; rc.lineWidth=2;
      rc.beginPath(); rc.arc(k.x,k.y,r*2.1,0,6.2832); rc.stroke();
    }
  }
  const q=P(Ball.pos.x,Ball.pos.z);
  rc.fillStyle='#fff'; rc.shadowColor='rgba(255,255,255,.9)'; rc.shadowBlur=10;
  rc.beginPath(); rc.arc(q[0],q[1],3.3,0,6.2832); rc.fill(); rc.shadowBlur=0;
}

let fpsAcc=0,fpsN=0;
const Hud={
  update(dt){
    const H=CFG.time.half*60;
    const t=clamp(Match.t,0,2*H);
    $('ck').textContent=String(Math.floor(t/60)).padStart(2,'0')+':'
      +String(Math.floor(t%60)).padStart(2,'0');
    $('half').textContent=Match.phase==='end'?'FIM':(Match.half===1?'1T':'2T');
    $('gH').textContent=Match.score.home; $('gA').textContent=Match.score.away;
    const near=Match.half===1?H:2*H;
    const extra=Math.ceil(Match.stoppage/60);
    $('adv').textContent='+'+extra;
    $('adv').classList.toggle('on',Match.t>near-120&&extra>0);

    const tot=Match.possT.home+Match.possT.away;
    const ph=Math.round(Match.possT.home/tot*100);
    $('sPossH').textContent=ph; $('sPossA').textContent=100-ph;
    $('barPoss').style.width=ph+'%';
    const d=Stats.d;
    $('sShotH').textContent=d.home.shots; $('sShotA').textContent=d.away.shots;
    $('sTgtH').textContent=d.home.tgt;   $('sTgtA').textContent=d.away.tgt;
    $('sPassH').textContent=d.home.pass; $('sPassA').textContent=d.away.pass;

    // telemetria: números que vêm direto do integrador
    const v=Ball.vel.length(), sp=Ball.spin.length();
    $('tVel').textContent=(v*3.6).toFixed(1);
    $('tSpin').textContent=Math.round(sp*9.5493);
    $('tApex').textContent=Ball.apex.toFixed(2);
    $('tDist').textContent=Ball.dist.toFixed(1);
    $('tCd').textContent=Aero.Cd(Math.max(v,.01)).toFixed(3);
    $('tWind').textContent=Aero.speed().toFixed(1);
    $('tSubs').textContent=Ball.subs||1;
    $('spd').textContent=Sim.speed+'\u00d7';
    Events.render();

    fpsAcc+=dt; fpsN++;
    if(fpsAcc>.5){
      $('fps').textContent=Math.round(fpsN/fpsAcc);
      if(renderer.info) $('draws').textContent=renderer.info.render.calls;
      fpsAcc=0; fpsN=0;
    }
    drawRadar();
  }
};

/* ============================================================================
   RENDER + LOOP
   ============================================================================ */
let started=false, last=performance.now(), acc=0, wallT=0;

function renderWorld(dt,a){
  for(const p of players) p.render(a);
  Officials.render(a);

  const bx=lerp(Ball.prev.x,Ball.pos.x,a), by=lerp(Ball.prev.y,Ball.pos.y,a),
        bz=lerp(Ball.prev.z,Ball.pos.z,a);
  Ball.mesh.position.set(bx,by,bz);
  const w=Ball.spin, wl=Math.hypot(w.x,w.y,w.z);
  if(wl>.01){
    Ball._ax=Ball._ax||new THREE.Vector3();
    Ball._ax.set(w.x/wl,w.y/wl,w.z/wl);
    Ball.mesh.rotateOnAxis(Ball._ax,Math.min(wl*dt,.8));
  }
  const h=clamp(by,0,9), k=1+h*.5;
  World.ballShadow.position.set(bx,.03,bz);
  World.ballShadow.scale.set(.9*k,.9*k,1);
  World.ballShadow.material.opacity=clamp(.8-h*.08,.08,.8);

  // rastro
  const T=Ball.trail;
  if(T){
    const sp=Math.hypot(Ball.vel.x,Ball.vel.y,Ball.vel.z);
    if(!Ball.owner&&sp>12){ T.hist.push([bx,by,bz]); if(T.hist.length>T.N) T.hist.shift(); }
    else if(T.hist.length) T.hist.shift();
    const n=T.hist.length;
    if(n>3){
      for(let i=0;i<T.N;i++){
        const p=T.hist[Math.min(i,n-1)];
        T.buf[i*3]=p[0]; T.buf[i*3+1]=p[1]; T.buf[i*3+2]=p[2];
      }
      if(T.geo.attributes&&T.geo.attributes.position) T.geo.attributes.position.needsUpdate=true;
      T.mesh.visible=true; T.mesh.material.opacity=clamp(n/T.N,0,1)*.26;
    } else T.mesh.visible=false;
  }

  Director.update(dt);
  wallT+=dt;

  if(World.grass){
    const u=World.grass.material.uniforms;
    u.uTime.value=wallT;
    u.uWind.value.set(Aero.wind.x,Aero.wind.z);
    const f=new THREE.Vector3(); camera.getWorldDirection(f);
    u.uCenter.value.set(camera.position.x+f.x*16,camera.position.z+f.z*16);
  }
  if(World.sheen) World.sheen.material.uniforms.uCam.value.copy(camera.position);
  const wdir=Math.atan2(Aero.wind.x,Aero.wind.z), wmag=clamp(Aero.speed()/6,0,1);
  for(let i=0;i<World.flags.length;i++){
    const fl=World.flags[i];
    fl.rotation.y=wdir+Math.sin(wallT*(2.2+wmag*2)+i)*(.12+.34*wmag);
    fl.rotation.z=Math.sin(wallT*(3.1+wmag*2)+i)*(.05+.2*wmag);
  }
  updateNets(dt);
  Overlay.update();
  if(World.flashes){
    if(Match.phase==='goal') World.flash=1;
    World.flash=Math.max(0,World.flash-dt*.22);
    for(let i=0;i<World.flashes.length;i++)
      World.flashes[i].material.opacity=World.flash*(.15+Math.random()*.85)*.9;
  }

  // excitação da torcida: perto da área e com a bola em jogo
  const gd=Math.min(dist(Ball.pos,goalCenter('home')),dist(Ball.pos,goalCenter('away')));
  Audio2.step(dt,clamp(1-gd/45,0,1)*(Match.phase==='play'?1:.4));
  Toast.update(dt);
  Hud.update(dt);
  Gfx.render(dt,Director.speed);
}

function simulate(dt){
  Aero.step(dt);
  Rules.step(dt);
  if(Match.phase==='play') brain(dt);
  else {
    for(const p of players){
      const f=Math.pow(.87,dt*60);
      p.vel.x*=f; p.vel.z*=f;
      if(p.gk&&Match.phase!=='goal') gkBrain(p,dt);
      p.step(dt);
    }
  }
  ballStep(dt);
  Officials.step(dt);
  Replay.record();
}

function frame(now){
  if(_destruido) return;
  _rafId=requestAnimationFrame(frame);
  const dt=Math.min(.1,(now-last)/1000); last=now;
  _passoRoteiro(dt);
  if(!started) return;
  if(Replay.active){ Replay.step(dt); renderWorld(dt,1); return; }
  if(!Match.paused){
    acc+=dt*Sim.speed;
    const cap=Math.min(20,Math.ceil(Sim.speed)+3);
    let n=0;
    while(acc>=STEP&&n<cap){ simulate(STEP); acc-=STEP; n++; }
    if(acc>STEP*cap) acc=0;
  }
  renderWorld(dt,Match.paused?1:clamp(acc/STEP,0,1));
}

/* ============================================================================
   BOOT
   ============================================================================ */
function boot(p,t){ $('barFill').style.width=p+'%'; if(t) $('step').textContent=t; }

const steps=[
  ['renderizador e pós-processamento',()=>{ initRenderer(); Gfx.init(); }],
  ['céu e iluminação',()=>{ buildSky(); buildLights(); }],
  ['gramado, faixas e desgaste',()=>{ buildPitch(); }],
  ['grama instanciada',()=>{ buildGrass(); }],
  ['traves, redes e bola',()=>{ buildGoals(); buildBall(); buildFlashes(); }],
  ['arquibancadas, público e refletores',()=>{ buildStadium(); buildCrowdVolume(); }],
  ['escalação, arbitragem e IA',()=>{ Aero.init(); spawnTeams(); Officials.init();
    Replay.init(); Overlay.init(); Ctrl.init(); }],
  ['aquecendo shaders',()=>{
    Rules.kickoff('home');
    $('cam').textContent=Director.names[0];
    $('qtag').textContent=QUALITY==='high'?'ALTA':QUALITY==='mid'?'MÉDIA':'BAIXA';
    if(renderer.compile) renderer.compile(scene,camera);
    renderWorld(1/60,1);
  }]
];

function runBuild(done){
  let i=0;
  (function next(){
    if(i>=steps.length){ boot(100,'pronto'); done(); return; }
    const [label,fn]=steps[i];
    boot(Math.round(i/steps.length*100),label);
    requestAnimationFrame(()=>{
      try{ fn(); }
      catch(err){ $('step').textContent='falha: '+err.message; console.error(err); return; }
      i++; setTimeout(next,14);
    });
  })();
}

  /** Retrato do estado interno da simulacao. Barato: so le, nao aloca cena. */
  function lerTelemetria(){
    if(_destruido || typeof Match === "undefined") return null
    const somaPoss = (Match.possT.home + Match.possT.away) || 1
    return {
      relogio: { segundos: Match.t, tempo: Match.half, acrescimo: Match.stoppage,
                 fase: Match.phase, pausado: Match.paused },
      placar: { casa: Match.score.home, fora: Match.score.away },
      posse: { casa: Match.possT.home / somaPoss * 100,
               fora: Match.possT.away / somaPoss * 100,
               atual: Match.possession },
      casa: { finalizacoes: Stats.d.home.shots, noGol: Stats.d.home.tgt,
              passesCertos: Stats.d.home.pass, passesTentados: Stats.d.home.att,
              bloqueios: Stats.d.home.blk, faltas: Match.fouls.home,
              amarelos: Match.cards.home, vermelhos: Match.reds.home },
      fora: { finalizacoes: Stats.d.away.shots, noGol: Stats.d.away.tgt,
              passesCertos: Stats.d.away.pass, passesTentados: Stats.d.away.att,
              bloqueios: Stats.d.away.blk, faltas: Match.fouls.away,
              amarelos: Match.cards.away, vermelhos: Match.reds.away },
      // Estes numeros SO existem aqui: o match-engine do jogo nao simula fisica.
      // `apex`, `dist` e `subs` ja eram mantidos pelo motor original.
      bola: {
        velocidadeKmh: Ball.vel.length() * 3.6,
        rotacaoRpm: Ball.spin.length() * 9.5493,   // rad/s -> rpm
        alturaM: Ball.pos.y,
        alturaMaximaM: Ball.apex,
        percursoM: Ball.dist,
        subpassos: Ball.subs,
        x: Ball.pos.x,
        z: Ball.pos.z,
        dono: Ball.owner ? Ball.owner.team : null,
        ultimoToque: Ball.lastTouch ? Ball.lastTouch.team : null,
      },
      velocidadeSim: Sim.speed,
      passos: Match.steps,
    }
  }

  /** Ajusta a velocidade da simulacao. A fisica NAO muda — muda quanto tempo
   *  simulado cabe em cada segundo real. Aceita o valor mais proximo da lista
   *  interna [0.15, 0.5, 1, 2, 4, 8]. */
  function definirVelocidade(mult){
    if(_destruido || typeof Sim === "undefined") return
    let melhor = 0, dif = Infinity
    for(let i = 0; i < Sim.list.length; i++){
      const d = Math.abs(Sim.list[i] - mult)
      if(d < dif){ dif = d; melhor = i }
    }
    Sim.i = melhor
  }

  /** Duracao de CADA tempo, em minutos de jogo. O padrao e 45. */
  function definirDuracaoDoTempo(minutos){
    if(_destruido || typeof CFG === "undefined") return
    CFG.time.half = Math.max(1, minutos)
  }

  /** Pausa/retoma. Sem isto o React nao tem como parar a partida. */
  function definirPausa(pausado){
    if(_destruido || typeof Match === "undefined") return
    Match.paused = !!pausado
  }

  /**
   * Usa a formacao do 2D (`lib/formations.ts`) no lugar da embutida.
   *
   * Antes o motor tinha um 4-3-3 proprio, sem relacao com o que a tela de
   * escalacao desenha — o time montado no campinho nao era o que entrava em
   * campo. Passando os slots do 2D, os dois passam a concordar.
   *
   * Precisa ser chamado ANTES de `iniciar()`: os jogadores leem a formacao ao
   * nascer. Depois disso, so vale na proxima partida.
   *
   * @param {{pos: string, x: number, y: number}[]} slots
   * @returns {boolean} true se a formacao foi aceita
   */
  function definirFormacao(slots){
    if(_destruido) return false
    const convertida = formacaoDo2D(slots)
    if(!convertida) return false
    _formacaoAtiva = convertida
    return true
  }

  // ── TEMPO DE CENA ───────────────────────────────────────────────────────────
  //
  // Um gol nao e um instante: e LANCE -> CONCLUSAO -> CONSEQUENCIA.
  //
  // A primeira versao de `encenar` pulava direto para a conclusao — chamava
  // `Rules.goal()` e a bola ja estava na rede sem nunca ter sido chutada. Ficava
  // teleporte, nao futebol.
  //
  // Agora cada evento vira uma pequena roteirizacao com tempo proprio. O
  // `roteiro` e uma fila de passos `{ atraso, fazer }` consumida pelo loop; nao
  // toca fisica nem regras, entao NAO altera o resultado que o match-engine
  // decidiu — so faz o lance respirar.
  const _roteiro = []

  /** Enfileira um passo da cena. `atraso` em segundos de tempo REAL. */
  function _cena(atraso, fazer){ _roteiro.push({ t: atraso, fazer }) }

  /** Consome o roteiro. Chamado do loop, com dt real. */
  function _passoRoteiro(dt){
    if(!_roteiro.length) return
    const p = _roteiro[0]
    p.t -= dt
    if(p.t <= 0){
      _roteiro.shift()
      try { p.fazer() } catch(e){ /* uma cena que falha nao pode parar o jogo */ }
    }
  }

  /** Jogador de linha aleatorio de um time (nunca o goleiro). */
  function _algumDeLinha(lado){
    const t = teams[lado]
    if(!t || t.length < 2) return null
    return t[1 + Math.floor(Math.random() * (t.length - 1))]
  }

  /** Quem esta mais perto de um ponto — o candidato natural para o lance. */
  function _maisPertoDe(lado, x, z){
    const t = teams[lado]
    if(!t || !t.length) return null
    let melhor = null, dist = Infinity
    for(const p of t){
      if(p.gk) continue
      const d = (p.pos.x - x)**2 + (p.pos.z - z)**2
      if(d < dist){ dist = d; melhor = p }
    }
    return melhor || t[0]
  }

  /**
   * Reacao coletiva. `chance` evita que os 11 facam a mesma coisa ao mesmo
   * tempo, o que pareceria coreografia em vez de gente.
   */
  function _reacaoDoTime(lado, pose, dur, chance){
    const t = teams[lado]
    if(!t) return
    for(const p of t){
      if(p.gk || Math.random() > (chance ?? 0.6)) continue
      p.pose = pose
      p.poseT = dur * (0.75 + Math.random() * 0.5)   // dessincroniza
    }
  }

  /**
   * Encena um evento decidido pelo match-engine, em tres tempos.
   *
   * O 3D NAO decide nada aqui: quem manda no resultado e o motor de partida do
   * jogo. Esta funcao monta o lance que leva ao que ja foi decidido.
   *
   * @param {{tipo: string, lado: "home"|"away", minuto?: number}} evento
   * @returns {boolean} true se o motor soube encenar
   */
  function encenar(evento){
    if(_destruido || typeof Rules === "undefined") return false
    const lado = evento.lado === "away" ? "away" : "home"
    const adv = lado === "home" ? "away" : "home"

    switch(evento.tipo){
      case "kickoff":
        Rules.kickoff(lado); return true

      case "goal": {
        // LANCE: poe a bola no pe de um atacante em posicao de finalizar e
        // chuta de verdade. A bola VIAJA ate a rede — o `Rules.goal` so entra
        // depois, quando ela chega.
        const d = CFG.teams[lado].dir
        const px = d * (HALF_L - rnd(9, 20))
        const pz = rnd(-HALF_W * 0.45, HALF_W * 0.45)
        const atacante = _maisPertoDe(lado, px, pz)
        if(atacante){
          atacante.pos.set(px, 0, pz); atacante.prev.copy(atacante.pos)
          Ball.pos.set(px + d * 0.4, CFG.ball.r, pz)
          Ball.prev.copy(Ball.pos); Ball.vel.set(0, 0, 0); Ball.spin.set(0, 0, 0)
          Ball.owner = atacante; Ball.lastTouch = atacante

          // Mira num canto do gol, com altura plausivel.
          const alvo = new THREE.Vector3(d * HALF_L, 0, rnd(-2.9, 2.9))
          const dir = alvo.clone().sub(Ball.pos)
          kick(atacante, dir, rnd(19, 26), rnd(1.2, 3.4), rnd(-0.6, 0.6), 0)
          Ball.owner = null
        }

        // CAMERA: acompanha o voo de um angulo baixo, atras do chutador — o
        // plano que a TV usa para mostrar a bola entrando.
        Director.cena = { ang: Math.atan2(pz, px) + Math.PI, raio: 21, alt: 3.2,
                          olha: 1.1, giro: 0.5, fecha: false, dur: 1.1, rate: 4.4 }
        Director.cenaT = 1.1

        // CONCLUSAO: a rede balanca quando a bola chega (~0,45s de voo).
        _cena(0.45, () => {
          if(atacante) Ball.lastTouch = atacante
          Rules.goal(lado, 22)
        })

        // CONSEQUENCIA: quem sofreu reage. O `Rules.goal` ja cuida da festa de
        // quem fez; o lado derrotado nao tinha reacao nenhuma ate agora.
        _cena(0.7, () => {
          const gk = teams[adv] && teams[adv][0]
          if(gk){ gk.pose = 'maos_cabeca'; gk.poseT = 3.4 }
          _reacaoDoTime(adv, 'maos_cabeca', 2.6, 0.45)
        })
        _cena(1.6, () => {
          _reacaoDoTime(adv, 'maos_quadril', 2.4, 0.5)
          const bode = _algumDeLinha(adv)
          if(bode){ bode.pose = 'aponta'; bode.poseT = 2.2 }   // cobra o companheiro
          // CAMERA: fecha no goleiro que sofreu. E o plano de reacao — a TV
          // sempre corta para quem perdeu depois de mostrar quem ganhou.
          const gk = teams[adv] && teams[adv][0]
          if(gk){
            Director.cena = { alvo: gk.pos, ang: Math.random() * 6.28, raio: 9,
                              alt: 2.6, olha: 1.4, giro: 0.35, fecha: true,
                              dur: 2.2, rate: 2.6 }
            Director.cenaT = 2.2
          }
        })
        return true
      }

      case "penalty": {
        Rules.penalty(lado)
        // CONSEQUENCIA imediata: quem vai bater se concentra, quem sofreu
        // reclama com o arbitro.
        _cena(0.3, () => {
          _reacaoDoTime(adv, 'reclamar', 2.8, 0.5)
        })
        return true
      }

      case "corner": {
        const d = CFG.teams[lado].dir
        const z = (Math.random() < 0.5 ? -1 : 1) * (HALF_W - 0.3)
        Rules.setPiece(lado, d * (HALF_L - 0.3), z, "ESCANTEIO")
        return true
      }

      case "foul":
      case "free_kick": {
        const d = CFG.teams[lado].dir
        const fx = d * (HALF_L * 0.45 + Math.random() * HALF_L * 0.3)
        const fz = rnd(-HALF_W * 0.6, HALF_W * 0.6)
        Rules.setPiece(lado, fx, fz, "FALTA")
        // CONSEQUENCIA: quem cometeu a falta reclama; quem sofreu se levanta.
        _cena(0.35, () => {
          const infrator = _maisPertoDe(adv, fx, fz)
          if(infrator){ infrator.pose = 'reclamar'; infrator.poseT = 2.1 }
        })
        return true
      }

      case "yellow_card": {
        Match.cards[lado]++
        // O cartao nao mudava NADA no corpo de ninguem. Agora o punido protesta
        // e um companheiro vem puxa-lo dali.
        const punido = _algumDeLinha(lado)
        if(punido){ punido.pose = 'reclamar'; punido.poseT = 3.0 }
        _cena(0.8, () => {
          const colega = _algumDeLinha(lado)
          if(colega && colega !== punido){ colega.pose = 'aponta'; colega.poseT = 1.8 }
        })
        return true
      }

      case "red_card": {
        const alvo = _algumDeLinha(lado)
        if(alvo){
          // CONSEQUENCIA antes da saida: protesta, depois deixa o campo.
          alvo.pose = 'reclamar'; alvo.poseT = 2.4
          _reacaoDoTime(lado, 'reclamar', 2.2, 0.4)
          // CAMERA: plano fechado no expulso, girando devagar. E o corte que a
          // TV da — a reacao dele importa mais que a posicao da bola.
          Director.cena = { alvo: alvo.pos, ang: Math.random() * 6.28, raio: 8.5,
                            alt: 2.4, olha: 1.5, giro: 0.6, fecha: true,
                            dur: 2.4, rate: 2.8 }
          Director.cenaT = 2.4
          _cena(2.4, () => { Rules.expel(alvo) })
        }
        Match.reds[lado]++
        return !!alvo
      }

      case "halftime":
        Match.half = 2; Match.t = CFG.time.half * 60
        Match.steps = CFG.time.half * 60 * 60
        Rules.kickoff(adv)
        return true

      case "fulltime": {
        Match.paused = true
        const venceu = Match.score.home === Match.score.away ? null
          : (Match.score.home > Match.score.away ? 'home' : 'away')
        if(venceu){
          _reacaoDoTime(venceu, 'celebrate', 5, 0.8)
          _reacaoDoTime(venceu === 'home' ? 'away' : 'home', 'maos_cabeca', 4, 0.6)
        }
        return true
      }

      // Eventos sem encenacao propria — o lance ja esta acontecendo em campo.
      // Devolver false deixa o chamador saber que nao houve mudanca de cena, em
      // vez de fingir que encenou.
      case "shot": case "shot_on_target": case "miss": case "post":
      case "save": case "offside": case "counter_attack":
      case "sub": case "var": case "injury":
        return false

      default:
        return false
    }
  }

  // ── ciclo de vida ───────────────────────────────────────────────────────────

  async function iniciar(){
    if(_destruido) return
    // A montagem e fatiada em passos com rAF entre eles para a barra de
    // progresso realmente andar. Rodar tudo de uma vez travaria a aba por
    // segundos e a barra pularia de 0 a 100.
    await new Promise((resolve, reject) => {
      let i = 0
      ;(function proximo(){
        if(_destruido) return resolve()
        if(i >= steps.length) return resolve()
        const [rotulo, fn] = steps[i]
        opcoes.aoProgredir?.(Math.round(i / steps.length * 100), rotulo)
        _rafId = requestAnimationFrame(() => {
          if(_destruido) return resolve()
          try { fn() } catch(err){ return reject(err) }
          i++
          _timers.push(window.setTimeout(proximo, 14))
        })
      })()
    })
    if(_destruido) return
    opcoes.aoProgredir?.(100, "pronto")
    started = true
    last = performance.now()
    Audio2.whistle(false)
    _rafId = requestAnimationFrame(frame)
    opcoes.aoIniciar?.()
  }

  function destruir(){
    if(_destruido) return
    _destruido = true
    started = false

    if(_rafId != null) cancelAnimationFrame(_rafId)
    _timers.forEach(t => clearTimeout(t))
    _timers.length = 0

    // Listeners primeiro: sem isto, um resize depois da desmontagem chamaria
    // codigo que espera um renderer que ja nao existe.
    _listeners.forEach(([alvo, evento, fn]) => alvo.removeEventListener(evento, fn))
    _listeners.length = 0

    // A GPU nao libera sozinha. Sem dispose(), cada partida jogada deixa
    // texturas e geometrias para tras ate o navegador matar o contexto.
    try {
      scene?.traverse((o) => {
        o.geometry?.dispose?.()
        const m = o.material
        if(Array.isArray(m)) m.forEach((x) => descartarMaterial(x))
        else if(m) descartarMaterial(m)
      })
      renderer?.dispose?.()
      renderer?.forceContextLoss?.()
      const cv = renderer?.domElement
      if(cv?.parentNode) cv.parentNode.removeChild(cv)
    } catch { /* ja descartado */ }

    try { Audio2?.close?.() } catch { /* audio pode nem ter iniciado */ }
  }

  function descartarMaterial(m){
    for(const k in m){
      const v = m[k]
      if(v && typeof v === "object" && typeof v.dispose === "function" && v.isTexture) v.dispose()
    }
    m.dispose?.()
  }

  return {
    iniciar,
    destruir,
    lerTelemetria,
    definirVelocidade,
    definirDuracaoDoTempo,
    definirPausa,
    definirFormacao,
    encenar,
    get destruido(){ return _destruido },
  }
}
