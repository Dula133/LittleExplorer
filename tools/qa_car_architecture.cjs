/* Migration structure checks; no screenshots/output files. Serve the repository first. */
const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
const base=process.env.LE_QA_URL||'http://127.0.0.1:19765';
(async()=>{const browser=await chromium.launch({executablePath:process.env.LE_QA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url());});
 await page.addInitScript(()=>{localStorage.setItem('muted','1');localStorage.setItem('voice','sys');});
 await page.goto(base+'/pages/car.html');await page.waitForFunction(()=>window.__dbg,null,{timeout:90000});
 const result=await page.evaluate(()=>{
  const main=__dbg,car=SCENES.car,T=main.THREE;car.lighting.setLampMode('HEADLIGHT');
  const before=JSON.stringify(car.controls.getState()),build=()=>{const scene=new T.Scene(),root=new T.Group();scene.add(root);const ctx=L3.makeCtx(scene,root),api={S:{drive:false,nightT:0,night:0,xr:0},now:()=>performance.now(),ee:0,sfx:{},caption(){}};return {obj:car.build(ctx,api,{preview:true}),ctx,root};};
  const a=build(),b=build();a.obj.runtime.controls.setWindow('left',1);a.obj.runtime.lighting.setLampMode('POSITION');a.obj.runtime.weather.setRainLevel('HEAVY');
  const isolated=JSON.stringify(car.controls.getState())===before&&car.lighting.getState().lampMode==='HEADLIGHT'&&b.obj.runtime.controls.getState().windows.left===0&&b.obj.runtime.lighting.getState().lampMode==='OFF';
  let guarded=false;try{car.build(a.ctx,a.obj.runtime.api,{preview:true});}catch(e){guarded=/already built/.test(e.message);}
  const seen=new Set();let ownership=true,plainData=true;
  for(const [id,p]of Object.entries(main.PARTS))for(const m of p.meshes){if(seen.has(m)||m.userData.part!==id)ownership=false;seen.add(m);for(const value of Object.values(m.userData))if(value?.isObject3D)plainData=false;}
  const attached=main.PARTS.windowleft.groups[0].parent.parent.userData.doorPivot&&main.PARTS.horn.groups[0].parent.parent===main.PARTS.steer.groups[0];
  // Preview constructors and update may run without an audio implementation.
  if(a.obj.audio)a.obj.update(.016);
  return {parts:Object.keys(main.PARTS).length,isolated,guarded,ownership,plainData,attached,previewAudio:a.obj.audio?.getMusicState?.().active||false};
 });
 assert.equal(result.parts,56);for(const k of ['isolated','guarded','ownership','plainData','attached'])assert.equal(result[k],true,k);assert.equal(result.previewAudio,false);
 await page.getByRole('button',{name:'进入驾驶舱'}).tap();await page.getByRole('button',{name:'查看灯光区'}).tap();await page.locator('[data-part="lampKnob"]').tap();assert.equal(await page.evaluate(()=>SCENES.car.lighting.getState().lampMode),'OFF');
 await page.goto(base+'/index.html');await page.waitForFunction(()=>{const c=document.querySelector('.card[data-scene="car"] canvas');if(!c||c.width===300)return false;const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return pixels.some((v,i)=>i%4===3&&v>0);},null,{timeout:90000});
 assert.deepEqual(errors,[]);console.log('PASS architecture/homepage:',JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
