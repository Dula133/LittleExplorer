#!/usr/bin/env node
'use strict';
// Integration-specific checks. The accepted Phase 3 tests remain byte-identical.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),{execFileSync,spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),BASE='cfbe268081a094050152054d26f70297b58da385';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const CAR_CSS=`/* Independent cockpit navigation; absolute positioning preserves the original header/canvas layout. */
.cockpit-entry{position:absolute;right:14px;top:calc(100% + 8px);width:74px;height:62px;flex-direction:column;gap:1px;font-weight:900;font-size:13px;line-height:1.1}
.cockpit-entry .cockpit-icon{font-size:23px;line-height:1.1}.cockpit-entry small{font-size:10px;color:var(--ink-soft)}
.cockpit-entry:focus-visible{outline:3px solid var(--sky-deep);outline-offset:3px}
`;
const CAR_LINK='  <a class="rbtn cockpit-entry" id="cockpit-entry" href="pages/cockpit.html" aria-label="驾驶舱 / Cockpit"><span class="cockpit-icon" aria-hidden="true">🚘</span><span>驾驶舱</span><small lang="en">Cockpit</small></a>\n';
function scope({ROOT:root=ROOT,pass=()=>{}}={}){
 const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
 assert.equal(git('branch','--show-current'),'feature/car-cockpit-desktop-v3');
 execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'],{cwd:root});
 assert.equal(git('rev-parse','origin/feature/car-simple-plus'),BASE);
 const allowed=new Set(['pages/car.html','pages/cockpit.html','tools/qa_cockpit_desktop_v3.cjs','tools/qa_cockpit_phase3_regression.cjs','docs/COCKPIT_DESKTOP_V3_INTEGRATION.md']);
 const changes=[...new Set([...git('diff','--name-only',BASE).split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))];
 for(const f of changes)assert.ok(allowed.has(f)||f.startsWith('docs/qa/cockpit-desktop-v3/'),'Unapproved change: '+f);
 const original=execFileSync('git',['show',BASE+':pages/car.html'],{cwd:root,encoding:'utf8'});
 assert.equal(fs.readFileSync(path.join(root,'pages/car.html'),'utf8'),original.replace('</style>',CAR_CSS+'</style>').replace('<div class="top">\n','<div class="top">\n'+CAR_LINK),'Car page may only gain the scoped navigation CSS/link');
 const protectedFiles={},voiceSHA256={};
 const rows=execFileSync('git',['ls-tree','-rz',BASE],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 for(const row of rows){const [meta,f]=row.split('\t'),oid=meta.split(' ')[2];if(f==='pages/car.html')continue;
  const b=fs.readFileSync(path.join(root,f));assert.equal(crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),oid,'Base file changed: '+f);
  protectedFiles[f]=sha(b);if(f.startsWith('voice/'))voiceSHA256[f]=sha(b);
 }
 // Compare SHA256 for each exact base path, using immutable Git blob contents.
 const voiceRows=rows.map(row=>{const[meta,f]=row.split('\t');return{f,oid:meta.split(' ')[2]};}).filter(r=>r.f.startsWith('voice/'));
 const blobs=execFileSync('git',['cat-file','--batch'],{cwd:root,input:voiceRows.map(r=>r.oid+'\n').join(''),maxBuffer:128*1024*1024});let offset=0;
 for(const {f,oid}of voiceRows){const end=blobs.indexOf(10,offset),header=blobs.subarray(offset,end).toString().split(' ');assert.equal(header[0],oid);assert.equal(header[1],'blob');const size=+header[2],expected=sha(blobs.subarray(end+1,end+1+size));assert.equal(voiceSHA256[f],expected,'Per-path Phase 3 SHA256 changed: '+f);offset=end+1+size+1;}
 assert.equal(Object.keys(voiceSHA256).filter(f=>f.endsWith('.mp3')).length,638);
 assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(root,'voice/lines.json')))).length,315);
 pass('Exact integration scope; every Phase 3 base file unchanged except the two car-navigation insertions',{base:BASE,changes,protectedFiles:Object.keys(protectedFiles).length,voiceKeys:315,mp3:638});
 return {base:BASE,changes,protectedFiles,voiceSHA256};
}
exports.scope=scope;
if(require.main===module)(process.argv.includes('--v31-wipers')?runV31():run()).catch(e=>{console.error(e);process.exitCode=1;});
async function run(){
 const OUT=process.env.LE_COCKPIT_QA_OUT||path.join(ROOT,'docs/qa/cockpit-desktop-v3');fs.mkdirSync(OUT,{recursive:true});
 const testedSHA256=Object.fromEntries(['pages/car.html','pages/cockpit.html',path.relative(ROOT,__filename)].map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]));
 const checks=[],errors=[],warnings=[],inputs=[],speech=[],media=[],viewports=[];
 const pass=(name,evidence)=>{checks.push({name,evidence});console.log('PASS:',name);};
 const baseline=scope({pass});
 fs.writeFileSync(path.join(OUT,'protected-phase3-sha256.json'),JSON.stringify(baseline,null,2)+'\n');
 const modulePath=process.env.PLAYWRIGHT_MODULE||'/workspace/.littleexplorer-tools/node_modules/playwright-core';
 const pw=require(modulePath);assert.equal(require(path.join(path.dirname(require.resolve(modulePath)),'package.json')).version,'1.58.2');
 const server=spawn('python3',['-B','-u','-m','http.server','0','--bind','127.0.0.1'],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
 let browser;
 try{
 const port=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server startup timeout')),10000);server.stdout.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m){clearTimeout(t);resolve(+m[1]);}});server.on('error',reject);});
 const url=`http://127.0.0.1:${port}`,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'];
 browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,args});
 function observe(){
  window.__cockpitQA={inputs:[],speech:[],media:[],lost:0};
  document.addEventListener('click',e=>__cockpitQA.inputs.push({id:e.target.closest('button,a')?.id||e.target.closest('button,a')?.getAttribute('data-tab')||e.target.closest('button,a')?.outerHTML.slice(0,150),trusted:e.isTrusted}),true);
  if('speechSynthesis'in window){const native=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=u=>{const item={text:u.text,lang:u.lang,rate:u.rate,events:[]};__cockpitQA.speech.push(item);for(const event of ['start','end','error'])u.addEventListener(event,e=>item.events.push({type:event,error:e.error||null}));return native(u);};}
  window.Audio=new Proxy(window.Audio,{construct(target,a){const el=Reflect.construct(target,a);for(const type of ['playing','ended','error'])el.addEventListener(type,e=>__cockpitQA.media.push({type,trusted:e.isTrusted,src:el.currentSrc,time:el.currentTime,duration:el.duration,error:el.error?.code||null}));return el;}});
  document.addEventListener('webglcontextlost',()=>__cockpitQA.lost++,true);
 }
 function watch(p){p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push({url:p.url(),type:'JS',message:String(e)}));p.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname!=='/favicon.ico')errors.push({url:r.url(),status:r.status()});});p.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')errors.push({url:r.url(),message:r.failure()?.errorText});});p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push({url:p.url(),type:'console',message:m.text()});if(m.type()==='warning')warnings.push(m.text());});}
 async function open(viewport){const c=await browser.newContext({viewport,locale:'zh-CN',timezoneId:'UTC',hasTouch:true});await c.addInitScript(observe);const p=await c.newPage();watch(p);return{p,c};}
 async function collect(p,label){const e=await p.evaluate(()=>({...__cockpitQA,voices:'speechSynthesis'in window?speechSynthesis.getVoices().map(v=>({name:v.name,lang:v.lang,localService:v.localService})):[]}));assert.equal(e.lost,0);assert.ok(e.inputs.every(i=>i.trusted));inputs.push({label,events:e.inputs});speech.push({label,voices:e.voices,utterances:e.speech});media.push({label,events:e.media});}
 async function click(p,s){await p.locator(s).click();}
 const pressed=(p,s)=>p.locator(s).getAttribute('aria-pressed');
 async function expectPressed(p,s,v){assert.equal(await pressed(p,s),String(v),s);}
 async function snap(p,name){await p.screenshot({path:path.join(OUT,name),animations:'disabled'});}
 async function geometry(p,expectedFixed){const result=await p.evaluate(()=>({viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],back:document.querySelector('#outsideBtn').getBoundingClientRect().toJSON(),footer:document.querySelector('.footer').getBoundingClientRect().toJSON()}));assert.ok(result.scroll[0]<=result.viewport[0]+1,'Horizontal overflow');if(expectedFixed)assert.ok(result.scroll[1]<=result.viewport[1]+1,'Unexpected whole-page scrolling');assert.ok(result.back.width>=44&&result.back.height>=44);return result;}
 async function reachable(p,s){const loc=p.locator(s);await loc.scrollIntoViewIfNeeded();assert.ok(await loc.isVisible(),s);assert.ok(await loc.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&el.contains(document.elementFromPoint(x,y));}),'Clipped/covered control: '+s);}
 async function allTabs(p){for(const tab of ['drive','lights','weather','cabin']){await click(p,`[data-tab="${tab}"]`);assert.equal(await p.locator(`[data-tab="${tab}"]`).getAttribute('aria-selected'),'true');assert.equal(await p.locator('.pane.active').getAttribute('id'),'tab-'+tab);const selectors=await p.locator(`#tab-${tab} button`).evaluateAll(a=>a.map(el=>el.id?'#'+el.id:el.hasAttribute('data-gear')?`[data-gear="${el.dataset.gear}"]`:el.hasAttribute('data-lamp')?`[data-lamp="${el.dataset.lamp}"]`:el.hasAttribute('data-rain')?`[data-rain="${el.dataset.rain}"]`:el.hasAttribute('data-wiper')?`[data-wiper="${el.dataset.wiper}"]`:`[data-fan="${el.dataset.fan}"]`));for(const s of selectors)await reachable(p,s);}for(const s of ['#brake','#accelerate','#voiceToggle','#outsideBtn'])await reachable(p,s);}
 for(const [width,height]of [[1280,720],[1366,768],[1440,900],[1920,1080],[1280,640],[1366,680],[1024,576],[390,844],[844,390]]){
  const{p,c}=await open({width,height});await p.goto(url+'/pages/cockpit.html');assert.equal(await p.locator('#exterior').count(),0);assert.ok(await p.locator('#cockpit').isVisible());const result=await geometry(p,width>=1000&&height>=620);await allTabs(p);await p.evaluate(()=>scrollTo(0,0));await reachable(p,'#outsideBtn');assert.equal(await p.locator('#toast').evaluate(el=>el.closest('#windshield')!==null),true);viewports.push({width,height,zoom:1,...result,allTabsAndControlsReachable:true});if(width===1280&&height===720){await click(p,'[data-tab="drive"]');await snap(p,'cockpit-default-1280x720.png');}if(width===390)await snap(p,'cockpit-mobile-390x844.png');await collect(p,`${width}x${height}`);await c.close();console.log('VIEWPORT:',width,height);
 }
 pass('All four desktop sizes, toolbar-reduced heights, narrow landscape and 390×844: four tabs, no horizontal overflow, every control reachable',viewports);
 // Deterministic browser time advances the original simulation, never state or handlers.
 const {p,c}=await open({width:1366,height:768});await p.clock.install({time:new Date('2026-10-21T12:00:00Z')});await p.clock.pauseAt(new Date('2026-10-21T12:00:01Z'));await p.goto(url+'/pages/cockpit.html');
 const step=async ms=>{for(let n=0;n<ms;n+=50)await p.clock.fastForward(Math.min(50,ms-n));};
 await click(p,'#start');await expectPressed(p,'#start',false);assert.equal(await p.locator('#feedbackTitle').textContent(),'先踩住脚刹');
 await click(p,'#accelerate');await expectPressed(p,'#accelerate',false);
 await click(p,'#belt');await click(p,'#brake');await click(p,'#start');await expectPressed(p,'#start',true);
 await click(p,'[data-gear="D"]');await expectPressed(p,'[data-gear="D"]',true);await click(p,'#handbrake');await expectPressed(p,'#handbrake',false);
 await click(p,'#accelerate');await expectPressed(p,'#accelerate',false); // brake still held
 await click(p,'#brake');const needle0=await p.locator('#speedNeedle').getAttribute('transform'),rpm0=await p.locator('#rpmNeedle').getAttribute('transform');
 await click(p,'#accelerate');await step(2000);const dSpeed=+(await p.locator('#speedVal').textContent());assert.ok(dSpeed>=20);assert.notEqual(await p.locator('#speedNeedle').getAttribute('transform'),needle0);assert.notEqual(await p.locator('#rpmNeedle').getAttribute('transform'),rpm0);assert.ok(await p.locator('#windshield').evaluate(el=>el.classList.contains('moving')));
 for(const gear of ['P','R','N']){await click(p,`[data-gear="${gear}"]`);await expectPressed(p,'[data-gear="D"]',true);assert.equal(await p.locator('#feedbackTitle').textContent(),'行驶中不能这样换挡');}
 await click(p,'#start');await expectPressed(p,'#start',true);assert.equal(await p.locator('#feedbackTitle').textContent(),'还不能熄火');
 await click(p,'#handbrake');await expectPressed(p,'#handbrake',false);assert.equal(await p.locator('#feedbackTitle').textContent(),'先刹车停稳');
 await click(p,'#belt');await expectPressed(p,'#belt',true);
 await click(p,'[data-gear="S"]');await expectPressed(p,'#accelerate',false);await click(p,'#accelerate');await step(2000);const sSpeed=+(await p.locator('#speedVal').textContent());assert.ok(sSpeed-dSpeed>dSpeed,'S must accelerate faster than D');
 await snap(p,'cockpit-s-driving-1366x768.png');
 await click(p,'#accelerate');await expectPressed(p,'#accelerate',false);await click(p,'#brake');await step(3000);assert.equal(await p.locator('#speedVal').textContent(),'0');
 await click(p,'[data-gear="P"]');await expectPressed(p,'[data-gear="S"]',true);assert.equal(await p.locator('#feedbackTitle').textContent(),'先拉手刹');
 await click(p,'#handbrake');await click(p,'[data-gear="P"]');await click(p,'#start');await click(p,'#brake');for(const [s,v]of [['#start',false],['#handbrake',true],['#brake',false],['[data-gear="P"]',true]])await expectPressed(p,s,v);
 pass('Native-click start/stop sequence, held pedals, D/S acceleration and both moving needles, P/R/N/off/handbrake/belt guards',{dSpeed,sSpeed});
 // Gear and belt guards not reached during the normal route.
 await click(p,'#belt');await click(p,'#brake');await click(p,'#start');await click(p,'[data-gear="D"]');await expectPressed(p,'[data-gear="P"]',true);assert.equal(await p.locator('#feedbackTitle').textContent(),'先系安全带');await click(p,'#belt');await click(p,'[data-gear="R"]');await expectPressed(p,'[data-gear="R"]',true);await click(p,'#handbrake');await click(p,'#brake');await click(p,'#accelerate');await step(1000);assert.ok(await p.locator('#windshield').evaluate(el=>el.classList.contains('reverse')));await click(p,'#brake');await step(1500);await click(p,'[data-gear="N"]');await expectPressed(p,'[data-gear="N"]',true);await click(p,'#accelerate');await expectPressed(p,'#accelerate',false);await click(p,'#handbrake');await click(p,'[data-gear="P"]');await click(p,'#start');await click(p,'#brake');
 pass('Seatbelt, reverse, neutral and acceleration guards');
 await p.clock.resume();await click(p,'[data-tab="weather"]');
 const weather=[];
 for(const rain of ['LIGHT','MEDIUM','HEAVY','STORM','SNOW','NONE','SNOW','HEAVY','NONE']){await click(p,`[data-rain="${rain}"]`);await p.waitForTimeout(500);const visual=await p.locator('#windshield').evaluate(el=>({raining:el.classList.contains('raining'),snowy:el.classList.contains('snowy'),rainOpacity:getComputedStyle(document.querySelector('#rainScreen')).opacity,snowOpacity:getComputedStyle(document.querySelector('#snowScreen')).opacity,snowflakes:document.querySelector('#snowScreen').children.length}));assert.equal(visual.raining,['LIGHT','MEDIUM','HEAVY','STORM'].includes(rain));assert.equal(visual.snowy,rain==='SNOW');assert.ok(!(visual.raining&&visual.snowy));if(rain==='SNOW'){assert.equal(+visual.snowOpacity,1);assert.equal(+visual.rainOpacity,0);assert.ok(visual.snowflakes>=50);await snap(p,'cockpit-snow-1366x768.png');}weather.push({rain,...visual});}
 for(const w of ['LOW','MEDIUM','HIGH','OFF']){await click(p,`[data-wiper="${w}"]`);await expectPressed(p,`[data-wiper="${w}"]`,true);}assert.equal(await p.locator('#wiperSystem > g').count(),2);
 await click(p,'#night');assert.ok(await p.locator('#windshield').evaluate(el=>el.classList.contains('night')&&el.classList.contains('lights-on')));await click(p,'#day');
 await click(p,'[data-tab="lights"]');for(const l of ['POSITION','HEADLIGHT','OFF','AUTO']){await click(p,`[data-lamp="${l}"]`);await expectPressed(p,`[data-lamp="${l}"]`,true);assert.equal(await p.locator('#windshield').evaluate(el=>el.classList.contains('lights-on')),l==='HEADLIGHT');}
 for(const [s,left,right]of [['#turnLeft',true,false],['#turnRight',false,true],['#hazard',true,true],['#hazard',false,false]]){await click(p,s);assert.equal(await p.locator('#flagLeft').evaluate(el=>el.classList.contains('on')),left);assert.equal(await p.locator('#flagRight').evaluate(el=>el.classList.contains('on')),right);}
 await click(p,'#fog');await expectPressed(p,'#fog',true);await click(p,'#fog');await expectPressed(p,'#fog',false);
 pass('Sunny/three rain levels/snow mutually exclusive, real snow elements, wipers, day/night, headlights, signals/hazard and fog visual state',weather);
 await click(p,'[data-tab="cabin"]');await click(p,'#tempUp');assert.equal(await p.locator('#tempVal').textContent(),'25');await click(p,'#tempDown');assert.equal(await p.locator('#tempVal').textContent(),'24');for(const f of ['1','2','3','0']){await click(p,`[data-fan="${f}"]`);await expectPressed(p,`[data-fan="${f}"]`,true);}
 for(const s of ['#window','#music']){await click(p,s);await expectPressed(p,s,true);await click(p,s);await expectPressed(p,s,false);}
 await click(p,'[data-tab="drive"]');await click(p,'#doorlock');await expectPressed(p,'#doorlock',true);await click(p,'#doorlock');await expectPressed(p,'#doorlock',false);await click(p,'#horn');assert.equal(await p.locator('#feedbackTitle').textContent(),'嘀嘀！');await click(p,'#leftSteer');assert.match(await p.locator('#wheel').getAttribute('style'),/-20deg/);await click(p,'#rightSteer');await click(p,'#centerSteer');assert.match(await p.locator('#wheel').getAttribute('style'),/0deg/);
 const spokenBefore=await p.evaluate(()=>__cockpitQA.speech.length);assert.ok(spokenBefore>0);await click(p,'#voiceToggle');await click(p,'#doorlock');assert.equal(await p.evaluate(()=>__cockpitQA.speech.length),spokenBefore);await click(p,'#voiceToggle');await click(p,'#doorlock');assert.ok(await p.evaluate(()=>__cockpitQA.speech.length)>spokenBefore);const utterances=await p.evaluate(()=>__cockpitQA.speech);assert.ok(utterances.every(u=>u.lang==='zh-CN'&&Math.abs(u.rate-.92)<1e-6));
 pass('Air temperature display, all fan levels, window, simulated music state, lock, horn, steering and browser-TTS on/off',{utterances:utterances.length,humanListening:'NOT_TESTED'});
 await collect(p,'functional-sequence');await c.close();
 // Real browser zoom is verified below, rather than a CSS transform or pinch zoom.
 await zoomChecks();
 // True document navigation and actual old MP3 playback after returning.
 for(const width of [1280,390]){const{p,c}=await open({width,height:width===390?844:720});await p.addInitScript(()=>{if(localStorage.getItem('voice')===null)localStorage.setItem('voice','xiaoyi');if(localStorage.getItem('muted')===null)localStorage.setItem('muted','0');});await p.goto(url+'/pages/car.html');await p.waitForFunction(()=>window.__dbg);await p.waitForFunction(()=>document.querySelector('#c').width>0);await reachable(p,'#cockpit-entry');const rect=await p.locator('#cockpit-entry').boundingBox();assert.ok(rect.width>=44&&rect.height>=44);if(width===1280)await snap(p,'car-cockpit-entry-1280x720.png');await click(p,'#cockpit-entry');await p.waitForURL('**/pages/cockpit.html');assert.ok(await p.locator('#cockpit').isVisible());await click(p,'[data-tab="weather"]');await click(p,'[data-rain="SNOW"]');await click(p,'#voiceToggle');assert.equal(await p.evaluate(()=>localStorage.getItem('voice')),'xiaoyi');await reachable(p,'#outsideBtn');await click(p,'#outsideBtn');await p.waitForURL('**/pages/car.html');await p.waitForFunction(()=>window.__dbg);assert.equal(await p.locator('#voice').textContent(),'小依');assert.equal(await p.locator('#nogl').isVisible(),false);assert.equal(await p.evaluate(()=>SCENES.car.weather.getState().rainLevel),'NONE');
  for(const s of ['#go','#xr','#ex']){await click(p,s);await click(p,s);}await click(p,'#xr');const mediaBefore=await p.evaluate(()=>__cockpitQA.media.length);await click(p,'.tile:has-text("车灯")');
  const runtimeKey=await p.evaluate(()=>document.querySelector('#cn').textContent+'。'+document.querySelector('#cd').textContent),clipID=JSON.parse(fs.readFileSync(path.join(ROOT,'voice/lines.json')))[runtimeKey];assert.ok(clipID);
  const suffix='/voice/xiaoyi/'+clipID+'.mp3';for(const event of ['playing','ended'])await p.waitForFunction(({mediaBefore,suffix,event})=>__cockpitQA.media.slice(mediaBefore).some(e=>e.type===event&&e.trusted&&(event!=='ended'||e.time>0)&&e.src.endsWith(suffix)),{mediaBefore,suffix,event},{timeout:45000});assert.deepEqual(await p.evaluate(()=>__cockpitQA.speech),[],'Old car must play its MP3 without TTS fallback');assert.ok(await p.evaluate(()=>{const g=document.querySelector('#c').getContext('webgl2');return g&&!g.isContextLost()&&g.getError()===g.NO_ERROR;}));if(width===1280)await snap(p,'car-returned-1280x720.png');await collect(p,'roundtrip-'+width);await c.close();}
 pass('Desktop and 390×844 true 3D → cockpit → 3D navigation; original three actions/WebGL and Xiaoyi MP3 playing+ended; no fallback or shared snow');
 assert.deepEqual(errors,[]);scope();for(const[f,expected]of Object.entries(testedSHA256))assert.equal(sha(fs.readFileSync(path.join(ROOT,f))),expected,'Tested file changed during run: '+f);
 const browserTTS={calls:speech.flatMap(s=>s.utterances).length,events:speech.flatMap(s=>s.utterances.flatMap(u=>u.events)),voices:speech.flatMap(s=>s.voices),audibility:'NOT_VERIFIED',scope:'Browser API calls/on-off/zh-CN only. Native engine errors are environment limitations, not successful speech playback.'};
 const report={status:'PASS',browserTTS,testedSHA256,base:BASE,branch:'feature/car-cockpit-desktop-v3',browser:browser.version(),playwright:'1.58.2',checks,viewports,errors,warnings:[...new Set(warnings)],inputs,speech,media,limits:{browserTTS:'Native speechSynthesis calls and on/off verified; cloud voice availability and human audibility are not guaranteed',humanAdultChildListening:'NOT_TESTED',HarmonyOS:'NOT_TESTED',physicalDesktopDevices:'NOT_TESTED',deployment:'NOT_AUTHORIZED'}};
 fs.writeFileSync(path.join(OUT,'cockpit-report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS: Cockpit integration suite',checks.length);
 async function zoomChecks(){
  const profile=fs.mkdtempSync('/tmp/le-cockpit-zoom-');
  const context=await pw.chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,viewport:{width:1280,height:720},locale:'zh-CN',args});
  try{await context.addInitScript(observe);const p=await context.newPage();
   // Change only this disposable QA browser profile through Chrome's own settings.
   await p.goto('chrome://settings/appearance');
   assert.equal(await p.evaluate(()=>new Promise(resolve=>chrome.settingsPrivate.setDefaultZoom(1.25,resolve))),true);
   watch(p);
   const results=[];
   for(const [width,height]of [[1280,720],[1366,768],[1440,900],[1920,1080],[1280,640]]){
    await p.setViewportSize({width,height});await p.goto(url+'/pages/cockpit.html');
    const cdp=await context.newCDPSession(p),metrics=await cdp.send('Page.getLayoutMetrics');await cdp.detach();
    assert.equal(metrics.cssVisualViewport.zoom,1.25);assert.equal(metrics.cssVisualViewport.scale,1);
    const measured=await geometry(p,width/1.25>=1000&&height/1.25>=620);await allTabs(p);
    results.push({physicalViewport:[width,height],browserZoom:metrics.cssVisualViewport.zoom,...measured,allControlsReachable:true});
    if(width===1280&&height===720)await snap(p,'cockpit-125percent-1280x720.png');
    if(width===1440)await snap(p,'cockpit-125percent-1440x900.png');
   }
   await collect(p,'125percent-real-browser-zoom');viewports.push(...results);pass('Real Chromium 125% page zoom: five viewport/toolbar cases, CDP zoom=1.25 scale=1, footer/pedals/all controls reachable',results);
  }finally{await context.close();}
 }
 }catch(e){fs.writeFileSync(path.join(OUT,'cockpit-failure.json'),JSON.stringify({status:'FAIL',error:String(e),stack:e.stack,checks,errors,viewports},null,2)+'\n');throw e;}
 finally{if(browser)await browser.close();server.kill();}
}

