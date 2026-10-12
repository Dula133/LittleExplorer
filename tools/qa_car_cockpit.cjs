/* Browser QA: NODE_PATH=<playwright-core parent> node tools/qa_car_cockpit.cjs
   Serve this repository first; LE_QA_URL and LE_QA_OUT may override the defaults. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.LE_QA_URL||'http://127.0.0.1:18765';
const out=process.env.LE_QA_OUT||'/tmp/littleexplorer-cockpit-v02';

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.LE_QA_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
    const errors=[],checks=[],touch={};
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.addInitScript(()=>{
      localStorage.setItem('muted','1');localStorage.setItem('voice','sys');
      // Keep speech pending to test rapid controls while narration is active.
      if(window.speechSynthesis)window.speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),15000);
    });
    const load=async id=>{await page.goto(base+'/pages/'+id+'.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__dbg,null,{timeout:90000});};
    const wait=async(fn,arg)=>page.waitForFunction(fn,arg,{timeout:30000});
    const shot=async name=>page.screenshot({path:path.join(out,name+'.png')});
    const tap=async id=>{
      const p=await page.evaluate(id=>{
        const d=__dbg,m=d.PARTS[id].meshes.find(m=>m.userData.touchProxy)||d.PARTS[id].meshes[0];
        m.updateWorldMatrix(true,false);d.camera.updateMatrixWorld();
        const v=m.getWorldPosition(new d.THREE.Vector3()).project(d.camera);
        return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
      },id);
      assert.ok(p.x>=24&&p.x<=366&&p.y>110&&p.y<630,id+' outside mobile safe area: '+JSON.stringify(p));
      await page.touchscreen.tap(p.x,p.y);touch[id]=p;
      console.log('touch',id,await page.evaluate(()=>({selected:__dbg.S.sel,lighting:SCENES.car.lighting.getState().turnMode})));
    };
    const lampState=()=>page.evaluate(()=>SCENES.car.lighting.getState());
    const weatherState=()=>page.evaluate(()=>SCENES.car.weather.getState());
    await load('car');
    const graph=await page.evaluate(()=>{
      const zones=[],doors=[];__dbg.root.traverse(o=>{if(o.name.startsWith('cockpit-'))zones.push(o.name);if(o.userData.carInterior==='door')doors.push(o.parent.userData.doorPivot);});
      return {zones,doors,screenIcon:!!__dbg.ICONS.infotainment,clusterIcon:!!__dbg.ICONS.instruments,screenMeshes:__dbg.PARTS.infotainment.meshes.filter(m=>!m.userData.touchProxy).length};
    });
    assert.equal(graph.zones.length,6);assert.equal(graph.doors.length,4);assert.ok(graph.doors.every(Boolean));assert.ok(graph.screenIcon&&graph.clusterIcon&&graph.screenMeshes>5);
    checks.push('six cockpit zones, four attached door linings, visible screen and instrument icons');
    await page.getByRole('button',{name:'进入驾驶舱'}).tap();
    await wait(()=>__dbg.camera.position.distanceTo(new __dbg.THREE.Vector3(-1.47,1.55,-.12))<.005);
    await shot('mobile-cockpit');

    for(const mode of ['POSITION','HEADLIGHT','OFF']){
      await tap('lampKnob');await wait(mode=>SCENES.car.lighting.getState().lampMode===mode,mode);
    }
    await page.evaluate(()=>SCENES.car.lighting.setLampMode('POSITION'));
    await wait(()=>{const m=__dbg.PARTS.positionLights.meshes.find(m=>m.userData.carLamp==='position-left');return m.userData.dynInt>1;});
    assert.equal((await lampState()).display.headlight,false);
    await page.evaluate(()=>SCENES.car.lighting.setLampMode('HEADLIGHT'));
    await wait(()=>__dbg.PARTS.lights.meshes.find(m=>m.userData.carLamp==='headlight-left').userData.dynInt>1);
    await page.evaluate(()=>SCENES.car.lighting.setLampMode('OFF'));
    checks.push('lamp knob three modes and exterior position/headlights');

    for(const mode of ['LEFT','RIGHT','OFF']){await tap('turnStalk');await wait(mode=>SCENES.car.lighting.getState().turnMode===mode,mode);}
    await tap('hazard');await wait(()=>SCENES.car.lighting.getState().turnMode==='HAZARD');
    await wait(()=>{const v=[];__dbg.root.traverse(o=>{if(o.userData.carLamp?.startsWith('turn-'))v.push(o.userData.dynInt);});return v.length===4&&v.every(x=>x>2);});
    const pressed=await page.evaluate(()=>__dbg.PARTS.hazard.meshes.find(m=>m.userData.carControl==='hazard-face').position.x);
    assert.ok(pressed>-.012);
    await tap('hazard');await wait(()=>SCENES.car.lighting.getState().turnMode==='OFF');
    checks.push('turn stalk LEFT/RIGHT/OFF; hazard four-lamp sync and button press');

    for(const level of ['LIGHT','MEDIUM','HEAVY','NONE']){
      await tap('rainControl');await wait(level=>SCENES.car.weather.getState().rainLevel===level,level);
      assert.equal((await weatherState()).wiperMode,'OFF');
    }
    for(const mode of ['SLOW','FAST','OFF']){await tap('wiperControl');await wait(mode=>SCENES.car.weather.getState().wiperMode===mode,mode);}
    for(const level of ['NONE','LIGHT','MEDIUM','HEAVY']){
      await page.evaluate(level=>{SCENES.car.weather.setRainLevel(level);SCENES.car.weather.setWiperMode('FAST');},level);
      const a=await page.evaluate(()=>__dbg.PARTS.wiper.groups[0].children[0].children[0].rotation.z);
      await wait(a=>Math.abs(__dbg.PARTS.wiper.groups[0].children[0].children[0].rotation.z-a)>.08,a);
      assert.equal((await weatherState()).rainLevel,level);
    }
    await page.evaluate(()=>{SCENES.car.weather.setRainLevel('NONE');SCENES.car.weather.setWiperMode('OFF');});
    checks.push('four rain levels; OFF/SLOW/FAST wiper independent under every rain level');

    await tap('fogControl');await wait(()=>SCENES.car.lighting.getState().fogLight);
    await tap('infotainment');await wait(()=>SCENES.car.controls.getState().mediaPage===1);
    await tap('volumeControl');await wait(()=>SCENES.car.controls.getState().volumeLevel===3);
    await tap('climateControl');await wait(()=>SCENES.car.controls.getState().climateOn);
    await tap('gearControl');await wait(()=>SCENES.car.controls.getState().gearMode==='D');
    await tap('brakePedal');assert.equal((await lampState()).brakeActive,true);
    await wait(()=>!SCENES.car.lighting.getState().brakeActive);
    await tap('accelerator');await wait(()=>{let n;__dbg.root.traverse(o=>{if(o.userData.carInstrument==='转速')n=o;});return n.rotation.x>-1;});
    checks.push('fog, center screen, volume, climate, P/D gear, pedals and brake expiry');

    // Real pointer events while speech is pending; no debug hush or forced selection.
    await page.locator('#mute').tap();
    await tap('lampKnob');await wait(()=>document.body.classList.contains('talking'));
    await tap('lampKnob');await wait(()=>SCENES.car.lighting.getState().lampMode==='HEADLIGHT');
    await page.locator('#mute').tap();
    await tap('start');await wait(()=>__dbg.S.drive);
    await tap('hazard');await wait(()=>SCENES.car.lighting.getState().turnMode==='HAZARD');
    await page.locator('#go').tap();await wait(()=>!__dbg.S.drive);
    checks.push('rapid operation during narration and start chain; original start/stop');

    await page.evaluate(()=>{
      SCENES.car.lighting.setLampMode('POSITION');
      const door=__dbg.PARTS.door.groups.find(g=>g.userData.driverDoor);__dbg.PARTS.door.action(door.children.find(o=>o.isMesh));
    });
    await wait(()=>SCENES.car.lighting.getState().reminderActive);
    await page.evaluate(()=>SCENES.car.lighting.setLampMode('OFF'));assert.equal((await lampState()).reminderActive,false);
    await page.evaluate(()=>{
      const d=__dbg.PARTS.door.groups.find(g=>g.userData.driverDoor);__dbg.PARTS.door.action(d.children.find(o=>o.isMesh));
      SCENES.car.lighting.setTurnMode('OFF');SCENES.car.lighting.setFogLight(false);
      __dbg.toggleNight();
    });assert.equal(await page.evaluate(()=>__dbg.S.nightT),1);await page.evaluate(()=>__dbg.toggleNight());
    await page.evaluate(()=>__dbg.PARTS.battery.action());assert.equal((await lampState()).display.headlight,true);
    await wait(()=>!SCENES.car.lighting.getState().display.demo);
    checks.push('door/light reminder, day/night and battery demo recovery');

    await page.setViewportSize({width:1100,height:820});
    await page.evaluate(()=>{__dbg.setMode('xray');__dbg.cam.tTheta=-1.05;__dbg.cam.tPhi=.90;__dbg.cam.zoom=.65;__dbg.cam.last=performance.now()+100000;});
    await wait(()=>__dbg.S.xr>.99&&Math.abs(__dbg.cam.theta+1.05)<.01);await shot('inside-overview');
    await page.evaluate(()=>__dbg.focusPart('instruments'));await wait(()=>__dbg.cam.target.distanceTo(new __dbg.THREE.Vector3(.62,1.21,-.43))<.15);await shot('inside-instruments');
    await page.evaluate(()=>__dbg.focusPart('infotainment'));await wait(()=>__dbg.cam.target.distanceTo(new __dbg.THREE.Vector3(.60,1.2,.21))<.15);await shot('inside-center');
    await page.evaluate(()=>{__dbg.setMode('explode');__dbg.cam.zoom=.80;});await wait(()=>__dbg.S.ex>.99);await shot('exploded');
    const attachment=await page.evaluate(()=>{let d;__dbg.root.traverse(o=>{if(o.name==='cockpit-center')d=o;});return {parent:d.parent===__dbg.PARTS.start.groups[0].parent.parent,door:__dbg.PARTS.door.groups.every(g=>g.children.some(c=>c.userData.carInterior==='door'))};});assert.equal(attachment.door,true);
    await page.evaluate(()=>__dbg.setMode('whole'));await wait(()=>__dbg.S.ex<.01&&__dbg.S.xr<.01);
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>__dbg.setMode('xray'));await wait(()=>__dbg.S.xr>.99);await shot('mobile-inside');
    checks.push('xray, instrument/screen focus, explode/reassemble, screenshots');

    for(const id of ['washer','elevator','jet','excavator']){
      await load(id);const r=await page.evaluate(()=>{const d=__dbg,gl=document.querySelector('#c').getContext('webgl2')||document.querySelector('#c').getContext('webgl');d.setMode('xray');d.setMode('explode');d.setMode('whole');document.querySelector('#go').click();return {count:Object.keys(d.PARTS).length,drive:d.S.drive,lost:gl.isContextLost(),immediate:Object.values(d.PARTS).some(p=>p.immediate)};});
      assert.ok(r.count>0&&r.drive&&!r.lost&&!r.immediate);checks.push(id+' minimal regression');
    }
    assert.deepEqual(errors,[]);
    const report={status:'PASS',checks,touch,errors,screenshots:fs.readdirSync(out).filter(n=>n.endsWith('.png')),limitations:['HarmonyOS hardware and audible audio were not tested; Chromium uses SwiftShader']};
    fs.writeFileSync(path.join(out,'qa-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
