'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
module.exports=async function(env){
 const {open,click,check,shot}=env,OUT=process.env.LE_V33_QA_OUT||path.join(ROOT,'docs/qa/cockpit-desktop-v3/v33/audio-repair');
 const stats=values=>{let sum=0,peak=0,clipped=0,jump=0;for(let i=0;i<values.length;i++){const v=values[i];assert.ok(Number.isFinite(v));sum+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=.98)clipped++;if(i)jump=Math.max(jump,Math.abs(v-values[i-1]));}return{samples:values.length,rms:Math.sqrt(sum/values.length),peak,fullScaleSamples:clipped,maxSampleJump:jump};};
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/cockpit-voice/manifest.json')));
 for(const [width,height]of [[1366,768],[1920,1080]]){
  const {p,c}=await open(width,height,false,true);
  await p.evaluate(()=>{
   window.__nativeSpeechCalls=0;const orig=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=u=>{__nativeSpeechCalls++;return orig(u);};
   window.__mediaEvents=[];window.__media=[];const Native=window.Audio; // product instances already created; capture by actual play events below
   for(const type of ['play','playing','ended','pause','error'])document.addEventListener(type,()=>{},true);
   const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){
    if(!__media.includes(this)){__media.push(this);for(const event of ['play','playing','ended','pause','error'])this.addEventListener(event,e=>__mediaEvents.push({event,src:this.currentSrc,trusted:e.isTrusted,time:this.currentTime,at:performance.now()}));}
    return play.apply(this,args);
   };
  });
  await p.waitForFunction(()=>document.querySelector('#voiceToggle').dataset.audioState==='ready');
  assert.equal(await p.evaluate(()=>__audioCapture.length),0,'No autoplay graph before first interaction');
  await click(p,'#voiceToggle');await click(p,'#belt');await click(p,'#brake');await click(p,'#start');
  await p.waitForFunction(()=>__audioCapture[0]?.ctx.state==='running');await p.waitForTimeout(950);
  // Observe raw post-limiter/master PCM using a zero-output worklet branch.
  await p.evaluate(async()=>{
   const a=__audioCapture[0],src=`class Capture extends AudioWorkletProcessor{constructor(){super();this.recording=false;this.port.onmessage=e=>{this.recording=e.data;};}process(inputs,outputs){const input=inputs[0]?.[0];if(this.recording&&input)this.port.postMessage(Array.from(input));return true;}}registerProcessor('actual-output-capture',Capture);`;
   await a.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
   window.__pcmNode=new AudioWorkletNode(a.ctx,'actual-output-capture');window.__pcm=[];__pcmNode.port.onmessage=e=>__pcm.push(...e.data);a.output.connect(__pcmNode);__pcmNode.connect(a.ctx.destination);
   window.__engineAnalyser=a.ctx.createAnalyser();__engineAnalyser.fftSize=2048;a.gains[0].connect(__engineAnalyser);
  });
  const begin=()=>p.evaluate(()=>{__pcm=[];__pcmNode.port.postMessage(true);window.__chunks=[];window.__rec=new MediaRecorder(__audioCapture[0].stream,{mimeType:'audio/webm;codecs=opus'});__rec.ondataavailable=e=>__chunks.push(e.data);__rec.start();});
  const finish=async(name)=>{
   const result=await p.evaluate(()=>new Promise(resolve=>{__pcmNode.port.postMessage(false);__rec.onstop=async()=>{await new Promise(r=>setTimeout(r,80));resolve({pcm:__pcm,bytes:Array.from(new Uint8Array(await new Blob(__chunks).arrayBuffer())),rate:__audioCapture[0].ctx.sampleRate});};__rec.stop();}));
   const file=path.join(OUT,`${name}-${width}.webm`);fs.writeFileSync(file,Buffer.from(result.bytes));const raw=execFileSync('ffmpeg',['-v','error','-i',file,'-ac','1','-f','f32le','pipe:1'],{maxBuffer:32*1024*1024}),decoded=[];for(let i=0;i<raw.length;i+=4)decoded.push(raw.readFloatLE(i));
   const b=Buffer.alloc(result.pcm.length*4);result.pcm.forEach((v,i)=>b.writeFloatLE(v,i*4));const wav=execFileSync('ffmpeg',['-v','error','-f','f32le','-ar',String(result.rate),'-ac','1','-i','pipe:0','-f','wav','pipe:1'],{input:b,maxBuffer:20*1024*1024});fs.writeFileSync(path.join(OUT,`${name}-${width}.wav`),wav);
   const evidence={raw:stats(result.pcm),decoded:stats(decoded)};assert.ok(evidence.raw.samples>3000);assert.ok(evidence.raw.peak<.8&&evidence.decoded.peak<.8);assert.equal(evidence.raw.fullScaleSamples,0);assert.equal(evidence.decoded.fullScaleSamples,0);return evidence;
  };
  const engineLevel=()=>p.evaluate(()=>{const b=new Float32Array(2048);__engineAnalyser.getFloatTimeDomainData(b);return Math.sqrt(b.reduce((s,v)=>s+v*v,0)/b.length);});
  await begin();await p.waitForTimeout(700);const idle=await finish('engine-idle');const before=await engineLevel();
  await click(p,'#voiceToggle');await click(p,'[data-tab="lights"]');await begin();await click(p,'[data-lamp="POSITION"]');
  await p.waitForFunction(()=>__mediaEvents.some(e=>e.event==='playing'&&e.src.includes('/assets/cockpit-voice/')));await p.waitForTimeout(500);const during=await engineLevel();
  await p.waitForFunction(()=>__mediaEvents.some(e=>e.event==='ended'&&e.src.includes('/assets/cockpit-voice/')),{},{timeout:20000});await p.waitForTimeout(800);const after=await engineLevel(),speechMix=await finish('chinese-engine-mix');
  assert.ok(speechMix.raw.rms>idle.raw.rms*1.5);assert.ok(during<before*.4);assert.ok(after>before*.8&&after<before*1.2);
  // Worst user volume settings still pass the same strict headroom requirement.
  await click(p,'[data-tab="cabin"]');await p.locator('#voiceVolume').press('End');await p.locator('#engineVolume').press('End');await click(p,'[data-tab="lights"]');await begin();await click(p,'[data-lamp="HEADLIGHT"]');await p.waitForTimeout(500);await click(p,'#wheelHorn');await p.waitForTimeout(1300);const triple=await finish('max-voice-engine-horn');
  assert.ok(triple.raw.rms>idle.raw.rms*2);assert.ok(triple.raw.maxSampleJump<.15);
  await click(p,'#voiceToggle');await p.waitForTimeout(800);assert.ok(await engineLevel()>before*.8,'Voice off releases engine duck');
  await click(p,'#audioMute');await p.waitForTimeout(650);await begin();await click(p,'#voiceToggle');await click(p,'[data-lamp="AUTO"]');await click(p,'#wheelHorn');await p.waitForTimeout(700);const muted=await finish('all-muted');assert.ok(muted.raw.peak<.0001&&muted.decoded.peak<.001);
  assert.equal(await p.evaluate(()=>__media.filter(e=>!e.paused).length),0,'Mute cancels and suppresses voice');await click(p,'#audioMute');await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>__media.filter(e=>!e.paused).length),0,'Unmute never replays cancelled speech');
  await click(p,'[data-tab="cabin"]');await p.locator('#voiceVolume').press('Home');await click(p,'[data-tab="lights"]');await click(p,'[data-lamp="OFF"]');assert.equal(await p.evaluate(()=>__media.filter(e=>!e.paused).length),0,'Voice slider zero suppresses new requests');
  await click(p,'[data-tab="cabin"]');await p.locator('#voiceVolume').press('End');await click(p,'[data-tab="lights"]');for(let i=0;i<8;i++)await click(p,`[data-lamp="${i%2?'POSITION':'HEADLIGHT'}"]`);await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>__media.filter(e=>e.currentSrc.includes('/assets/cockpit-voice/')&&!e.paused).length),1);assert.equal(await p.evaluate(()=>__audioCapture.length),1);assert.equal(await p.evaluate(()=>__audioCapture[0].oscillators),4);await click(p,'#voiceToggle');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>__media.filter(e=>!e.paused).length),0);
  // All shipped files are browser-decoded; complete runtime cue coverage below
  // uses real clicks, never assignment to state or direct handler calls.
  const decoded=await p.evaluate(async clips=>{const result=[];for(const clip of clips){const r=await fetch(clip.file),b=await __audioCapture[0].ctx.decodeAudioData(await r.arrayBuffer());result.push({id:clip.id,duration:b.duration,samples:b.length});}return result;},manifest.clips);assert.equal(decoded.length,96);assert.ok(decoded.every(d=>d.duration>.5&&d.samples>1000));
  assert.equal(await p.evaluate(()=>__nativeSpeechCalls),0);
  const events=await p.evaluate(()=>__mediaEvents);assert.ok(events.some(e=>e.event==='ended'&&e.trusted&&e.time>0));assert.ok(!events.some(e=>e.event==='error'));
  await shot(p,`repaired-audio-${width}x${height}`);await check(p,`Prerecorded Chinese + engine/horn actual PCM, duck/recovery, cancellation, peak, master mute, voice volume and browser decode ${width}×${height}`,{idle,speechMix,triple,muted,engineRMS:{before,during,after},decodedClips:decoded,events,nativeSpeechCalls:0,music:'ASSET_BLOCKED; no formal music playback claim'});await c.close();
 }
};

