/* Driving-area visual baseline and browser QA. Real rendering and pointers.
   NODE_PATH=<playwright-core parent> LE_QA_URL=http://127.0.0.1:19766
   node tools/qa_car_driving.cjs --baseline  (before changing geometry)
   node tools/qa_car_driving.cjs             (after implementation)
   Outputs are outside the checkout. Fixed camera overrides apply only to captures. */
const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.LE_QA_URL||'http://127.0.0.1:19766';
const out=process.env.LE_QA_OUT||'/workspace/LittleExplorer-artifacts/v03-driving';
const baseline=process.argv.includes('--baseline');
const BASELINE='edabab57fdc4aeeb149889adf412c7907a1699a5';
const {execFileSync}=require('node:child_process');
const readBaseline=file=>execFileSync('git',['show',BASELINE+':'+file],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
function wav(samples,rate,file){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);samples.forEach((x,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,x))*32767),44+i*2));fs.writeFileSync(file,b);}
async function drivingQA(page,errors){
 const checks=[],hits=[],audio=[];const pass=s=>{checks.push(s);console.log('PASS',s);};
 const wait=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:90000});
 const input=await page.context().newCDPSession(page);
 const state=()=>page.evaluate(()=>({c:SCENES.car.controls.getState(),w:SCENES.car.weather.getState(),l:SCENES.car.lighting.getState()}));
 await page.setViewportSize({width:390,height:844});
 await wait(()=>__dbg.camera.position.distanceTo(new __dbg.THREE.Vector3(-1.62,1.60,-.34))<.01);
 await page.screenshot({path:path.join(out,'driving-390.png')});
 async function tap3D(id,marker){
  const point=await page.evaluate(({id,marker})=>{const d=__dbg,m=d.PARTS[id].meshes.find(m=>m.userData.carControl===marker);if(!m)throw Error('Missing target '+marker);m.updateWorldMatrix(true,false);d.camera.updateMatrixWorld();const v=m.getWorldPosition(new THREE.Vector3()).project(d.camera);d.S.sel=null;const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;const blocked=[...document.querySelectorAll('.top,.bottom')].some(e=>{const r=e.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});return {x,y,blocked};},{id,marker});
  const size=page.viewportSize();assert.ok(point.x>0&&point.x<size.width&&point.y>0&&point.y<size.height&&!point.blocked,JSON.stringify({id,point,size}));
  await Promise.all([input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]}),input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})]);await wait(id=>__dbg.S.sel===id,id);hits.push({id,marker,viewport:size,point});
 }
 // Capture the live native AudioContext output in parallel with the real destination.
 // Only narration is suppressed; horn generation, envelopes and pointers are real.
 await page.locator('#mute').tap();
 await page.evaluate(async()=>{
  const c=__dbg.sfx.ac(),tap=c.createGain(),sink=c.createGain();sink.gain.value=0;
  const module=URL.createObjectURL(new Blob([`class PCMMonitor extends AudioWorkletProcessor{constructor(){super();this.buf=new Float32Array(2048);this.offset=0;}process(inputs){const x=inputs[0]?.[0];if(x)this.buf.set(x,this.offset);else this.buf.fill(0,this.offset,this.offset+128);this.offset+=128;if(this.offset===2048){this.port.postMessage({pcm:this.buf,start:currentTime+128/sampleRate-2048/sampleRate},[this.buf.buffer]);this.buf=new Float32Array(2048);this.offset=0;}return true;}}registerProcessor('pcm-monitor',PCMMonitor);`],{type:'text/javascript'}));
  await c.audioWorklet.addModule(module);URL.revokeObjectURL(module);
  const proc=new AudioWorkletNode(c,'pcm-monitor');tap.connect(proc);proc.connect(sink);sink.connect(c.destination);
  const original=AudioNode.prototype.connect,originalTone=__dbg.sfx.tone;
  const tape=window.__audioTape={samples:[],frames:[],presses:[],pointers:[],tones:[],connections:0,rate:c.sampleRate,original,originalTone,proc,tap,sink};
  AudioNode.prototype.connect=function(dest,...args){if(this.context===c&&dest===c.destination&&this!==sink){tape.connections++;original.call(this,tap);}return original.call(this,dest,...args);};
  __dbg.sfx.tone=function(...args){tape.tones.push(args);return originalTone.apply(this,args);};
  const pad=()=>{let m;__dbg.root.traverse(o=>{if(o.userData.carControl==='horn-pad')m=o;});return m;};
  for(const kind of ['pointerdown','pointerup'])document.querySelector('#c').addEventListener(kind,e=>{if(tape.record)tape.pointers.push({kind,native:e.timeStamp,handled:performance.now(),trusted:e.isTrusted});});
  document.querySelector('#c').addEventListener('pointerup',()=>{if(tape.record&&__dbg.S.sel==='horn'){tape.presses.push(pad().position.z);tape.from=c.currentTime;tape.samples=[];}});
  const observe=()=>{if(tape.record)tape.frames.push(pad().position.z);if(!tape.done)requestAnimationFrame(observe);};requestAnimationFrame(observe);
  proc.port.onmessage=e=>{if(tape.record&&tape.from!==null&&tape.samples.length<c.sampleRate*2){const i=Math.max(0,Math.ceil((tape.from-e.data.start)*c.sampleRate));if(i<e.data.pcm.length)tape.samples.push(...e.data.pcm.subarray(i));}};
 });
 async function record(level,muted,name){
  await page.evaluate(level=>{SCENES.car.controls.setVolumeLevel(level);__audioTape.samples=[];__audioTape.from=null;__audioTape.frames=[];__audioTape.presses=[];__audioTape.tones=[];__audioTape.pointers=[];__audioTape.connections=0;__audioTape.record=true;},level);
  await tap3D('horn','horn-pick');
  await wait(()=>__audioTape.presses.some(z=>z<-.009)&&__audioTape.frames.some(z=>z<-.002));
  await wait(()=>__audioTape.samples.length>__audioTape.rate*.8);
  const data=await page.evaluate(()=>{__audioTape.record=false;return {samples:__audioTape.samples,presses:__audioTape.presses,frames:__audioTape.frames,pointers:__audioTape.pointers,tones:__audioTape.tones,connections:__audioTape.connections,hidden:document.hidden,muted:__dbg.sfx.isMuted(),rate:__audioTape.rate,context:__dbg.sfx.ctx.state};});
  assert.equal(data.context,'running');
  const clearance=await page.evaluate(press=>{const p=__dbg.PARTS.horn,face=p.meshes.find(m=>m.userData.carControl==='horn-face'),base=p.meshes.find(m=>m.userData.carControl==='horn-base');face.geometry.computeBoundingBox();base.geometry.computeBoundingBox();return face.position.z+press+face.geometry.boundingBox.max.z-base.geometry.boundingBox.max.z;},Math.min(...data.presses));assert.ok(clearance>.002,'horn face must remain above base when pressed');const signal=data.samples;let first=signal.findIndex(x=>Math.abs(x)>1e-4),last=signal.length-1;while(last>=0&&Math.abs(signal[last])<=1e-4)last--;
  const active=first<0?[]:signal.slice(first,last+1),peak=signal.reduce((a,x)=>Math.max(a,Math.abs(x)),0),rms=active.length?Math.sqrt(active.reduce((a,x)=>a+x*x,0)/active.length):0;
  const amplitude=f=>{let re=0,im=0;active.forEach((x,i)=>{re+=x*Math.cos(2*Math.PI*f*i/data.rate);im+=x*Math.sin(2*Math.PI*f*i/data.rate);});return active.length?Math.hypot(re,im)/active.length:0;};
  const result={name,level,muted,pointerEvents:data.pointers,tones:data.tones,connections:data.connections,hidden:data.hidden,globalMuted:data.muted,pressedClearance:clearance,pressAtEvent:data.presses,minimumRenderedZ:Math.min(...data.frames),peak,rms,activeSeconds:active.length/data.rate,frequency420:amplitude(420),frequency525:amplitude(525),context:data.context};
  if(muted||!level)assert.ok(peak<1e-6,JSON.stringify(result));else{assert.ok(peak>.01&&peak<.2&&result.activeSeconds<.5&&result.frequency420>.001&&result.frequency525>.001,JSON.stringify(result));wav(signal,data.rate,path.join(out,name+'.wav'));}
  audio.push(result);await wait(()=>{let m;__dbg.root.traverse(o=>{if(o.userData.carControl==='horn-pad')m=o;});return Math.abs(m.position.z)<.001;});return result;
 }
 const low=await record(1,false,'horn-low'),high=await record(3,false,'horn-high');assert.ok(high.rms>low.rms*2.5&&high.rms<low.rms*3.5);
 await record(0,false,'horn-volume-zero');await page.locator('#mute').tap();await record(3,true,'horn-muted');
 await page.evaluate(()=>{const t=__audioTape;AudioNode.prototype.connect=t.original;t.done=true;__dbg.sfx.tone=t.originalTone;t.proc.disconnect();t.tap.disconnect();t.sink.disconnect();SCENES.car.controls.setVolumeLevel(2);});
 pass('real ray horn hit, visible depression/release, native PCM output with 420/525Hz, finite duration, volume ratio/zero and global mute');
 for(const mode of ['LEFT','RIGHT','OFF']){await tap3D('turnStalk','turn-stalk-pick');assert.equal((await state()).l.turnMode,mode);}
 for(const [id,marker,mode]of [['turnControlLeft','turn-left-pick','LEFT'],['turnControlLeft','turn-left-pick','OFF'],['turnControlRight','turn-right-pick','RIGHT']]){await tap3D(id,marker);assert.equal((await state()).l.turnMode,mode);}
 async function sync(mode){await wait(mode=>{const p=__dbg.PARTS,vals=id=>p[id].meshes.filter(m=>m.userData.carLamp?.startsWith('turn-')).map(m=>m.userData.dynInt);let indicators={};p.instruments.groups[0].traverse(o=>{if(o.userData.carIndicator)indicators[o.userData.carIndicator]=o.userData.dynInt;});return ['LEFT','RIGHT'].every(side=>{const on=mode===side||mode==='HAZARD',a=vals(side==='LEFT'?'turnLeft':'turnRight');return a.length===2&&a.every(v=>on?v>2:v===0)&&(on?indicators[side]>1:indicators[side]===0);});},mode);}
 await sync('RIGHT');await page.getByRole('button',{name:'查看灯光区'}).tap();await page.locator('[data-part="hazard"]').tap();await sync('HAZARD');await page.locator('[data-part="hazard"]').tap();await sync('OFF');
 await page.getByRole('button',{name:'查看驾驶区'}).tap();await wait(()=>__dbg.camera.position.distanceTo(new THREE.Vector3(-1.62,1.60,-.34))<.01);
 pass('lever body OFF/LEFT/RIGHT and direct arrow toggle; rear/front and instrument arrows synchronous including hazard');
 for(const mode of ['SLOW','FAST','OFF']){await tap3D('wiperControl','wiper-stalk-pick');assert.equal((await state()).w.wiperMode,mode);await wait(mode=>__dbg.PARTS.wiperControl.meshes.filter(m=>m.userData.carWiperMode).every(m=>m.material.opacity===(m.userData.carWiperMode===mode?1:.3)),mode);}
 for(const level of ['NONE','LIGHT','MEDIUM','HEAVY']){await page.evaluate(level=>{SCENES.car.weather.setRainLevel(level);SCENES.car.weather.setWiperMode('SLOW');},level);assert.equal((await state()).w.wiperMode,'SLOW');}
 await page.evaluate(()=>{SCENES.car.weather.setRainLevel('NONE');SCENES.car.weather.setWiperMode('OFF');});
 pass('right lever actual ray cycling and gear-mark feedback; rain/wiper state independence');
 await page.locator('[data-part="start"]').tap();assert.equal((await state()).c.gearMode,'P');assert.equal((await state()).c.moving,false);
 await page.locator('[data-part="gearControl"]').tap();assert.equal((await state()).c.gearMode,'D');
 await wait(()=>__dbg.PARTS.instruments.meshes.find(m=>m.userData.carReadout==='speed').userData.text===String(SCENES.car.controls.getState().speed));
 assert.ok((await state()).c.speed>0);await page.locator('[data-part="gearControl"]').tap();await page.locator('[data-part="start"]').tap();
 await wait(()=>__dbg.PARTS.instruments.meshes.find(m=>m.userData.carReadout==='speed').userData.text==='0');
 pass('P start, D movement and calibrated demonstration speed, P/stop restore zero');
 for(const size of [{width:390,height:844},{width:360,height:800},{width:844,height:390}]){
  await page.setViewportSize(size);await wait(()=>__dbg.camera.aspect===innerWidth/innerHeight);
  await tap3D('horn','horn-pick');await tap3D('turnControlLeft','turn-left-pick');await tap3D('turnControlRight','turn-right-pick');await tap3D('wiperControl','wiper-stalk-pick');
  const bounds=await page.locator('.cockpit-panel button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect()).filter(b=>b.width>0).map(r=>({w:r.width,h:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom})));
  assert.ok(bounds.every(r=>r.w>=44&&r.h>=44&&r.x>=0&&r.y>=0&&r.right<=size.width&&r.bottom<=size.height));
  await page.screenshot({path:path.join(out,'driving-'+size.width+'x'+size.height+'.png')});
 }
 pass('real canvas hit paths at 390x844, 360x800 and landscape; panel fallback 44px+');
 const budget=await page.evaluate(()=>({parts:Object.keys(__dbg.PARTS).length,meshes:Object.values(__dbg.PARTS).reduce((n,p)=>n+p.meshes.length,0)}));assert.equal(budget.parts,56);assert.ok(budget.meshes<=544);
 assert.deepEqual(errors,[]);const report={status:'PASS',baseline:BASELINE,checks,hits,audio,budget,errors,audioSource:'Local WebAudio 420/525 Hz triangle oscillators; captured native output, no car recording or narration changes',limitations:['No HarmonyOS physical device or physical speaker/headphone listening test','Digital output tested; perceptual realism needs human listening','Software WebGL does not measure phone GPU speed'],fixedViews:views};
 fs.writeFileSync(path.join(out,'driving-qa.json'),JSON.stringify(report,null,2));return report;
}
const views={
 panorama:{eye:[-1.47,1.55,-.12],target:[.64,1.04,-.08],fov:72},
 steering:{eye:[-.52,1.52,-.43],target:[.48,1.26,-.43],fov:52},
 instruments:{eye:[-.30,1.70,-.43],target:[.61,1.23,-.43],fov:52},
 stalks:{eye:[-.64,1.59,-.43],target:[.54,1.30,-.43],fov:58}
};
async function capture(page,folder){
 fs.mkdirSync(folder,{recursive:true});
 for(const [name,view]of Object.entries(views)){
  await page.evaluate(view=>{window.__qaView=view;__dbg.S.sel=null;},view);
  await page.waitForFunction(v=>__dbg.camera.position.distanceTo(new __dbg.THREE.Vector3(...v.eye))<.008&&Math.abs(__dbg.camera.fov-v.fov)<.1,view,{timeout:90000});
  await page.screenshot({path:path.join(folder,name+'.png')});console.log('Captured',name);
 }
 fs.writeFileSync(path.join(folder,'cameras.json'),JSON.stringify(views,null,2));
 await page.evaluate(()=>window.__qaView=null);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.LE_QA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const errors=[];let page;
 try{
  page=await browser.newPage({viewport:{width:1100,height:820},hasTouch:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  if(baseline)await page.route(/\/(?:scenes\/car(?:\/[^?]+)?|js\/app)\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'application/javascript',body:readBaseline(new URL(r.request().url()).pathname.slice(1))}));
  await page.route('**/scenes/car/car_cockpit.js*',async r=>{
   const response=await r.fetch();const body=baseline?readBaseline('scenes/car/car_cockpit.js'):await response.text();
   await r.fulfill({response,body:body+`\n(function(){const make=LECar.createCockpitBuilder;LECar.createCockpitBuilder=function(ctx,...args){const b=make(ctx,...args),build=b.build;b.build=function(...args){const obj=build(...args),view=obj.cockpitView;obj.cockpitView=function(options){const v=window.__qaView;if(!v)return view(options);return {position:ctx.root.localToWorld(new THREE.Vector3(...v.eye)),target:ctx.root.localToWorld(new THREE.Vector3(...v.target)),fov:v.fov};};return obj;};return b;};})();`});
  });
  await page.addInitScript(()=>{localStorage.setItem('muted','1');localStorage.setItem('voice','sys');if(window.speechSynthesis)window.speechSynthesis.speak=u=>queueMicrotask(()=>u.onend?.());let seed=25;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(base+'/pages/car.html');await page.waitForFunction(()=>window.__dbg,null,{timeout:90000});
  await page.getByRole('button',{name:'进入驾驶舱'}).tap();
  if(!process.argv.includes('--skip-capture'))await capture(page,path.join(out,baseline?'baseline':'upgraded'));else await page.evaluate(()=>window.__qaView=null);
  assert.deepEqual(errors,[]);
  console.log(process.argv.includes('--skip-capture')?'Using saved captures':'PASS fixed-view captures',Object.keys(views).join(', '));
  if(baseline)fs.writeFileSync(path.join(out,'baseline/source.json'),JSON.stringify({commit:BASELINE,scope:'Pinned car modules and js/app.js',viewport:{width:1100,height:820},views},null,2));
  if(!baseline){
   await drivingQA(page,errors);
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'baseline/cameras.json'))),views);
   fs.writeFileSync(path.join(out,'comparison.html'),'<!doctype html><meta charset="utf-8"><title>V0.2 / V0.3-A 同视角对比</title><style>body{background:#14212c;color:#eef7ff;font:16px sans-serif;margin:20px}section{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%}h2{margin-top:36px}</style><h1>V0.2 / V0.3-A 同视角对比</h1><p>相同视口 1100×820、相机、P 档、停止、无雨、灯光关闭。音频听感与 HarmonyOS 实机待人工验收。</p>'+Object.keys(views).map(name=>'<h2>'+name+'</h2><section><div>V0.2<img src="baseline/'+name+'.png"></div><div>V0.3-A<img src="upgraded/'+name+'.png"></div></section>').join(''));
  }
 }catch(e){fs.mkdirSync(out,{recursive:true});const diagnostic=page?await page.evaluate(()=>({selected:window.__dbg?.S.sel,tape:window.__audioTape?{sampleCount:__audioTape.samples.length,peak:__audioTape.samples.reduce((a,x)=>Math.max(a,Math.abs(x)),0),frames:__audioTape.frames,presses:__audioTape.presses,pointers:__audioTape.pointers,tones:__audioTape.tones,connections:__audioTape.connections,hidden:document.hidden,muted:__dbg.sfx.isMuted(),context:__dbg.sfx.ctx.state}:null})).catch(()=>null):null;fs.writeFileSync(path.join(out,'driving-failure.json'),JSON.stringify({status:'FAIL',error:e.stack,diagnostic,errors},null,2));if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
