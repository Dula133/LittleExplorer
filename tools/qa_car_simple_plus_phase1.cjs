'use strict';
// Candidate-only additions. API and isolated build-contract tests are explicitly
// separate from the native child-facing interactions in the Phase 0 harness.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
module.exports=async function({open,load,step,tapPart,tap,pass,OUT,ROOT,captures,existing,phase2=false,visualCompare=null}){
  const evidence={kind:'Direct API / isolated build-contract tests; not child touch acceptance',turn:[],lamps:[],rain:[]};
  const fresh=async()=>{const c=await open();await load(c.page);return c;};
  const state=p=>p.evaluate(()=>({lighting:SCENES.car.lighting.getState(),weather:SCENES.car.weather.getState()}));
  const signals=p=>p.evaluate(()=>Object.values(__dbg.PARTS).flatMap(p=>p.meshes).filter(m=>m.userData.turnSide).map(m=>({
    side:m.userData.turnSide,end:m.userData.turnEnd,owner:m.userData.part,z:m.position.z,
    dynamic:m.userData.dynInt,emission:m.material.emissiveIntensity,signalOff:m.userData.signalOff})));
  const headlights=p=>p.evaluate(()=>__dbg.PARTS.lights.meshes.filter(m=>m.geometry.type==='CylinderGeometry'&&m.geometry.parameters.radiusTop===.17).map(m=>m.userData.dynInt));
  const rain=p=>p.evaluate(()=>{const d=__dbg,m=d.root.parent.children.find(o=>o.isInstancedMesh&&o.geometry.parameters.height===.6);
    return {visible:m.visible,count:m.count,capacity:m.instanceMatrix.count,geometry:m.geometry.parameters,opacity:m.material.opacity,gloom:d.S.gloom,
      y:[...m.instanceMatrix.array].filter((_,i)=>i%16===13).slice(0,m.count),wipers:d.PARTS.wiper.groups[0].children.map(p=>p.children[0].rotation.z)};});
  // Original Git source is evaluated only to build an isolated reference model;
  // never replace/intercept the running page's scripts or screenshot renderer.
  {
    const {page,context}=await fresh();
    const original=execFileSync('git',['show','70091609b45fd2b2cf98a5853bfee2d8cbe28991:scenes/car.js'],{cwd:ROOT,encoding:'utf8'});
    const result=await page.evaluate(async source=>{
      const candidate=SCENES.car,before=JSON.stringify([candidate.lighting.getState(),candidate.weather.getState()]);
      let pinned;try{new Function(source)();pinned=SCENES.car;}finally{SCENES.car=candidate;}
      const config=s=>Object.fromEntries(Object.entries(s).filter(([k,v])=>typeof v!=='function'&&!['lighting','weather'].includes(k)));
      const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a))).map(b=>b.toString(16).padStart(2,'0')).join('');
      async function fingerprint(s){
        const savedRandom=Math.random;let seed=20261016;
        Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
        const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);const ctx=L3.makeCtx(scene,root);
        const stub={S:{drive:false,xr:0,ex:0,xray:false,explode:false,night:0,nightT:0},now:()=>performance.now(),ee:0,
          sfx:{wantLoop:null,loop(){},stopLoop(){},horn(){},click(){},door(){}},toggleNight(){}};
        let object;try{object=s.build(ctx,stub);}finally{Math.random=savedRandom;}
        const clean=v=>{if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='uuid').map(([k,v])=>[k,clean(v)]));return v;};
        const nodes=[];root.traverse(o=>nodes.push(o));
        const shape=await Promise.all(nodes.map(async o=>({type:o.type,parent:nodes.indexOf(o.parent),position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),
          owner:o.userData.part||null,keepEm:!!o.userData.keepEm,noHit:!!o.userData.noHit,glass:!!o.userData.glass,baseInt:o.userData.baseInt??null,
          geometry:o.geometry?{type:o.geometry.type,attributes:await Promise.all(Object.entries(o.geometry.attributes).map(async([k,a])=>[k,a.itemSize,a.normalized,await digest(a.array)])),
            index:o.geometry.index?await digest(o.geometry.index.array):null}:null,
          instances:o.isInstancedMesh?{count:o.count,matrix:await digest(o.instanceMatrix.array)}:null,
          material:o.material?clean(o.material.toJSON()):null})));
        const rain=scene.children.find(m=>m.isInstancedMesh&&m.geometry.parameters.height===.6);
        // Exercise the preview's update without any env call: it must not change
        // the live page's state or API binding (the old module-global hazard).
        stub.S.drive=true;object.update(.05);
        const summary={parts:Object.keys(ctx.PARTS),shape,rain:{geometry:rain.geometry.parameters,capacity:rain.instanceMatrix.count},config:config(s)};
        const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
        geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());return summary;
      }
      const baseline=await fingerprint(pinned),current=await fingerprint(candidate);
      const after=JSON.stringify([candidate.lighting.getState(),candidate.weather.getState()]);
      return {baseline,current,before,after};
    },original);
    assert.equal(result.before,result.after,'Preview build/update must not take over the active runtime');
    assert.equal(result.baseline.rain.capacity,520);assert.equal(result.current.rain.capacity,360);
    assert.deepEqual(result.current.rain.geometry,result.baseline.rain.geometry,'Reuse original drop geometry');
    assert.deepEqual(result.current.shape,result.baseline.shape,'All car geometry, hierarchy, materials and ownership must remain original');
    assert.deepEqual(result.current.parts,result.baseline.parts);assert.deepEqual(result.current.config,result.baseline.config);
    evidence.geometry={nodes:result.current.shape.length,partIDs:result.current.parts,geometryAttributes:'SHA256',materials:'exact JSON excluding UUID',previewIsolation:true,rainCapacity:360};
    const defaults=await state(page);assert.equal(defaults.lighting.requestedLampMode,null);assert.equal(defaults.lighting.lampMode,'OFF');
    assert.equal(defaults.lighting.turnMode,'OFF');assert.equal(defaults.lighting.blinkOn,false);assert.equal(defaults.lighting.turnSource,'ORIGINAL_LENS');
    assert.equal(defaults.lighting.positionVisualAvailable,phase2);assert.equal(defaults.lighting.fogVisualAvailable,phase2);
    assert.equal(defaults.weather.rainLevel,'NONE');assert.equal(defaults.weather.wiperEnabled,false);
    await page.evaluate(()=>{
      for(const f of [()=>SCENES.car.lighting.setLampMode('AUTO'),()=>SCENES.car.lighting.setTurnMode('BOTH'),()=>SCENES.car.lighting.triggerBrake(-1),
        ()=>SCENES.car.lighting.triggerBrake(Infinity),()=>SCENES.car.lighting.setFogLight(1),()=>SCENES.car.weather.setRainLevel('STORM'),()=>SCENES.car.weather.setWiperEnabled('OFF')]){
        let rejected=false;try{f();}catch(e){rejected=e instanceof RangeError||e instanceof TypeError;}if(!rejected)throw Error('Invalid API input accepted');}
      const copy=SCENES.car.weather.getState();copy.profile.count=9999;copy.rainLevel='HEAVY';
    });
    assert.deepEqual(await state(page),defaults,'Invalid inputs / returned copies must not mutate state');
    pass('Phase 1: original model/material/config contract, default states, invalid inputs and preview isolation',evidence.geometry);
    await context.close();
  }
  {
    const {page,context}=await fresh();await tapPart(page,'lights'); // Native selection, followed by explicitly labelled API tests.
    for(const mode of ['LEFT','RIGHT','HAZARD','LEFT','HAZARD','RIGHT','OFF']){
      await page.evaluate(m=>SCENES.car.lighting.setTurnMode(m),mode);
      const samples=[];
      for(let i=0;i<9;i++){
        await step(page,100);const s=(await state(page)).lighting,lamps=await signals(page);
        assert.equal(lamps.length,4);assert.equal(new Set(lamps.map(l=>l.side+'/'+l.end)).size,4);
        for(const l of lamps){assert.equal(l.side,l.z<0?'LEFT':'RIGHT');assert.equal(l.owner,phase2?(l.side==='LEFT'?'turnLeft':'turnRight'):(l.end==='FRONT'?'lights':'tail'));
          const on=s.blinkOn&&(mode==='HAZARD'||mode===l.side);assert.equal(l.dynamic,on?2.8:0);
          if(!on){assert.equal(l.emission,0,'Selected part must not re-light a signal in its off-phase');assert.equal(l.signalOff,true);}else assert.ok(l.emission>=2.8);}
        samples.push({at:await page.evaluate(()=>performance.now()),blinkOn:s.blinkOn,lamps});
      }
      if(mode!=='OFF'){assert.ok(samples.some(s=>s.blinkOn));assert.ok(samples.some(s=>!s.blinkOn));}
      else assert.ok(samples.every(s=>!s.blinkOn));
      evidence.turn.push({mode,samples});
    }
    pass('Phase 1 API: LEFT/RIGHT/OFF/HAZARD, four physical lamp owners, shared phases and selected-off suppression',evidence.turn);
    await context.close();
  }
  {
    const {page,context}=await fresh();
    await page.evaluate(()=>SCENES.car.lighting.triggerBrake(600));await step(page,250);
    let s=(await state(page)).lighting;assert.equal(s.brakeActive,true);assert.ok(s.brakeIntensity>.85);
    const red=await page.evaluate(()=>__dbg.PARTS.tail.meshes.filter(m=>m.position.x===-2.47&&m.userData.baseInt===.5).map(m=>m.userData.dynInt));
    assert.equal(red.length,2);assert.ok(red.every(v=>v>2.5));
    await step(page,1500);s=(await state(page)).lighting;assert.equal(s.brakeActive,false);assert.ok(s.brakeIntensity<.001);
    await tap(page,'#xr');await step(page,1500);await tap(page,'.tile:has-text("尾灯")');
    assert.equal((await state(page)).lighting.brakeActive,true);await step(page,4500);
    assert.ok((await state(page)).lighting.brakeIntensity<.001);
    await page.evaluate(()=>SCENES.car.lighting.setFogLight(true));assert.equal((await state(page)).lighting.fogLight,true);
    assert.equal((await state(page)).lighting.fogVisualAvailable,phase2);await page.evaluate(()=>SCENES.car.lighting.setFogLight(false));
    pass('Foundation: API brake and original native tail tile restore; fog availability matches phase',{red,restored:true,fogVisualAvailable:phase2});
    await context.close();
  }
  {
    const {page,context}=await fresh();
    for(const mode of ['OFF','POSITION','HEADLIGHT']){
      await page.evaluate(m=>SCENES.car.lighting.setLampMode(m),mode);await step(page,1500);
      const s=(await state(page)).lighting,actual=await headlights(page);
      assert.equal(s.lampMode,mode);assert.equal(s.source,'EXPLICIT');assert.equal(s.headlightTarget,mode==='HEADLIGHT');
      assert.equal(s.positionRequested,mode!=='OFF');assert.equal(s.positionVisualAvailable,phase2);
      assert.ok(actual.every(v=>mode==='HEADLIGHT'?v>1.59:v<.001));evidence.lamps.push({mode,state:s,actual});
    }
    await page.evaluate(()=>SCENES.car.lighting.setLampMode('OFF'));await tapPart(page,'lights');await step(page,1500);
    assert.equal(await page.evaluate(()=>__dbg.S.nightT),1);assert.ok((await headlights(page)).every(v=>v<.001));
    await page.evaluate(()=>SCENES.car.lighting.useAutomaticLamps());await step(page,1500);
    assert.equal((await state(page)).lighting.source,'AUTOMATIC');assert.ok((await headlights(page)).every(v=>v>3.1));
    await tapPart(page,'lights');await step(page,1500);assert.ok((await headlights(page)).every(v=>v<.001));
    await tap(page,'#xr');await step(page,1500);
    for(const mode of ['OFF','POSITION','HEADLIGHT']){
      await page.evaluate(m=>SCENES.car.lighting.setLampMode(m),mode);await tap(page,'.tile:has-text("电池")');await step(page,700);
      assert.equal((await state(page)).lighting.source,'DEMO');assert.ok((await headlights(page)).every(v=>v>1.5));
      if(mode==='OFF')await page.evaluate(()=>SCENES.car.lighting.setLampMode('POSITION')); // Latest request wins after override.
      await page.clock.fastForward(3000);await step(page,1500);
      const s=(await state(page)).lighting;assert.equal(s.source,'EXPLICIT');assert.equal(s.lampMode,mode==='OFF'?'POSITION':mode);
      assert.equal(s.headlightTarget,mode==='HEADLIGHT');assert.ok((await headlights(page)).every(v=>mode==='HEADLIGHT'?v>1.59:v<.001));
      evidence.lamps.push({batteryOverrideRestored:s});
    }
    await page.evaluate(()=>SCENES.car.lighting.setLampMode('OFF'));await tap(page,'#go');await step(page,300);
    assert.equal(await page.evaluate(()=>__dbg.S.drive),true);assert.equal((await state(page)).lighting.headlightTarget,false);
    await page.evaluate(()=>SCENES.car.lighting.useAutomaticLamps());await step(page,300);assert.equal((await state(page)).lighting.headlightTarget,true);
    await page.evaluate(()=>SCENES.car.lighting.setLampMode('HEADLIGHT'));await tap(page,'#go');await step(page,300);
    assert.equal((await state(page)).lighting.headlightTarget,true);
    pass('Phase 1 API + native legacy inputs: lamp modes, night/drive ownership, battery expiry and latest-request restore',evidence.lamps);
    await context.close();
  }
  for(const [level,count]of [['NONE',0],['LIGHT',72],['MEDIUM',180],['HEAVY',360]]){
    const {page,context}=await fresh();await page.evaluate(l=>SCENES.car.weather.setRainLevel(l),level);await step(page,1800);
    const s=(await state(page)).weather,a=await rain(page);
    assert.equal(s.rainLevel,level);assert.equal(s.profile.count,count);assert.equal(a.count,count);assert.equal(a.capacity,360);
    assert.deepEqual([a.geometry.width,a.geometry.height,a.geometry.depth],[.018,.6,.018]);
    assert.equal(s.wiperEnabled,false);assert.ok(a.wipers.every(v=>v===1));assert.equal(a.visible,count>0);
    const file=`rain-${level.toLowerCase()}-390x844.png`;await page.screenshot({path:path.join(OUT,file),animations:'disabled'});
    await step(page,50);const b=await rain(page),speeds=a.y.map((y,i)=>y>2?(y-b.y[i])/.05:null).filter(v=>v!==null);
    if(count){assert.ok(speeds.length>0);assert.ok(speeds.every(v=>v>=s.profile.minSpeed-.01&&v<=s.profile.maxSpeed+.01));}
    evidence.rain.push({level,count,capacity:a.capacity,opacity:a.opacity,gloom:a.gloom,profile:s.profile,
      measuredSpeedRange:count?[Math.min(...speeds),Math.max(...speeds)]:null,file});
    await context.close();
  }
  {
    const {page,context}=await fresh();await page.evaluate(()=>SCENES.car.weather.setWiperEnabled(true));await step(page,800);
    for(const level of ['NONE','LIGHT','MEDIUM','HEAVY']){
      await page.evaluate(l=>SCENES.car.weather.setRainLevel(l),level);const a=await rain(page);await step(page,200);const b=await rain(page);
      assert.equal((await state(page)).weather.wiperEnabled,true);assert.notDeepEqual(a.wipers,b.wipers);
    }
    await page.evaluate(()=>SCENES.car.weather.setWiperEnabled(false));await step(page,2200);
    assert.equal((await state(page)).weather.rainLevel,'HEAVY');assert.ok((await rain(page)).wipers.every(v=>Math.abs(v-1)<.01));
    await context.close();
  }
  {
    const {page,context}=await fresh();await tapPart(page,'wiper');await step(page,500);
    await page.evaluate(()=>SCENES.car.weather.setRainLevel('LIGHT'));
    await page.clock.fastForward(16000);await step(page,2500);
    assert.equal((await state(page)).weather.rainLevel,'LIGHT');assert.equal((await rain(page)).count,72);
    await page.evaluate(()=>SCENES.car.weather.setRainLevel('NONE'));await step(page,2500);assert.equal((await rain(page)).visible,false);
    await context.close();
    const second=await fresh();await tapPart(second.page,'wiper');
    await second.page.evaluate(()=>{SCENES.car.weather.setRainLevel('NONE');SCENES.car.weather.setWiperEnabled(false);});
    await second.page.clock.fastForward(16000);await step(second.page,2500);
    const s=(await state(second.page)).weather;assert.equal(s.rainLevel,'NONE');assert.equal(s.wiperEnabled,false);
    assert.equal((await rain(second.page)).visible,false);await second.context.close();
  }
  pass('Phase 1 API: four bounded rain profiles, measured fall speed, independent wipers and superseded legacy deadlines',evidence.rain);
  // Compare decoded pixels AND the exact structural/layout/camera captures that
  // the parent harness has already checked against the immutable manifest.
  const compare=visualCompare?await visualCompare({ROOT,OUT,captures,existing}):JSON.parse(execFileSync('python3',['-c',`
import json,sys,hashlib
from PIL import Image,ImageChops
from pathlib import Path
base,out=map(Path,sys.argv[1:])
results=[]
for file in sorted(base.glob('*.png')):
 a=Image.open(file).convert('RGB'); b=Image.open(out/file.name).convert('RGB')
 if a.size!=b.size: raise RuntimeError('Screenshot dimensions changed: '+file.name)
 diff=ImageChops.difference(a,b); box=diff.getbbox(); pixels=list(diff.getdata())
 changed=sum(any(c for c in p) for p in pixels); maximum=max(max(p) for p in pixels)
 results.append(dict(file=file.name,dimensions=a.size,changedPixels=changed,maxChannelDelta=maximum,boundingBox=box,
   baselineSHA256=hashlib.sha256(file.read_bytes()).hexdigest(),candidateSHA256=hashlib.sha256((out/file.name).read_bytes()).hexdigest()))
 if maximum>2: raise RuntimeError('Visual change requires review: '+file.name+' '+str(results[-1]))
a=Image.open(base/'car-default-390x844.png').convert('RGB');b=Image.open(out/'car-default-390x844.png').convert('RGB')
pair=Image.new('RGB',(a.width*2,a.height));pair.paste(a,(0,0));pair.paste(b,(a.width,0));pair.save(out/'default-original-vs-candidate.png',optimize=True)
print(json.dumps(results))
`,path.join(ROOT,'docs/baselines/simple-plus'),OUT],{encoding:'utf8'}));
  assert.equal(compare.length,existing.captures.length);assert.equal(captures.length,existing.captures.length);
  fs.writeFileSync(path.join(OUT,'visual-comparison.json'),JSON.stringify({status:'PASS',method:phase2?'Exact original camera/layout/state and all original mesh descriptors; only four amber owners reassigned; projected new fixtures and temporary controls bounded separately':'Exact camera/layout/state/hierarchy checks plus decoded pixels; same pinned browser/clock/DPR/seed',
    roundingLimit:2,captures:compare},null,2)+'\n');
  fs.writeFileSync(path.join(OUT,'foundation-api-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  pass('Phase 1: immutable original vs candidate screenshots (structure + decoded pixels)',compare);
};