module.exports.coverage=async function({open,click,check}){
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/cockpit-voice/manifest.json'))),byText=new Map(manifest.clips.map(x=>[x.text,x]));
 const {p,c}=await open(1366,768);const observed=[];
 await p.waitForFunction(()=>document.querySelector('#voiceToggle').dataset.audioState==='ready');
 await p.evaluate(()=>{window.__cuePlays=[];const native=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(!this.__cueObserved){this.__cueObserved=true;this.addEventListener('playing',e=>__cuePlays.push({src:this.currentSrc,trusted:e.isTrusted,at:performance.now()}));}return native.apply(this,args);};});
 const cue=async selector=>{
  const n=await p.evaluate(()=>__cuePlays.length);await click(p,selector);
  const text=await p.evaluate(()=>document.querySelector('#feedbackTitle').textContent+'。'+document.querySelector('#feedbackBody').textContent);
  const clip=byText.get(text);assert.ok(clip,'Missing actual runtime Chinese cue: '+text);
  await p.waitForFunction(({n,id})=>__cuePlays.slice(n).some(e=>e.trusted&&e.src.includes(id)),{n,id:clip.id});observed.push({selector,id:clip.id,text});
 };
 await cue('#start');await cue('#accelerate');await cue('[data-gear="R"]');await cue('#handbrake');await click(p,'#brake');await cue('[data-gear="R"]');await cue('[data-gear="N"]');await cue('#start');await cue('[data-gear="P"]');await cue('#start');await cue('[data-gear="D"]');await cue('#accelerate');await cue('#handbrake');await cue('#belt');await cue('#belt');await cue('[data-gear="N"]');await cue('#accelerate');await cue('[data-gear="D"]');await cue('#accelerate');await cue('#handbrake');await cue('#accelerate');
 await click(p,'#brake');await cue('#handbrake');await click(p,'#accelerate');await p.waitForFunction(()=>+document.querySelector('#speedVal').textContent>1);
 await cue('#belt');await cue('#start');await cue('#handbrake');await cue('[data-gear="R"]');await cue('[data-gear="S"]');await cue('[data-gear="D"]');await click(p,'#brake');await p.waitForFunction(()=>document.querySelector('#speedVal').textContent==='0');await cue('[data-gear="P"]');await cue('[data-gear="R"]');await cue('[data-gear="N"]');await cue('[data-gear="D"]');await cue('[data-gear="S"]');await cue('#handbrake');await cue('[data-gear="P"]');await cue('#start');await cue('#belt');
 for(const id of ['#doorlock','#doorlock'])await cue(id);
 await click(p,'[data-tab="lights"]');for(const level of ['AUTO','POSITION','HEADLIGHT','OFF'])await cue(`[data-lamp="${level}"]`);for(const id of ['#turnLeft','#turnLeft','#turnRight','#turnRight','#hazard','#hazard','#fog','#fog'])await cue(id);
 await click(p,'[data-tab="weather"]');for(const level of ['NONE','LIGHT','MEDIUM','HEAVY','STORM','STORM','SNOW','FOG'])await cue(`[data-rain="${level}"]`);for(const level of ['OFF','LOW','MEDIUM','HIGH'])await cue(`[data-wiper="${level}"]`);await cue('#night');await cue('#day');
 await click(p,'[data-tab="cabin"]');for(let i=0;i<10;i++)await cue('#tempDown');for(let i=0;i<16;i++)await cue('#tempUp');for(let i=0;i<16;i++)await cue('#tempDown');for(const level of [0,1,2,3])await cue(`[data-fan="${level}"]`);for(const level of ['WINDSHIELD','FACE','FEET','FACE_FEET','FEET_WINDSHIELD'])await cue(`[data-vent="${level}"]`);await cue('#window');await cue('#window');
 const played=new Set(observed.map(x=>x.id)),unreachable=manifest.clips.filter(x=>!played.has(x.id));
 assert.equal(played.size,94);assert.deepEqual(unreachable.map(x=>x.text).sort(),['温度 16 度。调高一点。','温度 30 度。降低一点。'].sort());
 await click(p,'#voiceToggle');await check(p,'All 94 reachable spoken runtime keys start their exact prerecorded MP3 via real clicks, including dynamic text and every guard',{uniqueReachable:played.size,clicks:observed.length,observed,extraBoundaryPhrases:unreachable,method:'Trusted UI clicks and actual HTMLMediaElement playing events; no product-state assignment'});await c.close();
};

