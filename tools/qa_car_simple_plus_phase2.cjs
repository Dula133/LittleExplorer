'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const NEW=['turnLeft','turnRight','position','fog'];
exports.voiceCheck=function({ROOT,policy}){
  // Keep the original checker untouched. Its generic all-texts-have-MP3 command
  // correctly exits 1 for the TWO approved static Phase 3 gaps; assert exactly
  // that outcome while requiring every original mapping/file to remain intact.
  return JSON.parse(execFileSync('python3',['-B','-c',`
import json,sys,importlib.util
from pathlib import Path
root=Path(sys.argv[1]); policy=json.loads((root/'tools/qa_car_simple_plus.phase2.json').read_text())
spec=importlib.util.spec_from_file_location('voice_check',root/'tools/check_voice.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
lines=m.collect_lines(root); mapping=json.loads((root/'voice/lines.json').read_text())
missing=lines-set(mapping); assert missing==set(policy['staticVoiceGaps']),sorted(missing)
assert set(mapping)<=lines,'An original spoken mapping disappeared'
assert len(set(policy['voiceGaps']))==20
assert all(t not in mapping for t in policy['voiceGaps'])
assert missing<=set(policy['voiceGaps'])
want=set(mapping.values())|{'sample'}; voices={}
for voice in m.VOICES:
 files={f.stem:f for f in (root/'voice'/voice).glob('*.mp3')}
 assert not want-set(files),(voice,'Missing original MP3')
 assert not [k for k in want if files[k].stat().st_size<1500],(voice,'Truncated original MP3')
 voices[voice]=len(files)
print(json.dumps(dict(originalMappings=len(mapping),originalAudioComplete=True,voices=voices,
  status='PASS_WITH_EXPLICIT_PHASE3_VOICE_GAPS',staticCheckerMissing=sorted(missing),formalNewMP3='NOT_IMPLEMENTED',voiceGaps=policy['voiceGaps']),ensure_ascii=False))
`,ROOT],{encoding:'utf8'}));
};
exports.scope=function({ROOT,BASE,policy,git,sha256,pass}){
  assert.equal(git('branch','--show-current'),'feature/car-simple-plus');assert.equal(git('rev-parse','origin/main'),BASE);
  execFileSync('git',['merge-base','--is-ancestor',policy.checkpoint,'HEAD'],{cwd:ROOT});
  for(const dir of ['docs/baselines/simple-plus','docs/qa/simple-plus-phase1']){
    for(const row of git('ls-tree','-r',policy.checkpoint,'--',dir).split('\n')){
      const [meta,file]=row.split('\t'),oid=meta.split(' ')[2],actual=git('hash-object',file);assert.equal(actual,oid,`Frozen Phase 0/1 evidence changed: ${file}`);}}
  const changes=[...new Set([...git('diff','--name-only',policy.checkpoint).split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))];
  assert.deepEqual(policy.allowedProductFiles,['scenes/car.js','js/app.js']);
  for(const f of changes)assert.ok([...policy.allowedProductFiles,...policy.allowedSupportFiles].includes(f)||f.startsWith(policy.artifactDirectory+'/'),`Unapproved Phase 2 file: ${f}`);
  let pinned=execFileSync('git',['show',`${policy.checkpoint}:js/app.js`],{cwd:ROOT,encoding:'utf8'}),current=fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
  const start=current.indexOf('// Opt-in scene actions'),end=current.indexOf('/* ---- 「开起来」',start);assert.ok(start>0&&end>start);
  const block=current.slice(start,end);assert.equal(sha256(block),policy.actionBlockSHA256,'Review changed opt-in UI block explicitly');current=current.slice(0,start)+current.slice(end);
  const replacements=[
    ['m.userData.noHit||m.userData.glass)continue;const ol','m.userData.noHit||m.userData.glass||m.userData.pickProxy)continue;const ol'],
    ['renderer.render(scene,camera);updateTray();','renderer.render(scene,camera);updateTray();if(partActionUI)partActionUI.update();'],
    ['S.sel=id;hop(p);sfx.click();','S.sel=id;hop(p);sfx.click();if(partActionUI)partActionUI.selected();'],
    ["function setMode(m){ // 'whole' | 'xray' | 'explode'，一次只在一个模式里\n","function setMode(m){ // 'whole' | 'xray' | 'explode'，一次只在一个模式里\n  if(partActionUI)partActionUI.dismiss();\n"]
  ];
  for(const [before,after]of replacements){assert.ok(pinned.includes(before));pinned=pinned.replace(before,after);}assert.equal(current,pinned,'Camera, ray/gesture, voice, busy guard and original UI engine must remain exact');
  pass('Phase 2 exact scope: two product files, opt-in engine hooks, frozen Phase 0/1 evidence',{changes,policy});
};
// Reassign only the four ORIGINAL amber descriptors, then restore their original
// ordering for comparison. All other old meshes/groups, text, camera and layout
// remain exact; extra/missing/changed original descriptors fail.
exports.normalize=function(snapshot,baseline){
  if(!snapshot.parts)return snapshot;
  const s=structuredClone(snapshot),moved=[];
  for(const id of ['turnLeft','turnRight']){const p=s.parts[id];assert.ok(p);assert.equal(p.meshes.length,2);assert.equal(p.groups.length,2);
    for(const m of p.meshes){assert.equal(m.owner,id);moved.push({...m,owner:m.local[0]>0?'lights':'tail'});}}
  for(const id of ['position','fog']){assert.ok(s.parts[id]);assert.equal(s.parts[id].meshes.length,6);assert.equal(s.parts[id].groups.length,1);}
  for(const id of NEW)delete s.parts[id];assert.deepEqual(Object.keys(s.parts),Object.keys(baseline.parts));
  for(const id of ['lights','tail']){
    const pool=[...s.parts[id].meshes,...moved.filter(m=>m.owner===id)];
    s.parts[id].meshes=baseline.parts[id].meshes.map(expected=>{const i=pool.findIndex(m=>JSON.stringify(m)===JSON.stringify(expected));assert.ok(i>=0,`Original ${id} mesh changed/missing: ${JSON.stringify(expected)}`);return pool.splice(i,1)[0];});
    assert.equal(pool.length,0,'Unexpected original part mesh');
  }
  return s;
};
exports.masks=function(){
  if(!window.__dbg)return [];
  const d=__dbg,T=d.THREE,rects=[];d.root.updateWorldMatrix(true,true);
  for(const id of ['position','fog'])for(const m of d.PARTS[id].meshes){if(m.userData.pickProxy)continue;
    m.geometry.computeBoundingBox();const b=m.geometry.boundingBox,pts=[];
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
      const p=new T.Vector3(x,y,z).applyMatrix4(m.matrixWorld).project(d.camera);pts.push([(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2]);}
    rects.push({kind:'fixture',id,rect:[Math.max(0,Math.floor(Math.min(...pts.map(p=>p[0])))-3),Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1])))-3),
      Math.min(innerWidth,Math.ceil(Math.max(...pts.map(p=>p[0])))+3),Math.min(innerHeight,Math.ceil(Math.max(...pts.map(p=>p[1])))+3)]});}
  // The two original front amber lenses no longer receive the parent headlight
  // selection pulse after their ownership becomes side-specific.
  if(d.S.sel==='lights')for(const id of ['turnLeft','turnRight'])for(const m of d.PARTS[id].meshes){if(m.userData.turnEnd!=='FRONT')continue;
    const p=m.getWorldPosition(new T.Vector3()).project(d.camera),x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;
    rects.push({kind:'amber-selection',id,rect:[Math.floor(x-5),Math.floor(y-5),Math.ceil(x+5),Math.ceil(y+5)]});}
  const ui=document.querySelector('#car-part-actions');if(ui&&!ui.hidden){const r=ui.getBoundingClientRect();rects.push({kind:'temporary-actions',rect:[Math.floor(r.left-16),Math.floor(r.top-16),Math.ceil(r.right+16),Math.ceil(r.bottom+16)]});}
  return rects;
};
exports.compare=async function({ROOT,OUT,captures}){
  const rows=captures.map(c=>({file:c.file,masks:c.masks}));fs.writeFileSync(path.join(OUT,'approved-visual-regions.json'),JSON.stringify(rows,null,2)+'\n');
  return JSON.parse(execFileSync('python3',['-c',`
import json,sys,hashlib
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
root,out=map(Path,sys.argv[1:]); base=root/'docs/baselines/simple-plus'
rows=json.loads((out/'approved-visual-regions.json').read_text()); results=[]
for row in rows:
 name=row['file']; a=Image.open(base/name).convert('RGB'); b=Image.open(out/name).convert('RGB'); assert a.size==b.size
 diff=ImageChops.difference(a,b); mask=Image.new('L',a.size); draw=ImageDraw.Draw(mask)
 fixture=Image.new('L',a.size); fd=ImageDraw.Draw(fixture)
 for area in row['masks']:
  r=area['rect']; draw.rectangle(r,fill=255)
  if area['kind']=='fixture': fd.rectangle(r,fill=255)
 assert sum(v>0 for v in fixture.get_flattened_data())<a.width*a.height*.05,'Fixture exceptions exceed 5%'
 assert len([x for x in row['masks'] if x['kind']=='temporary-actions'])<=1
 outside=diff.copy(); outside.paste((0,0,0),mask=mask)
 pixels=list(diff.get_flattened_data()); op=list(outside.get_flattened_data())
 maximum=max(max(p) for p in op); assert maximum<=2,(name,'Difference outside approved local fixtures/actions',maximum,outside.getbbox())
 results.append(dict(file=name,changedPixels=sum(any(p) for p in pixels),outsideLocalChangedPixels=sum(any(p) for p in op),outsideMaxChannelDelta=maximum,
   boundingBox=diff.getbbox(),approvedRegions=row['masks'],baselineSHA256=hashlib.sha256((base/name).read_bytes()).hexdigest(),candidateSHA256=hashlib.sha256((out/name).read_bytes()).hexdigest()))
 if name=='car-default-390x844.png':
  pair=Image.new('RGB',(a.width*2,a.height));pair.paste(a,(0,0));pair.paste(b,(a.width,0));pair.save(out/'default-original-vs-candidate.png',optimize=True)
print(json.dumps(results))
`,ROOT,OUT],{encoding:'utf8'}));
};
exports.ui=async function({open,load,step,tapPart,tap,pass,OUT}){
  const evidence={kind:'Trusted native DOM touch and physical Three.js ray tests, separate from foundation API tests',viewports:[],audioLock:[]};
  const get=p=>p.evaluate(()=>({lighting:SCENES.car.lighting.getState(),weather:SCENES.car.weather.getState(),selected:__dbg.S.sel}));
  const actual=p=>p.evaluate(()=>Object.fromEntries(['position','fog','lights'].map(id=>[id,__dbg.PARTS[id].meshes.filter(m=>m.material.emissive&&m.geometry.type==='CylinderGeometry').map(m=>m.userData.dynInt)])));
  const buttons=p=>p.evaluate(()=>['go','xr','ex'].map(id=>document.getElementById(id).getBoundingClientRect().toJSON()));
  async function checkUI(p){
    const r=await p.evaluate(()=>{const box=document.querySelector('#car-part-actions'),b=[...box.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.action,disabled:e.disabled,width:r.width,height:r.height,x:r.x,y:r.y,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e};});
      return {hidden:box.hidden,buttons:b,permanent:[...document.querySelectorAll('.tile')].map(e=>e.textContent),rBase:__dbg.cam.rBase,projection:__dbg.camera.projectionMatrix.toArray()};});
    assert.equal(r.hidden,false);assert.ok(r.buttons.length>=1&&r.buttons.length<=2);assert.equal(r.permanent.length,16);
    for(const b of r.buttons){assert.ok(b.width>=44&&b.height>=44);assert.equal(b.hit,true);assert.equal(b.disabled,false);}
    return r;
  }
  async function action(p,id){await checkUI(p);const before=await buttons(p),rb=await p.evaluate(()=>__dbg.cam.rBase);
    await tap(p,`#car-part-actions [data-action="${id}"]`);await step(p,100);
    assert.deepEqual(await buttons(p),before,'Three primary buttons must not shift');assert.equal(await p.evaluate(()=>__dbg.cam.rBase),rb,'Temporary controls must not refit camera');}
  async function physical(p,context,id,end){
    // Rotate with real touch gestures if that side/end is occluded. Never set
    // selection, camera or invoke a part action to manufacture a ray-hit pass.
    for(let n=0;n<9;n++){
      const can=await p.evaluate(({id,end})=>{
        const d=__dbg,T=d.THREE,ray=new T.Raycaster(),targets=Object.values(d.PARTS).flatMap(p=>p.meshes).filter(m=>!m.userData.noHit&&!m.userData.glass);
        const visible=m=>{for(let o=m;o;o=o.parent)if(!o.visible)return false;return true;};d.root.updateWorldMatrix(true,true);
        for(const m of d.PARTS[id].meshes){if(end&&m.userData.turnEnd!==end)continue;if(!visible(m))continue;
          m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;
          for(const fx of [.25,.5,.75])for(const fy of [.25,.5,.75])for(const fz of [0,.5,1]){const v=new T.Vector3(b.min.x+(b.max.x-b.min.x)*fx,b.min.y+(b.max.y-b.min.y)*fy,b.min.z+(b.max.z-b.min.z)*fz).applyMatrix4(m.matrixWorld).project(d.camera);
            const x=Math.round((v.x+1)*innerWidth/2),y=Math.round((1-v.y)*innerHeight/2);if(x<2||x>innerWidth-2||y<2||y>innerHeight-2||document.elementFromPoint(x,y)?.id!=='c')continue;
            ray.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),d.camera);const h=ray.intersectObjects(targets,false).find(h=>visible(h.object)&&!(d.S.xray&&h.object.userData.baseCol));
            if(h?.object.userData.part===id&&(!end||h.object.userData.turnEnd===end))return true;}}
        return false;},{id,end});
      if(can){await tapPart(p,id,end);await step(p,150);return;}
      const point=await p.evaluate(()=>{for(let y=100;y<innerHeight-100;y+=30)for(let x=70;x<innerWidth-140;x+=40)if(document.elementFromPoint(x,y)?.id==='c')return{x,y};return null;});assert.ok(point);
      const cdp=await context.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+16*i,y:point.y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await step(p,250);
    }
    throw Error('No physical ray hit after real rotation: '+id+'/'+end);
  }
  for(const viewport of [{width:390,height:844},{width:360,height:800},{width:844,height:390},{width:800,height:360}]){
    let {page,context}=await open(viewport);await load(page);const originalButtons=await buttons(page);
    const fresh=async()=>{await context.close();({page,context}=await open(viewport));await load(page);};
    assert.equal(await page.locator('#car-part-actions').isVisible(),false);
    await physical(page,context,'position');let s=await get(page);assert.equal(s.selected,'position');assert.equal(s.lighting.requestedLampMode,'POSITION');
    await step(page,700);assert.ok((await actual(page)).position.every(v=>v>.78));assert.ok((await actual(page)).lights.every(v=>v<.001));
    await checkUI(page);await action(page,'lamp');await step(page,700);assert.equal((await get(page)).lighting.requestedLampMode,'HEADLIGHT');
    assert.ok((await actual(page)).position.every(v=>v>.78));assert.ok((await actual(page)).lights.every(v=>v>1.58));
    await action(page,'lamp');await step(page,1100);assert.equal((await get(page)).lighting.requestedLampMode,'OFF');assert.ok((await actual(page)).position.every(v=>v<.001));
    await action(page,'lamp');assert.equal((await get(page)).lighting.requestedLampMode,null);
    await page.screenshot({path:path.join(OUT,`ui-lamps-${viewport.width}x${viewport.height}.png`),animations:'disabled'});
    await fresh();await physical(page,context,'fog');await step(page,700);assert.equal((await get(page)).lighting.fogLight,true);assert.ok((await actual(page)).fog.every(v=>v>1.28));
    const low=await page.evaluate(()=>{const g=__dbg.PARTS.fog.groups[0];return g.children.filter(o=>o.isSpotLight).map(o=>({distance:o.distance,intensity:o.intensity,down:o.target.position.y<o.position.y}));});
    assert.equal(low.length,2);assert.ok(low.every(l=>l.distance===3&&l.intensity>.79&&l.down));
    await page.screenshot({path:path.join(OUT,`ui-fog-${viewport.width}x${viewport.height}.png`),animations:'disabled'});
    await action(page,'fog');await step(page,1100);assert.equal((await get(page)).lighting.fogLight,false);assert.ok((await actual(page)).fog.every(v=>v<.001));
    await fresh();
    for(const [id,mode]of [['turnLeft','LEFT'],['turnRight','RIGHT']]){
      await physical(page,context,id,'FRONT');assert.equal((await get(page)).lighting.turnMode,mode);
      await physical(page,context,id,'FRONT');assert.equal((await get(page)).lighting.turnMode,'OFF');
      assert.equal(await page.locator('#cd').textContent(),'转向灯关掉了。');
      await physical(page,context,id,'REAR');assert.equal((await get(page)).lighting.turnMode,mode);
      await action(page,'hazard');assert.equal((await get(page)).lighting.turnMode,'HAZARD');
      const samples=[];for(let k=0;k<5;k++){await step(page,200);const v=await page.evaluate(()=>Object.values(__dbg.PARTS).flatMap(p=>p.meshes).filter(m=>m.userData.turnSide).map(m=>({value:m.userData.dynInt,em:m.material.emissiveIntensity})));
        assert.equal(new Set(v.map(l=>l.value)).size,1);if(v[0].value===0)assert.ok(v.every(l=>l.em===0));samples.push(v[0].value);}
      assert.ok(samples.includes(0)&&samples.includes(2.8));await action(page,'hazard');assert.equal((await get(page)).lighting.turnMode,'OFF');
    }
    await page.screenshot({path:path.join(OUT,`ui-turn-${viewport.width}x${viewport.height}.png`),animations:'disabled'});
    await fresh();await tapPart(page,'wiper');await step(page,200);await checkUI(page);
    const rainLevels=[];for(const expected of ['NONE','LIGHT','MEDIUM','HEAVY']){const before=(await get(page)).weather.wiperEnabled;await action(page,'rain');s=await get(page);
      assert.equal(s.weather.rainLevel,expected);assert.equal(s.weather.wiperEnabled,before);rainLevels.push(expected);}
    const current=(await get(page)).weather.rainLevel;await action(page,'wiper');assert.equal((await get(page)).weather.rainLevel,current);
    const chosen=(await get(page)).weather.wiperEnabled;await page.clock.fastForward(16000);await step(page,300);
    assert.equal((await get(page)).weather.rainLevel,'HEAVY');assert.equal((await get(page)).weather.wiperEnabled,chosen);
    await page.screenshot({path:path.join(OUT,`ui-rain-${viewport.width}x${viewport.height}.png`),animations:'disabled'});
    await tap(page,'#xr');await step(page,100);assert.equal(await page.locator('#car-part-actions').isVisible(),false);
    await tap(page,'.tile:has-text("雨刮器")');await step(page,1200);const compact=await checkUI(page);
    assert.deepEqual(await buttons(page),originalButtons,'Primary buttons retain baseline geometry');
    await page.screenshot({path:path.join(OUT,`ui-xray-${viewport.width}x${viewport.height}.png`),animations:'disabled'});
    await tap(page,'#xr');await step(page,150);assert.equal(await page.locator('#car-part-actions').isVisible(),false);
    await physical(page,context,'door');assert.equal(await page.locator('#car-part-actions').isVisible(),false);
    const ownership=await page.evaluate(()=>{const seen=new Set();return Object.entries(__dbg.PARTS).every(([id,p])=>p.meshes.every(m=>{if(seen.has(m)||m.userData.part!==id)return false;seen.add(m);return true;}));});assert.equal(ownership,true);
    await tap(page,'#ex');await step(page,2200);const split=await page.evaluate(()=>['position','fog'].map(id=>__dbg.PARTS[id].groups[0].position.distanceTo(__dbg.PARTS[id].groups[0].userData.home)));
    assert.ok(split.every(v=>v>.5));await tap(page,'#ex');await step(page,2200);
    assert.ok(await page.evaluate(()=>['position','fog'].every(id=>{const g=__dbg.PARTS[id].groups[0];return g.position.distanceTo(g.userData.home)<.02;})));
    const gl=await page.evaluate(()=>{const c=document.querySelector('#c'),g=c.getContext('webgl2')||c.getContext('webgl');return {lost:g.isContextLost(),error:g.getError()};});assert.deepEqual(gl,{lost:false,error:0});
    evidence.viewports.push({viewport,rainLevels,uniqueOwnership:true,lowFogLights:low,ui:compact,gl});
    pass(`Phase 2 native UI / physical ray / independent weather / explode: ${viewport.width}x${viewport.height}`,evidence.viewports.at(-1));await context.close();
  }
  // Real original MP3 locks the new DOM controls. No synthetic media completion
  // or TTS mock: wait for native playback and ended before tapping a live button.
  for(const part of ['lights','wiper']){
    const {page,context}=await open({width:390,height:844},{controlled:false,muted:false});await load(page);
    await tapPart(page,part);await page.waitForFunction(()=>__qaEvidence.media.some(e=>e.type==='playing'));
    await page.waitForFunction(()=>document.body.classList.contains('talking'));
    const locked=await page.locator('#car-part-actions button').evaluateAll(a=>a.map(b=>b.disabled));assert.ok(locked.length&&locked.every(Boolean));
    const stateBefore=await get(page),r=await page.locator('#car-part-actions button').first().boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
    const stateAfter=await get(page);assert.equal(stateAfter.selected,stateBefore.selected);assert.equal(stateAfter.lighting.requestedLampMode,stateBefore.lighting.requestedLampMode);assert.equal(stateAfter.weather.source,stateBefore.weather.source);
    await page.waitForFunction(()=>__qaEvidence.media.some(e=>e.type==='ended'),null,{timeout:45000});await page.waitForFunction(()=>[...document.querySelectorAll('#car-part-actions button')].every(b=>!b.disabled));
    // Mute using the real existing control so the new text-only interaction
    // cannot be misreported as a formally supplied MP3 or mocked TTS playback.
    await tap(page,'#mute');await tap(page,`#car-part-actions [data-action="${part==='lights'?'lamp':'rain'}"]`);
    evidence.audioLock.push({part,locked,ended:true,usableAfterNarration:true,media:await page.evaluate(()=>__qaEvidence.media)});await context.close();
  }
  fs.writeFileSync(path.join(OUT,'ui-touch-evidence.json'),JSON.stringify(evidence,null,2)+'\n');pass('Phase 2 real original MP3 lock and post-narration action persistence',evidence.audioLock);
};
