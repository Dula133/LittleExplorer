'use strict';
// Phase 3 extends the full Phase 2 suite; product UI/scene code stays frozen.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const CHECKPOINT='ee31b3a33535d2e3926af81ba4f61e6a7ff8fa2f';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const readBase=(ROOT,file)=>execFileSync('git',['show',`${CHECKPOINT}:${file}`],{cwd:ROOT});
function contract(ROOT){return require(path.join(ROOT,'tools/qa_car_simple_plus.phase2.json')).voiceGaps;}
function mapping(ROOT){return JSON.parse(fs.readFileSync(path.join(ROOT,'voice/lines.json'),'utf8'));}
function additions(ROOT){return Object.fromEntries(contract(ROOT).map(t=>[t,crypto.createHash('md5').update(t).digest('hex').slice(0,8)]));}
exports.scope=function({ROOT,git,pass}){
  assert.equal(git('branch','--show-current'),'feature/car-simple-plus');
  execFileSync('git',['merge-base','--is-ancestor',CHECKPOINT,'HEAD'],{cwd:ROOT});
  const ids=Object.values(additions(ROOT));
  const allowed=new Set(['voice/lines.json','voice/lines.js','pages/car.html','tools/check_voice.py','tools/qa_car_simple_plus.cjs','tools/qa_car_simple_plus_phase3.cjs','docs/SIMPLE_PLUS_PHASE3.md',...['yunxia','xiaoyi'].flatMap(v=>ids.map(id=>`voice/${v}/${id}.mp3`))]);
  const changes=[...new Set([...git('diff','--name-only',CHECKPOINT).split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))];
  for(const f of changes)assert.ok(allowed.has(f)||f.startsWith('docs/qa/simple-plus-phase3/'),`Unapproved Phase 3 change: ${f}`);
  const original=readBase(ROOT,'pages/car.html').toString();
  assert.equal(fs.readFileSync(path.join(ROOT,'pages/car.html'),'utf8'),original.replace('voice/lines.js?v=1789108061','voice/lines.js?v=simple-plus-phase3-007'),'Only the car voice mapping cache key may change');
  for(const f of ['scenes/car.js','js/app.js','index.html'])assert.equal(sha(fs.readFileSync(path.join(ROOT,f))),sha(readBase(ROOT,f)),f);
  pass('Phase 3 exact scope; all Phase 2 product behavior and frozen evidence unchanged',{checkpoint:CHECKPOINT,changes});
};
exports.voiceCheck=function({ROOT}){
  const old=JSON.parse(readBase(ROOT,'voice/lines.json')),current=mapping(ROOT),added=additions(ROOT);
  assert.equal(Object.keys(old).length,295);assert.equal(Object.keys(added).length,20);
  assert.equal(new Set(Object.values(added)).size,20);
  assert.equal(Object.keys(current).length,315);
  assert.deepEqual(current,{...old,...added});
  assert.equal(new Set(Object.values(current)).size,315,'MD5 ID collision');
  const sandbox={window:{}};require('node:vm').runInNewContext(fs.readFileSync(path.join(ROOT,'voice/lines.js'),'utf8'),sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.VOICE_LINES)),current);
  const files=execFileSync('git',['ls-tree','-r','--name-only',CHECKPOINT,'--','voice'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.mp3'));
  assert.equal(files.length,598);
  const originalSHA256={};for(const f of files){const expected=sha(readBase(ROOT,f));assert.equal(sha(fs.readFileSync(path.join(ROOT,f))),expected,f);originalSHA256[f]=expected;}
  const clips=[];
  for(const v of ['yunxia','xiaoyi'])for(const [text,id]of Object.entries(added)){
    const f=`voice/${v}/${id}.mp3`,full=path.join(ROOT,f),bytes=fs.statSync(full).size;assert.ok(bytes>=1500);
    const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',full],{encoding:'utf8'}));
    const duration=Number(info.format.duration);assert.ok(duration>=.3&&duration<=Math.max(15,text.length*.8));
    execFileSync('ffmpeg',['-v','error','-xerror','-i',full,'-f','null','-'],{stdio:['ignore','pipe','pipe']});
    clips.push({text,id,voice:v,file:f,bytes,duration,sha256:sha(fs.readFileSync(full)),decoded:true});
  }
  const check=execFileSync('python3',['-B','tools/check_voice.py'],{cwd:ROOT,encoding:'utf8'}).trim();
  return {status:'PASS',originalMappings:295,totalMappings:315,newKeys:20,newClips:40,originalAudioSHA256Unchanged:598,originalSHA256,clips,check};
};
exports.playback=async function({open,load,tapPart,tap,pass,OUT,ROOT,pickPoint}){
  const lines=mapping(ROOT),expected=new Set(contract(ROOT)),evidence=[];
  // Passive observers call the native implementation; never mock speech or media.
  function observe(){window.__phase3Fallback=[];if('speechSynthesis'in window){const native=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=function(u){window.__phase3Fallback.push(u.text);return native(u);};}}
  async function physical(page,context,id){
    for(let n=0;n<12;n++){
      const hit=await page.evaluate(pickPoint,id);
      if(hit){await tapPart(page,id);return;}
      const point=await page.evaluate(()=>{for(let y=110;y<innerHeight-180;y+=30)for(let x=70;x<innerWidth-140;x+=40)if(document.elementFromPoint(x,y)?.id==='c')return{x,y};return null;});assert.ok(point);
      const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+16*i,y:point.y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      await page.waitForTimeout(350);
    }
    throw Error('No native ray hit for '+id);
  }
  for(const voice of ['yunxia','xiaoyi']){
    const {page,context}=await open({width:390,height:844},{controlled:false,muted:false});
    await page.addInitScript(v=>localStorage.setItem('voice',v),voice);await page.addInitScript(observe);await load(page);
    const seen=new Set();
    async function heard(action,wanted){
      const before=await page.evaluate(()=>__qaEvidence.media.length);
      await action();
      const key=await page.evaluate(()=>document.querySelector('#cn').textContent+'。'+document.querySelector('#cd').textContent);
      if(wanted)assert.equal(key,wanted);assert.ok(lines[key],`No full runtime key: ${key}`);
      const suffix=`/voice/${voice}/${lines[key]}.mp3`;
      await page.waitForFunction(({before,suffix})=>__qaEvidence.media.slice(before).some(e=>e.type==='playing'&&e.trusted&&e.src.endsWith(suffix)),{before,suffix},{timeout:15000});
      await page.waitForFunction(({before,suffix})=>__qaEvidence.media.slice(before).some(e=>e.type==='ended'&&e.trusted&&e.time>0&&e.duration>0&&e.src.endsWith(suffix)),{before,suffix},{timeout:45000});
      await page.waitForFunction(()=>!document.body.classList.contains('talking'));
      const media=await page.evaluate(before=>__qaEvidence.media.slice(before),before);
      assert.ok(!media.some(e=>e.type==='error'));
      const fallback=await page.evaluate(()=>__phase3Fallback);assert.deepEqual(fallback,[],'Unexpected system TTS fallback');
      if(expected.has(key))seen.add(key);
      evidence.push({voice,key,id:lines[key],input:'native touch',timing:wanted?'Controlled battery setup; real-time native audio':'Real-time',events:media,fallback});
      console.log('PLAYED:',voice,key);
    }
    const action=id=>()=>tap(page,`#car-part-actions [data-action="${id}"]`);
    // Native model ray hits, followed by actual playing AND ended in real time.
    await heard(()=>physical(page,context,'position'));
    for(let n=0;n<4;n++)await heard(action('lamp'));
    await heard(()=>physical(page,context,'fog'));
    await heard(action('fog'));await heard(action('fog'));
    for(const id of ['turnLeft','turnRight']){
      await heard(()=>physical(page,context,id));
      await heard(action('turn'));await heard(action('turn'));
      await heard(action('hazard'));await heard(action('hazard'));
    }
    await heard(()=>physical(page,context,'wiper'));
    for(let n=0;n<4;n++)await heard(action('rain'));
    // End of the original demo may have stopped the wiper; two toggles cover both.
    await heard(action('wiper'));await heard(action('wiper'));
    // Separate controlled-timer case: software rendering can outlast the
    // 3.5s demo during input preparation. Freeze only preparation, use native
    // inputs and the real action/guard, then resume before observing playback.
    const time=await page.evaluate(()=>Date.now());
    await page.clock.pauseAt(new Date(time+100));
    await tap(page,'#mute');await tap(page,'#xr');
    for(let n=0;n<30;n++)await page.clock.fastForward(50);
    await tap(page,'.tile:has-text("电池")');
    await tap(page,'.tile:has-text("车灯")');
    await page.clock.fastForward(50); // Render actual controls inside the demo window.
    await tap(page,'#mute');
    await heard(async()=>{await action('lamp')();await page.clock.resume();},'车灯。档位已记住，电池演示结束后恢复。');
    assert.deepEqual([...seen].sort(),[...expected].sort(),`All 20 keys must actually play in ${voice}`);
    assert.deepEqual(await page.evaluate(()=>__phase3Fallback),[]);
    await context.close();pass(`Phase 3 native browser playback: all 20 keys / ${voice}; no system fallback`,{keys:seen.size});
  }
  fs.writeFileSync(path.join(OUT,'phase3-playback.json'),JSON.stringify({status:'PASS',newKeys:20,voices:2,evidence,humanListening:'NOT_TESTED',HarmonyOS:'NOT_TESTED'},null,2)+'\n');
};
