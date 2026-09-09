/* CRISPY ORBIT — Carji-style kart banana hunt */
(function () {
  "use strict";
  const SAVE_KEY = "crispy_carji_v4";
  const HEARTS = 3;
  const WORLD = 100;
  const XP_NEED = 2;
  const HOP0 = 1.0, HOP_STEP = 0.1, HOP_MIN = 0.4;

  let TOON = null;
  function makeToon() {
    const c = document.createElement("canvas"); c.width = 4; c.height = 1;
    const g = c.getContext("2d");
    ["#444","#888","#ccc","#fff"].forEach((col,i)=>{ g.fillStyle=col; g.fillRect(i,0,1,1); });
    const t = new THREE.CanvasTexture(c);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function now(){ return performance.now()/1000; }
  function fmt(t){ const m=Math.floor(t/60), s=t-m*60; return m+":"+s.toFixed(1).padStart(4,"0"); }
  function outlined(geom, color, sc) {
    const m = new THREE.Mesh(geom, new THREE.MeshToonMaterial({ color: color, gradientMap: TOON }));
    const o = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: 0x1a1008, side: THREE.BackSide }));
    o.scale.setScalar(sc || 1.07); m.add(o); return m;
  }
  function loadSave(){ try{ const r=localStorage.getItem(SAVE_KEY); if(r) return JSON.parse(r);}catch(e){} return {best:null}; }
  function writeSave(s){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }catch(e){} }

  const SFX = {
    ctx:null, on:true, t:0, i:0, notes:[0,4,7,4,9,7,4,2],
    ensure:function(){ if(!this.ctx){ const A=window.AudioContext||window.webkitAudioContext; if(A) this.ctx=new A(); } if(this.ctx&&this.ctx.state==="suspended") this.ctx.resume(); },
    beep:function(f,d,ty,v,sl){ if(!this.on) return; this.ensure(); if(!this.ctx) return;
      const t0=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type=ty||"square"; o.frequency.setValueAtTime(f,t0); if(sl) o.frequency.exponentialRampToValueAtTime(sl,t0+d);
      g.gain.setValueAtTime(v||0.07,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+d);
      o.connect(g); g.connect(this.ctx.destination); o.start(t0); o.stop(t0+d+0.02);
    },
    hop:function(){ this.beep(300,0.1,"square",0.07,520); },
    take:function(){ this.beep(660,0.1,"square",0.07,990); },
    shoot:function(){ this.beep(420,0.08,"square",0.06,180); },
    lvl:function(){ this.beep(523,0.12,"square",0.07); },
    hit:function(){ this.beep(90,0.2,"sawtooth",0.1,40); },
    dead:function(){ this.beep(150,0.35,"sawtooth",0.08,50); },
        win:function(){ this.beep(523,0.12,"square",0.07); setTimeout(()=>this.beep(784,0.22,"square",0.08),140); },
    tick:function(dt){ if(!this.on) return; this.t-=dt; if(this.t>0) return; this.t=0.5; this.beep(196*Math.pow(2,this.notes[this.i++%this.notes.length]/12),0.15,"triangle",0.016); }
  };

  const Input = {
    x:0, y:0, id:null, brake:false, hopP:false, fire:false, fireP:false, keys:{},
    setup:function(){
      const zone=document.getElementById("joystick-zone");
      const knob=document.getElementById("joy-knob");
      const base=document.getElementById("joy-base");
      const self=this;
      const setK=(nx,ny)=>{ const mx=(base.clientWidth-knob.clientWidth)/2;
        knob.style.left=(base.clientWidth/2-knob.clientWidth/2+nx*mx)+"px";
        knob.style.top=(base.clientHeight/2-knob.clientHeight/2+ny*mx)+"px"; };
      const apply=(cx,cy)=>{
        const r=base.getBoundingClientRect();
        let dx=(cx-(r.left+r.width/2))/(r.width*0.5);
        let dy=(cy-(r.top+r.height/2))/(r.height*0.5);
        const m=Math.hypot(dx,dy); if(m>1){ dx/=m; dy/=m; }
        self.x=dx; self.y=dy; setK(dx,dy);
      };
      const clear=()=>{ self.id=null; self.x=0; self.y=0; setK(0,0); };
      zone.addEventListener("touchstart",(e)=>{ const t=e.changedTouches[0]; self.id=t.identifier; apply(t.clientX,t.clientY); e.preventDefault(); },{passive:false});
      window.addEventListener("touchmove",(e)=>{ for(let i=0;i<e.changedTouches.length;i++){ const t=e.changedTouches[i]; if(t.identifier===self.id) apply(t.clientX,t.clientY);} },{passive:true});
      window.addEventListener("touchend",(e)=>{ for(let i=0;i<e.changedTouches.length;i++) if(e.changedTouches[i].identifier===self.id) clear(); });
      zone.addEventListener("mousedown",(e)=>{ self.id="m"; apply(e.clientX,e.clientY); });
      window.addEventListener("mousemove",(e)=>{ if(self.id==="m") apply(e.clientX,e.clientY); });
      window.addEventListener("mouseup",()=>{ if(self.id==="m") clear(); });
      const btnH=document.getElementById("btn-ability");
      const btnB=document.getElementById("btn-jump");
      const btnF=document.getElementById("btn-fire");
      const downH=(e)=>{ e.preventDefault(); self.hopP=true; };
      const downB=(e)=>{ e.preventDefault(); self.brake=true; };
      const upB=()=>{ self.brake=false; };
      const downF=(e)=>{ e.preventDefault(); self.fire=true; self.fireP=true; };
      const upF=()=>{ self.fire=false; };
      [ ["touchstart",downH],["mousedown",downH] ].forEach(p=>btnH.addEventListener(p[0],p[1],{passive:false}));
      [ ["touchstart",downB],["mousedown",downB] ].forEach(p=>btnB.addEventListener(p[0],p[1],{passive:false}));
      ["touchend","mouseup"].forEach(ev=>btnB.addEventListener(ev,upB));
      if(btnF){
        [ ["touchstart",downF],["mousedown",downF] ].forEach(p=>btnF.addEventListener(p[0],p[1],{passive:false}));
        ["touchend","mouseup"].forEach(ev=>btnF.addEventListener(ev,upF));
      }
      window.addEventListener("keydown",(e)=>{
        self.keys[e.code]=true;
        if(e.code==="Space"){ self.hopP=true; e.preventDefault(); }
        if(e.code==="ShiftLeft"||e.code==="KeyK") self.brake=true;
        if(e.code==="KeyJ"||e.code==="KeyF"){ self.fire=true; self.fireP=true; }
      });
      window.addEventListener("keyup",(e)=>{
        self.keys[e.code]=false;
        if(e.code==="ShiftLeft"||e.code==="KeyK") self.brake=false;
        if(e.code==="KeyJ"||e.code==="KeyF") self.fire=false;
      });
    },
    stick:function(){
      let x=this.x, y=this.y;
      if(this.keys["KeyA"]||this.keys["ArrowLeft"]) x-=1;
      if(this.keys["KeyD"]||this.keys["ArrowRight"]) x+=1;
      if(this.keys["KeyW"]||this.keys["ArrowUp"]) y-=1;   // up on screen / W = negative y
      if(this.keys["KeyS"]||this.keys["ArrowDown"]) y+=1;
      const m=Math.hypot(x,y); if(m>1){ x/=m; y/=m; }
      return {x:x,y:y};
    },
    consumeHop:function(){ const v=this.hopP; this.hopP=false; return v; },
    consumeFire:function(){ const v=this.fireP; this.fireP=false; return v; },
    reset:function(){ this.id=null; this.x=0; this.y=0; this.brake=false; this.hopP=false; this.fire=false; this.fireP=false; }
  };


  function makeMonkey(){
    const g=new THREE.Group();
    const fur=0x5a2e18, snout=0xd7b089, eyeW=0xfffdf8, ink=0x14110e;
    const torso=outlined(new THREE.SphereGeometry(0.42,10,8),fur,1.08);
    torso.scale.set(1.05,0.95,0.7); torso.position.y=0.55; g.add(torso);
    const head=outlined(new THREE.SphereGeometry(0.48,10,8),fur,1.07);
    head.scale.set(1.05,0.95,0.85); head.position.set(0,1.22,0.08); g.add(head);
    const muzzle=outlined(new THREE.SphereGeometry(0.26,8,7),snout,1.08);
    muzzle.scale.set(1.15,0.7,0.7); muzzle.position.set(0,1.08,0.38); g.add(muzzle);
    function eye(x){
      const e=outlined(new THREE.SphereGeometry(0.16,8,7),eyeW,1.12);
      e.scale.set(0.85,1.15,0.55); e.position.set(x,1.34,0.42); g.add(e);
      const p=outlined(new THREE.SphereGeometry(0.055,6,5),ink,1.2);
      p.position.set(x,1.33,0.50); g.add(p);
    }
    eye(-0.16); eye(0.16);
    const earL=outlined(new THREE.SphereGeometry(0.12,7,6),fur,1.12);
    earL.position.set(-0.42,1.38,0.02); g.add(earL);
    const earR=outlined(new THREE.SphereGeometry(0.12,7,6),fur,1.12);
    earR.position.set(0.42,1.38,0.02); g.add(earR);
    const armL=outlined(new THREE.SphereGeometry(0.12,6,5),fur,1.12);
    armL.scale.set(0.7,1.3,0.7); armL.position.set(-0.46,0.62,0.12); g.add(armL);
    const armR=outlined(new THREE.SphereGeometry(0.12,6,5),fur,1.12);
    armR.scale.set(0.7,1.3,0.7); armR.position.set(0.46,0.62,0.12); g.add(armR);
    return g;
  }
  function makeKart(){
    const g=new THREE.Group();
    const body=outlined(new THREE.BoxGeometry(0.9,0.32,1.55),0xe8c07a,1.06); body.position.y=0.4; g.add(body);
    const crust=outlined(new THREE.BoxGeometry(0.94,0.1,1.6),0xc48a3a,1.06); crust.position.y=0.58; g.add(crust);
    const seat=outlined(new THREE.BoxGeometry(0.46,0.26,0.46),0x6b3a18,1.1); seat.position.set(0,0.7,-0.18); g.add(seat);
    const wheels=[];
    [[-0.4,-0.5],[0.4,-0.5],[-0.4,0.5],[0.4,0.5]].forEach(s=>{
      const w=outlined(new THREE.SphereGeometry(0.16,7,6),0xc41e3a,1.1);
      w.position.set(s[0],0.16,s[1]); g.add(w); wheels.push(w);
    });
    const monkey=makeMonkey(); monkey.position.set(0,0.22,-0.05); g.add(monkey);
    g.userData.wheels=wheels; return g;
  }
  function parseKenneyOBJ(text){
    const pos=[], col=[], idx=[];
    const lines=text.split("\n");
    for(let i=0;i<lines.length;i++){
      const L=lines[i].trim();
      if(L.startsWith("v ")){
        const p=L.split(/\s+/);
        pos.push(+p[1], +p[2], +p[3]);
        if(p.length>=7) col.push(+p[4], +p[5], +p[6]);
        else col.push(1,1,1);
      } else if(L.startsWith("f ")){
        const p=L.split(/\s+/).slice(1);
        const ids=p.map(t=>parseInt(t.split("/")[0],10)-1);
        for(let k=1;k<ids.length-1;k++) idx.push(ids[0], ids[k], ids[k+1]);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col,3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mat=new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:TOON });
    const mesh=new THREE.Mesh(geo, mat);
    const o=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0x1a1008, side:THREE.BackSide }));
    o.scale.setScalar(1.06); mesh.add(o);
    return mesh;
  }
  const FOOD_CACHE={};
  function loadFood(name, cb){
    if(FOOD_CACHE[name]){ cb(FOOD_CACHE[name].clone()); return; }
    fetch("models/food/"+name+".obj").then(r=>r.text()).then(t=>{
      FOOD_CACHE[name]=parseKenneyOBJ(t);
      cb(FOOD_CACHE[name].clone());
    }).catch(()=>{});
  }
  function placeFood(name, x, z, scale, rotY){
    loadFood(name, function(m){
      m.scale.setScalar(scale||10);
      m.position.set(x,0,z);
      if(rotY) m.rotation.y=rotY;
      m.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(m);
      m.position.y = -box.min.y;
      Game.world.add(m);
    });
  }

  function makeBanana(){ const g=new THREE.Group(); const c=outlined(new THREE.TorusGeometry(0.17,0.055,5,8,Math.PI),0xffe14a,1.16); c.rotation.z=0.4; g.add(c); return g; }
  function makeWaffle(){ const g=new THREE.Group(); const b=outlined(new THREE.BoxGeometry(1.6,0.26,1.6),0xc47a28,1.05); b.position.y=0.5; g.add(b); return g; }
  function makeBun(){ const b=outlined(new THREE.SphereGeometry(1.0,8,6),0xe0a04a,1.05); b.scale.set(1.15,0.8,1.15); return b; }


  const Net = {
    ws:null, self:null, players:new Map(), connected:false, lastSend:0, url:null,
    connect:function(){
      if(this.ws && (this.ws.readyState===0||this.ws.readyState===1)) return;
      const proto=location.protocol==='https:'?'wss':'ws';
      this.url=(location.hostname==='localhost'||location.hostname==='127.0.0.1') ? 'ws://'+location.host : proto+'://'+location.host;
      try {
        this.ws=new WebSocket(this.url);
        this.ws.onopen=()=>{ this.connected=true; Game.toast('ONLINE ARENA — CONNECTED'); };
        this.ws.onclose=()=>{ this.connected=false; Game.toast('OFFLINE — RECONNECTING'); setTimeout(()=>this.connect(),1500); };
        this.ws.onerror=()=>{};
        this.ws.onmessage=(e)=>this.message(JSON.parse(e.data));
      } catch(e) { this.connected=false; }
    },
    send:function(m){ if(this.ws&&this.ws.readyState===1) this.ws.send(JSON.stringify(m)); },
    message:function(m){
      if(m.type==='welcome'){ this.self=m.self; this.apply(m.players||[]); Game.updateArenaHud(); }
      else if(m.type==='state'){ this.apply(m.players||[]); const me=(m.players||[]).find(p=>p.id===this.self); if(me){ Game.hp=me.hp; if(!me.alive){ Game.state='respawn'; Game.player.visible=false; } } Game.updateArenaHud(); }
      else if(m.type==='join'){ this.upsert(m.player); Game.updateArenaHud(); }
      else if(m.type==='leave'){ this.remove(m.id); Game.updateArenaHud(); }
      else if(m.type==='destroyed'){ Game.toast(m.by===this.self?'💥 PLAYER DESTROYED':'💥 YOU GOT BONKED'); }
      else if(m.type==='respawn'){ this.upsert(m.player); if(m.player.id===this.self) Game.localRespawn(m.player); Game.updateArenaHud(); }
    },
    apply:function(list){ list.forEach(p=>this.upsert(p)); },
    upsert:function(p){
      if(!p||p.id===this.self) return;
      let r=this.players.get(p.id);
      if(!r){ const mesh=makeKart(); mesh.traverse(o=>{ if(o.material&&o.material.color) o.material.color.offsetHSL(0,0.05,0.05); }); mesh.visible=p.alive; Game.world.add(mesh); r={data:p,mesh:mesh}; this.players.set(p.id,r); }
      r.target=p; r.mesh.visible=p.alive;
      if(!p.alive) r.mesh.position.y=-10;
    },
    remove:function(id){ const r=this.players.get(id); if(r){ Game.world.remove(r.mesh); this.players.delete(id); } },
    tick:function(dt){
      if(!this.connected||!this.self||Game.state!=='play') return;
      if(now()-this.lastSend>0.05){ this.lastSend=now(); this.send({type:'input',x:Game.player.position.x,z:Game.player.position.z,yaw:Game.yaw}); }
      for(const r of this.players.values()){ const p=r.target; if(!p) continue; r.mesh.position.x=lerp(r.mesh.position.x,p.x,1-Math.exp(-12*dt)); r.mesh.position.z=lerp(r.mesh.position.z,p.z,1-Math.exp(-12*dt)); r.mesh.position.y=Game.groundH(r.mesh.position.x,r.mesh.position.z); r.mesh.rotation.y=p.yaw||0; }
    },
    checkBumps:function(){
      if(!this.connected||!this.self||Game.state!=='play'||Game.inv>0) return;
      for(const r of this.players.values()){ const p=r.target; if(!p||!p.alive) continue; const d=Math.hypot(Game.player.position.x-p.x,Game.player.position.z-p.z);
        if(d<2.1 && Math.abs(Game.speed)>2.5){ this.send({type:'hit',target:p.id}); Game.inv=0.35; Game.speed*=-0.25; Game.shake=0.18; }
      }
    }
  };

  const Game = {
    save:loadSave(), state:"menu",
    renderer:null, scene:null, camera:null, clock:new THREE.Clock(),
    world:new THREE.Group(), player:null,
    speed:0, yaw:0, vy:0, grounded:true,
    hp:HEARTS, maxHp:HEARTS, got:0, need:0, xp:0, lv:0, hopCd:0, inv:0, shake:0, flash:0, time:0, timing:false,
    hasGun:false, fireCd:0, fireRate:0.55, extraSpeed:0, shots:[],
    items:[], enemies:[], solids:[], ramps:[], lavas:[], spawnT:0, arena:true,
    tmp:new THREE.Vector3(), cam:new THREE.Vector3(), look:new THREE.Vector3(),

    init:function(){
      TOON=makeToon();
      const canvas=document.getElementById("game-canvas");
      this.renderer=new THREE.WebGLRenderer({canvas:canvas, antialias:false, powerPreference:"low-power"});
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.scene=new THREE.Scene();
      this.scene.background=new THREE.Color(0xc8b89a);
      this.scene.fog=new THREE.Fog(0xc8b89a, 40, 160);
      this.camera=new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.15, 260);
      this.scene.add(new THREE.HemisphereLight(0xffe6c4, 0x6a4a30, 1.15));
      const sun=new THREE.DirectionalLight(0xfff4d2, 0.8); sun.position.set(-10,18,-6); this.scene.add(sun);
      this.scene.add(this.world);
      this.player=makeKart(); this.player.visible=false; this.scene.add(this.player);
      Input.setup(); this.bind();
      window.addEventListener("resize",()=>this.resize());
      this.clock.start(); this.loop();
    },
    resize:function(){ this.camera.aspect=window.innerWidth/window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth,window.innerHeight,false); },
    bind:function(){
      const on=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
      on("btn-play",()=>{ SFX.ensure(); this.startArena(); });
      on("btn-arena",()=>{ SFX.ensure(); this.startArena(); });
      on("btn-pause",()=>{ if(this.state==="play"){ Input.reset(); this.state="pause"; this.show("screen-pause"); }});
      on("btn-resume",()=>{ this.state="play"; this.show(null); });
      on("btn-restart",()=>this.start());
      on("btn-quit",()=>this.menu());
      on("btn-next",()=>this.start());
      on("btn-complete-menu",()=>this.menu());
      on("btn-retry",()=>this.start());
      on("btn-fail-menu",()=>this.menu());
    },
    show:function(id){ document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active")); if(id) document.getElementById(id).classList.add("active"); },
    menu:function(){ Input.reset(); this.state="menu"; this.player.visible=false; document.getElementById("hud").classList.remove("on"); this.clear(); this.show("screen-menu"); },
    toast:function(m){ const el=document.getElementById("toast"); el.textContent=m; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show"); },
    clear:function(){ while(this.world.children.length) this.world.remove(this.world.children[0]); this.items=[]; this.enemies=[]; this.solids=[]; this.ramps=[]; this.lavas=[]; },

    startArena:function(){ this.start(); this.arena=true; Net.connect(); this.toast(Net.connected?"ARENA READY":"CONNECTING TO ARENA..."); },

    start:function(){
      this.clear();
      this.hp=HEARTS; this.maxHp=HEARTS; this._hopBonus=0; this.got=0; this.xp=0; this.lv=0; this.hopCd=0; this.inv=0; this.shake=0;
      this.hasGun=false; this.fireCd=0; this.fireRate=0.55; this.extraSpeed=0; this.shots=[];
      const fb=document.getElementById("btn-fire"); if(fb) fb.classList.add("hidden");
      this.time=0; this.timing=false; this.speed=0; this.yaw=0; this.vy=0; this.grounded=true; this.spawnT=3.2;
      this.build();
      this.player.position.set(0,0,0); this.player.rotation.set(0,0,0); this.player.visible=true;
      this.camera.position.set(0,5.5,-11);
      document.getElementById("hud").classList.add("on"); this.show(null); this.hud(); this.state="play";
      if(this.arena) Net.connect();
      this.toast("GET THE BANANAS");
    },

    addSolid:function(x,z,rx,rz){ this.solids.push({x:x,z:z,rx:rx,rz:rz}); },
    addRamp:function(x,z,w,d,h){ this.ramps.push({x:x,z:z,w:w,d:d,h:h}); },

    build:function(){
      const tile=outlined(new THREE.BoxGeometry(WORLD*2,0.6,WORLD*2),0xe7d3b0,1.003);
      tile.position.y=-0.3; this.world.add(tile);
      for(let x=-90;x<=90;x+=16){
        for(let z=-90;z<=90;z+=16){
          if(((x+z)/16)%2===0){
            const t=outlined(new THREE.BoxGeometry(15.4,0.08,15.4),0xd4b48a,1.015);
            t.position.set(x,0.04,z); this.world.add(t);
          }
        }
      }
      const box=(w,h,d,col,x,y,z,sx,sz)=>{
        const m=outlined(new THREE.BoxGeometry(w,h,d),col,1.025);
        m.position.set(x,y,z); this.world.add(m);
        if(sx) this.addSolid(x,z,sx,sz);
      };
      // room walls like kitchen cabinets wrapping the space
      box(WORLD*2,28,3,0xf6f0e6,0,14,-WORLD+1.4,WORLD,1.6);
      box(WORLD*2,28,3,0xf6f0e6,0,14,WORLD-1.4,WORLD,1.6);
      box(3,28,WORLD*2,0xf6f0e6,-WORLD+1.4,14,0,1.6,WORLD);
      box(3,28,WORLD*2,0xf6f0e6,WORLD-1.4,14,0,1.6,WORLD);
      // back counter wall
      box(120,6,14,0xc4a06a,0,3,-86,62,7.4);
      box(120,16,6,0x8d5a2c,0,14,-92,62,3.2);
      // GIANT fridge
      box(18,32,14,0xeef3f8,-78,16,-78,9.5,7.5);
      box(16,2.2,0.6,0x9aa3ad,-78,22,-71);
      box(2.2,4,0.6,0xc9d0d8,-70,14,-71);
      // GIANT stove
      box(24,5,16,0x3a3a42,10,2.5,-84,12.4,8.4);
      const burner=(x,z,r)=>{ const b=outlined(new THREE.CylinderGeometry(r,r,0.35,12),0x1a1a1a,1.05); b.position.set(x,5.2,z); this.world.add(b); };
      burner(4,-80,2.2); burner(16,-80,2.2); burner(4,-88,2.2); burner(16,-88,2.2);
      this.lavas.push({x:10,z:-84,r:9});
      // kitchen island you can drive around (and ramp onto)
      box(28,4.2,16,0xd8c09a,0,2.1,6,14.5,8.4);
      box(26,0.5,14,0xeee6d4,0,4.35,6);
      rampOnto(-16,6,8,18,4.2);
      // sink
      box(22,4,12,0xc5ccd4,72,2, -18,11.5,6.4);
      const basin=outlined(new THREE.BoxGeometry(10,1.2,7),0x7aa7c8,1.04); basin.position.set(72,4.3,-18); this.world.add(basin);
      // pantry towers
      box(12,20,16,0x8a5a2b,-80,10,18,6.4,8.4);
      box(12,20,16,0x8a5a2b,-80,10,48,6.4,8.4);
      // dining table (huge)
      box(22,1.6,14,0x9a6a3a,55,5.2,55,11.4,7.4);
      box(1.4,5.2,1.4,0x6b3a18,46,2.6,49,0.9,0.9);
      box(1.4,5.2,1.4,0x6b3a18,64,2.6,61,0.9,0.9);
      box(1.4,5.2,1.4,0x6b3a18,46,2.6,61,0.9,0.9);
      box(1.4,5.2,1.4,0x6b3a18,64,2.6,49,0.9,0.9);
      rampOnto(55,42,7,16,5.2);
      function rampOnto(x,z,w,d,h){
        const m=outlined(new THREE.BoxGeometry(w,0.4,d),0xc9a36a,1.04);
        m.position.set(x,h*0.45,z); Game.world.add(m);
        Game.addRamp(x,z,w*0.55,d*0.55,h);
      }
      rampOnto(22,-12,7,20,3.8);
      rampOnto(-36,36,7,18,3.4);
      rampOnto(38,-48,7,22,4.0);
      rampOnto(0,70,6,18,3.6);
      // jam / sauce hazards
      const puddle=(x,z,r,col)=>{ const m=outlined(new THREE.CylinderGeometry(r,r,0.18,14),col,1.03); m.position.set(x,0.1,z); this.world.add(m); this.lavas.push({x:x,z:z,r:r*0.92}); };
      puddle(-42,-28,7,0x8a1a2a); puddle(60,-58,6,0x7a3a10); puddle(-8,78,5.5,0x8a1a2a);

      const spots=[];
      for(let i=0;i<48;i++){
        const a=i*0.73, r=14+((i*19)%78);
        spots.push([Math.cos(a)*r*1.05, Math.sin(a)*r]);
      }
      [[-62,-62],[62,62],[-74,28],[74,-28],[0,84],[84,0],[-84,70],[48,-74],[-50,80],[30,30]].forEach(p=>spots.push(p));
      spots.forEach((s,i)=>{
        const m=makeBanana(); m.position.set(s[0],0.8,s[1]); this.world.add(m);
        this.items.push({mesh:m, taken:false, baseY:0.8, ph:i*0.29});
      });
      this.need=this.items.length;

      // Kenney foods as LANDMARKS (tiny monkey scale)
      const foods=[
        ["burger",-10,18,55],["apple",18,22,45],["loaf",-22,-14,60],
        ["bottle-ketchup",70,-16,50],["cake",52,56,42],["donut",-68,24,48],
        ["waffle",20,-68,50],["tomato",-48,62,44],["carrot",32,74,50],
        ["cheese",-58,-8,40],["pancakes",6,14,42],["soda-can",-28,72,40],
        ["pot",12,-82,38],["plate",54,50,36],["rollingPin",-14,8,40],
        ["bread",42,-22,55],["banana",-38,22,48],["burger",72,38,50],
        ["loaf",-72,-38,58],["apple",62,-8,42],["cake",-18,78,40],
        ["donut",82,18,44],["waffle",-82,-18,48],["bottle-ketchup",-76,50,46]
      ];
      foods.forEach(f=>placeFood(f[0], f[1], f[2], f[3], Math.random()*6));
      this.addEnemy("waffle", new THREE.Vector3(24,0,24));
      this.addEnemy("bun", new THREE.Vector3(-28,0,-18));
    },

    hopMax:function(){ return Math.max(HOP_MIN, HOP0 - this.lv*HOP_STEP - (this._hopBonus||0)); },
    groundH:function(x,z){
      let h=0;
      for(let i=0;i<this.ramps.length;i++){
        const r=this.ramps[i];
        const dx=Math.abs(x-r.x), dz=Math.abs(z-r.z);
        if(dx<r.w && dz<r.d){ h=Math.max(h, r.h*(1-Math.max(dx/r.w, dz/r.d))); }
      }
      return h;
    },

    updateArenaHud:function(){
      const el=document.getElementById("arena-status"); if(!el) return;
      const count=Net.players.size+(Net.self?1:0);
      el.textContent=(Net.connected?"🟢 ONLINE":"🟠 CONNECTING")+"  •  "+count+" PLAYER"+(count===1?"":"S")+"  •  SCORE "+(Net.self && Net.players.get(Net.self)?.data?.score || 0);
    },
    localRespawn:function(p){ this.player.position.set(p.x,0,p.z); this.hp=p.hp; this.speed=0; this.vy=0; this.yaw=p.yaw||0; this.player.visible=true; this.state="play"; this.show(null); this.toast("🚀 RESPAWNED"); },

    hud:function(){
      const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
      set("hud-time", fmt(this.time));
      set("hud-hearts", "❤️".repeat(this.hp)+"🖤".repeat(Math.max(0,this.maxHp-this.hp)));
      set("hud-bananas", "🍌 "+this.got+"/"+this.need);
      const fill=document.getElementById("xp-fill"), lab=document.getElementById("xp-label");
      if(fill) fill.style.width=((this.xp/XP_NEED)*100)+"%";
      if(lab) lab.textContent="XP "+this.xp+" → "+XP_NEED+"   LV "+this.lv;
      const cd=document.getElementById("hud-cd"); if(cd) cd.textContent=this.hopMax().toFixed(1)+"s";
      const btn=document.getElementById("btn-ability"); if(btn) btn.classList.toggle("cooling", this.hopCd>0);
      this.updateArrow();
    },
    updateArrow:function(){
      const el=document.getElementById("arrow");
      const dist=document.getElementById("arrow-dist");
      let best=null, bestD=1e9;
      const p=this.player.position;
      for(let i=0;i<this.items.length;i++){
        if(this.items[i].taken) continue;
        const d=p.distanceTo(this.items[i].mesh.position);
        if(d<bestD){ bestD=d; best=this.items[i].mesh.position; }
      }
      if(!best){ if(el) el.style.transform="rotate(0deg)"; if(dist) dist.textContent="done"; return; }
      const dx=best.x-p.x, dz=best.z-p.z;
      const worldAng=Math.atan2(dx,dz);
      const rel=worldAng-this.yaw;
      if(el) el.style.transform="rotate("+(-rel*180/Math.PI)+"deg)";
      if(dist) dist.textContent=Math.round(bestD)+"m";
    },

    loop:function(){
      requestAnimationFrame(()=>this.loop());
      const dt=Math.min(this.clock.getDelta(),0.05);
      if(this.state==="play"){ this.tick(dt); SFX.tick(dt); }
      else { const t=now(); this.camera.position.set(Math.sin(t*0.12)*12,7,-14); this.camera.lookAt(0,1.2,0); }
      const fl=document.getElementById("hurt-flash");
      if(this.flash>0){ this.flash-=dt; fl.classList.add("on"); if(this.flash<=0) fl.classList.remove("on"); }
      if(this._blade) this._blade.rotation.z += dt*1.6;
      this.renderer.render(this.scene,this.camera);
    },

    tick:function(dt){
      this.drive(dt); this.tryShoot(); this.shotTick(dt); this.itemsTick(dt); this.enemyTick(dt); this.spawn(dt); this.camTick(dt);
      if(this.arena){ Net.tick(dt); Net.checkBumps(); }
      if(this.timing) this.time+=dt;
      this.inv=Math.max(0,this.inv-dt); this.hopCd=Math.max(0,this.hopCd-dt); this.fireCd=Math.max(0,this.fireCd-dt); this.shake=Math.max(0,this.shake-dt*3);
      this.hud();
    },

    drive:function(dt){
      const st=Input.stick();
      if(!this.timing && (Math.abs(st.x)>0.12||Math.abs(st.y)>0.12)) this.timing=true;
      // joy.y is + when stick is DOWN. Carji W = forward. Stick UP must be forward.
      const throttle = -st.y;
      const steer = -st.x;
      const maxSpd=12+this.extraSpeed;
      this.speed += throttle*18*dt;
      if(Input.brake) this.speed *= Math.pow(0.08, dt);
      this.speed *= Math.pow(0.42, dt);
      if(Math.abs(throttle)<0.06 && !Input.brake) this.speed *= Math.pow(0.22, dt);
      this.speed = clamp(this.speed, -4.5, maxSpd);

      const turn = steer * (1.55 - Math.min(Math.abs(this.speed)/maxSpd,1)*0.85);
      this.yaw += turn * this.speed * dt * 0.58;

      const fx=Math.sin(this.yaw), fz=Math.cos(this.yaw);
      this.player.position.x += fx*this.speed*dt;
      this.player.position.z += fz*this.speed*dt;

      if(Input.consumeHop() && this.grounded && this.hopCd<=0){
        this.vy=6.2; this.grounded=false; this.hopCd=this.hopMax(); SFX.hop();
      }
      this.vy -= 22*dt;
      this.player.position.y += this.vy*dt;
      const gh=this.groundH(this.player.position.x, this.player.position.z);
      if(this.player.position.y<=gh){ this.player.position.y=gh; if(this.vy<0) this.vy=0; this.grounded=true; }
      else this.grounded=false;

      this.player.position.x=clamp(this.player.position.x, -WORLD+2, WORLD-2);
      this.player.position.z=clamp(this.player.position.z, -WORLD+2, WORLD-2);

      for(let i=0;i<this.solids.length;i++){
        const s=this.solids[i];
        const dx=this.player.position.x-s.x, dz=this.player.position.z-s.z;
        const px=Math.abs(dx)-s.rx-0.65, pz=Math.abs(dz)-s.rz-0.65;
        if(px<0 && pz<0 && this.player.position.y<2.4){
          if(px>pz) this.player.position.x += Math.sign(dx||1)*(-px);
          else this.player.position.z += Math.sign(dz||1)*(-pz);
          this.speed*=0.4;
        }
      }
      for(let i=0;i<this.lavas.length;i++){
        const L=this.lavas[i];
        const d=Math.hypot(this.player.position.x-L.x, this.player.position.z-L.z);
        if(d<L.r && this.player.position.y<0.45) this.hurt(new THREE.Vector3(L.x,0,L.z), true);
      }

      this.player.rotation.y=this.yaw;
      this.player.rotation.z=lerp(this.player.rotation.z, -steer*0.2, 1-Math.exp(-8*dt));
      (this.player.userData.wheels||[]).forEach(w=>{ w.rotation.x -= this.speed*dt*2.6; });
    },

    itemsTick:function(dt){
      const t=now(), p=this.player.position;
      for(let i=0;i<this.items.length;i++){
        const it=this.items[i]; if(it.taken) continue;
        it.mesh.rotation.y += dt*2.4;
        it.mesh.position.y = it.baseY + this.groundH(it.mesh.position.x,it.mesh.position.z) + Math.sin(t*3+it.ph)*0.1;
        if(it.mesh.position.distanceTo(p)<1.45){
          it.taken=true; it.mesh.visible=false; this.got++; this.xp++;
          SFX.take(); this.toast("🍌");
          if(this.xp>=XP_NEED){ this.xp=0; this.lv++; SFX.lvl(); this.openUpgrades(); }
        }
      }
      if(!this.arena && this.got>=this.need && this.state==="play") this.win();
    },

    addEnemy:function(type,pos){
      const mesh= type==="waffle"? makeWaffle(): makeBun();
      const radius= type==="waffle"? 1.2: 1.15;
      const speed= type==="waffle"? 3.2+this.lv*0.2: 6.8+this.lv*0.28;
      mesh.position.copy(pos); mesh.position.y = type==="bun"?1:0;
      this.world.add(mesh);
      const dir=new THREE.Vector3().subVectors(this.player.position,pos); dir.y=0; if(dir.lengthSq()<0.01) dir.set(1,0,0); dir.normalize();
      this.enemies.push({mesh:mesh,type:type,radius:radius,speed:speed,dir:dir,lock:0});
    },
    spawn:function(dt){
      this.spawnT-=dt; if(this.spawnT>0) return;
      this.spawnT=Math.max(2.6, 6-this.lv*0.45);
      const a=Math.random()*Math.PI*2, r=WORLD-8;
      this.addEnemy(Math.random()<0.55?"waffle":"bun", new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));
    },
    enemyTick:function(dt){
      const p=this.player.position;
      for(let i=this.enemies.length-1;i>=0;i--){
        const e=this.enemies[i]; e.lock=Math.max(0,e.lock-dt);
        if(e.type==="waffle"){
          const to=this.tmp.subVectors(p,e.mesh.position); to.y=0;
          if(to.lengthSq()>0.01){ to.normalize(); e.mesh.position.x+=to.x*e.speed*dt; e.mesh.position.z+=to.z*e.speed*dt; e.mesh.rotation.y=Math.atan2(to.x,to.z); }
        } else {
          e.mesh.position.x+=e.dir.x*e.speed*dt; e.mesh.position.z+=e.dir.z*e.speed*dt; e.mesh.rotation.x+=e.speed*dt;
          if(Math.abs(e.mesh.position.x)>WORLD-1||Math.abs(e.mesh.position.z)>WORLD-1){ this.world.remove(e.mesh); this.enemies.splice(i,1); continue; }
        }
        if(e.mesh.position.distanceTo(p)<e.radius+0.75 && e.lock<=0){ e.lock=0.85; this.hurt(e.mesh.position,false); }
      }
    },

    hurt:function(from, lava){
      if(this.inv>0||this.state!=="play") return;
      this.hp -= lava? this.hp: 1;
      this.inv=1.05; this.shake=0.4; this.flash=0.18; SFX.hit();
      const dir=this.tmp.subVectors(this.player.position,from); dir.y=0;
      if(dir.lengthSq()<0.001) dir.set(0,0,-1); dir.normalize();
      this.player.position.x+=dir.x*1.3; this.player.position.z+=dir.z*1.3;
      this.speed*=-0.3; this.vy=3.2; this.grounded=false;
      this.toast(lava? "LAVA":"BONK");
      if(this.hp<=0){ if(this.arena){ this.state="respawn"; this.player.visible=false; this.toast("💥 DESTROYED — RESPAWNING..."); } else this.fail(); }
    },

    camTick:function(dt){
      const p=this.player.position;
      const back=10.2, h=4.6;
      const tx=p.x-Math.sin(this.yaw)*back, tz=p.z-Math.cos(this.yaw)*back;
      this.cam.lerp(new THREE.Vector3(tx, p.y+h, tz), 1-Math.exp(-3.4*dt));
      this.camera.position.copy(this.cam);
      if(this.shake>0){ this.camera.position.x+=(Math.random()-0.5)*this.shake; this.camera.position.y+=(Math.random()-0.5)*this.shake*0.4; }
      this.look.lerp(new THREE.Vector3(p.x+Math.sin(this.yaw)*5, p.y+1.0, p.z+Math.cos(this.yaw)*5), 1-Math.exp(-5*dt));
      this.camera.lookAt(this.look);
    },


    openUpgrades:function(){
      Input.reset();
      this.state="upgrade";
      const list=document.getElementById("upgrade-list");
      const sub=document.getElementById("upgrade-sub");
      if(sub) sub.textContent="LV "+this.lv+" — pick 1";
      const opts=[];
      if(!this.hasGun) opts.push({id:"gun", title:"BANANA BLASTER", desc:"unlock FIRE button"});
      else opts.push({id:"rapid", title:"RAPID FIRE", desc:"faster shots  "+this.fireRate.toFixed(2)+"s → "+Math.max(0.18,this.fireRate-0.12).toFixed(2)+"s"});
      opts.push({id:"hop", title:"FAST HOP", desc:"hop cooldown  "+this.hopMax().toFixed(1)+"s → "+Math.max(HOP_MIN,this.hopMax()-0.1).toFixed(1)+"s"});
      opts.push({id:"speed", title:"SPEED", desc:"cart goes faster"});
      if(this.hp<5) opts.push({id:"heart", title:"EXTRA HEART", desc:"heal + max heart"});
      list.innerHTML="";
      opts.forEach(o=>{
        const b=document.createElement("button");
        b.className="up-btn";
        b.innerHTML=o.title+"<small>"+o.desc+"</small>";
        b.onclick=()=>this.pickUpgrade(o.id);
        list.appendChild(b);
      });
      this.show("screen-upgrade");
    },
    pickUpgrade:function(id){
      if(id==="gun"){ this.hasGun=true; const fb=document.getElementById("btn-fire"); if(fb) fb.classList.remove("hidden"); this.toast("BLASTER ON"); }
      if(id==="rapid"){ this.fireRate=Math.max(0.18, this.fireRate-0.12); this.toast("RAPID FIRE"); }
      if(id==="hop"){ /* extra hop cut beyond level */ this.lv += 0; this._hopBonus=(this._hopBonus||0)+0.1; this.toast("FASTER HOP"); }
      if(id==="speed"){ this.extraSpeed+=2.2; this.toast("SPEED UP"); }
      if(id==="heart"){ this.maxHp=Math.min(5,this.maxHp+1); this.hp=Math.min(this.hp+1,this.maxHp); this.toast("HEART"); }
      this.state="play"; this.show(null);
    },
    tryShoot:function(){
      if(!this.hasGun) return;
      if(!(Input.fire || Input.consumeFire())) return;
      if(this.fireCd>0) return;
      this.fireCd=this.fireRate;
      SFX.shoot();
      const fx=Math.sin(this.yaw), fz=Math.cos(this.yaw);
      const mesh=outlined(new THREE.SphereGeometry(0.16,6,5),0xffe14a,1.14);
      mesh.position.set(this.player.position.x+fx*1.2, this.player.position.y+0.7, this.player.position.z+fz*1.2);
      this.world.add(mesh);
      this.shots.push({mesh:mesh, vx:fx*22, vz:fz*22, life:1.4});
    },
    shotTick:function(dt){
      for(let i=this.shots.length-1;i>=0;i--){
        const sh=this.shots[i];
        sh.life-=dt;
        sh.mesh.position.x+=sh.vx*dt;
        sh.mesh.position.z+=sh.vz*dt;
        sh.mesh.rotation.x+=dt*8;
        let hit=false;
        for(let j=this.enemies.length-1;j>=0;j--){
          const e=this.enemies[j];
          if(sh.mesh.position.distanceTo(e.mesh.position)<e.radius+0.35){
            this.world.remove(e.mesh); this.enemies.splice(j,1); hit=true; break;
          }
        }
        if(hit || sh.life<=0){ this.world.remove(sh.mesh); this.shots.splice(i,1); }
      }
    },
    win:function(){
      if(this.state!=="play") return; this.state="complete"; SFX.win();
      if(this.save.best==null || this.time<this.save.best){ this.save.best=this.time; writeSave(this.save); }
      document.getElementById("complete-stats").innerHTML="Time: "+fmt(this.time)+"<br>Bananas: "+this.got+"/"+this.need+"<br>Best: "+(this.save.best==null?"—":fmt(this.save.best));
      this.show("screen-complete");
    },
    fail:function(){
      this.state="fail"; SFX.dead();
      document.getElementById("fail-stats").innerHTML="Time: "+fmt(this.time)+"<br>Bananas: "+this.got+"/"+this.need;
      this.show("screen-fail");
    }
  };

  window.addEventListener("load", ()=>Game.init());
})();