module.exports.deviceOutput=async function({open,click,check}){
 assert.ok(process.env.PULSE_SERVER?.startsWith('unix:/tmp/'),'Use an isolated test audio server, never alter host volume');
 const OUT=process.env.LE_V33_QA_OUT, {spawn}=require('node:child_process'),{p,c}=await open(1366,768);
 await p.waitForFunction(()=>document.querySelector('#voiceToggle').dataset.audioState==='ready');
 await p.evaluate(()=>{window.__outputSpeech=[];const native=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...a){if(!this.__outputObserved){this.__outputObserved=true;for(const type of ['playing','ended'])this.addEventListener(type,e=>__outputSpeech.push({type,src:this.currentSrc,time:this.currentTime,trusted:e.isTrusted}));}return native.apply(this,a);};});
 await click(p,'#voiceToggle');await click(p,'#belt');await click(p,'#brake');await click(p,'#start');await p.waitForTimeout(1000);
 const capture=async(name,action,ms)=>{
  const file=path.join(OUT,name+'.wav'),log=fs.openSync(path.join(OUT,name+'.log'),'w');
  const recorder=spawn('ffmpeg',['-v','error','-f','pulse','-i','le_qa.monitor','-ac','1','-ar','48000','-y',file],{stdio:['ignore','ignore',log]});
  await p.waitForTimeout(350);await action();await p.waitForTimeout(ms);recorder.kill('SIGINT');await new Promise((r,j)=>{const t=setTimeout(()=>{recorder.kill('SIGKILL');j(Error('Pulse capture timeout'));},5000);recorder.once('exit',()=>{clearTimeout(t);r();});});fs.closeSync(log);
  const raw=execFileSync('ffmpeg',['-v','error','-i',file,'-f','f32le','pipe:1'],{maxBuffer:32*1024*1024});let sum=0,peak=0,clipped=0,jump=0,previous=0;for(let i=0;i<raw.length;i+=4){const v=raw.readFloatLE(i);sum+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=.98)clipped++;if(i)jump=Math.max(jump,Math.abs(v-previous));previous=v;}return{file:path.basename(file),samples:raw.length/4,rms:Math.sqrt(sum/(raw.length/4)),peak,fullScaleSamples:clipped,maxSampleJump:jump};
 };
 const idle=await capture('device-idle',async()=>{},900);assert.ok(idle.rms>.001);
 await click(p,'#voiceToggle');await click(p,'[data-tab="lights"]');const mix=await capture('device-chinese-engine-horn',async()=>{await click(p,'[data-lamp="POSITION"]');await p.waitForTimeout(900);await click(p,'#wheelHorn');},6500);
 const events=await p.evaluate(()=>__outputSpeech);assert.ok(events.some(e=>e.type==='playing'&&e.trusted));assert.ok(events.some(e=>e.type==='ended'&&e.trusted&&e.time>0));assert.ok(mix.rms>idle.rms*1.5);assert.ok(mix.peak<.8);assert.equal(mix.fullScaleSamples,0);
 await click(p,'#audioMute');await p.waitForTimeout(650);const muted=await capture('device-all-muted',async()=>{await click(p,'#wheelHorn');await click(p,'[data-lamp="HEADLIGHT"]');},900);assert.ok(muted.peak<.0001);
 await check(p,'Actual Chromium audio-device loopback: Chinese speech + engine + horn, real ended, safe peak and global silence',{method:'Unmodified host levels; isolated PulseAudio null-sink monitor of actual Chromium output; no stream normalization/calibration',idle,mix,muted,events,physicalSpeakers:'NOT_TESTED'});await c.close();
};

