/* V0.3 browser QA. Serve the repository first.
   NODE_PATH=<playwright-core parent> LE_QA_URL=http://127.0.0.1:19765 node tools/qa_car_cockpit.cjs
   Screenshots/reports go outside the repository. This tests real DOM/pointer actions,
   WebAudio state, scene geometry and controlled APIs; no render clock or state mocks. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.LE_QA_URL||'http://127.0.0.1:19765';
const out=process.env.LE_QA_OUT||'/tmp/littleexplorer-cockpit-v03';
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.LE_QA_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const errors=[],checks=[],touch={};const push=checks.push.bind(checks);checks.push=(...items)=>{console.log('PASS',...items);return push(...items);};let page;
  try{
    page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.addInitScript(()=>{localStorage.setItem('muted','1');localStorage.setItem('voice','sys');
      // Only narration is held; interaction, rendering, timers and WebAudio stay real.
      if(window.speechSynthesis)window.speechSynthesis.speak=u=>setTimeout(()=>u.onend?.(),15000);
    });
    const wait=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:60000});
    const state=()=>page.evaluate(()=>({c:SCENES.car.controls.getState(),l:SCENES.car.lighting.getState(),w:SCENES.car.weather.getState()}));
    const load=async id=>{await page.goto(base+'/pages/'+id+'.html',{waitUntil:'domcontentloaded'});await wait(()=>window.__dbg);};
    const zone=async name=>{await page.getByRole('button',{name:'查看'+name+'区',exact:true}).tap();};
    const tap=async id=>{await page.locator('.cockpit-actions button[data-part="'+id+'"]').tap();};
    const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
    const settle=async eye=>wait(eye=>__dbg.camera.position.distanceTo(new __dbg.THREE.Vector3(...eye))<.01,eye);
    const tap3D=async id=>{
      const point=await page.evaluate(id=>{const d=__dbg,m=d.PARTS[id].meshes.find(m=>m.userData.touchProxy)||d.PARTS[id].meshes[0];m.updateWorldMatrix(true,false);d.camera.updateMatrixWorld();const v=m.getWorldPosition(new d.THREE.Vector3()).project(d.camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,bottom:document.querySelector('.bottom').getBoundingClientRect().top};},id);
      assert.ok(point.x>0&&point.x<390&&point.y>70&&point.y<point.bottom,id+' 3D target occluded/offscreen: '+JSON.stringify(point));
      await page.touchscreen.tap(point.x,point.y);await wait(id=>__dbg.S.sel===id,id);touch[id]=point;
    };
    await load('car');
    assert.equal(await page.evaluate(()=>__dbg.PARTS.instruments.meshes.some(m=>m.userData.part!=='instruments')),false);
    const geometry=await page.evaluate(()=>{let zones=[],doors=[];__dbg.root.traverse(o=>{if(o.name.startsWith('cockpit-'))zones.push(o.name);if(o.userData.carInterior==='door')doors.push(o.parent.userData.doorPivot);});return {zones,doors,parts:Object.keys(__dbg.PARTS).length,meshCount:Object.values(__dbg.PARTS).reduce((n,p)=>n+p.meshes.length,0),icons:['horn','instruments','infotainment','windowleft'].every(id=>!!__dbg.ICONS[id])};});
    assert.ok(await page.evaluate(()=>Object.values(__dbg.PARTS).every(p=>p.meshes.filter(m=>m.userData.touchProxy).every(m=>!m.castShadow&&!m.material.visible&&!m.children.some(c=>c.userData.noHit)))),'touch proxies must not create visible outlines');
    assert.equal(geometry.zones.length,6);assert.equal(geometry.doors.length,4);assert.ok(geometry.doors.every(Boolean)&&geometry.icons);
    checks.push('layered cockpit, instruments/screen, four original door pivots, independent selectable children');
    await page.getByRole('button',{name:'进入驾驶舱'}).tap();await settle([-1.47,1.55,-.12]);await shot('390-front');
    await tap3D('horn');await tap3D('lampKnob');assert.equal((await state()).l.lampMode,'POSITION');
    await zone('灯光');
    for(const mode of ['HEADLIGHT','OFF','POSITION']){await tap('lampKnob');assert.equal((await state()).l.lampMode,mode);}
    await wait(()=>__dbg.PARTS.positionLights.meshes.find(m=>m.userData.carLamp==='position-left').userData.dynInt>1);
    assert.equal((await state()).l.display.headlight,false);await tap('lampKnob');
    await wait(()=>__dbg.PARTS.lights.meshes.find(m=>m.userData.carLamp==='headlight-left').userData.dynInt>1);await tap('lampKnob');
    await page.evaluate(()=>__dbg.toggleNight());assert.equal((await state()).l.display.headlight,false);await page.evaluate(()=>__dbg.toggleNight());
    await page.evaluate(()=>__dbg.PARTS.battery.action());assert.equal((await state()).l.display.demo,true);
    await tap('lampKnob');assert.equal((await state()).l.display.demo,false);await tap('lampKnob');await tap('lampKnob');
    await page.evaluate(()=>__dbg.PARTS.battery.action());await wait(()=>!SCENES.car.lighting.getState().display.demo);assert.equal((await state()).l.display.headlight,false);
    await tap('fogControl');assert.equal((await state()).l.fogLight,true);
    await wait(()=>__dbg.PARTS.fogLights.meshes.some(m=>m.userData.dynInt>1));await tap('fogControl');
    checks.push('OFF/POSITION/HEADLIGHT, exterior lamps, manual state survives night/start; battery override cancels on manual control; actual fog lamps');
    await zone('驾驶');
    for(const value of [-1,1,0]){await tap('steer');assert.equal((await state()).c.steering,value);}
    for(const [id,mode] of [['turnControlLeft','LEFT'],['turnControlRight','RIGHT'],['turnControlRight','OFF'],['turnControlLeft','LEFT']]){await tap(id);assert.equal((await state()).l.turnMode,mode);}
    const sync=async ids=>wait(ids=>{const p=__dbg.PARTS,vals=ids.flatMap(id=>p[id].meshes.filter(m=>m.userData.carLamp?.startsWith('turn-')).map(m=>m.userData.dynInt));return vals.length===ids.length*2&&vals.every(v=>v>2)&&vals.every(v=>v===vals[0]);},ids);
    await sync(['turnLeft']);await tap('turnControlRight');await sync(['turnRight']);
    await zone('灯光');await tap('hazard');assert.equal((await state()).l.turnMode,'HAZARD');await sync(['turnLeft','turnRight']);
    await wait(()=>__dbg.PARTS.hazard.meshes.find(m=>m.userData.carControl==='hazard-face').position.x>-.005);
    await tap('hazard');await wait(()=>['turnLeft','turnRight'].every(id=>__dbg.PARTS[id].meshes.filter(m=>m.userData.carLamp?.startsWith('turn-')).every(m=>m.userData.dynInt===0)));
    assert.equal((await state()).c.steering,0);
    checks.push('left/right/same-side OFF and hazard entry/exit; front/rear/four-lamp synchronization');
    await zone('驾驶');await tap('start');assert.equal((await state()).c.engineOn,true);assert.equal((await state()).c.moving,false);assert.equal((await state()).l.display.headlight,false);
    await wait(()=>{let n;__dbg.root.traverse(o=>{if(o.userData.carInstrument==='速度')n=o;});return Math.abs(n.rotation.x+2.15)<.01;});
    await tap('gearControl');assert.equal((await state()).c.gearMode,'D');assert.equal((await state()).c.moving,true);await tap('accelerator');await tap('brakePedal');assert.equal((await state()).l.brakeActive,true);assert.equal((await state()).c.moving,false);
    await wait(()=>!SCENES.car.lighting.getState().brakeActive);assert.equal((await state()).c.moving,true);
    await zone('左门');await tap('doorHandleleft');assert.equal((await state()).c.doors.find(d=>d.driver).open,false);assert.ok((await page.locator('#cd').innerText()).includes('停稳'));
    await zone('驾驶');await tap('gearControl');assert.equal((await state()).c.moving,false);assert.equal((await state()).c.engineOn,true);await tap('start');assert.equal((await state()).c.engineOn,false);
    checks.push('start keeps P; P/D controls actual movement and speed needle; brake expiry; moving blocks doors; stopping engine and throttle');
    await zone('左门');await tap('lockleft');await tap('doorHandleleft');assert.equal((await state()).c.doors.find(d=>d.driver).open,false);assert.ok((await page.locator('#cd').innerText()).includes('锁'));
    await tap('lockleft');await tap('doorHandleleft');assert.equal((await state()).c.doors.find(d=>d.driver).open,true);assert.equal((await state()).l.reminderActive,false);
    await zone('灯光');await tap('lampKnob');await wait(()=>SCENES.car.lighting.getState().reminderActive);
    await tap('lampKnob');await tap('lampKnob');assert.equal((await state()).l.reminderActive,false);
    await zone('左门');await tap('doorHandleleft');
    await settle([-.70,1.55,-.10]);await tap3D('windowleft');assert.equal((await state()).c.windows.left,1);await page.evaluate(()=>SCENES.car.controls.setWindow('left',0));
    for(const level of [1,2,0]){await tap('windowleft');assert.equal((await state()).c.windows.left,level);}
    await tap('windowleft');await wait(()=>{let w;__dbg.root.traverse(o=>{if(o.userData.windowSide==='left')w=o;});return Math.abs(w.scale.y-.5)<.02;});
    await tap('belt');assert.equal((await state()).c.beltFastened,true);await tap('cupHolder');assert.equal((await state()).c.cup,true);await tap('armrest');assert.equal((await state()).c.armrestOpen,true);
    await settle([-.70,1.55,-.10]);await shot('390-left-door');
    await zone('右门');await tap('windowright');assert.equal((await state()).c.windows.right,1);await tap('doorHandleright');await settle([-.70,1.55,-.10]);await shot('390-right-door');
    checks.push('original doors and locks, stopped/off lamp reminder, immediate OFF cancellation, independent windows with visible half height; belt/cup/armrest');
    await zone('视野');
    await tap('dayNightControl');assert.equal(await page.evaluate(()=>__dbg.S.nightT),1);assert.equal((await state()).l.display.headlight,false);await tap('dayNightControl');
    for(const [level,count] of [['LIGHT',80],['MEDIUM',190],['HEAVY',360],['NONE',0]]){await tap('rainControl');assert.equal((await state()).w.rainLevel,level);assert.equal((await state()).w.wiperMode,'OFF');await wait(count=>{let r;__dbg.root.parent.traverse(o=>{if(o.isInstancedMesh&&o.instanceMatrix.count===360)r=o;});return r&&r.count===count;},count);}
    for(const mode of ['SLOW','FAST','OFF']){await tap('wiperControl');assert.equal((await state()).w.wiperMode,mode);}
    for(const level of ['NONE','LIGHT','MEDIUM','HEAVY']){
      await page.evaluate(level=>{SCENES.car.weather.setRainLevel(level);SCENES.car.weather.setWiperMode('FAST');},level);
      const a=await page.evaluate(()=>__dbg.PARTS.wiper.groups[0].children[0].children[0].rotation.z);await wait(a=>Math.abs(__dbg.PARTS.wiper.groups[0].children[0].children[0].rotation.z-a)>.1,a);assert.equal((await state()).w.rainLevel,level);
    }
    await tap('mistControl');await wait(()=>SCENES.car.weather.getState().mist>.75);await tap('defogControl');await wait(()=>SCENES.car.weather.getState().mist<.04);
    assert.equal((await state()).w.rainLevel,'HEAVY');assert.equal((await state()).w.wiperMode,'FAST');await tap('defogControl');
    await page.evaluate(()=>{SCENES.car.weather.setRainLevel('NONE');SCENES.car.weather.setWiperMode('OFF');});
    checks.push('four bounded rain counts, all wiper speeds independent at every rain level, condensation gradually clears without changing rain/fog');
    await zone('中控');
    for(const [id,i] of [['screenMap',1],['screenClimate',2],['screenMusic',0]]){await tap(id);assert.equal((await state()).c.mediaPage,i);}
    await tap('climateControl');assert.equal((await state()).c.fanLevel,1);
    for(let i=0;i<4;i++)await tap('temperatureUp');assert.equal((await state()).c.temperature,26);
    for(let i=0;i<6;i++)await tap('temperatureDown');assert.equal((await state()).c.temperature,18);
    await tap('fanControl');assert.equal((await state()).c.fanLevel,2);await tap('screenClimate');
    await wait(()=>{let found=false;__dbg.PARTS.infotainment.groups[0].traverse(o=>{if(o.userData.text?.startsWith('18°  风 2'))found=true;});return found;});
    await tap('screenMusic');await tap('musicPlay');assert.equal((await state()).c.musicPlaying,true);
    await zone('驾驶');await tap('start');await zone('中控');
    await page.locator('#mute').tap();await wait(()=>__dbg.sfx.getMusicState().active&&__dbg.sfx.getMusicState().gain>.02&&__dbg.sfx.getMusicState().context==='running'&&__dbg.sfx.cur?.name==='engine');
    await tap('volumeControl');await wait(()=>__dbg.sfx.getMusicState().gain>.05);
    await tap('volumeControl');await wait(()=>__dbg.sfx.getMusicState().gain<.002);assert.equal((await state()).c.volumeLevel,0);
    await tap('volumeControl');await page.locator('#mute').tap();assert.equal(await page.evaluate(()=>__dbg.sfx.getMusicState().active),false);
    await page.locator('#mute').tap();await wait(()=>__dbg.sfx.getMusicState().active);
    // Muted background must stop the actual synth; restore browser visibility for remaining QA.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>__dbg.sfx.getMusicState().active),false);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await wait(()=>__dbg.sfx.getMusicState().active);
    await tap('musicPlay');await wait(()=>!__dbg.sfx.getMusicState().active);await page.locator('#mute').tap();
    await settle([-.75,1.52,.16]);await shot('390-center');
    checks.push('direct screen tabs, bounded temperature, fan/AC/readout; real independent music synth, volume zero, global mute/background cancellation and resume');
    await zone('灯光');await page.locator('#mute').tap();await tap('lampKnob');await wait(()=>document.body.classList.contains('talking'));await tap('lampKnob');await tap('lampKnob');assert.equal((await state()).l.lampMode,'OFF');await page.locator('#mute').tap();
    await page.getByRole('button',{name:'给家长',exact:true}).tap();assert.ok((await page.locator('.cockpit-details').innerText()).includes('示宽灯'));await page.locator('.cockpit-details button').tap();
    for(const size of [{width:390,height:844},{width:360,height:800},{width:844,height:390}]){
      await page.setViewportSize(size);await zone('中控');
      const targets=await page.locator('.cockpit-panel button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}).filter(r=>r.width>0));
      assert.ok(targets.every(r=>r.width>=44&&r.height>=44&&r.x>=0&&r.y>=0&&r.right<=size.width&&r.bottom<=size.height), 'minimum 44px targets and viewport bounds '+JSON.stringify(size));
    }
    await page.setViewportSize({width:390,height:844});await zone('驾驶');
    const before=await page.evaluate(()=>({yaw:__dbg.cam.cockpitYaw,pitch:__dbg.cam.cockpitPitch}));
    await page.mouse.move(200,170);await page.mouse.down();await page.mouse.move(330,230,{steps:8});await page.mouse.up();
    assert.notEqual(await page.evaluate(()=>__dbg.cam.cockpitYaw),before.yaw);
    const exteriorZoom=await page.evaluate(()=>__dbg.cam.zoom);await page.mouse.wheel(0,-120);await wait(()=>__dbg.camera.fov<65);assert.equal(await page.evaluate(()=>__dbg.cam.zoom),exteriorZoom);
    await page.evaluate(()=>__dbg.setCockpit(false));await page.getByRole('button',{name:'进入驾驶舱'}).tap();assert.equal(await page.locator('.cockpit-actions button').first().getAttribute('data-part'),'horn');
    checks.push('390x844, 360x800 and landscape 44px+ targets; bounded interior look; independent parent explanation; immediate repeat control during narration');
    await page.setViewportSize({width:1100,height:820});
    await page.evaluate(()=>{__dbg.setMode('xray');__dbg.cam.tTheta=-1.05;__dbg.cam.tPhi=.9;__dbg.cam.zoom=.65;__dbg.cam.last=performance.now()+100000;});await wait(()=>__dbg.S.xr>.99);await shot('inside-overview');
    await page.evaluate(()=>__dbg.setMode('explode'));await wait(()=>__dbg.S.ex>.99);await shot('exploded');
    assert.ok(await page.evaluate(()=>{const d=__dbg;return d.PARTS.windowleft.groups[0].parent.parent.userData.doorPivot&&d.PARTS.horn.groups[0].parent.parent===d.PARTS.steer.groups[0];}));
    await page.evaluate(()=>__dbg.setMode('whole'));await wait(()=>__dbg.S.ex<.01&&__dbg.S.xr<.01);
    // Both tray and canvas use opt-in immediate behavior; other scenes keep original policy.
    await page.evaluate(()=>__dbg.setMode('xray'));await wait(()=>__dbg.S.xr>.99);await page.locator('#mute').tap();
    await page.locator('#trayIn .tile').filter({hasText:'灯光旋钮'}).tap();await page.locator('#trayIn .tile').filter({hasText:'危险报警闪光灯'}).tap();assert.equal((await state()).l.turnMode,'HAZARD');await page.locator('#mute').tap();
    checks.push('xray/explode/reassembly retain attachment and state; selectable tray remains operable during narration');
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{__dbg.setCockpit(true);SCENES.car.weather.setRainLevel('HEAVY');});await settle([-1.47,1.55,-.12]);await shot('390-heavy-rain');
    const performance=await page.evaluate(()=>new Promise(resolve=>{let prev=performance.now(),deltas=[];function sample(t){deltas.push(t-prev);prev=t;if(deltas.length===30)resolve({meanFrameMs:deltas.reduce((a,b)=>a+b,0)/deltas.length,maxFrameMs:Math.max(...deltas),lost:(document.querySelector('#c').getContext('webgl2')||document.querySelector('#c').getContext('webgl')).isContextLost()});else requestAnimationFrame(sample);}requestAnimationFrame(sample);}));
    assert.equal(performance.lost,false);checks.push('heavy rain bounded at 360 instances, no context loss (software-renderer timing recorded)');
    for(const id of ['washer','elevator','jet','excavator']){
      await load(id);const r=await page.evaluate(()=>{const d=__dbg,gl=document.querySelector('#c').getContext('webgl2')||document.querySelector('#c').getContext('webgl');d.setMode('xray');d.setMode('explode');d.setMode('whole');document.querySelector('#go').click();return {count:Object.keys(d.PARTS).length,drive:d.S.drive,lost:gl.isContextLost(),carUI:!!document.querySelector('.cockpit-panel'),immediate:Object.values(d.PARTS).some(p=>p.immediate)};});
      assert.ok(r.count>0&&r.drive&&!r.lost&&!r.carUI&&!r.immediate);checks.push(id+' minimal regression: load/start/view transitions and unaffected control policy');
    }
    assert.deepEqual(errors,[]);
    const report={status:'PASS',checks,touch,geometry,performance,errors,screenshots:fs.readdirSync(out).filter(n=>n.endsWith('.png')),limitations:['HarmonyOS hardware not available','WebAudio nodes/gain verified; human audible quality not verified','New narration uses system speech fallback; formal MP3 not generated','SwiftShader timing does not measure mobile GPU performance']};
    fs.writeFileSync(path.join(out,'qa-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }catch(e){fs.writeFileSync(path.join(out,'qa-failure.json'),JSON.stringify({status:'FAIL',error:e.stack,checks,errors},null,2));if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