async function runV31(){
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=process.env.LE_V31_QA_OUT||path.join(ROOT,'docs/qa/cockpit-desktop-v3/v31');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const median=a=>{const x=[...a].sort((a,b)=>a-b);return x[Math.floor(x.length/2)];};

 fs.mkdirSync(OUT,{recursive:true});const checks=[],errors=[],viewports=[],rain=[],motion=[];
 const testedSHA256=Object.fromEntries(['pages/cockpit.html','pages/car.html','tools/qa_cockpit_desktop_v3.cjs'].map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]));
 const pass=(name,evidence)=>{checks.push({name,evidence});console.log('PASS:',name);};
 const protectedFiles=require('./qa_cockpit_desktop_v3.cjs').scope();
 const modulePath=process.env.PLAYWRIGHT_MODULE||'/workspace/.littleexplorer-tools/node_modules/playwright-core';const {chromium}=require(modulePath);
 assert.equal(require(path.join(path.dirname(require.resolve(modulePath)),'package.json')).version,'1.58.2');
 const server=spawn('python3',['-B','-u','-m','http.server','0','--bind','127.0.0.1'],{cwd:ROOT,stdio:['ignore','pipe','pipe']});let browser;
 try{
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m){clearTimeout(timer);resolve(+m[1]);}});server.on('error',reject);});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 async function open(width,height,controlled=false){const c=await browser.newContext({viewport:{width,height},locale:'zh-CN'});const p=await c.newPage();p.setDefaultTimeout(15000);
  p.on('pageerror',e=>errors.push({type:'JS',message:String(e)}));p.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname!=='/favicon.ico')errors.push({url:r.url(),status:r.status()});});p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push({type:'console',message:m.text()});});
  await p.addInitScript(()=>{window.__v31Inputs=[];document.addEventListener('click',e=>__v31Inputs.push({trusted:e.isTrusted,target:e.target.closest('button,a')?.outerHTML.slice(0,130)}),true);});
  if(controlled){await p.clock.install({time:new Date('2026-10-21T12:00:00Z')});await p.clock.pauseAt(new Date('2026-10-21T12:00:01Z'));}
  await p.goto(`http://127.0.0.1:${port}/pages/cockpit.html`);await p.locator('#voiceToggle').click();await p.locator('[data-tab="weather"]').click();return{p,c};
 }
 const click=(p,s)=>p.locator(s).click();const pressed=(p,s)=>p.locator(s).getAttribute('aria-pressed');
 async function parked(p){await p.waitForFunction(()=>['wiperLeft','wiperRight'].every(id=>Math.abs(Number(document.getElementById(id).getAttribute('transform').match(/rotate\(([-.\d]+)/)[1]))<.001),{},{timeout:3500});}
 // Observe the original rAF animation in real elapsed time, without clock overrides.
 async function sample(p,ms){return p.evaluate(ms=>new Promise(resolve=>{const rows=[],start=performance.now();function frame(now){const arms=['wiperLeft','wiperRight'].map(id=>{const el=document.getElementById(id),b=el.getBBox(),m=el.transform.baseVal.consolidate().matrix;const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));return{angle:-Number(el.getAttribute('transform').match(/rotate\(([-.\d]+)/)[1]),bounds:[Math.min(...points.map(p=>p.x)),Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y))]};});rows.push({ms:now-start,arms});if(now-start>=ms)resolve(rows);else requestAnimationFrame(frame);}requestAnimationFrame(frame);}),ms);}
 for(const [width,height]of [[1366,768],[1920,1080]]){
  const{p,c}=await open(width,height);
  const layout=await p.evaluate(()=>({viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],rects:Object.fromEntries(['#windshield','.instruments','.cluster','.wheel','.footer','#wiperSystem'].map(s=>[s,document.querySelector(s).getBoundingClientRect().toJSON()]))}));
  assert.deepEqual(layout.scroll,layout.viewport);assert.equal(await p.locator('#wiperSystem > g').count(),2);assert.ok(layout.rects['#wiperSystem'].bottom<=layout.rects['#windshield'].bottom);assert.ok(layout.rects['.instruments'].top>=layout.rects['#windshield'].bottom);assert.ok(layout.rects['.wheel'].width>=76);viewports.push(layout);
  for(const level of ['NONE','LIGHT','MEDIUM','HEAVY','STORM']){
   await click(p,`[data-rain="${level}"]`);await p.waitForTimeout(400);
   const measured=await p.evaluate(async()=>{const w=document.querySelector('#windshield'),els=[...document.querySelectorAll('#rainScreen .drop')].filter(e=>getComputedStyle(e).display!=='none');const active=getComputedStyle(document.querySelector('#rainScreen')).visibility!=='hidden';const selected=els.slice(0,20);await new Promise(requestAnimationFrame);const start=performance.now(),before=selected.map(e=>e.getBoundingClientRect().top);await new Promise(resolve=>{function frame(now){if(now-start>=140)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});const dt=(performance.now()-start)/1000;const speeds=selected.map((e,i)=>(e.getBoundingClientRect().top-before[i])/dt).filter(v=>v>0);return{count:active?els.length:0,speeds,durations:els.map(e=>parseFloat(getComputedStyle(e).animationDuration)),raining:w.classList.contains('raining'),snowy:w.classList.contains('snowy'),roadOpacity:getComputedStyle(document.querySelector('.world')).opacity,rainBackground:getComputedStyle(document.querySelector('#rainScreen')).backgroundColor};});
   assert.equal(measured.count,{NONE:0,LIGHT:18,MEDIUM:45,HEAVY:90,STORM:180}[level]);assert.equal(measured.snowy,false);assert.equal(measured.roadOpacity,'1');assert.equal(measured.rainBackground,'rgba(0, 0, 0, 0)');
   rain.push({width,height,level,...measured});if(level==='STORM')assert.equal(await pressed(p,'[data-wiper="HIGH"]'),'true');
  }
  const local=rain.filter(x=>x.width===width),heavy=local.find(x=>x.level==='HEAVY'),storm=local.find(x=>x.level==='STORM');assert.ok(median(storm.durations)<median(heavy.durations)*.65);assert.ok(median(storm.speeds)>median(heavy.speeds)*1.4);assert.equal(storm.count,heavy.count*2);
  await p.waitForTimeout(2800);await p.screenshot({path:path.join(OUT,`storm-high-${width}x${height}.png`)});
  // Manual overrides survive update/render and repeated selection of the same weather.
  await click(p,'[data-wiper="LOW"]');await p.waitForTimeout(500);await click(p,'[data-rain="STORM"]');assert.equal(await pressed(p,'[data-wiper="LOW"]'),'true');
  await click(p,'[data-wiper="OFF"]');await parked(p);const rest=await p.locator('#wiperSystem').innerHTML();await p.waitForTimeout(400);assert.equal(await p.locator('#wiperSystem').innerHTML(),rest);assert.equal(await pressed(p,'[data-rain="STORM"]'),'true');
  await click(p,'[data-wiper="MEDIUM"]');await click(p,'[data-rain="NONE"]');assert.equal(await pressed(p,'[data-wiper="MEDIUM"]'),'true');await click(p,'[data-rain="STORM"]');assert.equal(await pressed(p,'[data-wiper="HIGH"]'),'true');
  await click(p,'[data-rain="SNOW"]');await p.waitForTimeout(400);assert.ok(await p.locator('#windshield').evaluate(e=>e.classList.contains('snowy')&&!e.classList.contains('raining')));assert.equal(await p.locator('#snowScreen .flake').count(),75);assert.equal(await p.locator('#rainScreen').evaluate(e=>getComputedStyle(e).visibility),'hidden');await click(p,'[data-wiper="OFF"]');await parked(p);await p.waitForTimeout(2800);await p.screenshot({path:path.join(OUT,`snow-${width}x${height}.png`)});
  await click(p,'[data-rain="MEDIUM"]');assert.equal(await p.locator('#snowScreen').evaluate(e=>getComputedStyle(e).visibility),'hidden');await p.waitForTimeout(400);
  const speeds=[];
  for(const mode of ['LOW','MEDIUM','HIGH']){
   await click(p,`[data-wiper="${mode}"]`);const samples=await sample(p,8000);const crossings=[];
   for(let i=1;i<samples.length;i++)if(samples[i-1].arms[0].angle<33&&samples[i].arms[0].angle>=33)crossings.push(samples[i].ms);
   assert.ok(crossings.length>=2,`Need real cycles: ${mode}`);const periods=crossings.slice(1).map((v,i)=>v-crossings[i]),period=median(periods);
   const expected={LOW:2600,MEDIUM:1550,HIGH:850}[mode];assert.ok(Math.abs(period-expected)<expected*.2,`${mode} real period ${period}`);
   for(const frame of samples){assert.ok(Math.abs(frame.arms[0].angle/66-frame.arms[1].angle/64)<.001);for(const arm of frame.arms){const[l,t,r,b]=arm.bounds;assert.ok(l>=0&&t>=0&&r<=1200&&b<=440,'Wiper escapes glass');}}
   assert.ok(Math.max(...samples.map(s=>s.arms[0].angle))>60);assert.ok(Math.min(...samples.map(s=>s.arms[0].angle))<5);
   motion.push({width,height,mode,period,cycles:crossings.length,frames:samples.length,samples});speeds.push(period);console.log('MOTION:',width,mode,period);
   await p.screenshot({path:path.join(OUT,`wipers-${mode.toLowerCase()}-${width}x${height}.png`)});
  }
  assert.ok(speeds[0]>speeds[1]*1.4&&speeds[1]>speeds[2]*1.4);
  await click(p,'[data-wiper="OFF"]');await parked(p);const off=await sample(p,400);assert.ok(off.every(f=>f.arms.every(a=>a.angle===0)));
  assert.ok((await p.evaluate(()=>__v31Inputs)).every(e=>e.trusted));await c.close();pass(`Dual wipers, three measured real speeds, five rain levels, storm auto/manual/parking, snow and no-scroll layout: ${width}×${height}`);
 }
 // The weather/rAF additions must preserve the complete original driving flow.
 {
  const{p,c}=await open(1366,768,true);await click(p,'[data-tab="drive"]');
  const step=async ms=>{for(let n=0;n<ms;n+=50)await p.clock.fastForward(Math.min(50,ms-n));};
  await click(p,'#start');assert.equal(await pressed(p,'#start'),'false');assert.equal(await p.locator('#feedbackTitle').textContent(),'先踩住脚刹');
  await click(p,'#belt');await click(p,'#brake');await click(p,'#start');await click(p,'[data-gear="D"]');await click(p,'#handbrake');await click(p,'#brake');
  const needle0=await p.locator('#speedNeedle').getAttribute('transform'),rpm0=await p.locator('#rpmNeedle').getAttribute('transform');await click(p,'#accelerate');await step(2000);
  const dSpeed=+(await p.locator('#speedVal').textContent());assert.ok(dSpeed>=20);assert.notEqual(await p.locator('#speedNeedle').getAttribute('transform'),needle0);assert.notEqual(await p.locator('#rpmNeedle').getAttribute('transform'),rpm0);
  for(const s of ['[data-gear="P"]','#start','#handbrake']){await click(p,s);assert.equal(await pressed(p,'[data-gear="D"]'),'true');assert.equal(await pressed(p,'#start'),'true');assert.equal(await pressed(p,'#handbrake'),'false');}
  await click(p,'[data-gear="S"]');assert.equal(await pressed(p,'#accelerate'),'false');await click(p,'#accelerate');await step(2000);const sSpeed=+(await p.locator('#speedVal').textContent());assert.ok(sSpeed>dSpeed*2);
  await p.screenshot({path:path.join(OUT,'s-driving-1366x768.png'),animations:'disabled'});
  await click(p,'#accelerate');await click(p,'#brake');await step(3500);assert.equal(await p.locator('#speedVal').textContent(),'0');await click(p,'[data-gear="P"]');assert.equal(await p.locator('#feedbackTitle').textContent(),'先拉手刹');await click(p,'#handbrake');await click(p,'[data-gear="P"]');await click(p,'#start');await click(p,'#brake');
  assert.equal(await pressed(p,'#start'),'false');assert.equal(await pressed(p,'#handbrake'),'true');assert.equal(await pressed(p,'#brake'),'false');assert.equal(await pressed(p,'[data-gear="P"]'),'true');
  await c.close();pass('V3.1 native-click D/S, dynamic speed/RPM needles, moving guards and complete start/park sequence',{dSpeed,sSpeed});
 }
 assert.deepEqual(errors,[]);for(const[f,expected]of Object.entries(testedSHA256))assert.equal(sha(fs.readFileSync(path.join(ROOT,f))),expected,'Tested source changed during run');
 require('./qa_cockpit_desktop_v3.cjs').scope();
 const report={status:'PASS',version:'V3.1',testedSHA256,browser:browser.version(),playwright:'1.58.2',checks,viewports,rain,motion,errors,voiceProtection:{keys:315,mp3:638,perPathSHA256Unchanged:true},browserTTS:'Known cloud synthesis-failed; no claim of successful new speech output or human listening',humanListening:'NOT_TESTED',HarmonyOS:'NOT_TESTED'};
 fs.writeFileSync(path.join(OUT,'qa-report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS: V3.1 real browser QA');
 }catch(e){fs.writeFileSync(path.join(OUT,'failure.json'),JSON.stringify({status:'FAIL',error:String(e),stack:e.stack,checks,errors,rain,motion,viewports},null,2)+'\n');throw e;}
 finally{if(browser)await browser.close();server.kill();}
}