module.exports.fixtureMix=async function({open,click,check}){
 const OUT=process.env.LE_V33_QA_OUT,{p,c}=await open(1366,768,false,true,true);
 await p.waitForFunction(()=>document.querySelector('#voiceToggle').dataset.audioState==='ready');await click(p,'#voiceToggle');await click(p,'#belt');await click(p,'#brake');await click(p,'#start');await click(p,'[data-tab="cabin"]');await p.waitForFunction(()=>!document.querySelector('#music').disabled);await click(p,'#music');await p.waitForTimeout(700);
 const musicBefore=await p.evaluate(()=>__audioCapture[0].gains[1].gain.value);
 await p.evaluate(()=>{window.__chunks=[];window.__rec=new MediaRecorder(__audioCapture[0].stream,{mimeType:'audio/webm;codecs=opus'});__rec.ondataavailable=e=>__chunks.push(e.data);__rec.start();});
 await click(p,'#voiceToggle');await click(p,'[data-tab="lights"]');await click(p,'[data-lamp="POSITION"]');await p.waitForFunction(()=>document.querySelector('#voiceToggle').dataset.audioState==='playing');await p.waitForTimeout(450);const musicDuring=await p.evaluate(()=>__audioCapture[0].gains[1].gain.value);await click(p,'#wheelHorn');await p.waitForFunction(()=>document.querySelector('#voiceToggle').dataset.audioState==='idle',{},{timeout:20000});await p.waitForTimeout(800);const musicAfter=await p.evaluate(()=>__audioCapture[0].gains[1].gain.value);
 const bytes=await p.evaluate(()=>new Promise(r=>{__rec.onstop=async()=>r(Array.from(new Uint8Array(await new Blob(__chunks).arrayBuffer())));__rec.stop();}));const file=path.join(OUT,'four-bus-mix-SPEECH-FIXTURE-NOT-MUSIC.webm');fs.writeFileSync(file,Buffer.from(bytes));const raw=execFileSync('ffmpeg',['-v','error','-i',file,'-ac','1','-f','f32le','pipe:1'],{maxBuffer:32*1024*1024});let sum=0,peak=0,clipped=0;for(let i=0;i<raw.length;i+=4){const v=raw.readFloatLE(i);sum+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=.98)clipped++;}assert.ok(peak<.8&&Math.sqrt(sum/(raw.length/4))>.01);assert.equal(clipped,0);assert.ok(musicDuring<musicBefore*.4&&musicAfter>musicBefore*.8);
 await check(p,'Four buses mix actual decoded output and speech ducks/restores the player bus; fixture is NOT licensed music',{musicBefore,musicDuring,musicAfter,peak,fullScaleSamples:clipped,rms:Math.sqrt(sum/(raw.length/4)),formalMusic:'ASSET_BLOCKED; two unchanged existing speech clips are QA-only transport input'});await c.close();
};
