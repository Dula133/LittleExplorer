/* 场景：汽车（街景 + 昼夜） */
window.SCENES=window.SCENES||{};
(function(){
const WX=[1.44,-1.45],WY=.385,WZ=.80,TIRE_R=.385,SILL=.50,ARCH_R=.58,ARCH_CY=.40;// 轮拱开大一点，轮胎整个露在外面// 方盒子越野车：长 4.82、宽 1.93、高 1.97、轴距 2.89、离地高
const M=window.LECar;
if(!M?.createRuntime)throw new Error('Missing car module dependencies');
const {LAMP_MODES,TURN_MODES,RAIN_LEVELS,WIPER_MODES,GEAR_MODES}=M.modes;
const RAIN_PROFILES=M.RAIN_PROFILES;
const instances=new WeakMap();
const idleApi={S:{drive:false,nightT:0},now:()=>performance.now(),caption(){},sfx:{}};
let active=M.createRuntime(idleApi);
function runtimeFor(ctx,api,options={}){let r=instances.get(ctx);if(!r){r=M.createRuntime(api,options);instances.set(ctx,r);}if(!r.preview)active=r;return r;}
const facade=(key,names,constants={})=>Object.assign({},constants,Object.fromEntries(names.map(name=>[name,(...args)=>active[key][name](...args)])));
const lighting=facade('lighting',['setLampMode','setTurnMode','triggerBrake','setFogLight','getState'],{modes:{lamp:LAMP_MODES,turn:TURN_MODES}});
const weather=facade('weather',['setRainLevel','setWiperMode','demonstrateMist','getState'],{levels:RAIN_LEVELS,wiperModes:WIPER_MODES});
const controls=facade('controls',['setGearMode','setVolumeLevel','setMediaPage','setClimate','setMusic','setTemperature','setFanLevel','setDefog','setLocked','setSteering','setWindow','getState'],{gears:GEAR_MODES});
const LAMP_SEQUENCE=[LAMP_MODES.OFF,LAMP_MODES.POSITION,LAMP_MODES.HEADLIGHT];
const RAIN_SEQUENCE=[RAIN_LEVELS.NONE,RAIN_LEVELS.LIGHT,RAIN_LEVELS.MEDIUM,RAIN_LEVELS.HEAVY];
const WIPER_SEQUENCE=[WIPER_MODES.OFF,WIPER_MODES.SLOW,WIPER_MODES.FAST];
const nextIn=(value,sequence)=>sequence[(sequence.indexOf(value)+1)%sequence.length];
const lampFeedback={OFF:'灯关掉了。',POSITION:'现在只打开小灯。',HEADLIGHT:'前照灯亮了，小灯也继续亮着。'};
const rainFeedback={NONE:'雨停了。',LIGHT:'现在下小雨了。',MEDIUM:'雨变大了一些。',HEAVY:'现在是大雨，前面更难看清了。'};
const wiperFeedback={OFF:'雨刮器停下来了。',SLOW:'雨刮器开始慢慢摆动。',FAST:'雨刮器现在摆得更快了。'};
SCENES.car={
  id:'car',title:'汽车',subtitle:'越野车 · 拖一拖转圈，点零件听听',night:true,
  lighting,weather,controls,
  cockpitControls:{
    front:{name:'驾驶',view:'front',parts:['horn','steer','turnControlLeft','turnControlRight','start','gearControl','brakePedal','accelerator']},
    lighting:{name:'灯光',view:'front',parts:['lampKnob','hazard','fogControl','instruments']},
    weather:{name:'视野',view:'center',parts:['wiperControl','defogControl','rainControl','mistControl','dayNightControl']},
    center:{name:'中控',view:'center',parts:['screenMap','screenMusic','screenClimate','musicPlay','volumeControl','climateControl','temperatureDown','temperatureUp','fanControl']},
    left:{name:'左门',view:'left',parts:['doorHandleleft','windowleft','lockleft','speakerleft','belt','armrest','cupHolder']},
    right:{name:'右门',view:'right',parts:['doorHandleright','windowright','lockright','speakerright','seat']}
  },
  cockpitShortNames:{horn:'喇叭',steer:'方向盘',turnControlLeft:'左转',turnControlRight:'右转',start:'启动',gearControl:'档位',brakePedal:'刹车',accelerator:'油门',lampKnob:'车灯',hazard:'双闪',fogControl:'雾灯',instruments:'仪表',wiperControl:'雨刮',defogControl:'除雾',rainControl:'天气演示',mistControl:'起雾演示',dayNightControl:'昼夜',screenMap:'导航',screenMusic:'音乐',screenClimate:'空调屏',musicPlay:'播放',volumeControl:'音量',climateControl:'空调',temperatureDown:'温度 −',temperatureUp:'温度 +',fanControl:'风量',doorHandleleft:'开关门',doorHandleright:'开关门',windowleft:'车窗',windowright:'车窗',lockleft:'门锁',lockright:'门锁',speakerleft:'音响',speakerright:'音响',belt:'安全带',cupHolder:'杯架',armrest:'扶手',seat:'安全座椅'},
  driveFeedback(){return active.controls.driveFeedback();},
  cockpitStatus(){return active.controls.cockpitStatus();},
  /* 线性色彩 + 软阴影：车漆和镀铬件才有真实的高光过渡，不然像塑料玩具 */
  look:{srgb:true,hemi:.55,sun:.95,fill:.28,rim:.4,exposure:1.0,autoRotate:.10},
  sky:'linear-gradient(180deg,#7FBFFF 0%,#A9D4FF 28%,#D6ECFB 48%,#D6ECFB 100%)',
  fog:{color:0xD6ECFB,near:20,far:44},nightFog:0x2b4a7e,
  envMap:['#cfe0f0','#eef4fa','#b6bfc9','#8d97a2'],hemi:{sky:0xdfefff,ground:0x9fcf8a},
  fit:{w:6.6,h:5.6,ty:1.05,tyEx:1.95,rEx:1.28},cameraStart:{theta:.95,phi:1.12},
  order:['engine','tank','battery','shaft','wheels','exhaust','door','doorHandleleft','doorHandleright','windowleft','windowright','lockleft','lockright','speakerleft','speakerright','steer','horn','instruments','turnStalk','turnControlLeft','turnControlRight','lampKnob','hazard','rainControl','wiperControl','fogControl','start','gearControl','infotainment','screenMap','screenMusic','screenClimate','musicPlay','volumeControl','climateControl','temperatureDown','temperatureUp','fanControl','defogControl','mistControl','dayNightControl','cupHolder','armrest','brakePedal','accelerator','wiper','mirror','belt','seat','body','lights','positionLights','fogLights','turnLeft','turnRight','tail'],
  go:{on:'启动',off:'停止',stopSaid:'发动机停下啦',stopHint:'车停稳后再开门。',done:'发动机启动了。',doneHintXray:'P 档停车，选择 D 档才会前进。',doneHint:'P 档停车，进入驾驶舱试试档把。'},
  intro:{icon:'body',name:'汽车',text:'点车门可以开关门，点车灯开关它。驾驶舱的视野区还能演示白天和夜晚。'},
  poster:{title:'汽车里面到底长什么样',sub:'每天都坐，但你可能从没看过它的内部！',summary:'汽油 + 发动机 + 四个轮子一起转 = 哪儿都能去！',angle:{theta:.95,phi:1.15},keys:['engine','tank','battery','shaft','wheels','exhaust'],anchors:{wheels:[1.44,.385,.86],exhaust:[-1.9,.42,-.7],shaft:[0,.42,0],engine:[1.55,1.0,0]}},

  /* ---------- 街景：草地、马路、树、房子、路灯、云 ---------- */
  env(ctx,_api){
    const runtime=runtimeFor(ctx,_api),{state:C,api,now}=runtime;const {THREE,scene,V,flat,canvasTex,rngFactory}=ctx;
    const grassTex=canvasTex(512,512,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,w*.05,w/2,h/2,w/2);
      gr.addColorStop(0,'rgba(136,204,114,1)');gr.addColorStop(.75,'rgba(126,196,106,1)');gr.addColorStop(1,'rgba(126,196,106,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
    const ground=new THREE.Mesh(new THREE.CircleGeometry(34,72),new THREE.MeshStandardMaterial({map:grassTex,transparent:true,roughness:1,metalness:0}));
    ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    const strip=(rgb,len,wid,y,z)=>{const tex=canvasTex(1024,32,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,0);
        gr.addColorStop(0,`rgba(${rgb},0)`);gr.addColorStop(.1,`rgba(${rgb},1)`);gr.addColorStop(.9,`rgba(${rgb},1)`);gr.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=gr;g.fillRect(0,0,w,h);});
      const m=new THREE.Mesh(new THREE.PlaneGeometry(len,wid),new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:1}));m.rotation.x=-Math.PI/2;m.position.set(0,y,z);m.receiveShadow=true;scene.add(m);return m;};
    strip('104,112,124',60,3.4,.006,0);
    for(const z of [2.3,-2.3])strip('226,218,200',60,1.1,.02,z);
    for(const z of [1.5,-1.5])strip('244,246,249',56,.07,.012,z);
    for(const z of [1.76,-1.76]){const curb=new THREE.Mesh(new THREE.BoxGeometry(56,.08,.12),flat(0xd6d0c2));curb.position.set(0,.04,z);curb.receiveShadow=true;scene.add(curb);}
    const dashes=[];
    for(let i=0;i<22;i++){const d=new THREE.Mesh(new THREE.BoxGeometry(.9,.012,.13),new THREE.MeshStandardMaterial({color:0xF4F6F9,roughness:1,transparent:true}));d.position.set(-19.8+i*1.8,.014,0);d.receiveShadow=true;scene.add(d);dashes.push(d);}

    const env=new THREE.Group();scene.add(env);const scrollers=[],clouds=[],nightGlow=[];
    const rnd=rngFactory(20260904),GREENS=[0x5DBB63,0x4CA85A,0x7CC576,0x3F9A4E,0x8FD17A],trunkM=flat(0x8B5A2B),rndPick=a=>a[Math.floor(rnd()*a.length)];
    function tree(kind,sc){const g=new THREE.Group(),c=rndPick(GREENS);
      if(kind===0){const t=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,.9,7),trunkM);t.position.y=.45;g.add(t);
        const r=.65+rnd()*.25;const s1=new THREE.Mesh(new THREE.SphereGeometry(r,9,7),flat(c));s1.position.y=1.3;g.add(s1);
        const s2=new THREE.Mesh(new THREE.SphereGeometry(r*.7,8,6),flat(c));s2.position.set(.35,1.55,.2);g.add(s2);
        const s3=new THREE.Mesh(new THREE.SphereGeometry(r*.6,8,6),flat(c));s3.position.set(-.3,1.6,-.25);g.add(s3);}
      else{const t=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.7,7),trunkM);t.position.y=.35;g.add(t);
        for(const [r,h,y] of [[.75,1.3,1.2],[.55,1.1,1.9],[.35,.9,2.5]]){const k=new THREE.Mesh(new THREE.ConeGeometry(r,h,8),flat(c));k.position.y=y;g.add(k);}}
      g.traverse(o=>{if(o.isMesh)o.castShadow=true;});g.scale.setScalar(sc);g.rotation.y=rnd()*6.28;return g;}
    function bush(){const b=new THREE.Mesh(new THREE.SphereGeometry(.35+rnd()*.2,8,6),flat(rndPick(GREENS)));b.scale.y=.7;b.position.y=.22;b.castShadow=true;return b;}
    function house(){const g=new THREE.Group(),w=2.2+rnd(),d=1.8+rnd()*.6,h=1.4+rnd()*.5;
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),flat(rndPick([0xF6E7C8,0xF9D9C4,0xDDEBF7,0xFFF1CC])));body.position.y=h/2;g.add(body);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.78,.9,4),flat(0xC9564B));roof.position.y=h+.45;roof.rotation.y=Math.PI/4;g.add(roof);
      const door=new THREE.Mesh(new THREE.BoxGeometry(.4,.7,.05),trunkM);door.position.set(0,.35,d/2+.02);g.add(door);
      for(const x of [-w*.3,w*.3]){const wm=flat(0x9fd3ff,{roughness:.3,emissive:0xFFD27A,emissiveIntensity:0});const win=new THREE.Mesh(new THREE.BoxGeometry(.45,.4,.05),wm);win.position.set(x,h*.6,d/2+.02);g.add(win);nightGlow.push(n=>{wm.emissiveIntensity=1.5*n;});}
      g.traverse(o=>{if(o.isMesh)o.castShadow=true;});g.rotation.y=rnd()<.5?0:Math.PI;return g;}
    function hill(){const r=5+rnd()*6,m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),flat(rndPick([0x78BF6B,0x86C97A,0x6DB562])));m.scale.y=.35+rnd()*.15;m.position.y=-r*.05;return m;}
    function cloud(){const g=new THREE.Group(),m=flat(0xffffff,{transparent:true,opacity:.92}),n=3+Math.floor(rnd()*3);
      for(let i=0;i<n;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.6+rnd()*.7,8,6),m);s.position.set((i-n/2)*.9+rnd()*.3,rnd()*.3,rnd()*.4);s.scale.y=.6;g.add(s);}return g;}
    function reg(o){o.updateWorldMatrix(true,true);const sp=new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere());o.userData.r=sp.radius;o.userData.cy=sp.center.y-o.position.y;o.userData.s0=o.scale.x;o.userData.k=1;scrollers.push(o);}
    function scatter(make,count,zMin,zMax){for(let i=0;i<count;i++){const o=make(),sd=rnd()<.5?1:-1,x=-30+(i+rnd())*(60/count),z=sd*(zMin+rnd()*(zMax-zMin));o.position.set(x,o.position.y,z);env.add(o);reg(o);}}
    scatter(()=>tree(rnd()<.6?0:1,.9+rnd()*.5),34,3.6,11);scatter(bush,26,2.7,3.3);scatter(bush,10,4,9);scatter(house,5,9,14);
    const poolTex=canvasTex(128,128,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,225,160,1)');gr.addColorStop(.5,'rgba(255,225,160,.35)');gr.addColorStop(1,'rgba(255,225,160,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
    function streetLamp(side){const g=new THREE.Group(),pm=flat(0x4a5160,{metalness:.4,roughness:.6});
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,3.2,8),pm);pole.position.y=1.6;g.add(pole);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,.9),pm);arm.position.set(0,3.15,-side*.4);g.add(arm);
      const head=new THREE.Mesh(new THREE.BoxGeometry(.24,.1,.36),pm);head.position.set(0,3.12,-side*.85);g.add(head);
      const bm=flat(0xfff4c8,{emissive:0xFFE9A8,emissiveIntensity:0});const bulb=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),bm);bulb.position.set(0,3.03,-side*.85);g.add(bulb);
      const plm=new THREE.MeshBasicMaterial({map:poolTex,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});const pool=new THREE.Mesh(new THREE.PlaneGeometry(5.5,5.5),plm);pool.rotation.x=-Math.PI/2;pool.position.set(0,.03,-side*1.3);g.add(pool);
      nightGlow.push(n=>{bm.emissiveIntensity=2.6*n;plm.opacity=.7*n;});g.traverse(o=>{if(o.isMesh&&o!==pool)o.castShadow=true;});return g;}
    for(let i=0;i<5;i++){const side=i%2?1:-1,l=streetLamp(side);l.position.set(-24+i*12,0,side*2.95);env.add(l);l.userData.r=1.2;l.userData.cy=2;l.userData.s0=1;l.userData.k=1;scrollers.push(l);}
    for(let i=0;i<10;i++){const a=(i/10)*Math.PI*2+rnd()*.3;if(Math.abs(Math.sin(a))<.35)continue;const R=24+rnd()*6,h=hill();h.position.set(Math.cos(a)*R,h.position.y,Math.sin(a)*R);env.add(h);}
    for(let i=0;i<6;i++){const c=cloud();c.position.set(-26+i*9+rnd()*4,7+rnd()*3,(rnd()<.5?1:-1)*(6+rnd()*14));env.add(c);clouds.push(c);}
    return {occluders:scrollers,update(dt){
      for(const d of dashes){d.position.x-=C.motionW*TIRE_R*dt;if(d.position.x<-19.8)d.position.x+=39.6;d.material.opacity=THREE.MathUtils.clamp((19-Math.abs(d.position.x))/3,0,1);}
      if(C.motionW>.01){const dx=C.motionW*TIRE_R*dt;for(const o of scrollers){o.position.x-=dx;if(o.position.x<-30)o.position.x+=60;}}
      for(const c of clouds){c.position.x-=dt*.25;if(c.position.x<-28)c.position.x+=56;}
      const n=api.S.night;for(const f of nightGlow)f(n);
    }};
  },

  /* ---------- 汽车本体 ---------- */
  build(ctx,_api,options={}){
    const runtime=runtimeFor(ctx,_api,options);if(runtime.built)throw new Error("car already built for ctx");runtime.built=true;
    const {state:C,api,now,lighting,weather,controls,startLightReminder}=runtime,effectiveLampState=lighting.effectiveLampState;
    const {THREE,V,mm,roundedBox,capsule,tubeM,pathTube,loft,stationsX,canvasTex,steel,matte,flat,place,defPart,markShell,root}=ctx;
    /* 这一页用更实体的材质参数：清漆更亮、橡胶更哑、玻璃更深更透，
       配合 look.srgb 的线性色彩，看起来像模型店里的实体车，而不是塑料玩具。 */
    const paint=(c=0xbd1829)=>new THREE.MeshPhysicalMaterial({color:c,metalness:.2,roughness:.24,clearcoat:.7,clearcoatRoughness:.18,envMapIntensity:.9});
    const chrome=()=>new THREE.MeshStandardMaterial({color:0xd8dee5,metalness:.9,roughness:.3,envMapIntensity:.6});
    const dark=(c=0x222830)=>new THREE.MeshStandardMaterial({color:c,metalness:.05,roughness:.82});
    const glassMat=(c=0x75909c,op=.54)=>new THREE.MeshPhysicalMaterial({color:c,metalness:.12,roughness:.08,transparent:true,opacity:op,depthWrite:false,envMapIntensity:1.1});
    /* 车壳：方盒子一样的越野车 —— 全是平面和直角 */
    const shell=new THREE.Group(),tailLights=[],positionLamps=[],fogLamps=[],fogBeams=[],fogSpots=[],turnLamps={LEFT:[],RIGHT:[]},turnGroups={LEFT:[],RIGHT:[]};
    {
      const BELT=1.34,ROOF=1.97,GW=.93;                       // 窗台线 / 车顶 / 座舱半宽
      const CAB0=-1.95,CAB1=1.02,FLOOR=.62;
      // 下半身：一个笔直的大方盒（机盖也在这个高度），转角只留一点点圆
      const hullKeys=[
        {x:2.41,hw:.88,y0:.62,y1:1.30,rb:.05,rt:.05},{x:2.34,hw:.94,y0:.56,y1:1.32,rb:.04,rt:.04},{x:2.20,hw:.965,y0:SILL,y1:1.33,rb:.04,rt:.04},
        {x:1.60,hw:.965,y0:SILL,y1:1.34,rb:.04,rt:.04},{x:1.02,hw:.965,y0:SILL,y1:BELT,rb:.04,rt:.04},{x:-.60,hw:.965,y0:SILL,y1:BELT,rb:.04,rt:.04},
        {x:-1.90,hw:.965,y0:SILL,y1:BELT,rb:.04,rt:.04},{x:-2.24,hw:.965,y0:SILL,y1:BELT-.01,rb:.04,rt:.04},{x:-2.34,hw:.94,y0:.56,y1:BELT-.02,rb:.04,rt:.04},
        {x:-2.41,hw:.88,y0:.62,y1:1.30,rb:.05,rt:.05}];
      const arch=(x,st)=>{for(const xw of WX){const dx=x-xw;if(Math.abs(dx)<ARCH_R){const a=ARCH_CY+Math.sqrt(ARCH_R*ARCH_R-dx*dx);if(a>st.y0)st.y0=a;}}
        if(x>CAB0&&x<CAB1){st.y1=Math.max(FLOOR,st.y0+.05);st.rt=.03;}return st;};// 座舱段只留地板，能看见里面
      shell.add(loft(hullKeys,stationsX(2.41,-2.41,.06,WX.map(x=>[x,ARCH_R+.02,.02]).concat([[CAB0,.03,.01],[CAB1,.03,.01]])),paint(),{adjust:arch}));
      for(const sd of [1,-1]){
        for(const [x,y] of [[.98,1.26],[.98,.78],[-.42,1.26],[-.42,.78]]){const hg=roundedBox(.09,.09,.06,.02,dark(0x2b2f38));hg.position.set(x,y,sd*.965);shell.add(hg);}// 露在外面的门铰链
        const step=roundedBox(1.86,.09,.16,.03,dark(0x262b35));step.position.set(-.05,.52,sd*.95);shell.add(step);          // 侧踏板：只在前后轮之间，插进轮胎会闪
        for(const xw of WX){const liner=mm(new THREE.CylinderGeometry(ARCH_R-.05,ARCH_R-.05,.62,20,1,false,Math.PI/2,Math.PI),dark(0x14171d));
          liner.rotation.x=Math.PI/2;liner.position.set(xw,ARCH_CY,sd*.55);liner.castShadow=false;shell.add(liner);}// 往里收，别贴到车门内表面
      }
      const mat=roundedBox(CAB1-CAB0-.1,.03,1.8,.01,matte(0x3a3f4a));mat.position.set((CAB0+CAB1)/2,FLOOR+.015,0);mat.castShadow=false;shell.add(mat);
      /* 座舱：整块钣金冲出来，窗户是抠出来的洞，所以立柱天生是车身的一部分 */
      const sidePanel=()=>{const sh=new THREE.Shape();
        sh.moveTo(1.02,BELT);sh.lineTo(.70,ROOF);sh.lineTo(-2.0,ROOF);sh.lineTo(-2.0,BELT);sh.closePath();
        for(const pts of [[[.86,1.40],[.62,1.90],[-.42,1.90],[-.42,1.40]],           // 前门窗
                          [[-.50,1.40],[-.50,1.90],[-1.66,1.90],[-1.66,1.40]],       // 后门窗
                          [[-1.74,1.40],[-1.74,1.90],[-1.94,1.90],[-1.94,1.40]]]){   // 后角窗
          const h=new THREE.Path();h.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)h.lineTo(pts[i][0],pts[i][1]);h.closePath();sh.holes.push(h);}
        return mm(new THREE.ExtrudeGeometry(sh,{depth:.05,bevelEnabled:false,curveSegments:1}),paint());};
      for(const s of [1,-1]){const sp=sidePanel();sp.position.z=s>0?GW-.05:-GW;shell.add(sp);}
      const roof=roundedBox(2.72,.07,GW*2,.02,paint());roof.position.set(-.65,ROOF-.035,0);shell.add(roof);
      for(const s of [1,-1]){const rail=roundedBox(2.5,.05,.07,.02,dark(0x2b2f38));rail.position.set(-.7,ROOF+.04,s*.78);shell.add(rail);}// 车顶行李架
      // 玻璃：前挡（很立）、后挡（竖直）、六块侧窗
      const pane=(x0,y0,x1,y1,w,thick)=>{const dx=x1-x0,dy=y1-y0,L=Math.hypot(dx,dy);
        const m=mm(new THREE.BoxGeometry(thick,L,w),glassMat());m.position.set((x0+x1)/2,(y0+y1)/2,0);
        m.rotation.z=Math.atan2(dy,dx)-Math.PI/2;m.castShadow=false;m.userData.glass=true;return m;};
      shell.add(pane(1.0,BELT+.04,.72,ROOF-.05,GW*2-.16,.05));       // 前挡风
      shell.add(pane(-1.99,BELT+.04,-1.99,ROOF-.05,GW*2-.16,.05));   // 后挡风（竖直）
      for(const s of [1,-1])for(const [x0,x1] of [[-1.76,-1.92]]){// 后角窗固定在车身上，两块车门玻璃跟着门走
        const w=mm(new THREE.BoxGeometry(x0-x1,.48,.02),glassMat());
        w.position.set((x0+x1)/2,1.65,s*(GW-.055));w.castShadow=false;w.userData.glass=true;shell.add(w);}
      /* 车头：直上直下的格栅面 + 圆大灯 + 立在翼子板上的转向灯 */
      const grille=roundedBox(.06,.44,1.42,.03,dark(0x14171d));grille.position.set(2.45,1.04,0);shell.add(grille);
      for(const y of [.90,1.04,1.18]){const bar=mm(new THREE.BoxGeometry(.02,.02,1.38),dark(0x3c444c));bar.position.set(2.475,y,0);bar.castShadow=false;shell.add(bar);}
      for(const y of [.845,.97,1.095,1.225]){const bar=mm(new THREE.BoxGeometry(.017,.017,.97),dark(0x3c444c));bar.position.set(2.476,y,0);bar.castShadow=false;shell.add(bar);}
      const gpost=mm(new THREE.BoxGeometry(.02,.42,.06),chrome());gpost.position.set(2.475,1.04,0);gpost.castShadow=false;shell.add(gpost);
      // 前后保险杠 + 车牌
      for(const [x,y] of [[2.46,.68],[-2.46,.72]]){const b=roundedBox(.12,.24,1.86,.03,dark(0x262b35));b.position.set(x,y,0);shell.add(b);}
      const plate=mm(new THREE.BoxGeometry(.016,.13,.4),matte(0xf5f5f0));plate.position.set(2.52,.68,0);plate.castShadow=false;shell.add(plate);
      // 后门上的备胎（越野车的标志）
      const spare=new THREE.Group();
      {const t=mm(new THREE.TorusGeometry(.33,.10,14,32),dark(0x1c1f25));spare.add(t);                                   // 轮胎（在 xy 平面，正面朝 z）
       const face=mm(new THREE.CylinderGeometry(.24,.24,.12,26),dark(0x2b2f38));face.rotation.x=Math.PI/2;spare.add(face);// 轮芯，和轮胎同一个朝向
       const cover=mm(new THREE.CylinderGeometry(.30,.30,.06,26),paint());cover.rotation.x=Math.PI/2;cover.position.z=.09;spare.add(cover);
       spare.position.set(-2.50,1.15,.10);spare.rotation.y=-Math.PI/2;shell.add(spare);}                                   // 整只转 90°，正面朝车后
      markShell(shell);place(shell,V(0,0,0),V(0,2.7,0));
    }

    defPart('body',{name:'车身',more:'车身像一个方盒子，又高又方，坐得高看得远，后门上还挂着一个备胎。车身是硬壳，撞到东西时前后会先压扁一点，把力气吃掉。',outside:true,text:'方方正正的大盒子，坐得高、看得远，后面还背着一个备胎。'},[shell]);

    /* 车门：点一下就开，再点一下就关 */
    const doorPivots=[],doorExtras=[],frontWindows=[],speakerFaces=[];let driverDoor=null;
    const toggleDoor=pv=>controls.toggleDoor(pv);
    const doorButton=(parent,x,y,z,color)=>{
      const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
      const face=roundedBox(.15,.08,.045,.016,matte(color));face.castShadow=false;g.add(face);
      const proxy=mm(new THREE.BoxGeometry(.22,.14,.075),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));proxy.userData.touchProxy=true;g.add(proxy);return g;
    };
    for(const sd of [1,-1])for(const [hx,x1,wx0,wx1] of [[.98,-.36,.84,-.44],[-.42,-1.72,-.52,-1.68]]){
      const pv=new THREE.Group();
      /* 后轮正好在后门下面，直上直下的方门会把轮胎盖掉一截。门板下沿按轮胎半径 +4cm
         裁一道弧绕开它——轮子整个露出来，门形只浅浅缺一口，不至于被啃成 C 形。
         前门离前轮够远（.98 到 1.44 差 .46 > .43），算下来不会被裁到。 */
      const DY0=.62,DY1=1.34,RT=TIRE_R+.045;
      const yAt=wx=>{let y=DY0;for(const cx of WX){const d=RT*RT-(wx-cx)*(wx-cx);if(d>0)y=Math.max(y,WY+Math.sqrt(d));}return Math.min(y,DY1-.35);};
      const xa=x1-hx,N=36,sh=new THREE.Shape();
      sh.moveTo(xa,yAt(x1));
      for(let i=1;i<=N;i++){const lx=xa-xa*i/N;sh.lineTo(lx,yAt(lx+hx));}
      sh.lineTo(0,DY1);sh.lineTo(xa,DY1);sh.closePath();
      const panel=mm(new THREE.ExtrudeGeometry(sh,{depth:.026,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,steps:1,curveSegments:1}),paint());
      panel.position.z=-.013;pv.add(panel);
      const h=roundedBox(.16,.05,.05,.015,chrome());h.position.set(x1-hx+.22,1.16,sd*.02);pv.add(h);        // 门把手
      const gy=yAt(x1);
      const gap=mm(new THREE.BoxGeometry(.012,DY1-gy,.012),dark(0x4a3236));gap.position.set(x1-hx-.01,(DY1+gy)/2,sd*.012);gap.castShadow=false;pv.add(gap);
      const w=mm(new THREE.BoxGeometry(wx0-wx1,.48,.02),glassMat());                            // 车窗跟着门一起开
      w.position.set((wx0+wx1)/2-hx,1.65,-sd*.035);w.castShadow=false;w.userData.glass=true;pv.add(w);
      for(const [dx,dy,ww,hh] of [[0,-.26,wx0-wx1+.05,.05],[(wx0-wx1)/2,0,.05,.52],[-(wx0-wx1)/2,0,.05,.52]]){// 车窗四周的细门框
        const f=roundedBox(ww,hh,.035,.012,paint());f.position.set((wx0+wx1)/2-hx+dx,1.65+dy,-sd*.035);f.castShadow=false;pv.add(f);}
      markShell(pv);// 看里面时车门跟车身一起变半透明
      // 内饰属于同一扇门，随铰链和拆开偏移一起移动；不加入透视外壳列表。
      const inner=new THREE.Group();inner.userData.carInterior='door';
      const cx=(x1-hx)/2,inside=-sd;
      const lining=roundedBox(1.08,.40,.055,.04,dark(0x27323f));lining.position.set(cx,1.02,inside*.065);inner.add(lining);
      const insert=roundedBox(.74,.18,.025,.03,matte(0xB89C79));insert.position.set(cx,1.08,inside*.105);inner.add(insert);
      const armrest=roundedBox(.70,.065,.14,.025,dark(0x182431));armrest.position.set(cx,1.01,inside*.16);inner.add(armrest);
      const innerHandle=roundedBox(.19,.045,.035,.012,chrome());innerHandle.position.set(cx+.27,1.18,inside*.115);inner.add(innerHandle);
      const pocket=roundedBox(.58,.11,.08,.02,dark(0x131e28));pocket.position.set(cx,.83,inside*.105);inner.add(pocket);
      const speaker=mm(new THREE.CylinderGeometry(.065,.065,.014,12),dark(0x506070));speaker.rotation.x=Math.PI/2;speaker.position.set(cx-.36,.89,inside*.105);speaker.castShadow=false;inner.add(speaker);
      pv.add(inner);
      if(hx>0){
        const side=sd<0?'left':'right';w.userData.windowLevel=0;w.userData.windowK=0;w.userData.windowSide=side;frontWindows.push(w);
        const windowButton=doorButton(inner,cx+.10,1.10,inside*.23,0x609EB6);
        const lockButton=doorButton(inner,cx-.17,1.10,inside*.23,0xC1A76B);
        const glyph=(parent,kind)=>{const tex=canvasTex(128,96,(g,W,H)=>{g.strokeStyle='#EAF5FA';g.fillStyle='#EAF5FA';g.lineWidth=7;if(kind==='window'){g.strokeRect(25,18,78,40);g.beginPath();g.moveTo(40,75);g.lineTo(64,60);g.lineTo(88,75);g.stroke();}else{g.strokeRect(37,45,54,36);g.beginPath();g.arc(64,43,19,Math.PI,0);g.stroke();}});const m=mm(new THREE.PlaneGeometry(.125,.065),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.position.z=inside*.027;m.castShadow=false;parent.add(m);};glyph(windowButton,'window');glyph(lockButton,'lock');
        const handleGroup=new THREE.Group();inner.remove(innerHandle);handleGroup.add(innerHandle);inner.add(handleGroup);
        const handleHit=mm(new THREE.BoxGeometry(.27,.14,.08),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));handleHit.position.copy(innerHandle.position);handleHit.userData.touchProxy=true;handleGroup.add(handleHit);
        const speakerGroup=new THREE.Group();inner.remove(speaker);speakerGroup.add(speaker);inner.add(speakerGroup);speaker.scale.setScalar(1.55);speaker.userData.keepEm=true;speakerFaces.push(speaker);
        for(let i=0;i<5;i++){const bar=mm(new THREE.BoxGeometry(.13,.006,.008),matte(0x9AAABA));bar.position.set(cx-.36,.856+i*.017,inside*.128);speakerGroup.add(bar);}
        const speakerHit=mm(new THREE.BoxGeometry(.24,.22,.09),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));speakerHit.position.copy(speaker.position);speakerHit.userData.touchProxy=true;speakerGroup.add(speakerHit);
        doorExtras.push({pv,inner,side,windowButton,lockButton,handleGroup,speakerGroup});
        for(const g of [windowButton,lockButton,handleGroup,speakerGroup])inner.remove(g);
      }
      pv.userData.sd=sd;pv.userData.doorPivot=true;pv.userData.driverDoor=sd<0&&hx>0;pv.userData.open=0;pv.userData.k=0;if(pv.userData.driverDoor)driverDoor=pv;doorPivots.push(pv);place(pv,V(hx,0,sd*.945),V(0,.15,sd*1.8));
    }
    defPart('door',{name:'车门',outside:true,immediate:true,more:'车门靠前面的铰链转开，里面有防撞钢梁。上车前要看看后面有没有来车，再慢慢推开门。',
      text:'点一下，车门就打开啦！上车下车都要开门关门。',
      action(hit){
        if(hit){let o=hit;while(o&&!o.userData.doorPivot)o=o.parent;if(o){toggleDoor(o);return;}}
        toggleDoor(driverDoor);
      }},doorPivots);
    controls.bindVehicle({doorPivots,frontWindows,driverDoor});
    for(const d of doorExtras){
      const {side,pv,inner,windowButton,lockButton,handleGroup,speakerGroup}=d;
      for(const g of [windowButton,lockButton,handleGroup,speakerGroup])inner.add(g);
      defPart('window'+side,{name:(side==='left'?'左':'右')+'车窗按钮',outside:true,immediate:true,text:'按一下，玻璃往下收，再按可以关上。',more:'关闭、半开、全开。玻璃始终在原车门铰链内运动，门框保持不动。',pickText(){return ['车窗关上了。','车窗打开一半。','车窗打开了。'][(controls.getState().windows[side]+1)%3];},action(){controls.setWindow(side,(controls.getState().windows[side]+1)%3);}},[windowButton]);
      defPart('doorHandle'+side,{name:(side==='left'?'驾驶员':'乘客')+'门把手',outside:true,immediate:true,text:'车停稳，看看外面，再开门。',more:'门锁锁住时先解锁；汽车移动时不能开门。',pickText(){return controls.getState().moving?'汽车正在走，停稳后再开门。':C.locked&&!pv.userData.open?'门锁着，先按门锁解锁。':pv.userData.open?'车门关上了。':'看看外面，车门打开了。';},action(){toggleDoor(pv);}},[handleGroup]);
      defPart('speaker'+side,{name:'门板音响喇叭',outside:true,immediate:true,text:'音乐从这里传出来。它和方向盘的提醒喇叭不一样。',more:'点击可以播放或暂停演示音乐，音量旋钮只控制音乐。',pickText(){return C.musicPlaying?'音乐暂停了。':'音乐从门板音响传出来了。';},action(){controls.setMusic(!C.musicPlaying);}},[speakerGroup]);
      defPart('lock'+side,{name:'门锁按钮',outside:true,immediate:true,more:'锁住车门可防止意外开门；不改变已经打开的门。',pickText(){return C.locked?'车门解锁了。':'车门锁好了。';},action(){controls.setLocked(!C.locked);}},[lockButton]);
    }

    /* 尾灯（刹车时亮红） */
    const tailG=new THREE.Group();
    for(const z of [.80,-.80]){const side=z<0?TURN_MODES.LEFT:TURN_MODES.RIGHT,t=roundedBox(.05,.34,.20,.02,new THREE.MeshStandardMaterial({color:0xE04848,emissive:0xE04848,emissiveIntensity:.5,roughness:.3}));
      t.position.set(-2.47,1.10,z);t.userData.keepEm=true;t.userData.carLamp=`brake-${side.toLowerCase()}`;tailG.add(t);tailLights.push(t);
      const amber=roundedBox(.055,.11,.20,.02,new THREE.MeshStandardMaterial({color:0xF2A03C,emissive:0xF2A03C,emissiveIntensity:.35,roughness:.3}));
      amber.position.set(-2.472,1.24,z);amber.userData.keepEm=true;amber.userData.suppressSelectGlowWhenOff=true;amber.userData.carLamp=`turn-${side.toLowerCase()}-rear`;const turnG=new THREE.Group();turnG.add(amber);place(turnG,V(0,0,0),V(-2.1,.7,side===TURN_MODES.LEFT?-.35:.35));turnGroups[side].push(turnG);turnLamps[side].push(amber);
      const rim=roundedBox(.04,.40,.25,.01,dark(0x262b35));rim.position.set(-2.45,1.10,z);tailG.add(rim);}
    place(tailG,V(0,0,0),V(-2.1,.7,0));
    defPart('tail',{immediate:true,name:'刹车灯',more:'踩刹车时，车尾两边的红灯会一起变亮，松开以后恢复原来的亮度。',outside:true,text:'刹车时，后面的红灯会变亮，提醒后面的车：我正在减速。',action(){lighting.triggerBrake();}},[tailG]);

    /* 轮子 */
    const wheelsG=new THREE.Group(),wheelSpin=[],frontYaw=[],wheelYaws=[];
    /* 轮胎用 Lathe 车出断面：胎肩、胎侧、胎唇都有实际厚度；胎纹是一圈 InstancedMesh 小块。
       轮圈的辐条/螺栓/中心盖都收在胎唇（半径 .222）以内，不会和胎面重叠闪烁。 */
    const tireGeo=new THREE.LatheGeometry(
      [[.241,-.105],[.278,-.12],[.336,-.12],[.369,-.101],[.384,-.062],[.384,.062],[.369,.101],[.336,.12],[.278,.12],[.241,.105],[.241,-.105]]
        .map(([r,z])=>new THREE.Vector2(r,z)),64);
    tireGeo.rotateX(Math.PI/2);
    const treadGeo=new THREE.BoxGeometry(.042,.012,.068),_tm=new THREE.Object3D();
    for(const x of WX)for(const sw of [1,-1]){
      const z=sw*WZ,sd=sw;
      const yaw=new THREE.Group(),spin=new THREE.Group();yaw.scale.z=1.1;
      spin.add(mm(tireGeo,dark(0x262a2e)));                                                                          // 胎体
      const bore=mm(new THREE.CylinderGeometry(.237,.237,.17,40),dark(0x454c53));bore.rotation.x=Math.PI/2;spin.add(bore);
      const lip=mm(new THREE.TorusGeometry(.222,.014,10,48),chrome());lip.position.z=sd*.106;spin.add(lip);          // 轮圈外沿
      for(let k=0;k<5;k++){const a2=k*Math.PI*2/5;                                                                   // 五根辐条
        const sp=roundedBox(.054,.248,.028,.008,chrome());sp.rotation.z=a2-Math.PI/2;
        sp.position.set(Math.cos(a2)*.102,Math.sin(a2)*.102,sd*.105);spin.add(sp);
        const bolt=mm(new THREE.CylinderGeometry(.012,.012,.022,10),chrome());bolt.rotation.x=Math.PI/2;
        bolt.position.set(Math.cos(a2)*.052,Math.sin(a2)*.052,sd*.13);spin.add(bolt);}
      const cap=mm(new THREE.CylinderGeometry(.047,.047,.045,24),chrome());cap.rotation.x=Math.PI/2;cap.position.z=sd*.12;spin.add(cap);
      const rim=mm(new THREE.TorusGeometry(.298,.003,6,64),dark(0x34383c));rim.position.z=sd*.121;spin.add(rim);     // 胎侧那圈细线
      const treads=new THREE.InstancedMesh(treadGeo,dark(0x202429),80);treads.castShadow=true;treads.userData.noHit=true;
      for(let i=0;i<80;i++){const a2=(i%40)*Math.PI*2/40+(i<40?0:.055);
        _tm.position.set(Math.cos(a2)*.383,Math.sin(a2)*.383,i<40?-.043:.043);
        _tm.rotation.set(0,0,a2-Math.PI/2);_tm.updateMatrix();treads.setMatrixAt(i,_tm.matrix);}
      treads.instanceMatrix.needsUpdate=true;spin.add(treads);
      yaw.add(spin);wheelsG.add(yaw);wheelSpin.push(spin);wheelYaws.push(yaw);if(x>0)frontYaw.push(yaw);
      place(yaw,V(x,WY,z),V(0,0,sw*.9));
    }
    defPart('wheels',{name:'轮子',more:'轮子外面是橡胶轮胎，软软的抓得住地面；里面充着气，所以坐车不颠。四个轮子都会使劲，这叫四驱。',outside:true,hopTargets:wheelYaws,text:'四个轮子转呀转，车子就往前跑。',action(){C.wheelUntil=now()+3500;}},[wheelsG]);

    /* 传动轴 */
    const driveG=new THREE.Group(),axles=[];
    for(const x of WX){const a=mm(new THREE.CylinderGeometry(.05,.05,1.7,10),steel());a.rotation.x=Math.PI/2;const g=new THREE.Group();g.add(a);g.position.set(x,WY,0);driveG.add(g);axles.push(g);}
    // 四驱：发动机 → 变速箱 → 分动箱 → 前后各一根传动轴，四个轮子一起使劲
    const shaftG=new THREE.Group();shaftG.position.set(0,.44,0);
    {for(const [cx,len] of [[-.85,1.5],[.78,1.0]]){const a=mm(new THREE.CylinderGeometry(.05,.05,len,10),steel(0xb7bec8));a.rotation.z=Math.PI/2;a.position.x=cx;shaftG.add(a);
       const stripe=mm(new THREE.BoxGeometry(len-.2,.03,.05),matte(0xFF6B6B));stripe.position.set(cx,.055,0);shaftG.add(stripe);
       for(const e of [-1,1]){const j=mm(new THREE.SphereGeometry(.07,14,10),steel());j.position.x=cx+e*len/2;shaftG.add(j);}}}
    const gearbox=roundedBox(.6,.34,.36,.06,steel(0x525a68));gearbox.position.set(.75,.56,0);driveG.add(gearbox);
    const tcase=roundedBox(.34,.30,.30,.05,steel(0x6b7280));tcase.position.set(.32,.47,0);driveG.add(tcase);// 分动箱：把力气分给前后
    for(const x of WX){const diff=mm(new THREE.SphereGeometry(.14,16,12),steel(0x525a68));diff.position.set(x,WY,.06);driveG.add(diff);}
    driveG.add(shaftG);place(driveG,V(0,0,0),V(0,.50,0));
    defPart('shaft',{name:'传动轴',more:'越野车是四驱：发动机的力气先进变速箱，再进「分动箱」，分动箱把力气分成两份，前面一根传动轴、后面一根传动轴，四个轮子一起使劲，所以有一个轮子打滑也还能爬出来。',text:'力气分成两份，顺着前后两根轴，交给四个轮子一起使劲。',action(){C.shaftUntil=now()+3500;C.wheelUntil=now()+3500;}},[driveG]);

    /* 发动机 */
    const engine=new THREE.Group(),pistons=[],PIST_Y=.42,PIST_AMP=.04;let fan;
    {
      engine.add(roundedBox(.86,.52,.72,.06,steel(0x454c5a)));
      const head=roundedBox(.78,.14,.56,.04,paint(0xb8262e));head.position.y=.33;engine.add(head);
      for(let i=0;i<6;i++){const p=mm(new THREE.CylinderGeometry(.055,.055,.1,14),chrome());p.position.set(-.3+i*.12,PIST_Y,0);engine.add(p);pistons.push(p);}// 六个活塞站着，一个接一个
      const belt=mm(new THREE.TorusGeometry(.12,.014,8,28),dark());belt.rotation.y=Math.PI/2;belt.position.set(.45,0,0);engine.add(belt);
      const pulley=mm(new THREE.CylinderGeometry(.1,.1,.04,20),steel());pulley.rotation.z=Math.PI/2;pulley.position.set(.46,0,0);engine.add(pulley);
      const alt=mm(new THREE.CylinderGeometry(.07,.07,.12,16),steel(0x8a919c));alt.rotation.z=Math.PI/2;alt.position.set(.42,.16,.24);engine.add(alt);
      const rad=roundedBox(.05,.5,.95,.02,dark(0x22262e));rad.position.set(.66,.05,0);engine.add(rad);
      fan=new THREE.Group();fan.position.set(.57,.04,0);
      for(let k=0;k<4;k++){const b=mm(new THREE.BoxGeometry(.016,.15,.05),matte(0x3a4150));b.rotation.x=k*Math.PI/2;b.position.set(0,Math.cos(k*Math.PI/2)*.085,Math.sin(k*Math.PI/2)*.085);fan.add(b);}
      const hub=mm(new THREE.CylinderGeometry(.035,.035,.035,12),steel());hub.rotation.z=Math.PI/2;fan.add(hub);engine.add(fan);
      place(engine,V(1.55,.78,0),V(1.3,1.9,0));
    }
    defPart('engine',{name:'发动机',more:'越野车的发动机很大，六个活塞站成一排轮流干活，力气特别大，才拖得动这么重的车爬坡。旁边那块黑黑的是水箱，帮发动机降温。',text:'发动机是汽车的心脏，六个活塞上上下下，突突突地转。',
      action(){C.engineUntil=now()+3600;C.puffUntil=now()+3600;C.shaftUntil=now()+3600;}},[engine]);

    /* 电池 */
    const battery=new THREE.Group();
    {
      battery.add(roundedBox(.3,.22,.2,.03,dark(0x1b1e25)));
      for(const x of [-.08,.08]){const t=mm(new THREE.CylinderGeometry(.025,.025,.04,12),chrome());t.position.set(x,.13,0);battery.add(t);}
      const capR=mm(new THREE.CylinderGeometry(.03,.03,.016,12),matte(0xE04848));capR.position.set(.08,.158,0);battery.add(capR);
      const lbl=mm(new THREE.BoxGeometry(.17,.08,.004),matte(0x4CC38A));lbl.position.set(0,.01,.103);lbl.castShadow=false;battery.add(lbl);
      battery.add(tubeM(V(.08,.16,0),V(-.3,-.02,-.5),.016,matte(0xE04848)));
      place(battery,V(1.95,.95,.66),V(1.2,1.9,1.05));// 电池放在发动机旁边，不埋进缸体
    }
    defPart('battery',{name:'电池',more:'电池给车灯、喇叭、收音机供电，也负责把发动机叫醒。车开起来以后，发电机会给它充电。',text:'小电池管电：让车灯亮起来，让喇叭叭叭叫。',action(){C.lightsUntil=now()+3500;setTimeout(()=>api.sfx.horn(),350);}},[battery]);

    /* 油箱 + 油管 */
    const tank=new THREE.Group();
    {
      tank.add(capsule(.13,.5,matte(0xE88E1A)));
      const band=mm(new THREE.CylinderGeometry(.135,.135,.05,20),dark(0x2b2f38));band.rotation.z=Math.PI/2;tank.add(band);
      const cap=mm(new THREE.CylinderGeometry(.05,.05,.04,12),dark());cap.position.set(-.12,.13,.04);tank.add(cap);
      tank.add(tubeM(V(.25,0,0),V(2.32,.46,-.16),.022,matte(0xb86b00)));
      place(tank,V(-.95,.40,.26),V(-.90,.80,1.10));// 油箱在后排地板下面
    }
    defPart('tank',{name:'油箱',more:'越野车的油箱又大又厚，藏在后座下面，跑很远也不怕没油。油泵把汽油顺着车底的管子一路送到车头的发动机。',text:'油箱是汽车的肚子。汽油顺着长长的管子，送到前面的发动机。',action(){C.fuelUntil=now()+4000;}},[tank]);
    const FUEL_A=V(-.65,.42,.24),FUEL_B=V(1.35,.86,.1),fuelDots=[];
    for(let i=0;i<6;i++){const d=mm(new THREE.SphereGeometry(.04,10,8),new THREE.MeshStandardMaterial({color:0xFFB020,emissive:0xFFB020,emissiveIntensity:.7}));d.castShadow=false;d.scale.setScalar(0);root.add(d);fuelDots.push(d);}

    /* 排气管 + 烟 */
    const exhaust=new THREE.Group(),PUFF_AT=V(-2.0,.46,-.86);
    {
      exhaust.add(pathTube([V(1.5,.55,-.3),V(.8,.46,-.42),V(-.5,.42,-.5),V(-1.2,.52,-.62),V(-1.62,.52,-.72),V(-1.9,.44,-.82)],.038,steel(0x7c8590)));// 后桥这一段抬高，从桥上面绕过去
      const muf=capsule(.1,.6,steel(0x9aa2ad),16);muf.position.set(-.85,.44,-.54);exhaust.add(muf);
      const tip=mm(new THREE.CylinderGeometry(.055,.055,.18,14),chrome());tip.rotation.z=Math.PI/2;tip.position.set(-1.98,.44,-.84);exhaust.add(tip);
      place(exhaust,V(0,0,0),V(-.40,.65,-.90));
    }
    defPart('exhaust',{name:'排气管',more:'越野车的排气管从车底一路走到后轮前面，从侧面出来，这样过水坑时不容易灌水。中间有消音器把声音变小，还有净化器把废气变干净。',text:'发动机吃完饭会打嗝，从排气管噗噗噗冒出烟来。',action(){C.puffUntil=now()+3200;}},[exhaust]);
    const puffs=[];
    for(let i=0;i<12;i++){const p=mm(new THREE.SphereGeometry(.12,10,8),new THREE.MeshStandardMaterial({color:0xC9CFDB,transparent:true,opacity:0,depthWrite:false,roughness:1}));p.castShadow=false;p.visible=false;p.userData.life=0;root.add(p);puffs.push(p);}

    /* 前照灯、位置灯、转向灯与近距离前雾灯 */
    const lightsG=new THREE.Group(),positionG=new THREE.Group(),fogG=new THREE.Group(),lamps=[],beams=[],spots=[];
    for(const z of [.68,-.68]){const side=z<0?TURN_MODES.LEFT:TURN_MODES.RIGHT;
      const l=mm(new THREE.CylinderGeometry(.17,.17,.06,22),new THREE.MeshPhysicalMaterial({color:0xFFF6D5,emissive:0xFFD740,emissiveIntensity:0,roughness:.1,metalness:.1,clearcoat:1}));
      l.rotation.z=Math.PI/2;l.position.set(2.46,1.04,z);l.userData.keepEm=true;l.userData.suppressSelectGlowWhenOff=true;l.userData.carLamp=`headlight-${side.toLowerCase()}`;lightsG.add(l);lamps.push(l);// 圆圆的大灯，嵌在平平的车头上
      const ring=mm(new THREE.TorusGeometry(.185,.025,10,24),dark(0x262b35));ring.rotation.y=Math.PI/2;ring.position.set(2.45,1.04,z);lightsG.add(ring);
      const turnG=new THREE.Group(),turnBase=mm(new THREE.CylinderGeometry(.075,.075,.045,16),dark(0x262b35));turnBase.rotation.z=Math.PI/2;turnBase.position.set(2.13,1.38,z*1.25);turnG.add(turnBase);
      const blink=mm(new THREE.CylinderGeometry(.055,.055,.09,14),new THREE.MeshStandardMaterial({color:0xF2A03C,emissive:0xF2A03C,emissiveIntensity:.2,roughness:.3}));
      blink.position.set(2.16,1.38,z*1.25);blink.userData.keepEm=true;blink.userData.suppressSelectGlowWhenOff=true;blink.userData.carLamp=`turn-${side.toLowerCase()}-front`;turnG.add(blink);place(turnG,V(0,0,0),V(2.1,.7,side===TURN_MODES.LEFT?-.35:.35));turnGroups[side].push(turnG);turnLamps[side].push(blink);// 立在翼子板上的小转向灯
      const b=mm(new THREE.ConeGeometry(.5,2.2,20,1,true),new THREE.MeshStandardMaterial({color:0xFFE58A,transparent:true,opacity:0,depthWrite:false,emissive:0xFFE58A,emissiveIntensity:.6,side:THREE.DoubleSide}));
      b.rotation.z=Math.PI/2;b.position.set(3.7,1.0,z);b.castShadow=false;b.userData.noHit=true;b.userData.keepEm=true;lightsG.add(b);beams.push(b);
      const sp=new THREE.SpotLight(0xfff1c4,0,18,Math.PI/7,.55,1.1);sp.position.set(2.5,1.04,z);sp.target.position.set(9,-.4,z*1.6);lightsG.add(sp);lightsG.add(sp.target);spots.push(sp);
    }
    place(lightsG,V(0,0,0),V(2.1,.7,0));
    for(const z of [-.68,.68])for(const r of [.055,.092,.137]){
      const lensRing=mm(new THREE.TorusGeometry(r,.0025,6,36),chrome());
      lensRing.rotation.y=Math.PI/2;lensRing.position.set(2.500,1.04,z);lensRing.castShadow=false;lightsG.add(lensRing);
    }
    for(const l of lamps){l.material.color.setHex(0xd5e0e5);l.material.metalness=.6;l.material.roughness=.2;}
    for(const z of [.88,-.88]){const side=z<0?TURN_MODES.LEFT:TURN_MODES.RIGHT,l=mm(new THREE.CylinderGeometry(.065,.065,.055,18),new THREE.MeshStandardMaterial({color:0xFFF8E8,emissive:0xFFE9B8,emissiveIntensity:0,roughness:.24}));
      l.rotation.z=Math.PI/2;l.position.set(2.49,.91,z);l.userData.keepEm=true;l.userData.suppressSelectGlowWhenOff=true;l.userData.carLamp=`position-${side.toLowerCase()}`;positionG.add(l);positionLamps.push(l);
      const ring=mm(new THREE.TorusGeometry(.077,.012,8,18),chrome());ring.rotation.y=Math.PI/2;ring.position.set(2.515,.91,z);positionG.add(ring);
      const hit=mm(new THREE.CylinderGeometry(.14,.14,.12,16),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));hit.rotation.z=Math.PI/2;hit.position.set(2.55,.91,z);hit.castShadow=false;hit.userData.touchProxy=true;positionG.add(hit);}
    place(positionG,V(0,0,0),V(2.25,.95,0));
    for(const z of [.50,-.50]){const side=z<0?TURN_MODES.LEFT:TURN_MODES.RIGHT,l=mm(new THREE.CylinderGeometry(.105,.105,.06,20),new THREE.MeshStandardMaterial({color:0xFFE6A8,emissive:0xFFD36A,emissiveIntensity:0,roughness:.18}));
      l.rotation.z=Math.PI/2;l.position.set(2.50,.69,z);l.userData.keepEm=true;l.userData.suppressSelectGlowWhenOff=true;l.userData.carLamp=`fog-${side.toLowerCase()}`;fogG.add(l);fogLamps.push(l);
      const ring=mm(new THREE.TorusGeometry(.12,.018,8,20),dark(0x262b35));ring.rotation.y=Math.PI/2;ring.position.set(2.51,.69,z);fogG.add(ring);
      const hit=mm(new THREE.CylinderGeometry(.16,.16,.12,16),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));hit.rotation.z=Math.PI/2;hit.position.set(2.56,.69,z);hit.castShadow=false;hit.userData.touchProxy=true;fogG.add(hit);
      const b=mm(new THREE.ConeGeometry(.34,1.35,18,1,true),new THREE.MeshStandardMaterial({color:0xFFE2A0,transparent:true,opacity:0,depthWrite:false,emissive:0xFFE2A0,emissiveIntensity:.35,side:THREE.DoubleSide}));b.rotation.z=Math.PI/2;b.position.set(3.18,.62,z);b.castShadow=false;b.userData.noHit=true;b.userData.keepEm=true;fogG.add(b);fogBeams.push(b);
      const sp=new THREE.SpotLight(0xffd98a,0,7,Math.PI/5,.75,1.4);sp.position.set(2.5,.69,z);sp.target.position.set(6.5,.15,z*1.25);fogG.add(sp);fogG.add(sp.target);fogSpots.push(sp);}
    place(fogG,V(0,0,0),V(2.0,.45,0));
    defPart('lights',{immediate:true,name:'前照灯',more:'前照灯照向前方较远的路面。驾驶舱里的灯光旋钮可以单独控制它。',outside:true,text:'这是前照灯，照亮汽车前面的路。',
      pickText(){return C.lampMode==='HEADLIGHT'?'前照灯关掉了。':'前照灯亮了，小灯也继续亮着。';},action(){lighting.setLampMode(C.lampMode==='HEADLIGHT'?'OFF':'HEADLIGHT');}},[lightsG]);
    defPart('positionLights',{immediate:true,name:'小灯（位置灯）',more:'位置灯比前照灯小，也没有照向远处的大光束。',outside:true,text:'这是小灯，也叫位置灯。它不像大灯那样主要照路，而是让别人更容易看见汽车在哪里。',
      action(){lighting.setLampMode(C.lampMode===LAMP_MODES.POSITION?LAMP_MODES.OFF:LAMP_MODES.POSITION);}},[positionG]);
    defPart('fogLights',{immediate:true,name:'前雾灯',more:'前雾灯安装得更低，灯光主要落在汽车附近较低的路面。',outside:true,text:'这是前雾灯。雾很大的时候，它帮助我们看清汽车附近的路。',action(){lighting.setFogLight(!C.fogLight);}},[fogG]);
    defPart('turnLeft',{immediate:true,name:'左转向灯',more:'左前和左后两盏橙色灯使用同一个节奏同步闪烁。',outside:true,text:'左边的灯一闪一闪，告诉别人：我准备往左边走。',action(){lighting.setTurnMode(C.turnMode===TURN_MODES.LEFT?TURN_MODES.OFF:TURN_MODES.LEFT);}},turnGroups.LEFT);
    defPart('turnRight',{immediate:true,name:'右转向灯',more:'右前和右后两盏橙色灯使用同一个节奏同步闪烁。',outside:true,text:'右边的灯一闪一闪，告诉别人：我准备往右边走。',action(){lighting.setTurnMode(C.turnMode===TURN_MODES.RIGHT?TURN_MODES.OFF:TURN_MODES.RIGHT);}},turnGroups.RIGHT);

    /* 后视镜 */
    const mirrorsG=new THREE.Group(),mirrorParts=[];
    for(const s of [1,-1]){const g=new THREE.Group();const mir=roundedBox(.1,.08,.14,.03,paint());mir.position.set(0,.06,s*.15);g.add(mir);
      const face=mm(new THREE.BoxGeometry(.01,.06,.11),chrome());face.position.set(-.052,.06,s*.15);face.castShadow=false;g.add(face);
      g.add(tubeM(V(0,0,0),V(0,.03,s*.13),.018,dark()));mirrorsG.add(g);mirrorParts.push(g);place(g,V(.92,1.44,s*.93),V(.5,2.5,s*.9));}
    defPart('mirror',{name:'后视镜',more:'车上有三面镜子：左右各一面，车里还有一面。司机不用回头就能看到后面的车。',outside:true,hopTargets:mirrorParts,text:'爸爸看一眼小镜子，就知道后面有没有车。'},[mirrorsG]);

    /* 雨刮器：雨量与速度独立，驾驶舱和车外雨刮共用 OFF/SLOW/FAST 三档状态。 */
    const wiperG=new THREE.Group(),sweeps=[],WIPE_REST=1.0,WIPE_SWEEP=1.5;// 停放角（躺平）与摆动幅度
    {
      const d=V(-.33,.60,0).normalize(),n=V(d.y,-d.x,0),X=V().crossVectors(d,n);
      for(const z of [.40,-.40]){const pv=new THREE.Group();pv.position.copy(V(1.02,1.36,z)).addScaledVector(n,.03);pv.setRotationFromMatrix(new THREE.Matrix4().makeBasis(X,d,n));
        // 细细的臂 + 胶条；不刮的时候平躺在挡风玻璃底边（朝副驾一侧），不挡视线
        const sw=new THREE.Group();const arm=mm(new THREE.BoxGeometry(.016,.4,.012),dark(0x1f242e));arm.position.set(0,.2,.01);sw.add(arm);
        const blade=mm(new THREE.BoxGeometry(.026,.34,.01),dark(0x0f1218));blade.position.set(.018,.32,.014);sw.add(blade);
        const hub=mm(new THREE.CylinderGeometry(.02,.02,.024,10),dark());hub.rotation.x=Math.PI/2;sw.add(hub);sw.rotation.z=WIPE_REST;pv.add(sw);wiperG.add(pv);sweeps.push(sw);}
      place(wiperG,V(0,0,0),V(1.1,3.1,0));// 拆开：浮在抬起的挡风玻璃前上方
    }
    defPart('wiper',{name:'雨刮器',more:'雨刮器由一个小电机带动，左右摆动把雨水刮到旁边。雨量按钮只改变雨量，不会替你打开雨刮器。',outside:true,
      pickText(){return wiperFeedback[nextIn(C.wiperMode,WIPER_SEQUENCE)]},action(){weather.setWiperMode(nextIn(C.wiperMode,WIPER_SEQUENCE));}},[wiperG]);
    // 雨：一束会往下落的短线
    const RAIN_N=RAIN_PROFILES.HEAVY.count,rainX=new Float32Array(RAIN_N),rainY=new Float32Array(RAIN_N),rainZ=new Float32Array(RAIN_N),rainV=new Float32Array(RAIN_N),_rm=new THREE.Matrix4();
    for(let i=0;i<RAIN_N;i++){rainX[i]=(Math.random()-.5)*12;rainZ[i]=(Math.random()-.5)*10;rainY[i]=Math.random()*7;rainV[i]=Math.random();}
    const rain=new THREE.InstancedMesh(new THREE.BoxGeometry(.018,.6,.018),new THREE.MeshBasicMaterial({color:0xF4FAFF,transparent:true,opacity:0,depthWrite:false}),RAIN_N);
    rain.visible=false;rain.frustumCulled=false;rain.castShadow=false;ctx.scene.add(rain);

    /* 方向盘 */
    const steer=new THREE.Group(),steerSpin=new THREE.Group(),hornG=new THREE.Group();let hornFace;
    {
      steerSpin.add(mm(new THREE.TorusGeometry(.16,.024,10,24),dark()));
      for(let k=0;k<3;k++){const a=k*2*Math.PI/3+Math.PI/2;const sp=mm(new THREE.BoxGeometry(.03,.14,.02),dark());sp.position.set(Math.cos(a)*.07,Math.sin(a)*.07,0);sp.rotation.z=a-Math.PI/2;steerSpin.add(sp);}
      const hubC=mm(new THREE.CylinderGeometry(.061,.061,.035,14),dark(0x3a4150));hubC.rotation.x=Math.PI/2;hornG.add(hubC);hornFace=hubC;
      const hornHit=mm(new THREE.SphereGeometry(.07,10,8),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));hornHit.position.z=-.026;hornHit.userData.touchProxy=true;hornG.add(hornHit);
      // 拆开时直接落在中控台面上（中控自己的偏移是 .55/1.45，这里再往前上方挪一点，正好坐在台面中央）
      const spokeTrim=roundedBox(.10,.022,.012,.004,chrome());spokeTrim.position.set(0,-.045,-.025);steerSpin.add(spokeTrim);
      steer.add(steerSpin);const P=V(.45,1.23,-.43);place(steer,P,V(.92,1.47,.45));
      steer.lookAt(P.clone().add(V(-1,.5,0)));
    }
    defPart('steer',{immediate:true,name:'方向盘',more:'方向盘连着一根轴，轴带动前面两个轮子转向。轮子偏一点，车就慢慢拐过去。',outside:true,text:'转一转方向盘，前面的轮子跟着偏转。' ,action(){controls.setSteering(C.steerTarget>0?0:C.steerTarget<0?1:-1);}},[steer]);
    steerSpin.add(hornG);
    defPart('horn',{name:'方向盘喇叭',outside:true,immediate:true,text:'嘟！提醒别人注意汽车。',more:'短促提醒声；连续点按不会堆叠无限音效。喇叭不改变方向盘或转向灯。',action(){if(now()>=C.hornUntil){C.hornUntil=now()+500;api.sfx.horn();}}},[hornG]);

    /* V0.3 驾驶舱：分区建模，所有操作继续调用原来的 lighting/weather/controls。 */
    const dash=new THREE.Group(),cockpitHide=[];
    const zones={};
    for(const name of ['structure','instruments','lighting','visibility','center','driving']){
      const g=new THREE.Group();g.name='cockpit-'+name;g.userData.carInterior=name;dash.add(g);zones[name]=g;
    }
    let startBtn,hazardButton,rainButton,fogButton,lampKnobRotor,wiperControlButton,volumeRotor,gearLever,brakePedalPad,gasPedalPad;
    let clusterInfo,climateReadout,mediaMarker,musicBars=[],fanRotor,defogButton,airStreams=[],cupMesh,armrestPivot,buckleFaces=[];
    let speedNeedle,rpmNeedle,headlightIndicator,hazardIndicator,doorIndicator,turnStalkRotor,wiperStalkRotor,climateButton;
    const turnIndicators={},fuelGaugeLights=[],clusterGlow=[],volumeBars=[],mediaPages=[],gearLights={},lampModeLabels={},rainBars=[],wiperBars=[];
    const glowMat=(color,intensity=0)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.38,metalness:.10});
    const box=(parent,w,h,d,x,y,z,mat,r=.02)=>{
      const mesh=roundedBox(w,h,d,r,mat);mesh.position.set(x,y,z);mesh.castShadow=false;parent.add(mesh);return mesh;
    };
    const label=(parent,text,y,z,color='#EAF3FF',w=.20,h=.055,x=.12)=>{
      const tex=canvasTex(256,80,(g,W,H)=>{g.clearRect(0,0,W,H);g.fillStyle=color;g.font='700 32px "PingFang SC","Microsoft YaHei",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,W/2,H/2);});
      const m=mm(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
      m.rotation.y=-Math.PI/2;m.position.set(x,y,z);m.castShadow=false;parent.add(m);return m;
    };
    const touchHit=(r=.105)=>{
      const m=mm(new THREE.SphereGeometry(r,10,8),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));
      m.castShadow=false;m.userData.touchProxy=true;return m;
    };
    const touchPanel=(h,w)=>{
      const m=mm(new THREE.BoxGeometry(.035,h,w),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));
      m.castShadow=false;m.userData.touchProxy=true;return m;
    };
    const control=(parent,key,y,z,color,r=.065)=>{
      const g=new THREE.Group();g.userData.carControl=key;g.position.set(.15,y,z);g.rotation.z=Math.PI/2;parent.add(g);
      const bezel=mm(new THREE.CylinderGeometry(r+.018,r+.018,.027,16),chrome());bezel.position.y=-.012;bezel.castShadow=false;g.add(bezel);
      const face=mm(new THREE.CylinderGeometry(r,r,.047,16),glowMat(color));face.userData.keepEm=true;face.userData.carControl=key+'-face';face.castShadow=false;g.add(face);g.add(touchHit(.11));
      return {g,face};
    };

    /* 包裹式上台面 + 下护板 + 立体中控桥，避免一整块平板。 */
    const leather=dark(0x202b38),soft=matte(0xAA9072),trim=matte(0xBEA16A);
    box(zones.structure,.38,.105,1.66,.48,.91,0,leather,.045).rotation.z=-.14;
    box(zones.structure,.17,.39,1.56,.37,.69,0,leather,.045);
    box(zones.structure,.24,.18,1.48,.39,.43,0,soft,.035);
    box(zones.structure,.25,.16,.38,.40,.82,.66,leather,.035);
    for(const z of [.59,.83])box(zones.structure,.10,.06,.035,.21,.73,z,trim,.012);
    box(zones.structure,.04,.045,.27,.16,.73,.71,leather,.015);
    box(zones.structure,.023,.020,1.48,.27,.73,0,trim,.008);
    box(zones.structure,.021,.012,1.38,.265,.75,0,glowMat(0x5DB8CF,.25),.005);
    // 中控左右立边向中央通道延伸，形成桥式层次。
    for(const z of [-.025,.56]){
      const cheek=box(zones.center,.24,.38,.045,.28,.64,z,leather,.035);cheek.rotation.z=-.18;
    }
    box(zones.center,.055,.29,.56,.23,.79,.21,dark(0x162230),.025);
    box(zones.driving,.70,.18,.42,-.10,.255,.12,leather,.045);
    box(zones.driving,.61,.032,.37,-.10,.35,.12,trim,.012);
    box(zones.driving,.51,.022,.32,-.12,.37,.12,dark(0x293b49),.008);
    box(zones.driving,.22,.045,.33,-.36,.38,.12,dark(0x111E28),.018);
    for(const z of [.65,-.73]){
      box(zones.structure,.035,.085,.16,.25,.83,z,dark(0x111c27),.015);
      for(let i=-2;i<=2;i++)box(zones.structure,.008,.007,.13,.225,.83+i*.013,z,matte(0x6B7B89),.002);
    }
    // 扶手和杯架分别注册，盖板绕自己的铰链转动。
    armrestPivot=new THREE.Group();armrestPivot.position.set(-.46,.44,.12);zones.driving.add(armrestPivot);
    box(armrestPivot,.20,.055,.31,.10,0,0,soft,.025);
    const armHit=touchPanel(.16,.30);armHit.position.set(.07,.02,0);armrestPivot.add(armHit);
    const cupG=new THREE.Group();zones.driving.add(cupG);
    for(const z of [.045,.205]){
      const cup=mm(new THREE.TorusGeometry(.057,.009,5,14),matte(0x728291));cup.rotation.x=Math.PI/2;cup.position.set(-.27,.386,z);cup.castShadow=false;cupG.add(cup);
    }

    cupMesh=mm(new THREE.CylinderGeometry(.044,.036,.10,12),matte(0xD7E7EC));cupMesh.position.set(-.27,.438,.045);cupMesh.castShadow=false;cupG.add(cupMesh);
    const cupHit=touchHit(.09);cupHit.position.copy(cupMesh.position);cupG.add(cupHit);
    defPart('cupHolder',{name:'杯架',outside:true,immediate:true,text:'杯子放在这里，汽车里更整齐。',more:'点击放入或取出杯子；这是物品收纳演示。',pickText(){return C.cup?'杯子拿出来了。':'杯子放进杯架了。';},action(){C.cup=!C.cup;}},[cupG]);
    defPart('armrest',{name:'中央扶手',outside:true,immediate:true,text:'扶手下面，还有一个收东西的小盒子。',more:'盖板绕后端铰链开关，不影响档把。',pickText(){return C.armrestOpen?'扶手盖关上了。':'扶手盖打开了。';},action(){C.armrestOpen=!C.armrestOpen;}},[armrestPivot]);

    /* A. 独立完整仪表舱：左右圆表 + 中央信息区。 */
    const cluster=new THREE.Group();zones.instruments.add(cluster);
    box(cluster,.075,.32,.70,.25,.88,-.43,dark(0x0D1B28),.035);
    box(cluster,.27,.065,.76,.35,1.055,-.43,leather,.03);
    const makeDial=(z,title)=>{
      const rim=mm(new THREE.CylinderGeometry(.123,.123,.020,24),chrome());rim.rotation.z=Math.PI/2;rim.position.set(.192,.90,z);rim.castShadow=false;cluster.add(rim);
      const face=mm(new THREE.CylinderGeometry(.109,.109,.024,24),glowMat(0x112C40,.16));face.rotation.z=Math.PI/2;face.position.set(.175,.90,z);face.userData.keepEm=true;face.castShadow=false;cluster.add(face);clusterGlow.push(face);
      for(let i=0;i<11;i++){const a=-2.25+i*.45;const tick=mm(new THREE.BoxGeometry(.009,.005,.019),matte(i%5===0?0xEBC576:0x95BACB));tick.position.set(.154,.90+Math.cos(a)*.086,z+Math.sin(a)*.086);tick.rotation.x=-a;tick.castShadow=false;cluster.add(tick);}
      const pivot=new THREE.Group();pivot.position.set(.142,.90,z);pivot.userData.carInstrument=title;
      box(pivot,.007,.009,.08,0,0,.035,matte(0xFFD475),.003);cluster.add(pivot);
      label(cluster,title,.829,z,'#CAE7F1',.11,.035,.142);return pivot;
    };
    speedNeedle=makeDial(-.64,'速度');rpmNeedle=makeDial(-.22,'转速');
    box(cluster,.024,.17,.13,.173,.91,-.43,glowMat(0x164053,.2),.012);
    const infoP=label(cluster,'P',.947,-.43,'#90ECC5',.08,.045,.142);
    const infoD=label(cluster,'D',.947,-.43,'#90D6FF',.08,.045,.142);
    const ready=label(cluster,'汽车',.894,-.43,'#B9D8E4',.115,.033,.142);
    clusterInfo={p:infoP,d:infoD,ready};label(cluster,'油量',.805,-.43,'#9CD9C4',.11,.032,.142);
    for(let i=0;i<5;i++){const f=box(cluster,.009,.024,.023,.14,.847,-.493+i*.031,glowMat(0x5BC5A5),.003);f.userData.keepEm=true;fuelGaugeLights.push(f);}
    const indicator=(z,color)=>{
      const m=box(cluster,.018,.028,.045,.16,1.015,z,glowMat(color),.008);m.userData.keepEm=true;m.userData.suppressSelectGlowWhenOff=true;return m;
    };
    turnIndicators.LEFT=indicator(-.71,0x42D68A);headlightIndicator=indicator(-.56,0x62B5FF);hazardIndicator=indicator(-.43,0xFF4D4D);doorIndicator=indicator(-.30,0xFF9F43);turnIndicators.RIGHT=indicator(-.15,0x42D68A);
    for(const [z,txt] of [[-.71,'◀'],[-.56,'灯'],[-.43,'△'],[-.30,'门'],[-.15,'▶']])label(cluster,txt,1.015,z,'#D9E9EF',.04,.025,.145);
    const clusterHit=touchPanel(.10,.12);clusterHit.position.set(.13,.89,-.43);cluster.add(clusterHit);
    defPart('instruments',{name:'仪表盘',outside:true,immediate:true,text:'两只圆表和中间的小屏幕，告诉我们汽车现在的情况。',more:'速度和转速用简化动画演示；中间显示 P 或 D，转向指示与车外灯使用相同节奏。'},[cluster]);

    /* F. 中控屏：可见模型、界面和命中区归属同一零件。 */
    const infotainmentG=new THREE.Group();infotainmentG.userData.carControl='infotainment';zones.center.add(infotainmentG);
    box(infotainmentG,.055,.255,.49,.21,.88,.21,matte(0x657984),.022);
    const screenFace=box(infotainmentG,.025,.222,.455,.172,.88,.21,glowMat(0x103647,.25),.015);screenFace.userData.keepEm=true;screenFace.userData.carDisplay='center';clusterGlow.push(screenFace);
    for(const [i,title] of ['音乐','导航','空调'].entries()){
      const page=new THREE.Group();page.visible=i===0;infotainmentG.add(page);mediaPages.push(page);
      label(page,title,.943,.21,'#DCF5FA',.25,.045,.151);
      if(i===0){
        for(let j=0;j<6;j++)musicBars.push(box(page,.008,.025+(j%3)*.016,.025,.15,.875,.105+j*.042,glowMat(0x60C6C9,.45),.003));
        label(page,'♪  ♫  ♪',.813,.21,'#BCE7EA',.25,.035,.15);
      }else if(i===1){
        box(page,.008,.07,.20,.15,.862,.20,matte(0x315D67),.007);
        const road=box(page,.010,.009,.25,.145,.864,.20,matte(0xE7C482),.003);road.rotation.x=-.24;
        mediaMarker=label(page,'●',.867,.22,'#75DFCA',.04,.035,.135);
      }else{
        climateReadout=label(page,'22°',.873,.21,'#93EDD1',.35,.06,.15);
      }
    }
    const screenHit=touchPanel(.16,.43);screenHit.position.set(.14,.88,.21);infotainmentG.add(screenHit);

    // 屏幕页签是独立命中区，点击导航不会顺序循环到音乐。
    const screenTabs=[];
    for(const [i,id,title,z] of [[1,'screenMap','导航',.055],[0,'screenMusic','音乐',.21],[2,'screenClimate','空调',.365]]){
      const g=new THREE.Group();zones.center.add(g);box(g,.025,.07,.135,.145,1.052,z,glowMat(0x315262,.15),.01);label(g,title,1.052,z,'#E8F6FC',.115,.037,.12);
      const hit=touchPanel(.10,.14);hit.position.set(.11,1.052,z);g.add(hit);screenTabs.push({i,g});
      defPart(id,{name:title+'页面',outside:true,immediate:true,text:'点这里，看'+title+'。',more:i===1?'离线示意地图，不使用定位。汽车在 P 档时地图标记保持不动。':i===0?'音乐播放与音量真正联动；与发动机、提醒音分开。':'屏幕显示真实的温度、风量和除雾状态。',action(){controls.setMediaPage(i);}},[g]);
    }
    const musicPlayG=new THREE.Group();zones.center.add(musicPlayG);label(musicPlayG,'▶ / Ⅱ',.805,.21,'#C9F4E8',.18,.042,.125);
    const musicHit=touchPanel(.06,.22);musicHit.position.set(.10,.805,.21);musicPlayG.add(musicHit);
    defPart('musicPlay',{name:'播放与暂停',outside:true,immediate:true,more:'演示旋律由 WebAudio 生成，静音和切到后台会停止声音。',pickText(){return C.musicPlaying?'音乐暂停了。':'音乐开始了。';},action(){controls.setMusic(!C.musicPlaying);}},[musicPlayG]);

    /* B. 左侧灯光台：三个清楚的档位标签。 */
    box(zones.lighting,.11,.30,.23,.24,.59,-.65,leather,.025);
    const lamp=control(zones.lighting,'lamp-knob',.56,-.65,0x344656,.068),lampKnobG=lamp.g;
    lampKnobRotor=new THREE.Group();lampKnobRotor.userData.carControl='lamp-knob-rotor';
    lampKnobG.remove(lamp.face);lampKnobRotor.add(lamp.face);lampKnobG.add(lampKnobRotor);
    box(lampKnobRotor,.016,.012,.064,0,.031,-.025,matte(0xFFE19D),.004);
    for(const [mode,text,z] of [['OFF','关',-.74],['POSITION','小灯',-.65],['HEADLIGHT','大灯',-.56]])lampModeLabels[mode]=label(zones.lighting,text,.668,z,'#FFD98A',.075,.035,.125);
    label(zones.lighting,'灯光',.449,-.65,'#EDD6AF',.18,.04);
    const start=control(zones.lighting,'start',.755,-.68,0x4CC38A,.057);startBtn=start.face;
    label(zones.lighting,'启动',.755,-.57,'#BDEFD7',.10,.04);

    /* C. 中央红色三角双闪，按下位移 + 亮灭反馈。 */
    const hazardG=new THREE.Group();hazardG.userData.carControl='hazard';hazardG.position.set(.15,.65,-.13);zones.center.add(hazardG);
    const triangle=(s,mat)=>{const shape=new THREE.Shape();shape.moveTo(-s,-s*.72);shape.lineTo(s,-s*.72);shape.lineTo(0,s);shape.closePath();const m=mm(new THREE.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1}),mat);m.rotation.y=Math.PI/2;m.castShadow=false;return m;};
    hazardG.add(triangle(.08,dark(0x25313b)));hazardButton=triangle(.059,glowMat(0xE54242));hazardButton.position.x=-.012;hazardButton.userData.keepEm=true;hazardButton.userData.carControl='hazard-face';hazardButton.userData.suppressSelectGlowWhenOff=true;hazardG.add(hazardButton);hazardG.add(touchHit(.11));
    label(zones.center,'双闪',.54,-.13,'#FFB9B1',.13,.04);

    /* D. 方向盘两侧实体拨杆；旋转只读取 turnMode/wiperMode。 */
    const stalk=(key,z,endZ)=>{
      const g=new THREE.Group();g.position.set(.18,.965,z);g.userData.carControl=key;zones.instruments.add(g);
      const rotor=new THREE.Group();g.add(rotor);
      const arm=tubeM(V(0,0,0),V(-.09,.01,endZ),.017,leather,8);arm.castShadow=false;rotor.add(arm);
      box(rotor,.08,.049,.095,-.09,.01,endZ,matte(0x637586),.013);
      const hit=touchHit(.11);hit.position.set(-.09,.01,endZ);rotor.add(hit);return {g,rotor};
    };
    const turnStalk=stalk('turn-stalk',-.47,-.12),turnStalkG=turnStalk.g;turnStalkRotor=turnStalk.rotor;
    label(zones.instruments,'左 / 右',.94,-.60,'#A3ECD0',.13,.035,.07);
    // 拨杆末端的左右按钮分别声明语义；再次点同侧关闭。
    const turnTargets=[];
    for(const [side,z,txt] of [['LEFT',-.80,'◀'],['RIGHT',-.59,'▶']]){
      const g=new THREE.Group();zones.instruments.add(g);box(g,.05,.075,.115,.04,1.095,z,glowMat(0x2D6B5A),.015);label(g,txt,1.095,z,'#B8F8D8',.075,.042,.005);
      const hit=touchPanel(.11,.15);hit.position.set(-.005,1.095,z);g.add(hit);turnTargets.push({side,g});
      defPart(side==='LEFT'?'turnControlLeft':'turnControlRight',{name:side==='LEFT'?'左转拨杆':'右转拨杆',outside:true,immediate:true,more:'同侧再次点击关闭，另一侧直接切换。它不会自动转方向盘。',pickText(){return C.turnMode===side?'转向灯关掉了。':side==='LEFT'?'左边的灯一闪一闪，告诉别人：我准备往左边走。':'右边的灯一闪一闪，告诉别人：我准备往右边走。';},action(){lighting.setTurnMode(C.turnMode===side?'OFF':side);}},[g]);
    }
    const wiperStalk=stalk('wiper-stalk',-.27,.19),wiperStalkG=wiperStalk.g;wiperStalkRotor=wiperStalk.rotor;
    label(zones.instruments,'雨刮',.94,-.08,'#B6DFEF',.10,.035,.07);

    /* E. 视野区：雨量、雨刮、雾灯独立，带可见状态格。 */
    box(zones.visibility,.10,.21,.53,.245,.54,.28,leather,.025);
    const rainControl=control(zones.visibility,'rain',.54,.10,0x3D9BE9,.058),rainControlG=rainControl.g;rainButton=rainControl.face;
    const wipeControl=control(zones.visibility,'wiper',.54,.29,0x6D8CAF,.058),wiperControlG=wipeControl.g;wiperControlButton=wipeControl.face;
    const fogControl=control(zones.lighting,'fog',.56,-.36,0xE8B447,.058),fogControlG=fogControl.g;fogButton=fogControl.face;
    label(zones.visibility,'天气演示',.434,.10,'#AFDDFF',.14,.04);
    label(zones.visibility,'雨刮',.434,.29,'#D2E1F4',.14,.04);
    label(zones.lighting,'雾灯',.449,-.36,'#FFE2A0',.14,.04);
    for(let i=0;i<3;i++){
      rainBars.push(box(zones.visibility,.01,.014,.025,.128,.636,.067+i*.032,glowMat(0x5AB8FF),.003));
      wiperBars.push(box(zones.visibility,.01,.014,.025,.128,.636,.257+i*.032,glowMat(0xAECCE4),.003));
    }
    for(const [g,txt] of [[rainControlG,'☂'],[wiperControlG,'↔'],[fogControlG,'≋']]){
      // 图标独立平面朝驾驶员，随按钮归属注册。
      const mark=label(g,txt,0,0,'#EFF8FF',.065,.048,-.033);mark.rotation.set(Math.PI/2,0,0);mark.position.set(0,.027,0);
    }

    /* F. 空调横向风口 + 两个旋钮，屏幕与按键层级清楚。 */
    box(zones.center,.03,.055,.40,.178,.735,.21,dark(0x0E1D28),.009);
    for(let i=-1;i<=1;i++)box(zones.center,.009,.004,.36,.15,.735+i*.012,.21,matte(0x63828F),.002);
    const vol=control(zones.center,'volume',.655,.06,0x344b5c,.045),volumeG=vol.g;volumeRotor=new THREE.Group();
    volumeG.remove(vol.face);volumeRotor.add(vol.face);volumeG.add(volumeRotor);box(volumeRotor,.012,.011,.043,0,.027,-.018,matte(0x9DD9EC),.003);
    const climate=control(zones.center,'climate',.655,.35,0x69BDAD,.045),climateG=climate.g;climateButton=climate.face;
    label(zones.center,'音量',.655,-.028,'#C7EFFF',.10,.032);
    label(zones.center,'空调',.655,.435,'#C7FFF4',.10,.032);
    for(let i=0;i<3;i++)volumeBars.push(box(zones.center,.008,.012+i*.008,.023,.128,.65,.135+i*.030,glowMat(0x76D9FF),.003));

    const tempDown=control(zones.center,'temperature-down',.36,.03,0x5E9FDA,.052),tempUp=control(zones.center,'temperature-up',.36,.22,0xD7886B,.052);
    label(zones.center,'温度 −',.27,.03,'#CDE8FF',.13,.038);label(zones.center,'温度 +',.27,.22,'#FFD6C5',.13,.038);
    const fanControl=control(zones.center,'fan',.36,.42,0x558D8E,.052);fanRotor=new THREE.Group();fanControl.g.remove(fanControl.face);fanRotor.add(fanControl.face);fanControl.g.add(fanRotor);box(fanRotor,.012,.012,.055,0,.03,0,matte(0xADF2E4),.003);label(zones.center,'风量',.27,.42,'#CFF5EE',.12,.038);
    const defog=control(zones.visibility,'defog',.54,.47,0x78BBA2,.058);defogButton=defog.face;label(zones.visibility,'除雾',.434,.47,'#CAF3E4',.13,.04);
    for(let i=0;i<3;i++){const a=box(zones.center,.13,.012,.012,.08,.73,.13+i*.07,glowMat(0xA2E5F2,.2),.003);a.userData.noHit=true;airStreams.push(a);}
    for(const [id,ctl,delta] of [['temperatureDown',tempDown,-2],['temperatureUp',tempUp,2]])defPart(id,{name:delta<0?'降低温度':'提高温度',outside:true,immediate:true,more:'18 到 26 度之间调节，到边界后保持不变。',pickText(){return '温度设为 '+Math.max(18,Math.min(26,C.temperature+delta))+' 度。';},action(){controls.setTemperature(Math.max(18,Math.min(26,C.temperature+delta)));}},[ctl.g]);
    defPart('fanControl',{name:'风量旋钮',outside:true,immediate:true,more:'关、小风、中风、大风。开启风量时空调同步开启。',pickText(){return ['风停了。','现在是小风。','风变大了一些。','现在是大风。'][(C.fanLevel+1)%4];},action(){controls.setFanLevel((C.fanLevel+1)%4);}},[fanControl.g]);
    defPart('defogControl',{name:'前窗除雾',outside:true,immediate:true,more:'除雾用于清理玻璃上的凝结水汽，与前雾灯和外面的雨量分开。',pickText(){return C.defog?'除雾关掉了。':'除雾打开了，玻璃会慢慢清楚。';},action(){controls.setDefog(!C.defog);}},[defog.g]);
    const mistG=new THREE.Group();zones.visibility.add(mistG);label(mistG,'玻璃起雾演示',.18,.25,'#BED4DE',.30,.043);
    const mistHit=touchPanel(.10,.32);mistHit.position.set(.09,.18,.25);mistG.add(mistHit);
    defPart('mistControl',{name:'玻璃起雾演示',outside:true,immediate:true,text:'玻璃上有水汽，试试前窗除雾。',more:'这是天气教学演示入口，不是真实汽车的起雾按钮。',action(){weather.demonstrateMist();}},[mistG]);
    // 薄层凝结水汽，贴合原挡风玻璃平面；不创建雾天气。
    const mistLayer=mm(new THREE.PlaneGeometry(1.49,.54),new THREE.MeshBasicMaterial({color:0xD8E7E9,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));mistLayer.quaternion.setFromUnitVectors(V(0,0,1),V(1,.56,0).normalize());mistLayer.position.set(.826,1.65,0);mistLayer.userData.noHit=true;mistLayer.castShadow=false;shell.add(mistLayer);

    const dayNightG=new THREE.Group();zones.visibility.add(dayNightG);label(dayNightG,'昼夜演示',.18,-.13,'#F5DAA6',.23,.043);
    const dayHit=touchPanel(.10,.25);dayHit.position.set(.09,.18,-.13);dayNightG.add(dayHit);
    defPart('dayNightControl',{name:'昼夜演示',outside:true,immediate:true,more:'切换环境时间，不替你转动汽车灯光旋钮。夜晚可以自己打开前照灯。',pickText(){return api.S.nightT?'天亮了。':'天黑了，试试灯光旋钮。';},action(){api.toggleNight();}},[dayNightG]);

    /* G. 带台座、导槽和 P/D 标记的独立档把区。 */
    const gearG=new THREE.Group();gearG.position.set(-.18,.34,.20);gearG.userData.carControl='gear';zones.driving.add(gearG);
    box(gearG,.15,.025,.23,0,.045,0,matte(0x536572),.015);
    box(gearG,.058,.018,.16,-.005,.065,0,dark(0x111e29),.007);
    gearLever=new THREE.Group();gearLever.userData.carControl='gear-lever';gearG.add(gearLever);
    const stem=mm(new THREE.CylinderGeometry(.015,.024,.125,8),chrome());stem.position.y=.065;stem.castShadow=false;gearLever.add(stem);
    box(gearLever,.07,.078,.08,-.015,.14,0,leather,.018);
    const gearHit=touchHit(.085);gearHit.position.y=.14;gearLever.add(gearHit);
    for(const [mode,z] of [['P',-.07],['D',.07]]){
      const m=box(gearG,.008,.027,.038,-.086,.067,z,glowMat(mode==='P'?0x63D99C:0x62B5FF),.005);
      m.userData.keepEm=true;m.userData.carGear=mode;gearLights[mode]=m;
      label(zones.driving,mode,.430,.20+z,'#D1E6EE',.05,.03,-.28);
    }
    const makePedal=(z,color)=>{
      const g=new THREE.Group();g.position.set(.38,.10,z);zones.driving.add(g);
      box(g,.025,.19,.022,0,.09,0,leather,.005);
      const pad=box(g,.032,.13,.11,-.025,.20,0,matte(color),.018);pad.rotation.z=-.20;
      for(let i=-1;i<=1;i++)box(g,.006,.012,.08,-.045,.20+i*.029,0,dark(0x23313f),.003);
      const hit=touchHit(.12);hit.position.y=.18;g.add(hit);return {g,pad};
    };
    const bp=makePedal(-.53,0x8996A3),gp=makePedal(-.31,0x768693);brakePedalPad=bp.pad;gasPedalPad=gp.pad;
    place(dash,V(.42,.32,0),V(.55,1.45,0));root.add(dash);

    defPart('start',{name:'启动按钮',outside:true,isStart:true,immediate:true,text:'按一下，汽车就醒过来啦！',more:'启动按钮与原来的开起来、停下使用同一个车辆运行状态。'},[start.g]);
    defPart('lampKnob',{name:'灯光旋钮',outside:true,immediate:true,more:'关、小灯、大灯三档。小灯是位置灯或示宽灯，让别人容易看见汽车；它不是车门打开时的车内照明。',
      pickText(){return lampFeedback[nextIn(C.lampMode,LAMP_SEQUENCE)]},action(){lighting.setLampMode(nextIn(C.lampMode,LAMP_SEQUENCE));}},[lampKnobG]);
    defPart('hazard',{name:'危险报警闪光灯（双闪）',outside:true,immediate:true,text:'左右两边一起闪，提醒别人：这里有特殊情况，请注意。',more:'双闪与车外四盏转向灯、仪表指示共享同一个节奏。',
      action(){lighting.setTurnMode(C.turnMode===TURN_MODES.HAZARD?TURN_MODES.OFF:TURN_MODES.HAZARD);}},[hazardG]);
    defPart('turnStalk',{name:'转向拨杆',outside:true,immediate:true,more:'拨杆端部的左右箭头各自控制一侧，同侧再点关闭。',
      pickText(){return C.turnMode===TURN_MODES.LEFT?'转向灯关闭了。':'左转向灯闪起来了。';},
      action(){lighting.setTurnMode(C.turnMode===TURN_MODES.LEFT?TURN_MODES.OFF:TURN_MODES.LEFT);}},[turnStalkG]);
    defPart('rainControl',{name:'天气演示（雨量）',outside:true,immediate:true,more:'依次演示无雨、小雨、中雨、大雨，不会自动改变雨刮速度。',
      pickText(){return rainFeedback[nextIn(C.rainLevel,RAIN_SEQUENCE)]},action(){weather.setRainLevel(nextIn(C.rainLevel,RAIN_SEQUENCE));}},[rainControlG]);
    defPart('wiperControl',{name:'雨刮控制',outside:true,immediate:true,more:'关闭、慢速、快速三档。右拨杆和按钮使用相同的雨刮状态。',
      pickText(){return wiperFeedback[nextIn(C.wiperMode,WIPER_SEQUENCE)]},action(){weather.setWiperMode(nextIn(C.wiperMode,WIPER_SEQUENCE));}},[wiperControlG,wiperStalkG]);
    defPart('fogControl',{name:'前雾灯开关',outside:true,immediate:true,more:'控制车头下方两盏前雾灯。',
      pickText(){return C.fogLight?'前雾灯关掉了。':'前雾灯打开了，照亮汽车附近较低的路面。';},action(){lighting.setFogLight(!C.fogLight);}},[fogControlG]);
    defPart('infotainment',{name:'中控屏',outside:true,immediate:true,text:'上面的三个入口，可以选择导航、音乐和空调。',more:'离线示意界面，音乐和空调显示与控制共用状态。'},[infotainmentG]);
    defPart('volumeControl',{name:'音量旋钮',outside:true,immediate:true,more:'调节演示音乐的真实音量，不改变发动机、喇叭或提醒声。',
      pickText(){return (C.volumeLevel+1)%4===0?'音乐音量关掉了。':'转动旋钮，音乐音量变了。';},action(){controls.setVolumeLevel((C.volumeLevel+1)%4);}},[volumeG]);
    defPart('climateControl',{name:'空调按钮',outside:true,immediate:true,more:'按钮、出风动画、风量和空调屏幕使用同一份状态。',
      pickText(){return C.climateOn?'空调演示关掉了。':'空调演示打开了。';},action(){controls.setClimate(!C.climateOn);}},[climateG]);
    defPart('gearControl',{name:'档把',outside:true,immediate:true,more:'P 是停车档，D 是前进档。发动机启动后，D 档才让汽车前进；切回 P 档停车。',
      pickText(){return C.gearMode==='P'?'档把推到 D。':'档把回到 P。';},action(){controls.setGearMode(C.gearMode==='P'?'D':'P');}},[gearG]);
    defPart('brakePedal',{name:'刹车踏板',outside:true,immediate:true,text:'踩下刹车，后面的红灯亮起来，提醒后面的车。',more:'点击演示刹车灯变亮，然后自动恢复。',action(){lighting.triggerBrake();}},[bp.g]);
    defPart('accelerator',{name:'油门踏板',outside:true,immediate:true,text:'轻轻踩油门，发动机更有精神了。',more:'发动机运行时短时提高转速表，P 档仍保持停车。',pickText(){return api.S.drive?'踩下油门，转速表提高了。':'先按启动按钮，让发动机醒过来。';},action(){if(api.S.drive)C.throttleUntil=now()+1800;else api.caption('accelerator','油门踏板','先按启动按钮，让发动机醒过来。');}},[gp.g]);

    /* 座椅 + 安全座椅 */
    const TAN=0xc9a97c,seatsG=new THREE.Group(),driverMeshes=[];
    {
      for(const z of [.45,-.45]){
        const c=roundedBox(.44,.13,.42,.05,matte(TAN));c.position.set(-.28,.47,z);seatsG.add(c);
        const b=roundedBox(.12,.5,.42,.05,matte(TAN));b.position.set(-.55,.8,z);b.rotation.z=.15;seatsG.add(b);
        const h=roundedBox(.1,.12,.24,.04,matte(TAN));h.position.set(-.62,1.12,z);seatsG.add(h);cockpitHide.push(c,b,h);
      }
      const bench=roundedBox(.36,.12,1.3,.05,matte(TAN));bench.position.set(-1.0,.46,0);seatsG.add(bench);
      const back=roundedBox(.12,.36,1.3,.05,matte(TAN));back.position.set(-1.16,.66,0);back.rotation.z=.12;seatsG.add(back);
      /* 司机：坐在驾驶座上，双手扶着方向盘（坐标是 seatsG 的局部值，整组再抬 .30）
         关键：坐垫顶面在局部 .535，人的胯部要落在这里，头顶要高过窗台线（世界 1.40），否则从外面只看得见一点头发 */
      {const dz=-.45,SKIN=matte(0xF6D2B0),SHIRT=matte(0x3F8FE0),PANTS=matte(0x2f3540);const D0=seatsG.children.length;
       const torso=roundedBox(.30,.62,.34,.10,SHIRT);torso.position.set(-.32,.85,dz);seatsG.add(torso);        // 胯 .54 → 肩 1.16
       const neck=mm(new THREE.CylinderGeometry(.055,.055,.10,10),SKIN);neck.position.set(-.30,1.20,dz);seatsG.add(neck);
       const head=mm(new THREE.SphereGeometry(.125,16,12),SKIN);head.position.set(-.29,1.32,dz);seatsG.add(head);// 世界 1.62，正好在车窗里
       const hair=mm(new THREE.SphereGeometry(.13,16,10,0,Math.PI*2,0,Math.PI/2),matte(0x2b2b2b));hair.position.set(-.29,1.335,dz);seatsG.add(hair);
       for(const s2 of [1,-1]){const eye=mm(new THREE.SphereGeometry(.014,8,6),dark(0x1f242e));eye.position.set(-.175,1.34,dz+s2*.05);eye.castShadow=false;seatsG.add(eye);}
       for(const s2 of [1,-1]){                                   // 两条胳膊伸到方向盘上（方向盘在局部 1.04）
         seatsG.add(tubeM(V(-.30,1.08,dz+s2*.18),V(.12,1.05,dz+s2*.12),.038,SHIRT));
         seatsG.add(tubeM(V(.12,1.05,dz+s2*.12),V(.42,1.03,dz+s2*.08),.034,SKIN));}
       for(const s2 of [1,-1]){                                   // 腿：坐着往前伸，脚踩在地板上（地板在局部 .32）
         seatsG.add(tubeM(V(-.26,.56,dz+s2*.10),V(.18,.50,dz+s2*.10),.06,PANTS));
         seatsG.add(tubeM(V(.18,.50,dz+s2*.10),V(.36,.34,dz+s2*.10),.052,PANTS));
         const shoe=roundedBox(.17,.07,.11,.02,dark(0x262b35));shoe.position.set(.42,.33,dz+s2*.10);seatsG.add(shoe);}
       for(let i=D0;i<seatsG.children.length;i++)seatsG.children[i].traverse(o=>{if(o.isMesh)driverMeshes.push(o);});}// 看里面/拆开看时把司机藏起来
      place(seatsG,V(0,.30,0),V(-.5,1.35,0));root.add(seatsG);
    }
    const cseat=new THREE.Group();
    {
      const c=roundedBox(.38,.12,.38,.05,matte(0xE04848));c.position.set(0,.06,0);cseat.add(c);
      const b=roundedBox(.1,.36,.38,.05,matte(0xE04848));b.position.set(-.14,.27,0);cseat.add(b);
      for(const z of [.17,-.17]){const w=roundedBox(.34,.2,.05,.025,matte(0xE04848));w.position.set(0,.18,z);cseat.add(w);}
      for(const z of [.06,-.06]){const belt=mm(new THREE.BoxGeometry(.035,.2,.035),dark());belt.position.set(-.04,.25,z);cseat.add(belt);}
      const buckle=roundedBox(.05,.05,.07,.01,chrome());buckle.position.set(-.02,.14,0);cseat.add(buckle);
      place(cseat,V(-.95,.84,.45),V(-.5,1.35,0));
    }
    const beltsG=new THREE.Group();
    for(const sd of [1,-1]){const z=sd*.45,bm=dark(0x2a2f3a);
      beltsG.add(tubeM(V(-.47,1.02,z+sd*.17),V(-.33,.58,z-sd*.2),.022,bm));       // 斜挎带
      beltsG.add(tubeM(V(-.3,.58,z+sd*.21),V(-.3,.58,z-sd*.2),.02,bm));            // 腰带
      const bk=roundedBox(.05,.06,.05,.01,chrome());bk.position.set(-.32,.6,z-sd*.21);beltsG.add(bk);buckleFaces.push(bk);
      const anchor=roundedBox(.04,.05,.04,.01,dark());anchor.position.set(-.5,1.04,z+sd*.19);beltsG.add(anchor);}
    place(beltsG,V(0,.30,0),V(-.5,1.35,0));
    defPart('belt',{immediate:true,name:'安全带',more:'急刹车时人会往前冲，安全带把人拉住。大人系三点式安全带，小朋友要坐安全座椅。',outside:true,text:'上车先系安全带，咔哒扣好，急刹车也不会摔出去。',pickText(){return C.beltFastened?'安全带解开了。':'咔哒，安全带扣好了。';},action(){C.beltFastened=!C.beltFastened;api.sfx.click();}},[beltsG]);
    defPart('seat',{name:'安全座椅',more:'小朋友太小，普通安全带勒不住。安全座椅按身高体重来选，用五点式带子把孩子稳稳包住。',outside:true,text:'宝宝坐在安全座椅上，扣好安全带，咔哒！',action(){api.sfx.click();setTimeout(()=>api.sfx.click(),160);}},[cseat]);

    const setGlow=(mesh,value)=>{mesh.userData.dynInt=value;if(mesh.material.emissive)mesh.material.emissiveIntensity=value;};
    /* ---- 每帧动画 ---- */
    function update(dt){
      for(const e of windowEdges)e.material.opacity=1-api.S.xr*.9;
      const S=api.S,t=now(),drv=S.drive,ee=api.ee,nn=S.night,moving=controls.getState().moving;
      C.motionW=moving?9:0;
      const lampDisplay=effectiveLampState(t);
      const fuelT=((drv&&C.fuelOn)||t<C.fuelUntil)?1:0,pistT=((drv&&C.engineOn)||t<C.engineUntil)?1:0,wheelWT=((moving&&C.wheelsOn)||t<C.wheelUntil)?9:0,
            shaftWT=(((moving&&C.shaftOn)||t<C.shaftUntil)||wheelWT>0)?12:0,lightsT=lampDisplay.headlight?1:0,positionT=lampDisplay.position?1:0,puffOn=(drv&&C.engineOn)||t<C.puffUntil;
      const e=Math.min(1,dt*3.5);
      C.fuel+=(fuelT-C.fuel)*e;C.pistonSpd+=(pistT-C.pistonSpd)*e;C.wheelW+=(wheelWT-C.wheelW)*Math.min(1,dt*2.5);C.shaftW+=(shaftWT-C.shaftW)*e;C.lights+=(lightsT-C.lights)*Math.min(1,dt*6);C.position+=(positionT-C.position)*Math.min(1,dt*8);
      const knobTarget=C.lampMode===LAMP_MODES.OFF?-.65:(C.lampMode===LAMP_MODES.POSITION?0:.65);C.lampKnobAngle+=(knobTarget-C.lampKnobAngle)*Math.min(1,dt*10);lampKnobRotor.rotation.y=C.lampKnobAngle;
      for(const mode of LAMP_SEQUENCE)lampModeLabels[mode].material.opacity=C.lampMode===mode?1:.38;
      clusterInfo.p.visible=C.gearMode===GEAR_MODES.P;clusterInfo.d.visible=C.gearMode===GEAR_MODES.D;
      rainBars.forEach((m,i)=>setGlow(m,i<RAIN_SEQUENCE.indexOf(C.rainLevel)?1:.03));
      wiperBars.forEach((m,i)=>setGlow(m,i<WIPER_SEQUENCE.indexOf(C.wiperMode)?1:.03));
      hazardButton.position.x+=((C.turnMode===TURN_MODES.HAZARD?-.003:-.012)-hazardButton.position.x)*Math.min(1,dt*12);
      const throttleActive=t<C.throttleUntil,dashOn=drv?1:0,speedK=Math.min(1,C.motionW/9),rpmK=C.pistonSpd*(throttleActive?.8:.3);
      speedNeedle.rotation.x=-2.15+4.25*speedK;rpmNeedle.rotation.x=-2.15+3.75*Math.min(1,rpmK);
      for(const m of clusterGlow)setGlow(m,.10+.48*dashOn);
      fuelGaugeLights.forEach((m,i)=>setGlow(m,dashOn&&(i<4||C.fuel>.75)?.75:.035));
      C.gearK+=(((C.gearMode===GEAR_MODES.D)?1:0)-C.gearK)*Math.min(1,dt*9);gearLever.position.z=-.055+.11*C.gearK;gearLever.rotation.x=-.10+.20*C.gearK;
      setGlow(gearLights.P,C.gearMode===GEAR_MODES.P?1.05:.04);setGlow(gearLights.D,C.gearMode===GEAR_MODES.D?1.05:.04);
      volumeRotor.rotation.y=-.8+C.volumeLevel*.52;volumeBars.forEach((m,i)=>setGlow(m,i<C.volumeLevel?.85:.025));mediaPages.forEach((m,i)=>m.visible=i===C.mediaPage);setGlow(climateButton,C.climateOn?1.0:.03);
      const turnLeverTarget=C.turnMode===TURN_MODES.LEFT?-.26:(C.turnMode===TURN_MODES.RIGHT?.26:0);turnStalkRotor.rotation.x+=(turnLeverTarget-turnStalkRotor.rotation.x)*Math.min(1,dt*10);
      const wiperIndex=WIPER_SEQUENCE.indexOf(C.wiperMode);wiperStalkRotor.rotation.x+=((wiperIndex*.18)-wiperStalkRotor.rotation.x)*Math.min(1,dt*10);setGlow(wiperControlButton,wiperIndex===0?.04:.35+wiperIndex*.36);
      // 模型反馈全部从集中状态读取，不维护第二份控件状态。
      hornFace.position.z=t<C.hornUntil?-.012:0;
      for(const w of frontWindows){const u=w.userData;u.windowK+=(u.windowLevel/2-u.windowK)*Math.min(1,dt*6);w.scale.y=Math.max(.01,1-u.windowK);w.position.y=1.41+.24*w.scale.y;w.visible=w.scale.y>.02;}
      for(const d of doorExtras){d.lockButton.children[0].material.color.setHex(C.locked?0xDA8A67:0xA8C4AE);}
      speakerFaces.forEach(m=>{const k=C.musicPlaying?1+.035*Math.sin(t*.013):1;m.scale.setScalar(1.55*k);});
      api.sfx.setMusic(C.musicPlaying,C.volumeLevel);
      musicBars.forEach((m,i)=>{m.scale.y=C.musicPlaying?.55+.45*Math.sin(t*.008+i)**2:.25;});
      musicPlayG.visible=C.mediaPage===0;
      if(mediaMarker&&moving)mediaMarker.position.z=.21+.065*Math.sin(t*.0007);
      fanRotor.rotation.y=-.8+C.fanLevel*.52;
      airStreams.forEach((m,i)=>{m.visible=C.fanLevel>0;m.position.x=.04-(.5+.5*Math.sin(t*.003+i))*C.fanLevel*.04;});
      setGlow(defogButton,C.defog?1:.02);
      if(C.defog){C.mistTarget=Math.max(0,C.mistTarget-dt*.24);}C.mist+=(C.mistTarget-C.mist)*Math.min(1,dt*2);mistLayer.material.opacity=C.mist*.65;mistLayer.visible=C.mist>.01;
      cupMesh.visible=C.cup;armrestPivot.rotation.z+=((C.armrestOpen?-.95:0)-armrestPivot.rotation.z)*Math.min(1,dt*6);
      buckleFaces.forEach(m=>{m.position.y=C.beltFastened?.58:.60;m.material.color.setHex(C.beltFastened?0x63B990:0xDDA270);});
      const readout=C.temperature+'°  风 '+C.fanLevel+(C.defog?'  除雾':'');
      if(climateReadout.userData.text!==readout){climateReadout.userData.text=readout;const old=climateReadout.material.map;climateReadout.material.map=canvasTex(256,80,(g,W,H)=>{g.fillStyle='#93EDD1';g.font='bold 30px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(readout,W/2,H/2);});old.dispose();}
      screenTabs.forEach(({i,g})=>setGlow(g.children[0],i===C.mediaPage?.55:.06));
      engine.position.x+=.012*Math.sin(t*.06)*C.pistonSpd;engine.position.y+=.006*Math.sin(t*.083)*C.pistonSpd;
      shell.position.y+=.008*Math.sin(t*.05)*C.pistonSpd*(1-ee);
      for(const s of wheelSpin)s.rotation.z-=C.wheelW*dt;for(const a of axles)a.rotation.z-=C.wheelW*dt;shaftG.rotation.x+=C.shaftW*dt;
      const steerT=t<C.steerDemoUntil?.42*Math.sin(t/1000*2.4):C.steerTarget;C.steer+=(steerT-C.steer)*Math.min(1,dt*5);
      for(const y of frontYaw)y.rotation.y=C.steer;steerSpin.rotation.z=-2.6*C.steer;
      C.pistonPh+=dt*26*C.pistonSpd;pistons.forEach((p,i)=>{p.position.y=PIST_Y+PIST_AMP*Math.sin(C.pistonPh+i*1.05);});fan.rotation.x+=dt*22*C.pistonSpd;
      for(const l of lamps)l.userData.dynInt=(1.6+1.6*nn)*C.lights;for(const b of beams)b.material.opacity=(.32+.3*nn)*C.lights;
      for(const l of positionLamps)l.userData.dynInt=1.35*C.position;
      C.fog+=((C.fogLight?1:0)-C.fog)*Math.min(1,dt*8);for(const l of fogLamps)l.userData.dynInt=1.8*C.fog;for(const b of fogBeams)b.material.opacity=.2*C.fog;for(const sp of fogSpots)sp.intensity=1.35*C.fog;
      const blinkOn=C.turnMode!==TURN_MODES.OFF&&((t-C.turnEpoch)%900)<450;
      turnTargets.forEach(({side,g})=>setGlow(g.children[0],blinkOn&&(C.turnMode===side||C.turnMode==='HAZARD')?.65:.02));
      for(const side of [TURN_MODES.LEFT,TURN_MODES.RIGHT]){const sideOn=blinkOn&&(C.turnMode===side||C.turnMode===TURN_MODES.HAZARD);for(const l of turnLamps[side])l.userData.dynInt=sideOn?2.6:0;setGlow(turnIndicators[side],sideOn?1.25:.02);}
      setGlow(hazardButton,C.turnMode===TURN_MODES.HAZARD?(blinkOn?1.2:.12):0);setGlow(hazardIndicator,C.turnMode===TURN_MODES.HAZARD?(blinkOn?1.15:.08):.015);setGlow(headlightIndicator,lampDisplay.headlight?1.1:.02);
      setGlow(rainButton,.12+RAIN_SEQUENCE.indexOf(C.rainLevel)*.18);setGlow(fogButton,C.fogLight?1.05:0);setGlow(doorIndicator,driverDoor?.userData.open?1.1:.02);
      for(const sp of spots)sp.intensity=C.lights*nn*2.6;C.brake+=(((t<C.brakeUntil)?1:0)-C.brake)*Math.min(1,dt*8);for(const tl of tailLights)tl.userData.dynInt=.5+1.0*nn+2.4*C.brake;
      C.pedalBrake+=(C.brake-C.pedalBrake)*Math.min(1,dt*12);C.pedalGas+=((throttleActive?1:0)-C.pedalGas)*Math.min(1,dt*10);brakePedalPad.rotation.z=-.20-.28*C.pedalBrake;gasPedalPad.rotation.z=-.20-.28*C.pedalGas;
      setGlow(startBtn,drv?1.3:.04);
      // 雨 + 雨刮
      const rainProfile=RAIN_PROFILES[C.rainLevel],raining=C.rainLevel!==RAIN_LEVELS.NONE,wiping=C.wiperMode!=='OFF';
      C.rain+=((raining?1:0)-C.rain)*Math.min(1,dt*2);C.wipe+=((wiping?1:0)-C.wipe)*Math.min(1,dt*3);
      rain.count=rainProfile.count;rain.visible=rainProfile.count>0&&C.rain>.01;rain.material.opacity=rainProfile.opacity*C.rain;S.gloom=rainProfile.gloom*C.rain;
      if(rain.visible){for(let i=0;i<rainProfile.count;i++){const speed=rainProfile.speedMin+(rainProfile.speedMax-rainProfile.speedMin)*rainV[i];let y=rainY[i]-speed*dt;if(y<0){y+=7;rainX[i]=(Math.random()-.5)*12;rainZ[i]=(Math.random()-.5)*10;}rainY[i]=y;_rm.makeTranslation(rainX[i],y,rainZ[i]);rain.setMatrixAt(i,_rm);}rain.instanceMatrix.needsUpdate=true;}
      const wantWater=raining&&!drv;if(wantWater&&!api.sfx.wantLoop)api.sfx.loop('water');else if(!wantWater&&api.sfx.wantLoop==='water')api.sfx.stopLoop();// 雨声只在没开车时放，开车让位给发动机
      for(const pv of doorPivots){const u=pv.userData,tg=u.open;u.k+=(tg-u.k)*Math.min(1,dt*4);pv.rotation.y=u.sd*.95*u.k;}// 只读取同一扇门的开启状态；启动和挂 D 时会先关门。
      const reminderCondition=!drv&&C.lampMode!==LAMP_MODES.OFF&&!!driverDoor?.userData.open;if(reminderCondition&&!C.lightReminderCondition)startLightReminder(driverDoor);if(!reminderCondition)C.lightReminderBeeps=0;C.lightReminderCondition=reminderCondition;
      if(C.lightReminderBeeps>0&&t>=C.lightReminderNext){api.sfx.tone(1120,.11,'square',.045);C.lightReminderBeeps--;C.lightReminderNext=t+230;}
      const wipeRate=C.wiperMode===WIPER_MODES.FAST?7.4:(C.wiperMode===WIPER_MODES.SLOW?4.2:0);if(C.wipe>.01&&wipeRate)C.wipePh+=dt*wipeRate*C.wipe;const wa=(.5-.5*Math.cos(C.wipePh))*Math.min(1,C.wipe*1.2);for(const sw of sweeps)sw.rotation.z=WIPE_REST-WIPE_SWEEP*wa;
      fuelDots.forEach((d,i)=>{const u=((t/1000*.45)+i/6)%1;d.position.lerpVectors(FUEL_A,FUEL_B,u);d.scale.setScalar(C.fuel*(1-ee)*(.6+.4*Math.sin(u*Math.PI)));});
      if(puffOn){C.puffTimer-=dt;if(C.puffTimer<=0){C.puffTimer=.2;const p=puffs.find(p=>!p.visible);if(p){p.visible=true;p.userData.life=0;p.position.copy(exhaust.position).add(PUFF_AT);p.scale.setScalar(.5);}}}
      for(const p of puffs){if(!p.visible)continue;p.userData.life+=dt;const L=p.userData.life;if(L>1.5){p.visible=false;continue;}
        p.position.x-=dt*(.9+C.wheelW*.05);p.position.y+=dt*.75;p.scale.setScalar(.5+L*1.4);p.material.opacity=.7*(1-L/1.5);}
    }
    const chain=[
      {t:'按一下启动按钮。',part:'start',on(){C.startOn=true}},
      {t:'油箱。油箱是汽车的肚子。汽油顺着长长的管子，送到前面的发动机。',part:'tank',inner:true,on(){C.fuelOn=true}},
      {t:'发动机突突突转起来。',part:'engine',inner:true,on(){C.engineOn=true;api.sfx.loop('engine')}},
      {t:'传动轴把力气送到轮子。D 档时，轮子带汽车向前走。',part:'shaft',inner:true,on(){C.shaftOn=true}},
      {t:'发动机启动了。P 档停车，选择 D 档才会前进。',part:'wheels',on(){C.wheelsOn=true}},
    ];
    /* 车窗胶条：玻璃四周的细边，看里面的时候淡出，免得挡视线 */
    const windowEdges=[];
    for(const g of [shell,...doorPivots])g.traverse(m=>{
      if(!m.isMesh||!m.userData.glass)return;
      const edge=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x18232b,transparent:true}));
      m.add(edge);windowEdges.push(edge);
    });
    const cockpitEye=V(-1.47,1.55,-.12),cockpitLook=V(.64,1.04,-.08),cockpitViewState={position:V(),target:V()};
    ctx.linearize();
    return {runtime,update,chain,hideOnExplode:driverMeshes,hideInCockpit:cockpitHide,iconFor(id){return id==='wheels'?wheelYaws[0]:null;},
      cockpitView({zone='front',yaw=0,pitch=0}={}){
        const views={front:[cockpitEye,cockpitLook],center:[V(-.75,1.52,.16),V(.56,1.03,.18)],left:[V(-.70,1.55,-.10),V(.30,1.13,-.85)],right:[V(-.70,1.55,-.10),V(.30,1.13,.85)]};
        const [eye,target]=views[zone]||views.front;root.updateWorldMatrix(true,false);cockpitViewState.position.copy(eye);cockpitViewState.target.copy(target);
        const look=cockpitViewState.target.clone().sub(eye);look.applyAxisAngle(V(0,1,0),yaw);look.y+=pitch;cockpitViewState.target.copy(eye).add(look);
        cockpitViewState.fov=zone==='front'?72:68;root.localToWorld(cockpitViewState.position);root.localToWorld(cockpitViewState.target);return cockpitViewState;
      },
      showSeatsInCockpit(){return ['left','right'].includes(api.S.cockpitZone);},
      onStop(){C.startOn=C.fuelOn=C.engineOn=C.shaftOn=C.wheelsOn=false;C.throttleUntil=0;C.motionW=0;},onStart(){C.startOn=C.fuelOn=C.engineOn=C.shaftOn=C.wheelsOn=true;api.sfx.loop('engine');for(const p of doorPivots)p.userData.open=0;C.lightReminderBeeps=0;C.lightReminderCondition=false;}};
  }
};
})();
