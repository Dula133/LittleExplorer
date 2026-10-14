/* 驾驶舱几何与视图。保留原父子结构、局部坐标和注册顺序。 */
(function(M){
const {LAMP_MODES,TURN_MODES,GEAR_MODES}=M.modes;
const {LAMP_SEQUENCE,RAIN_SEQUENCE,WIPER_SEQUENCE,nextIn,lampFeedback,rainFeedback,wiperFeedback}=M.presentation;
M.createCockpitBuilder=function(ctx,runtime,materials){
 const {THREE,V,mm,roundedBox,capsule,tubeM,pathTube,canvasTex,matte,place,defPart,root}=ctx;
 const {paint,chrome,dark,glassMat}=materials;
 const {state:C,api,now,lighting,weather,controls}=runtime;
 const toggleDoor=pv=>controls.toggleDoor(pv),doorExtras=[],speakerFaces=[];
    const doorButton=(parent,x,y,z,color)=>{
      const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
      const face=roundedBox(.15,.08,.045,.016,matte(color));face.castShadow=false;g.add(face);
      const proxy=mm(new THREE.BoxGeometry(.22,.14,.075),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));proxy.userData.touchProxy=true;g.add(proxy);return g;
    };
 return {
  buildDoorInterior({pv,w,sd,hx,x1}){
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
        const side=sd<0?'left':'right';w.userData.windowLevel=0;w.userData.windowK=0;w.userData.windowSide=side;
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
  },
  registerDoors(){
    for(const d of doorExtras){
      const {side,pv,inner,windowButton,lockButton,handleGroup,speakerGroup}=d;
      for(const g of [windowButton,lockButton,handleGroup,speakerGroup])inner.add(g);
      defPart('window'+side,{name:(side==='left'?'左':'右')+'车窗按钮',outside:true,immediate:true,text:'按一下，玻璃往下收，再按可以关上。',more:'关闭、半开、全开。玻璃始终在原车门铰链内运动，门框保持不动。',pickText(){return ['车窗关上了。','车窗打开一半。','车窗打开了。'][(controls.getState().windows[side]+1)%3];},action(){controls.setWindow(side,(controls.getState().windows[side]+1)%3);}},[windowButton]);
      defPart('doorHandle'+side,{name:(side==='left'?'驾驶员':'乘客')+'门把手',outside:true,immediate:true,text:'车停稳，看看外面，再开门。',more:'门锁锁住时先解锁；汽车移动时不能开门。',pickText(){return controls.getState().moving?'汽车正在走，停稳后再开门。':C.locked&&!pv.userData.open?'门锁着，先按门锁解锁。':pv.userData.open?'车门关上了。':'看看外面，车门打开了。';},action(){toggleDoor(pv);}},[handleGroup]);
      defPart('speaker'+side,{name:'门板音响喇叭',outside:true,immediate:true,text:'音乐从这里传出来。它和方向盘的提醒喇叭不一样。',more:'点击可以播放或暂停演示音乐，音量旋钮控制音乐和短喇叭声。',pickText(){return C.musicPlaying?'音乐暂停了。':'音乐从门板音响传出来了。';},action(){controls.setMusic(!C.musicPlaying);}},[speakerGroup]);
      defPart('lock'+side,{name:'门锁按钮',outside:true,immediate:true,more:'锁住车门可防止意外开门；不改变已经打开的门。',pickText(){return C.locked?'车门解锁了。':'车门锁好了。';},action(){controls.setLocked(!C.locked);}},[lockButton]);
    }  },
  build({shell,driverDoor,frontWindows}){
    /* V0.3-A：粗皮革 D 形轮圈、缎面三辐与独立喇叭盖；非品牌复刻。 */
    const steer=new THREE.Group(),steerSpin=new THREE.Group(),hornG=new THREE.Group();let hornFace;
    {
      const leatherWheel=new THREE.MeshStandardMaterial({color:0x18232E,roughness:.76,metalness:.03});
      const satin=new THREE.MeshStandardMaterial({color:0x9EAEB8,roughness:.36,metalness:.58});
      const ring=new THREE.Shape();
      ring.moveTo(-.125,-.158);ring.quadraticCurveTo(-.202,-.15,-.202,.018);ring.bezierCurveTo(-.202,.265,.202,.265,.202,.018);ring.quadraticCurveTo(.202,-.15,.125,-.158);ring.closePath();
      const hole=new THREE.Path();hole.moveTo(-.103,-.115);hole.lineTo(.103,-.115);hole.quadraticCurveTo(.158,-.105,.158,.018);hole.bezierCurveTo(.158,.207,-.158,.207,-.158,.018);hole.quadraticCurveTo(-.158,-.105,-.103,-.115);ring.holes.push(hole);
      const rim=mm(new THREE.ExtrudeGeometry(ring,{depth:.027,bevelEnabled:true,bevelThickness:.007,bevelSize:.006,bevelSegments:2,curveSegments:12}),leatherWheel);
      rim.position.z=-.014;rim.userData.carControl='steering-rim';steerSpin.add(rim);
      for(const sd of [-1,1]){
        const spoke=roundedBox(.125,.05,.027,.014,leatherWheel);spoke.position.set(sd*.112,-.012,.009);spoke.rotation.z=sd*.16;steerSpin.add(spoke);
        const trim=roundedBox(.093,.014,.01,.004,satin);trim.position.set(sd*.113,-.036,.029);trim.rotation.z=sd*.16;steerSpin.add(trim);
        // Embossed grips are decoration; the whole rim retains the steering action.
        for(let i=0;i<3;i++){const grip=mm(new THREE.BoxGeometry(.028,.005,.006),dark(0x70818A));grip.position.set(sd*(.101+i*.014),.009,.03);steerSpin.add(grip);}
      }
      const lower=roundedBox(.054,.12,.025,.013,leatherWheel);lower.position.set(0,-.102,.007);steerSpin.add(lower);
      const lowerTrim=roundedBox(.023,.074,.009,.007,satin);lowerTrim.position.set(0,-.103,.026);steerSpin.add(lowerTrim);
      const base=roundedBox(.185,.115,.048,.028,leatherWheel.clone());base.userData.carControl='horn-base';hornG.add(base);
      hornFace=new THREE.Group();hornFace.userData.carControl='horn-pad';hornG.add(hornFace);
      const pad=roundedBox(.172,.100,.024,.026,dark(0x2B3744));pad.position.z=.027;pad.userData.carControl='horn-face';hornFace.add(pad);
      const icon=canvasTex(128,64,(g)=>{g.strokeStyle='#B9C9D1';g.lineWidth=4;g.lineJoin='round';g.beginPath();g.moveTo(42,28);g.lineTo(51,28);g.lineTo(63,18);g.lineTo(63,46);g.lineTo(51,36);g.lineTo(42,36);g.closePath();g.stroke();for(const r of [12,20]){g.beginPath();g.arc(65,32,r,-.65,.65);g.stroke();}});
      const symbol=mm(new THREE.PlaneGeometry(.064,.032),new THREE.MeshBasicMaterial({map:icon,transparent:true,depthWrite:false}));symbol.position.z=.042;symbol.castShadow=false;hornFace.add(symbol);
      const hornHit=mm(new THREE.BoxGeometry(.20,.13,.075),new THREE.MeshBasicMaterial({transparent:true,opacity:.001,depthWrite:false}));hornHit.position.z=.025;hornHit.userData.touchProxy=true;hornHit.userData.carControl='horn-pick';hornHit.userData.cockpitPickPriority=1;hornG.add(hornHit);
      steer.add(steerSpin);const P=V(.27,1.16,-.43);place(steer,P,V(.92,1.47,.45));steer.lookAt(P.clone().add(V(-1,.4,0)));
    }
    defPart('steer',{immediate:true,name:'方向盘',more:'方向盘与前轮继续同步偏转；这是简化机械演示，没有模拟真实车辆动力学。',outside:true,text:'转一转方向盘，前面的轮子跟着偏转。',action(){controls.setSteering(C.steerTarget>0?0:C.steerTarget<0?1:-1);}},[steer]);
    steerSpin.add(hornG);
    defPart('horn',{name:'方向盘喇叭',outside:true,immediate:true,selectSound:false,text:'嘟！提醒别人注意汽车。',more:'中心盖按下并短促鸣响。声音由本地 WebAudio 双音三角波合成，服从全局静音和音量旋钮；不使用录音或持续鸣笛。',action(){if(runtime.audio.pressHorn())hornFace.position.z=-.012;}},[hornG]);

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

    /* A. 仪表罩、缎面边框、双圆表刻度和真实交互指示；读数明确标为演示。 */
    const cluster=new THREE.Group();zones.instruments.add(cluster);
    box(cluster,.095,.36,.82,.26,.95,-.43,dark(0x0B1722),.04);
    box(cluster,.30,.085,.86,.36,1.15,-.43,leather,.04);
    for(const z of [-.86,0])box(cluster,.19,.20,.024,.32,1.06,z,leather,.015);
    box(cluster,.023,.015,.77,.20,.795,-.43,matte(0xA7B5BE),.005);
    const makeDial=(z,title,max,unit)=>{
      const rim=mm(new THREE.CylinderGeometry(.136,.136,.020,32),matte(0xAAB8C2));rim.rotation.z=Math.PI/2;rim.position.set(.19,.965,z);rim.castShadow=false;cluster.add(rim);
      const face=mm(new THREE.CylinderGeometry(.125,.125,.024,32),glowMat(0x102533,.12));face.rotation.z=Math.PI/2;face.position.set(.172,.965,z);face.userData.keepEm=true;face.castShadow=false;cluster.add(face);clusterGlow.push(face);
      const tex=canvasTex(384,384,(g,W,H)=>{
        const cx=W/2,cy=H/2;g.strokeStyle='#314957';g.lineWidth=2;g.beginPath();g.arc(cx,cy,158,0,Math.PI*2);g.stroke();
        for(let i=0;i<=20;i++){const a=-2.35+i*4.7/20,r=i%5===0?123:133;g.strokeStyle=i%5===0?'#F3D397':'#ADC3CD';g.lineWidth=i%5===0?5:2;g.beginPath();g.moveTo(cx+Math.sin(a)*r,cy-Math.cos(a)*r);g.lineTo(cx+Math.sin(a)*147,cy-Math.cos(a)*147);g.stroke();
          if(i%5===0){g.fillStyle='#DCE9EF';g.font='600 29px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(max*i/20),cx+Math.sin(a)*102,cy-Math.cos(a)*102);}}
        g.fillStyle='#AAC8D3';g.font='24px sans-serif';g.textAlign='center';g.fillText(unit,cx,cy+45);
      });
      const marks=mm(new THREE.PlaneGeometry(.244,.244),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}));marks.rotation.y=-Math.PI/2;marks.position.set(.151,.965,z);marks.castShadow=false;cluster.add(marks);
      const pivot=new THREE.Group();pivot.position.set(.133,.965,z);pivot.userData.carInstrument=title;
      box(pivot,.006,.096,.008,0,.044,0,matte(0xF4BA76),.003);cluster.add(pivot);
      const hub=mm(new THREE.SphereGeometry(.014,8,6),matte(0x7F9BAA));hub.position.copy(pivot.position);hub.position.x-=.005;hub.castShadow=false;cluster.add(hub);
      label(cluster,title+'示意',.82,z,'#BCD7E1',.15,.034,.133);return pivot;
    };
    speedNeedle=makeDial(-.69,'速度',20,'km/h · 演示');rpmNeedle=makeDial(-.17,'转速',4,'×1000 · 演示');
    box(cluster,.022,.205,.15,.164,.977,-.43,glowMat(0x143745,.16),.014);
    const infoP=label(cluster,'P',1.031,-.43,'#94E2BD',.10,.061,.130);
    const infoD=label(cluster,'D',1.031,-.43,'#96CDF0',.10,.061,.130);
    const ready=label(cluster,'停止',.967,-.43,'#B9D5E0',.14,.034,.130);
    const speedReadout=label(cluster,'0',.912,-.43,'#E3EDF3',.10,.044,.130);speedReadout.userData.carReadout='speed';
    clusterInfo={p:infoP,d:infoD,ready,speedReadout};label(cluster,'演示',.864,-.43,'#A9C9D5',.10,.027,.130);
    label(cluster,'油量示意',.779,-.43,'#9CD9C4',.15,.030,.130);
    for(let i=0;i<5;i++){const f=box(cluster,.008,.014,.022,.13,.818,-.49+i*.03,glowMat(0x5BC5A5),.003);f.userData.keepEm=true;fuelGaugeLights.push(f);}
    const indicator=(z,color,key)=>{const m=box(cluster,.014,.031,.047,.14,1.10,z,glowMat(color),.007);m.userData.keepEm=true;m.userData.carIndicator=key;m.userData.suppressSelectGlowWhenOff=true;return m;};
    turnIndicators.LEFT=indicator(-.78,0x42D68A,'LEFT');headlightIndicator=indicator(-.60,0x67BFC5,'headlight');hazardIndicator=indicator(-.43,0xFF4D4D,'hazard');doorIndicator=indicator(-.26,0xFF9F43,'door');turnIndicators.RIGHT=indicator(-.08,0x42D68A,'RIGHT');
    for(const [z,txt] of [[-.78,'◀'],[-.60,'灯'],[-.43,'△'],[-.26,'门'],[-.08,'▶']])label(cluster,txt,1.10,z,'#D9E9EF',.035,.026,.128);
    const clusterHit=touchPanel(.18,.16);clusterHit.position.set(.10,.98,-.43);cluster.add(clusterHit);
    defPart('instruments',{name:'仪表盘',outside:true,immediate:true,text:'两只圆表和中间的小屏幕，告诉我们汽车现在的情况。',more:'速度、转速和油量是演示读数，未连接真实车辆传感器。P/D、运行状态、转向、前灯和双闪指示读取当前交互状态；前灯指示表示当前前照灯状态。'},[cluster]);

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
      defPart(id,{name:title+'页面',outside:true,immediate:true,text:'点这里，看'+title+'。',more:i===1?'离线示意地图，不使用定位。汽车在 P 档时地图标记保持不动。':i===0?'音乐播放与音量真正联动；与发动机、提醒音分开。':'屏幕显示设定温度、风量和除雾状态，不测量真实气温。',action(){controls.setMediaPage(i);}},[g]);
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

    /* D. 两支可识别实体拨杆。端部目标跟随杆轴，不再悬在仪表上。 */
    const stalk=(key,z,endZ)=>{
      const g=new THREE.Group();g.position.set(.12,.93,z);g.userData.carControl=key;zones.instruments.add(g);
      const rotor=new THREE.Group();g.add(rotor);
      const arm=tubeM(V(0,0,0),V(-.18,0,endZ),.016,leather,8);arm.castShadow=false;rotor.add(arm);
      box(rotor,.10,.11,.16,-.18,0,endZ,matte(0x263B49),.025);
      for(let i=0;i<3;i++)box(rotor,.011,.08,.012,-.223,0,endZ-.045+i*.022,matte(0x748B98),.003);
      const hit=touchPanel(.14,.20);hit.position.set(-.23,0,endZ*.65);hit.userData.carControl=key+'-pick';hit.userData.cockpitPickPriority=1;rotor.add(hit);return {g,rotor};
    };
    const turnStalk=stalk('turn-stalk',-.59,-.23),turnStalkG=turnStalk.g;turnStalkRotor=turnStalk.rotor;
    const turnTargets=[];
    for(const [side,y,txt] of [['LEFT',-.082,'◀'],['RIGHT',.082,'▶']]){
      const g=new THREE.Group();g.position.set(-.18,y,-.23);turnStalkRotor.add(g);
      box(g,.062,.058,.14,0,0,0,glowMat(0x285746),.012);label(g,txt,0,0,'#B8F8D8',.08,.035,-.036);
      const hit=touchPanel(.11,.20);hit.position.set(-.055,0,0);hit.userData.carControl='turn-'+side.toLowerCase()+'-pick';hit.userData.cockpitPickPriority=2;g.add(hit);turnTargets.push({side,g});
      defPart(side==='LEFT'?'turnControlLeft':'turnControlRight',{name:side==='LEFT'?'左转拨杆':'右转拨杆',outside:true,immediate:true,more:'拨杆端部箭头控制一侧，同侧再次点击关闭，另一侧直接切换；不会自动转方向盘。',pickText(){return C.turnMode===side?'转向灯关掉了。':side==='LEFT'?'左边的灯一闪一闪，告诉别人：我准备往左边走。':'右边的灯一闪一闪，告诉别人：我准备往右边走。';},action(){lighting.setTurnMode(C.turnMode===side?'OFF':side);}},[g]);
      turnStalkRotor.remove(g); // Register the shaft separately before reattaching selectable ends.
    }
    label(zones.instruments,'转向',.87,-.83,'#A3ECD0',.13,.036,.02);
    const wiperStalk=stalk('wiper-stalk',-.28,.25),wiperStalkG=wiperStalk.g;wiperStalkRotor=wiperStalk.rotor;
    const wiperModeLabels={};
    for(const [i,txt] of ['关','慢','快'].entries()){const mode=WIPER_SEQUENCE[i],m=label(wiperStalkRotor,txt,.071,.16+i*.068,'#D1E8F1',.058,.033,-.238);m.userData.carWiperMode=mode;wiperModeLabels[mode]=m;}
    label(zones.instruments,'雨刮',.87,-.015,'#B6DFEF',.13,.036,.02);

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
    defPart('turnStalk',{name:'转向拨杆',outside:true,immediate:true,more:'点杆身依次关闭、左转、右转；端部箭头直接选方向，同侧再次点击关闭。与车外前后灯和仪表箭头同步。',
      pickText(){return C.turnMode==='LEFT'?'右转向灯闪起来了。':C.turnMode==='RIGHT'?'转向灯关闭了。':'左转向灯闪起来了。';},
      action(){lighting.setTurnMode(C.turnMode==='LEFT'?'RIGHT':C.turnMode==='RIGHT'?'OFF':'LEFT');}},[turnStalkG]);
    for(const {g} of turnTargets)turnStalkRotor.add(g);
    defPart('rainControl',{name:'天气演示（雨量）',outside:true,immediate:true,more:'依次演示无雨、小雨、中雨、大雨，不会自动改变雨刮速度。',
      pickText(){return rainFeedback[nextIn(C.rainLevel,RAIN_SEQUENCE)]},action(){weather.setRainLevel(nextIn(C.rainLevel,RAIN_SEQUENCE));}},[rainControlG]);
    defPart('wiperControl',{name:'雨刮控制',outside:true,immediate:true,more:'关闭、慢速、快速三档。右拨杆和按钮使用相同的雨刮状态。',
      pickText(){return wiperFeedback[nextIn(C.wiperMode,WIPER_SEQUENCE)]},action(){weather.setWiperMode(nextIn(C.wiperMode,WIPER_SEQUENCE));}},[wiperControlG,wiperStalkG]);
    defPart('fogControl',{name:'前雾灯开关',outside:true,immediate:true,more:'控制车头下方两盏前雾灯。',
      pickText(){return C.fogLight?'前雾灯关掉了。':'前雾灯打开了，照亮汽车附近较低的路面。';},action(){lighting.setFogLight(!C.fogLight);}},[fogControlG]);
    defPart('infotainment',{name:'中控屏',outside:true,immediate:true,text:'上面的三个入口，可以选择导航、音乐和空调。',more:'离线示意界面，音乐和空调显示与控制共用状态。'},[infotainmentG]);
    defPart('volumeControl',{name:'音量旋钮',outside:true,immediate:true,more:'四档音量控制演示音乐和短喇叭声。发动机与提醒声沿用各自的轻音量；全局静音控制所有声音。',
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
    function update(dt,t,lampDisplay,blinkOn){
      const drv=api.S.drive,moving=controls.getState().moving;
      const knobTarget=C.lampMode===LAMP_MODES.OFF?-.65:(C.lampMode===LAMP_MODES.POSITION?0:.65);C.lampKnobAngle+=(knobTarget-C.lampKnobAngle)*Math.min(1,dt*10);lampKnobRotor.rotation.y=C.lampKnobAngle;
      for(const mode of LAMP_SEQUENCE)lampModeLabels[mode].material.opacity=C.lampMode===mode?1:.38;
      clusterInfo.p.visible=C.gearMode===GEAR_MODES.P;clusterInfo.d.visible=C.gearMode===GEAR_MODES.D;
      rainBars.forEach((m,i)=>setGlow(m,i<RAIN_SEQUENCE.indexOf(C.rainLevel)?1:.03));
      wiperBars.forEach((m,i)=>setGlow(m,i<WIPER_SEQUENCE.indexOf(C.wiperMode)?1:.03));
      hazardButton.position.x+=((C.turnMode===TURN_MODES.HAZARD?-.003:-.012)-hazardButton.position.x)*Math.min(1,dt*12);
      const throttleActive=t<C.throttleUntil,dashOn=drv?1:0;
      const demoSpeed=controls.getState().speed,demoRPM=Math.round(C.pistonSpd*(throttleActive?2600:900)/100)*100;
      speedNeedle.rotation.x=-2.35+4.7*Math.min(1,demoSpeed/20);rpmNeedle.rotation.x=-2.35+4.7*Math.min(1,demoRPM/4000);
      const setReadout=(m,text)=>{if(m.userData.text===text)return;m.userData.text=text;const old=m.material.map;m.material.map=canvasTex(256,80,(g,W,H)=>{g.fillStyle='#C9E6EE';g.font='700 36px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,W/2,H/2);});old.dispose();};
      setReadout(clusterInfo.speedReadout,String(demoSpeed));setReadout(clusterInfo.ready,drv?'运行':'停止');
      for(const m of clusterGlow)setGlow(m,.10+.48*dashOn);
      fuelGaugeLights.forEach((m,i)=>setGlow(m,dashOn&&i<4?.75:.035)); // Fixed demonstration level, not measured fuel.
      C.gearK+=(((C.gearMode===GEAR_MODES.D)?1:0)-C.gearK)*Math.min(1,dt*9);gearLever.position.z=-.055+.11*C.gearK;gearLever.rotation.x=-.10+.20*C.gearK;
      setGlow(gearLights.P,C.gearMode===GEAR_MODES.P?1.05:.04);setGlow(gearLights.D,C.gearMode===GEAR_MODES.D?1.05:.04);
      volumeRotor.rotation.y=-.8+C.volumeLevel*.52;volumeBars.forEach((m,i)=>setGlow(m,i<C.volumeLevel?.85:.025));mediaPages.forEach((m,i)=>m.visible=i===C.mediaPage);setGlow(climateButton,C.climateOn?1.0:.03);
      const turnLeverTarget=C.turnMode===TURN_MODES.LEFT?-.26:(C.turnMode===TURN_MODES.RIGHT?.26:0);turnStalkRotor.rotation.x+=(turnLeverTarget-turnStalkRotor.rotation.x)*Math.min(1,dt*10);
      for(const [mode,m] of Object.entries(wiperModeLabels))m.material.opacity=C.wiperMode===mode?1:.30;
      const wiperIndex=WIPER_SEQUENCE.indexOf(C.wiperMode);wiperStalkRotor.rotation.x+=((wiperIndex*.18)-wiperStalkRotor.rotation.x)*Math.min(1,dt*10);setGlow(wiperControlButton,wiperIndex===0?.04:.35+wiperIndex*.36);
      // 模型反馈全部从集中状态读取，不维护第二份控件状态。
      hornFace.position.z+=((t<C.hornUntil?-.012:0)-hornFace.position.z)*Math.min(1,dt*12);
      for(const w of frontWindows){const u=w.userData;u.windowK+=(u.windowLevel/2-u.windowK)*Math.min(1,dt*6);w.scale.y=Math.max(.01,1-u.windowK);w.position.y=1.41+.24*w.scale.y;w.visible=w.scale.y>.02;}
      for(const d of doorExtras){d.lockButton.children[0].material.color.setHex(C.locked?0xDA8A67:0xA8C4AE);}
      speakerFaces.forEach(m=>{const k=C.musicPlaying?1+.035*Math.sin(t*.013):1;m.scale.setScalar(1.55*k);});
      musicBars.forEach((m,i)=>{m.scale.y=C.musicPlaying?.55+.45*Math.sin(t*.008+i)**2:.25;});
      musicPlayG.visible=C.mediaPage===0;
      if(mediaMarker&&moving)mediaMarker.position.z=.21+.065*Math.sin(t*.0007);
      fanRotor.rotation.y=-.8+C.fanLevel*.52;
      airStreams.forEach((m,i)=>{m.visible=C.fanLevel>0;m.position.x=.04-(.5+.5*Math.sin(t*.003+i))*C.fanLevel*.04;});
      setGlow(defogButton,C.defog?1:.02);
      cupMesh.visible=C.cup;armrestPivot.rotation.z+=((C.armrestOpen?-.95:0)-armrestPivot.rotation.z)*Math.min(1,dt*6);
      buckleFaces.forEach(m=>{m.position.y=C.beltFastened?.58:.60;m.material.color.setHex(C.beltFastened?0x63B990:0xDDA270);});
      const readout=C.temperature+'°  风 '+C.fanLevel+(C.defog?'  除雾':'');
      if(climateReadout.userData.text!==readout){climateReadout.userData.text=readout;const old=climateReadout.material.map;climateReadout.material.map=canvasTex(256,80,(g,W,H)=>{g.fillStyle='#93EDD1';g.font='bold 30px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(readout,W/2,H/2);});old.dispose();}
      screenTabs.forEach(({i,g})=>setGlow(g.children[0],i===C.mediaPage?.55:.06));
      steerSpin.rotation.z=-2.6*C.steer;
      turnTargets.forEach(({side,g})=>setGlow(g.children[0],blinkOn&&(C.turnMode===side||C.turnMode==='HAZARD')?.65:.02));
      for(const side of [TURN_MODES.LEFT,TURN_MODES.RIGHT]){const sideOn=blinkOn&&(C.turnMode===side||C.turnMode===TURN_MODES.HAZARD);setGlow(turnIndicators[side],sideOn?1.25:0);}
      setGlow(hazardButton,C.turnMode===TURN_MODES.HAZARD?(blinkOn?1.2:.12):0);setGlow(hazardIndicator,C.turnMode===TURN_MODES.HAZARD?(blinkOn?1.15:.08):.015);setGlow(headlightIndicator,lampDisplay.headlight?1.1:.02);
      setGlow(rainButton,.12+RAIN_SEQUENCE.indexOf(C.rainLevel)*.18);setGlow(fogButton,C.fogLight?1.05:0);setGlow(doorIndicator,driverDoor?.userData.open?1.1:.02);
      C.pedalBrake+=(C.brake-C.pedalBrake)*Math.min(1,dt*12);C.pedalGas+=((throttleActive?1:0)-C.pedalGas)*Math.min(1,dt*10);brakePedalPad.rotation.z=-.20-.28*C.pedalBrake;gasPedalPad.rotation.z=-.20-.28*C.pedalGas;
      setGlow(startBtn,drv?1.3:.04);
    }
    const cockpitEye=V(-1.62,1.60,-.34),cockpitLook=V(.60,1.12,-.24),cockpitViewState={position:V(),target:V()};
    return {update,mistLayer,hideOnExplode:driverMeshes,hideInCockpit:cockpitHide,
      cockpitView({zone='front',yaw=0,pitch=0}={}){
        const views={front:[cockpitEye,cockpitLook],center:[V(-.75,1.52,.16),V(.56,1.03,.18)],left:[V(-.70,1.55,-.10),V(.30,1.13,-.85)],right:[V(-.70,1.55,-.10),V(.30,1.13,.85)]};
        const [eye,target]=views[zone]||views.front;root.updateWorldMatrix(true,false);cockpitViewState.position.copy(eye);cockpitViewState.target.copy(target);
        const look=cockpitViewState.target.clone().sub(eye);look.applyAxisAngle(V(0,1,0),yaw);look.y+=pitch;cockpitViewState.target.copy(eye).add(look);
        cockpitViewState.fov=api.camera?.aspect>1.3?60:(zone==='front'?76:68);root.localToWorld(cockpitViewState.position);root.localToWorld(cockpitViewState.target);return cockpitViewState;
      },
      showSeatsInCockpit(){return ['left','right'].includes(api.S.cockpitZone);},
    };
  }
 };
};
})(window.LECar=window.LECar||{});
