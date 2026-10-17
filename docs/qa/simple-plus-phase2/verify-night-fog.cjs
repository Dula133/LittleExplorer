// Supplemental visual QA: actual native taps, original scene, no API state or
// material overrides. Reproduce with: node docs/qa/simple-plus-phase2/verify-night-fog.cjs
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const pw=require('/workspace/.littleexplorer-tools/node_modules/playwright-core');
const ROOT=path.resolve(__dirname,'../../..'),OUT=__dirname;
const source=fs.readFileSync(path.join(ROOT,'tools/qa_car_simple_plus.cjs'),'utf8');
const pick=Function('return ('+source.slice(source.indexOf('function pickPoint('),source.indexOf('function rainState(')).trim()+')')();
const observe=Function('return ('+source.slice(source.indexOf('function instrumentation('),source.indexOf('function sceneSnapshot(')).trim()+')')();
async function run(){let browser,server;
  try{
    server=spawn('python3',['-B','-u','-m','http.server','0','--bind','127.0.0.1'],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
    const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('HTTP startup timeout')),10000);
      server.stdout.on('data',b=>{const m=String(b).match(/port (\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});server.once('error',reject);});
    browser=await pw.chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1,locale:'zh-CN',timezoneId:'UTC'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.clock.install({time:new Date('2026-10-16T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T12:00:01Z'));
    await page.addInitScript(observe,{muted:true,controlled:true});await page.goto(`http://127.0.0.1:${port}/pages/car.html`,{waitUntil:'load'});await page.waitForFunction(()=>!!window.__dbg);
    const step=async ms=>{for(let t=0;t<ms;t+=50)await page.clock.fastForward(Math.min(50,ms-t));};
    async function part(id){const p=await page.evaluate(pick,id);assert.ok(p,'Physical ray hit: '+id);await page.touchscreen.tap(p.x,p.y);await step(100);assert.equal(await page.evaluate(()=>__dbg.S.sel),id);}
    await step(200);await part('lights');
    for(let i=0;i<3;i++){await page.locator('#car-part-actions [data-action="lamp"]').tap();await step(100);}
    assert.equal(await page.evaluate(()=>SCENES.car.lighting.getState().requestedLampMode),'OFF');
    await step(10000);await part('fog');await page.locator('#car-part-actions [data-action="fog"]').tap();await step(1200);
    const sample=()=>page.evaluate(()=>{const d=__dbg,T=d.THREE,p=new T.Vector3(3.4,.02,0).project(d.camera);
      return {lighting:SCENES.car.lighting.getState(),camera:{theta:d.cam.theta,phi:d.cam.phi,r:d.cam.r,projection:d.camera.projectionMatrix.toArray()},night:d.S.night,
        roadPoint:[Math.round((p.x+1)*innerWidth/2),Math.round((1-p.y)*innerHeight/2)],
        spots:d.PARTS.fog.groups[0].children.filter(o=>o.isSpotLight).map(o=>({visible:o.visible,intensity:o.intensity,distance:o.distance,target:o.target.position.toArray()})),
        trusted:__qaEvidence.pointers.every(e=>e.trusted),contextLost:__qaEvidence.contextLost};});
    const off=await sample();assert.equal(off.lighting.fogLight,false);assert.ok(off.lighting.headlightIntensity<.001&&off.lighting.positionIntensity<.001);
    await page.screenshot({path:path.join(OUT,'fog-night-off-390x844.png'),animations:'disabled'});
    await page.locator('#car-part-actions [data-action="fog"]').tap();await step(1200);const on=await sample();assert.equal(on.lighting.fogLight,true);
    assert.ok(on.spots.every(s=>s.visible&&s.intensity>.79&&s.distance===3&&s.target[1]===.03));
    assert.ok(Math.abs(on.camera.theta-off.camera.theta)<.00001&&Math.abs(on.camera.r-off.camera.r)<.00001);assert.deepEqual(on.camera.projection,off.camera.projection);
    await page.screenshot({path:path.join(OUT,'fog-night-on-390x844.png'),animations:'disabled'});
    const pixels=JSON.parse(execFileSync('python3',['-c',`
from PIL import Image,ImageStat
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); x,y=map(int,sys.argv[2:]); r=(max(0,x-12),max(0,y-8),min(390,x+13),min(844,y+9))
a=Image.open(p/'fog-night-off-390x844.png').convert('RGB').crop(r); b=Image.open(p/'fog-night-on-390x844.png').convert('RGB').crop(r)
before=sum(ImageStat.Stat(a).mean)/3;after=sum(ImageStat.Stat(b).mean)/3
assert after>before+.5,('Near-road illumination not visibly increased',r,before,after)
print(json.dumps(dict(roadROI=r,beforeMeanRGB=before,afterMeanRGB=after,increase=after-before)))
`,OUT,...on.roadPoint.map(String)],{encoding:'utf8'}));
    assert.equal(on.trusted,true);assert.equal(on.contextLost,0);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(OUT,'night-fog-evidence.json'),JSON.stringify({status:'PASS',kind:'Supplemental native-touch screenshot and rendered near-road illumination test',off,on,pixels,errors,
      boundaries:['Software Chromium only','No physical HarmonyOS or human audio test','New formal MP3 not supplied']},null,2)+'\n');console.log('NIGHT FOG PASS',JSON.stringify(pixels));
  }finally{if(browser)await browser.close();if(server)server.kill('SIGTERM');}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
