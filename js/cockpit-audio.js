/* One lazy WebAudio graph, shared by prerecorded cockpit speech, engine, horn and licensed-track player. */
'use strict';
window.createCockpitAudio=function({state,$}){
 let ctx,engineBus,musicBus,hornBus,voiceBus,master,tone,harmonic,starter,previousEngine=false,closed=false;
 let engineVolume=.28,musicVolume=.30,voiceVolume=.45,ducked=false,speechToken=0,speechTimer;
 let lastRPM=.8,musicMuted=false,muted=false,hornUntil=0,hornTimer,mediaSource,tracks=[],trackIndex=0,playEpoch=0;
 try{muted=sessionStorage.getItem('le-cockpit-muted')==='true';}catch(_){}
 $('audioMute').setAttribute('aria-pressed',String(muted));$('audioMute').textContent=muted?'🔇':'🔊';
 const player=new Audio();player.preload='metadata';
 // A separate reusable media element feeds the SAME verified mix graph. Native
 // speechSynthesis is deliberately absent: it cannot be routed through this bus.
 const voicePlayer=new Audio();voicePlayer.preload='metadata';let voiceSource;
 const voiceStatus=value=>{ $('voiceToggle').dataset.audioState=value; };
 voiceStatus('loading');
 const voiceManifest=fetch('../assets/cockpit-voice/manifest.json?v=3.3-audio1').then(r=>{
  if(!r.ok)throw Error('voice manifest');return r.json();
 }).then(m=>{
  if(m.schemaVersion!==1||!Array.isArray(m.clips)||!m.clips.length)throw Error('voice schema');
  const clips=new Map();
  for(const clip of m.clips){
   const u=new URL(clip.file,location.href);
   if(u.origin!==location.origin||!u.pathname.startsWith(new URL('../assets/cockpit-voice/',location.href).pathname)||!u.pathname.endsWith('.mp3')||!clip.text||clips.has(clip.text))throw Error('voice clip');
   clips.set(clip.text,u.href);
  }
  voiceStatus('ready');return clips;
 }).catch(()=>{voiceStatus('unavailable');$('voiceToggle').title='中文讲解暂不可用 · Voice unavailable';return new Map();});
 voicePlayer.addEventListener('playing',()=>{voiceStatus('playing');duck(true);});
 const speechFinished=()=>{clearTimeout(speechTimer);voiceStatus('idle');duck(false);};
 voicePlayer.addEventListener('ended',speechFinished);
 voicePlayer.addEventListener('pause',()=>{if(voicePlayer.paused)speechFinished();});
 voicePlayer.addEventListener('error',()=>{speechFinished();voiceStatus('unavailable');$('voiceToggle').title='中文讲解暂不可用 · Voice unavailable';});
 const musicStatus=text=>$('musicStatus').textContent=text;
 const timeLabel=t=>Number.isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
 function renderMusic(){
  const ready=tracks.length>0;for(const id of ['music','musicPrev','musicNext','musicMute','musicVolume','musicSeek'])$(id).disabled=!ready||(id==='musicSeek'&&!Number.isFinite(player.duration));
  state.music=!player.paused&&!player.ended;
  $('music').classList.toggle('active',state.music);$('music').setAttribute('aria-pressed',String(state.music));
  $('music').querySelector('.btn-symbol').textContent=state.music?'⏸':'▶';$('music').querySelector('.zh').textContent=state.music?'暂停':'播放';$('music').querySelector('.en').textContent=state.music?'Pause':'Play';
  $('musicMute').textContent=musicMuted?'🔇':'🔊';$('musicMute').setAttribute('aria-pressed',String(musicMuted));
  $('musicElapsed').textContent=timeLabel(player.currentTime);$('musicDuration').textContent=timeLabel(player.duration);
  $('musicSeek').value=Number.isFinite(player.duration)&&player.duration>0?player.currentTime/player.duration*100:0;
 }
 function selectTrack(index){
  if(!tracks.length)return;playEpoch++;player.pause();trackIndex=(index+tracks.length)%tracks.length;
  const track=tracks[trackIndex];player.src=new URL(track.file,location.href).href;player.load();
  $('musicTrack').textContent=track.title;$('musicCredit').textContent=track.author+' · '+track.license.name+' · '+track.attribution;musicStatus('点按播放 · Tap to play');renderMusic();
 }
 async function play(){
  if(!tracks.length||!ensure())return;update();const epoch=++playEpoch;
  if(!mediaSource){mediaSource=ctx.createMediaElementSource(player);mediaSource.connect(musicBus);}
  try{await ctx.resume();if(epoch!==playEpoch||document.hidden||closed)return;await player.play();if(epoch!==playEpoch) return;musicStatus('正在播放 · Playing');}
  catch(_){if(epoch===playEpoch)musicStatus('请再次点按播放 · Tap play to enable audio');}renderMusic();
 }
 function pause(){playEpoch++;player.pause();musicStatus(tracks.length?'已暂停 · Paused':'音乐待添加 · No licensed tracks yet');renderMusic();}
 function next(direction){const wasPlaying=!player.paused;selectTrack(trackIndex+direction);if(wasPlaying)play();}
 $('music').onclick=()=>{if(player.paused)play();else pause();};$('musicPrev').onclick=()=>next(-1);$('musicNext').onclick=()=>next(1);
 $('musicMute').onclick=()=>{musicMuted=!musicMuted;update();renderMusic();};
 $('musicVolume').oninput=e=>{musicVolume=+e.target.value/100;update();};
 $('musicSeek').oninput=e=>{if(Number.isFinite(player.duration))player.currentTime=player.duration*(+e.target.value/100);renderMusic();};
 for(const event of ['timeupdate','loadedmetadata','play','pause','durationchange'])player.addEventListener(event,renderMusic);
 player.addEventListener('ended',()=>{selectTrack(trackIndex+1);play();});
 player.addEventListener('error',()=>{playEpoch++;musicStatus('曲目无法播放 · Track unavailable');renderMusic();});
 fetch('../assets/music/manifest.json?v=3.3').then(r=>{if(!r.ok)throw Error('manifest');return r.json();}).then(manifest=>{
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.tracks))throw Error('schema');
  tracks=manifest.tracks.filter(t=>{try{const u=new URL(t.file,location.href);return t.redistributionApproved===true&&u.origin===location.origin&&/\.(mp3|ogg|wav|m4a)$/i.test(u.pathname)&&[t.title,t.author,t.source,t.license?.name,t.license?.url,t.attribution].every(x=>typeof x==='string'&&x.trim());}catch(_){return false;}});
  if(tracks.length)selectTrack(0);else{musicStatus('音乐待添加 · No licensed tracks yet');renderMusic();}
 }).catch(()=>{musicStatus('音乐清单不可用 · Track list unavailable');renderMusic();});
 renderMusic();
 function status(text){$('engineAudioStatus').textContent=text;}
 function ensure(){
  if(closed)return false;
  if(!ctx){
   const C=window.AudioContext||window.webkitAudioContext;if(!C){status('此浏览器不支持声音 · Audio unavailable');return false;}
   ctx=new C();engineBus=ctx.createGain();musicBus=ctx.createGain();voiceBus=ctx.createGain();engineBus.gain.value=0;musicBus.gain.value=musicVolume;voiceBus.gain.value=voiceVolume;
   const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.005;limiter.release.value=.18;
   master=ctx.createGain();master.gain.value=muted?0:.85;
   engineBus.connect(limiter);musicBus.connect(limiter);voiceBus.connect(limiter);hornBus=ctx.createGain();hornBus.gain.value=0;hornBus.connect(limiter);
   // Smooth bounded output, in addition to the existing compressor. This limits
   // real summed samples, including attack transients, without hard clipping.
   const ceiling=ctx.createWaveShaper(),curve=new Float32Array(16385);
   for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=.85*Math.tanh(x/.85);}
   ceiling.curve=curve;ceiling.oversample='4x';limiter.connect(ceiling);ceiling.connect(master);master.connect(ctx.destination);
   // A soft two-tone horn reuses the same voices for every press.
   for(const frequency of [340,430]){const voice=ctx.createOscillator(),level=ctx.createGain();voice.type='sine';voice.frequency.value=frequency;level.gain.value=.5;voice.connect(level);level.connect(hornBus);voice.start();}
   tone=ctx.createOscillator();harmonic=ctx.createOscillator();tone.type='triangle';harmonic.type='sine';
   const blend=ctx.createGain();blend.gain.value=.3;tone.connect(engineBus);harmonic.connect(blend);blend.connect(engineBus);tone.frequency.value=49;harmonic.frequency.value=98;tone.start();harmonic.start();
   const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);let seed=71;
   for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1);}
   const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter();noise.buffer=buffer;noise.loop=true;filter.type='lowpass';filter.frequency.value=340;starter=ctx.createGain();starter.gain.value=0;noise.connect(filter);filter.connect(starter);starter.connect(engineBus);noise.start();
   ctx.onstatechange=()=>status(ctx.state==='running'?'🔉 驾驶舱声音 · Cockpit audio':ctx.state==='suspended'?'⏸ 声音已暂停 · Audio paused':'声音已释放 · Audio released');
  }
  if(ctx.state==='suspended'&&!document.hidden)ctx.resume().catch(()=>status('点按以启用声音 · Tap for audio'));
  return true;
 }
 function update(rpm=lastRPM){
  lastRPM=rpm;
  if(state.engine&&!ctx)ensure();
  if(!ctx||closed){previousEngine=state.engine;return;}
  const t=ctx.currentTime,freq=29+Math.max(.5,rpm)*24;
  if(state.engine&&!previousEngine){
   starter.gain.cancelScheduledValues(t);starter.gain.setValueAtTime(0,t);starter.gain.linearRampToValueAtTime(.7,t+.07);starter.gain.exponentialRampToValueAtTime(.0001,t+.65);
   tone.frequency.cancelScheduledValues(t);tone.frequency.setValueAtTime(32,t);tone.frequency.linearRampToValueAtTime(freq,t+.6);
  }else tone.frequency.setTargetAtTime(freq,t,.16);
  harmonic.frequency.setTargetAtTime(freq*2,t,.16);
  const hornActive=performance.now()<hornUntil,backgroundDuck=ducked?.22:hornActive?.28:1;
  const gain=state.engine?( .065+Math.min(rpm,6)*.025+(state.accel?.012:0))*engineVolume*backgroundDuck:0;
  engineBus.gain.setTargetAtTime(gain,t,state.engine?.14:.22);
  musicBus.gain.setTargetAtTime((musicMuted?0:musicVolume)*(ducked?.25:hornActive?.22:1),t,.12);
  if(!state.engine&&previousEngine)starter.gain.setTargetAtTime(0,t,.1);
  previousEngine=state.engine;
 }
 function duck(on){ducked=on;update();}
 function cancelSpeech(){
  speechToken++;clearTimeout(speechTimer);voicePlayer.pause();
  if(voicePlayer.readyState>0)voicePlayer.currentTime=0;voiceStatus('idle');duck(false);
 }
 async function speak(text){
  cancelSpeech();if(muted||voiceVolume===0||closed||document.hidden)return;
  const token=++speechToken,clips=await voiceManifest;
  if(token!==speechToken||muted||voiceVolume===0||closed||document.hidden)return;
  const src=clips.get(text);
  if(!src){voiceStatus('unavailable');$('voiceToggle').title='中文讲解暂不可用 · Voice unavailable';return;}
  if(!ensure())return;
  if(!voiceSource){voiceSource=ctx.createMediaElementSource(voicePlayer);voiceSource.connect(voiceBus);}
  voicePlayer.src=src;
  try{
   await ctx.resume();if(token!==speechToken||muted||closed||document.hidden)return;
   await voicePlayer.play();if(token!==speechToken)return;
   speechTimer=setTimeout(()=>{if(token===speechToken)cancelSpeech();},45000);
  }catch(_){if(token===speechToken){speechFinished();voiceStatus('unavailable');}}
 }
 function horn(){
  if(muted||!ensure())return;
  const t=ctx.currentTime;hornUntil=performance.now()+550;clearTimeout(hornTimer);
  // Hold the current envelope on retrigger. Repeated presses cannot add voices.
  hornBus.gain.cancelAndHoldAtTime(t);hornBus.gain.setTargetAtTime(.16,t,.022);hornBus.gain.setTargetAtTime(0,t+.28,.055);
  update();hornTimer=setTimeout(()=>{hornUntil=0;update();},560);
 }
 $('audioMute').onclick=()=>{muted=!muted;try{sessionStorage.setItem('le-cockpit-muted',String(muted));}catch(_){}if(muted)cancelSpeech();if(master)master.gain.setTargetAtTime(muted?0:.85,ctx.currentTime,.025);$('audioMute').setAttribute('aria-pressed',String(muted));$('audioMute').textContent=muted?'🔇':'🔊';$('audioMute').title=muted?'全部声音已静音 · All audio muted':'静音全部声音 · Mute all audio';};

 $('engineVolume').oninput=e=>{engineVolume=+e.target.value/100;update();};
 $('voiceVolume').oninput=e=>{voiceVolume=+e.target.value/100;if(voiceBus)voiceBus.gain.setTargetAtTime(voiceVolume,ctx.currentTime,.025);if(voiceVolume===0)cancelSpeech();};
 document.addEventListener('click',()=>{if(ctx?.state==='suspended'&&!document.hidden){ensure();update();}},true);
 function suspendAudio(){
  pause();cancelSpeech();clearTimeout(hornTimer);hornUntil=0;
  if(ctx&&!closed){hornBus.gain.cancelScheduledValues(ctx.currentTime);hornBus.gain.setValueAtTime(0,ctx.currentTime);ctx.suspend().catch(()=>{});}
 }
 document.addEventListener('visibilitychange',()=>{if(closed)return;if(document.hidden)suspendAudio();else if(ctx){ensure();update();}});
 // Chromium can freeze a background page without another visibility transition.
 document.addEventListener('freeze',suspendAudio);

 window.addEventListener('pagehide',event=>{
  clearTimeout(hornTimer);hornUntil=0;pause();cancelSpeech();
  if(event.persisted){if(ctx&&ctx.state!=='closed'){hornBus.gain.cancelScheduledValues(ctx.currentTime);hornBus.gain.setValueAtTime(0,ctx.currentTime);ctx.suspend().catch(()=>{});}return;}
  player.removeAttribute('src');player.load();voicePlayer.removeAttribute('src');voicePlayer.load();closed=true;if(ctx&&ctx.state!=='closed')ctx.close().catch(()=>{});
 });
 window.addEventListener('pageshow',event=>{if(event.persisted){pause();status('点按继续声音 · Tap to resume audio');}});
 return{update,speak,cancelSpeech,horn,renderMusic};
};
