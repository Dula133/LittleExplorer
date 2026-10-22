#!/usr/bin/env node
'use strict';
// Native clicks and the original rAF driving simulation; never assign product state.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../../../..'),OUT=__dirname,BASE='fcffdc29f0761f3d066efd07d815fe818a43b019';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
function protect(){
 assert.equal(git('branch','--show-current'),'feature/car-cockpit-desktop-v3');
 execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'],{cwd:ROOT});
 const changes=[...new Set([...git('diff','--name-only',BASE).split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))];
 for(const f of changes)assert.ok(f==='pages/cockpit.html'||f.startsWith('docs/qa/cockpit-desktop-v3/v32/'),'Unapproved change: '+f);
 const rows=execFileSync('git',['ls-tree','-rz',BASE],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(Boolean);let preserved=0;
 for(const row of rows){const[meta,f]=row.split('\t'),oid=meta.split(' ')[2];if(f==='pages/cockpit.html')continue;const b=fs.readFileSync(path.join(ROOT,f));assert.equal(crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),oid,'Base file changed: '+f);preserved++;}
 const prior=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/qa/cockpit-desktop-v3/protected-phase3-sha256.json'))),voiceSHA256={};
 for(const[f,expected]of Object.entries(prior.voiceSHA256)){const actual=sha(fs.readFileSync(path.join(ROOT,f)));assert.equal(actual,expected,'Voice SHA256 mismatch: '+f);voiceSHA256[f]=actual;}
 assert.equal(Object.keys(voiceSHA256).filter(f=>f.endsWith('.mp3')).length,638);
 assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT,'voice/lines.json')))).length,315);
 return{base:BASE,changes,preservedBaseFiles:preserved,voiceKeys:315,mp3:638,voiceSHA256};
}
(async()=>{
 const protection=protect(),source=fs.readFileSync(path.join(ROOT,'pages/cockpit.html')),sourceSHA256=sha(source),baseline=execFileSync('git',['show',BASE+':pages/cockpit.html'],{cwd:ROOT});
 // The only JS insertion is passive rendering at the beginning of update().
 const script=b=>b.toString().match(/<script>([\s\S]*?)<\/script>/)[1],currentJS=script(source),baseJS=script(baseline);
 const marker="function update(){const w=$('windshield');",start=currentJS.indexOf(marker)+marker.length,end=currentJS.indexOf("\n w.classList.toggle('night'",start);
 assert.ok(start>marker.length&&end>start);assert.equal(currentJS.slice(0,start)+currentJS.slice(end),baseJS,'Original guards, weather, wipers, speech and physics must be byte-identical');
 assert.ok(!/\bstate\.\w+\s*=(?!=)/.test(currentJS.slice(start,end)),'Observation code cannot write product state');
 const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');assert.equal(require(path.join(path.dirname(require.resolve(process.env.PLAYWRIGHT_MODULE||'playwright-core')),'package.json')).version,'1.58.2');
 const errors=[],warnings=[],checks=[],records=[],inputs=[];let browser;
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}const bytes=url.pathname==='/baseline.html'?baseline:url.pathname==='/pages/cockpit.html'?fs.readFileSync(path.join(ROOT,'pages/cockpit.html')):null;if(!bytes){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);});
 try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const url='http://127.0.0.1:'+server.address().port;
 browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 async function open(width,height,base=false){const c=await browser.newContext({viewport:{width,height},locale:'zh-CN'});const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(r.url()+':'+r.status());});p.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));
  await p.addInitScript(()=>{window.__rearQA=[];document.addEventListener('click',e=>__rearQA.push({trusted:e.isTrusted,target:e.target.closest('button,a')?.outerHTML.slice(0,180)}),true);});
  await p.clock.install({time:new Date('2026-10-22T02:00:00Z')});await p.clock.pauseAt(new Date('2026-10-22T02:00:01Z'));
  await p.goto(url+(base?'/baseline.html':'/pages/cockpit.html'));await p.evaluate(()=>document.fonts.ready);return{p,c};
 }
 const click=(p,s)=>p.locator(s).click(),pressed=(p,s)=>p.locator(s).getAttribute('aria-pressed');
 const step=async(p,ms)=>{for(let n=0;n<ms;n+=50)await p.clock.fastForward(Math.min(50,ms-n));};
 async function geometry(p){return p.evaluate(()=>({viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],rects:Object.fromEntries(['.topbar','#windshield','.rear-mirror','#wiperSystem','.instruments','.gauge.speed','.gauge.rpm','.wheel','.controls','.footer','#outsideBtn'].map(s=>[s,document.querySelector(s).getBoundingClientRect().toJSON()])),buttons:[...document.querySelectorAll('button')].map(e=>e.outerHTML)}));}
 async function lamps(p,label,brake,reverse,gear){const state=await p.evaluate(()=>({braking:document.querySelector('#rearLights').classList.contains('braking'),reversing:document.querySelector('#rearLights').classList.contains('reversing'),red:[...document.querySelectorAll('.rear-brake-light')].map(e=>getComputedStyle(e).fill),white:[...document.querySelectorAll('.rear-reverse-light')].map(e=>getComputedStyle(e).fill),aria:document.querySelector('#rearLights').getAttribute('aria-label'),selectedGear:document.querySelector('[data-gear][aria-pressed="true"]').dataset.gear,brakePressed:document.querySelector('#brake').getAttribute('aria-pressed')}));
  assert.equal(state.braking,brake,label);assert.equal(state.reversing,reverse,label);assert.deepEqual(state.red,Array(2).fill(brake?'rgb(255, 59, 66)':'rgb(84, 43, 57)'));assert.deepEqual(state.white,Array(2).fill(reverse?'rgb(255, 254, 243)':'rgb(60, 83, 98)'));assert.equal(state.brakePressed,String(brake));assert.equal(state.selectedGear,gear);assert.match(state.aria,new RegExp('Brake '+(brake?'on':'off')));assert.match(state.aria,new RegExp('Reverse '+(reverse?'on':'off')));records.push({label,...state});}
 for(const[width,height]of [[1366,768],[1920,1080]]){
  const old=await open(width,height,true),before=await geometry(old.p);await old.c.close();
  const{p,c}=await open(width,height),after=await geometry(p);assert.deepEqual(after,before,'Existing mirror/road/wipers/gauges/layout and all controls must retain baseline geometry');assert.deepEqual(after.scroll,[width,height]);
  assert.equal(await p.locator('#rearLights button, #rearLights input, #rearLights a').count(),0);
  const fit=await p.evaluate(()=>{const parent=document.querySelector('.rear-mirror').getBoundingClientRect(),zone=document.querySelector('#rearLights').getBoundingClientRect(),legend=document.querySelector('.rear-light-legend'),items=[...legend.children].map(e=>e.getBoundingClientRect());return{parent:parent.toJSON(),zone:zone.toJSON(),legendFits:legend.scrollWidth<=legend.clientWidth+1&&items.every(r=>r.left>=parent.left&&r.right<=parent.right)};});assert.ok(fit.zone.left>=fit.parent.left&&fit.zone.right<=fit.parent.right&&fit.zone.top>=fit.parent.top&&fit.zone.bottom<=fit.parent.bottom);assert.ok(fit.legendFits,'Bilingual legend must fit existing mirror');
  checks.push({name:`Baseline geometry and no-scroll layout ${width}×${height}`,geometry:after,fit});
  await click(p,'#voiceToggle');await lamps(p,`${width} initial P`,false,false,'P');
  await click(p,'#brake');await lamps(p,`${width} P brake on engine off`,true,false,'P');await p.screenshot({path:path.join(OUT,`brake-red-${width}x${height}.png`),animations:'disabled'});
  await click(p,'[data-gear="R"]');assert.equal(await p.locator('#feedbackTitle').textContent(),'先启动发动机');await lamps(p,`${width} R denied before engine`,true,false,'P');
  await click(p,'#brake');await lamps(p,`${width} P brake released`,false,false,'P');await click(p,'#start');assert.equal(await pressed(p,'#start'),'false');assert.equal(await p.locator('#feedbackTitle').textContent(),'先踩住脚刹');
  await click(p,'#belt');await click(p,'#brake');await click(p,'#start');assert.equal(await pressed(p,'#start'),'true');
  for(const gear of ['N','D','S','R','P']){await click(p,`[data-gear="${gear}"]`);await lamps(p,`${width} ${gear} held brake`,true,gear==='R',gear);
   if(gear==='R'){await p.screenshot({path:path.join(OUT,`reverse-and-brake-${width}x${height}.png`),animations:'disabled'});await p.locator('.rear-mirror').screenshot({path:path.join(OUT,`mirror-both-${width}.png`)});}
   await click(p,'#brake');await lamps(p,`${width} ${gear} released brake`,false,gear==='R',gear);
   if(gear==='R')await p.screenshot({path:path.join(OUT,`reverse-white-${width}x${height}.png`),animations:'disabled'});
   if(gear==='D'){await click(p,'[data-gear="R"]');assert.equal(await p.locator('#feedbackTitle').textContent(),'换挡前踩脚刹');await lamps(p,`${width} rejected R without brake`,false,false,'D');}
   await click(p,'#brake');}
  // Drive in reverse through the unchanged guards, then reject moving shifts.
  await click(p,'[data-gear="R"]');await click(p,'#handbrake');await click(p,'#brake');await click(p,'#accelerate');await step(p,1200);assert.ok(+(await p.locator('#speedVal').textContent())>0);
  for(const gear of ['D','N','P']){await click(p,`[data-gear="${gear}"]`);assert.equal(await p.locator('#feedbackTitle').textContent(),'行驶中不能这样换挡');await lamps(p,`${width} moving R rejects ${gear}`,false,true,'R');}
  await click(p,'#brake');await lamps(p,`${width} moving reverse braking`,true,true,'R');await step(p,2000);assert.equal(await p.locator('#speedVal').textContent(),'0');
  await click(p,'[data-gear="N"]');await lamps(p,`${width} exit R to N`,true,false,'N');await click(p,'[data-gear="D"]');await click(p,'#brake');await click(p,'#accelerate');await step(p,1200);
  await click(p,'[data-gear="R"]');assert.equal(await p.locator('#feedbackTitle').textContent(),'行驶中不能这样换挡');await lamps(p,`${width} moving D rejects R`,false,false,'D');
  await click(p,'#brake');await lamps(p,`${width} forward braking`,true,false,'D');await step(p,2000);await click(p,'#handbrake');await click(p,'[data-gear="P"]');await click(p,'#start');await click(p,'#brake');await lamps(p,`${width} safely parked engine off`,false,false,'P');assert.equal(await pressed(p,'#start'),'false');
  await p.screenshot({path:path.join(OUT,`parked-off-${width}x${height}.png`),animations:'disabled'});
  const events=await p.evaluate(()=>__rearQA);assert.ok(events.length>0&&events.every(e=>e.trusted));inputs.push({width,height,events});checks.push({name:`Brake/reverse/both/all five gears/illegal-shift guards/start and park ${width}×${height}`,status:'PASS'});await c.close();console.log('PASS: rear lights',width,height);
 }
 // Small screens retain discoverable return navigation and a contained display.
 {const{p,c}=await open(390,844);const g=await geometry(p);assert.equal(g.scroll[0],390);await p.locator('#outsideBtn').scrollIntoViewIfNeeded();assert.ok(await p.locator('#outsideBtn').evaluate(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}));await p.screenshot({path:path.join(OUT,'mobile-390x844.png')});await c.close();checks.push({name:'390×844 horizontal containment and accessible return',status:'PASS'});}
 assert.deepEqual(errors,[]);assert.equal(sha(fs.readFileSync(path.join(ROOT,'pages/cockpit.html'))),sourceSHA256);protect();
 fs.writeFileSync(path.join(OUT,'protected-files.json'),JSON.stringify(protection,null,2)+'\n');
 fs.writeFileSync(path.join(OUT,'rear-lights-report.json'),JSON.stringify({status:'PASS',base:BASE,version:'V3.2',sourceSHA256,qaSHA256:sha(fs.readFileSync(__filename)),browser:browser.version(),playwright:'1.58.2',checks,records,inputs,errors,warnings:[...new Set(warnings)],originalJSOutsidePassiveInsertionUnchanged:true,voices:{keys:315,mp3:638,SHA256Unchanged:true},humanVisualListening:'NOT_TESTED',HarmonyOS:'NOT_TESTED',browserTTSAudibility:'Not retested; previously reported cloud synthesis-failed'},null,2)+'\n');console.log('PASS: V3.2 native-click rear lights QA');
 }catch(e){fs.writeFileSync(path.join(OUT,'failure.json'),JSON.stringify({status:'FAIL',error:String(e),stack:e.stack,checks,records,errors},null,2)+'\n');throw e;}
 finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
