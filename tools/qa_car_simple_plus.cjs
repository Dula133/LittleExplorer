#!/usr/bin/env node
/* Original-product checkpoint. No product hooks, action calls, DOM click(),
 * synthetic dispatchEvent(), intercepted assets, or mocked audio completion.
 * Playwright sends native browser input; evaluation only observes scene state.
 * --record-baseline is deliberately restricted to the exact original commit.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {execFileSync, spawn} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const BASE = '70091609b45fd2b2cf98a5853bfee2d8cbe28991';
const BASEDIR = path.join(ROOT, 'docs/baselines/simple-plus');
const RECORD = process.argv.includes('--record-baseline');
const VISUAL = process.argv.includes('--visual-only');
const PHASE3 = process.argv.includes('--candidate-phase3');
const PHASE2 = process.argv.includes('--candidate-phase2') || PHASE3;
const phase3 = PHASE3 ? require('./qa_car_simple_plus_phase3.cjs') : null;
const UI_ONLY = process.argv.includes('--phase2-ui-only');
const CANDIDATE = process.argv.includes('--candidate-phase1') || PHASE2;
const policy = CANDIDATE ? require(PHASE2?'./qa_car_simple_plus.phase2.json':'./qa_car_simple_plus.phase1.json') : null;
const phase2 = PHASE2 ? require('./qa_car_simple_plus_phase2.cjs') : null;
const OUT = process.env.LE_QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), RECORD ? 'le-simple-plus-record-' : 'le-simple-plus-'));
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
const checks = [], errors = [], warnings = [], inputs = [], captures = [], audio = [], knownOriginalIssues = [];
function pass(name, evidence) { checks.push({name, evidence}); console.log('PASS:', name); }
function protectedFiles() {
  const rows = execFileSync('git', ['ls-tree', '-rz', BASE], {cwd: ROOT, encoding: 'utf8'}).split('\0').filter(Boolean);
  return Object.fromEntries(rows.map(row => {
    const [meta, file] = row.split('\t'), [mode, type, oid] = meta.split(' ');
    assert.equal(type, 'blob', file); assert.equal(mode, '100644', file);
    const bytes = fs.readFileSync(path.join(ROOT, file));
    const actual = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if(CANDIDATE&&(policy.allowedProductFiles.includes(file)||(PHASE3&&['voice/lines.json','voice/lines.js','pages/car.html','tools/check_voice.py'].includes(file)))){
      const original=execFileSync('git',['show',`${BASE}:${file}`],{cwd:ROOT});
      return [file,{gitBlob:oid,bytes:original.length,sha256:sha256(original)}];
    }
    assert.equal(actual, oid, `Protected original changed: ${file}`);
    return [file, {gitBlob: oid, bytes: bytes.length, sha256: sha256(bytes)}];
  }));
}
function candidateScope(){
  if(PHASE3){phase3.scope({ROOT,git,sha256,pass});return;}
  if(PHASE2){phase2.scope({ROOT,BASE,policy,git,sha256,pass});return;}
  assert.equal(git('branch','--show-current'),'feature/car-simple-plus');
  assert.equal(git('rev-parse','origin/main'),BASE);
  execFileSync('git',['merge-base','--is-ancestor',policy.checkpoint,'HEAD'],{cwd:ROOT});
  const frozen=git('ls-tree','-r',policy.checkpoint,'--','docs/baselines/simple-plus').split('\n');
  for(const row of frozen){const [meta,file]=row.split('\t'),oid=meta.split(' ')[2],bytes=fs.readFileSync(path.join(ROOT,file));
    assert.equal(crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),oid,`Frozen evidence changed: ${file}`);}
  const changes=new Set([...git('diff','--name-only',policy.checkpoint).split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean));
  for(const f of changes)assert.ok([...policy.allowedProductFiles,...policy.allowedSupportFiles].includes(f)||f.startsWith(policy.artifactDirectory+'/'),`Unapproved change: ${f}`);
  const original=execFileSync('git',['show',`${BASE}:js/app.js`],{cwd:ROOT,encoding:'utf8'});
  const before='if(isSel&&!u.keepEm)mat.emissive.copy(mat.color);else mat.emissive.setHex(u.baseEm);mat.emissiveIntensity=u.dynInt+(isSel?pulse:0);}}';
  const after='if(isSel&&!u.keepEm)mat.emissive.copy(mat.color);else mat.emissive.setHex(u.baseEm);\n      mat.emissiveIntensity=u.dynInt+(isSel&&!(u.suppressSelectGlowWhenOff&&u.signalOff)?pulse:0);}}';
  assert.ok(original.includes(before));
  assert.equal(fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8'),original.replace(before,after),'Only the approved opt-in selection glow patch is permitted in the engine');
  pass('Phase 1 scope: two product files only; exact opt-in engine patch; all frozen Phase 0 artifacts immutable',{policy,changed:[...changes]});
}
function playwright() {
  const candidates = process.env.PLAYWRIGHT_MODULE ? [process.env.PLAYWRIGHT_MODULE] :
    ['/workspace/.littleexplorer-tools/node_modules/playwright-core','playwright-core'];
  for (const name of candidates) {
    let entry; try {entry=require.resolve(name);} catch (_) {continue;}
    const version=require(path.join(path.dirname(entry),'package.json')).version;
    assert.equal(version,'1.58.2','Use the pinned QA dependency');
    return {...require(entry),packageVersion:version};
  }
  throw Error('Install playwright-core@1.58.2 outside the repository; set PLAYWRIGHT_MODULE to its absolute module path.');
}
// Runs before application scripts. A fixed seed and browser clock control only
// the test environment, never car state or event handlers. Input/media listeners
// are passive evidence observers. Audio runs separately with the real clock.
function instrumentation({muted, controlled}) {
  localStorage.setItem('muted', muted ? '1' : '0');
  localStorage.setItem('voice', 'yunxia');
  let seed = 20261016;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  if (controlled) {
    const epoch = Date.now();
    Object.defineProperty(performance, 'now', {value: () => Date.now() - epoch, configurable: true});
  }
  window.__qaEvidence = {pointers: [], media: [], contextLost: 0};
  document.addEventListener('pointerup', e => window.__qaEvidence.pointers.push({
    trusted: e.isTrusted, type: e.pointerType, x: e.clientX, y: e.clientY, target: e.target.id || e.target.tagName
  }), true);
  const observeMedia = a => {for (const type of ['playing', 'ended', 'error']) a.addEventListener(type, e => {
    window.__qaEvidence.media.push({
      type, trusted: e.isTrusted, src: e.target.currentSrc, duration: e.target.duration,
      time: e.target.currentTime, error: e.target.error?.code || null
    });
  });};
  // Audio() elements are detached from the DOM. Add passive native listeners;
  // retain the original constructor, playback promises, sound and handlers.
  window.Audio = new Proxy(window.Audio, {construct(target, args) {
    const a = Reflect.construct(target, args); observeMedia(a); return a;
  }});
  document.addEventListener('webglcontextlost', () => window.__qaEvidence.contextLost++, true);
}
function sceneSnapshot() {
  const d = window.__dbg, round = n => Math.round(n * 1e6) / 1e6;
  const arr = a => a.map(round), rect = el => {
    const r = el.getBoundingClientRect(); return arr([r.x, r.y, r.width, r.height]);
  };
  const parts = {};
  for (const [id, p] of Object.entries(d.PARTS)) {
    parts[id] = {name: p.name, text: p.text, text2: p.text2 || null,
      meshes: p.meshes.map(m => ({geometry: m.geometry.type,
        vertices: m.geometry.attributes.position?.count || 0, indices: m.geometry.index?.count || 0,
        local: arr([...m.position.toArray(), ...m.quaternion.toArray(), ...m.scale.toArray()]),
        owner: m.userData.part, shell: !!m.userData.baseCol, noHit: !!m.userData.noHit, glass: !!m.userData.glass})),
      groups: p.groups.map(g => ({home: g.userData.home?.toArray() || null, explode: g.userData.explode?.toArray() || null,
        position: arr(g.position.toArray()), quaternion: arr(g.quaternion.toArray()), scale: arr(g.scale.toArray())}))};
  }
  const rects = Object.fromEntries(['.top', '.bottom', '#cap', '#go', '#xr', '#ex', '#c'].map(sel => [sel, rect(document.querySelector(sel))]));
  const c = d.camera, cam = d.cam;
  return {logicalMs: performance.now(), viewport: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio},
    camera: {theta: round(cam.theta), phi: round(cam.phi), targetTheta: round(cam.tTheta), targetPhi: round(cam.tPhi),
      r: round(cam.r), rBase: round(cam.rBase), zoom: cam.zoom, focus: cam.focus, target: arr(cam.target.toArray()),
      position: arr(c.position.toArray()), quaternion: arr(c.quaternion.toArray()), fov: c.fov,
      projection: arr(c.projectionMatrix.elements), view: c.view},
    state: {...d.S}, caption: {name: document.querySelector('#cn').textContent, text: document.querySelector('#cd').textContent},
    buttons: [...document.querySelectorAll('.ctrl > button')].map(b => ({id: b.id, text: b.textContent.trim()})),
    layout: rects, parts};
}
function pickPoint(id) {
  const end=typeof id==='object'?id.end:null;id=typeof id==='object'?id.id:id;
  const d = window.__dbg, T = d.THREE, W = innerWidth, H = innerHeight;
  d.root.updateWorldMatrix(true, true); d.camera.updateWorldMatrix(true, false);
  const visible = m => { for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; };
  const targets = Object.values(d.PARTS).flatMap(p => p.meshes).filter(m => !m.userData.noHit && !m.userData.glass);
  const ray = new T.Raycaster(), point = new T.Vector3(), candidates = [];
  for (const m of d.PARTS[id].meshes) {
    if(end&&m.userData.turnEnd!==end)continue;
    if (!visible(m) || m.userData.noHit || m.userData.glass) continue;
    m.geometry.computeBoundingBox(); const box = m.geometry.boundingBox;
    for (const x of [.25, .5, .75]) for (const y of [.25, .5, .75]) for (const z of [0, .5, 1]) {
      point.set(box.min.x + (box.max.x-box.min.x)*x, box.min.y + (box.max.y-box.min.y)*y, box.min.z + (box.max.z-box.min.z)*z);
      point.applyMatrix4(m.matrixWorld).project(d.camera);
      candidates.push({x: (point.x+1)*W/2, y: (1-point.y)*H/2});
    }
  }
  for (const candidate of candidates) {
    // Browser touch coordinates may be quantized. Validate the integer coordinate
    // actually sent, not a different subpixel ray beside a very thin wiper.
    const p={x:Math.round(candidate.x),y:Math.round(candidate.y)};
    if (p.x<2 || p.x>W-2 || p.y<2 || p.y>H-2 || document.elementFromPoint(p.x,p.y)?.id!=='c') continue;
    ray.setFromCamera(new T.Vector2(p.x/W*2-1,1-p.y/H*2), d.camera);
    const h = ray.intersectObjects(targets, false).find(h => visible(h.object) && !(d.S.xray && h.object.userData.baseCol));
    if (h?.object.userData.part === id) return p;
  }
  return null;
}
function rainState() {
  const d = __dbg, scene = d.root.parent;
  const rain = scene.children.find(m => m.isInstancedMesh && m.geometry.parameters.height === .6);
  const w = d.PARTS.wiper.groups[0].children.map(p => p.children[0].rotation.z);
  return {logicalMs:performance.now(),visible: rain.visible, count: rain.count, opacity: rain.material.opacity,
    gloom: d.S.gloom, wipers: w};
}
async function run() {
  assert.ok(!(RECORD&&VISUAL),'Recording must run the full QA suite');
  assert.ok(!(RECORD&&CANDIDATE),'Candidates cannot record or replace original baselines');
  assert.ok(!UI_ONLY||(PHASE2&&!RECORD&&!VISUAL),'UI-only is an explicitly partial Phase 2 mode');
  assert.ok(!path.resolve(OUT).startsWith(path.resolve(BASEDIR)), 'QA output must not overwrite the frozen baseline');
  const scriptSHA256=sha256(fs.readFileSync(__filename));
  const pw=playwright();
  const originalFiles = protectedFiles();
  if(CANDIDATE)candidateScope();
  if (RECORD) {
    assert.equal(git('rev-parse', 'HEAD'), BASE, 'Recording requires exact original HEAD');
    assert.ok(!fs.existsSync(BASEDIR), 'Baseline directory already exists; refusing to overwrite');
  }
  const existing = RECORD ? null : JSON.parse(fs.readFileSync(path.join(BASEDIR, 'manifest.json'), 'utf8'));
  if (existing) {
    assert.equal(existing.baselineCommit, BASE);
    assert.deepEqual(originalFiles, existing.protectedFiles);
    for (const cap of existing.captures) assert.equal(sha256(fs.readFileSync(path.join(BASEDIR, cap.file))), cap.sha256, cap.file);
  }
  fs.mkdirSync(OUT, {recursive: true});
  pass(CANDIDATE?'All unapproved original files are byte-identical to pinned main':'All original tracked files are byte-identical to pinned main',
    {files:Object.keys(originalFiles).length,allowedChanges:CANDIDATE?policy.allowedProductFiles:[],commit:BASE});
  if(!VISUAL&&!UI_ONLY){
    const voiceCheck = PHASE3 ? phase3.voiceCheck({ROOT}) : PHASE2 ? phase2.voiceCheck({ROOT,policy}) : execFileSync('python3', ['-B', 'tools/check_voice.py'], {cwd: ROOT, encoding: 'utf8'}).trim();
    const voiceFiles = Object.keys(originalFiles).filter(f => /^voice\/[^/]+\/.*\.mp3$/.test(f));
    // Decode every existing MP3, including sample clips. No generated media.
    for (const f of voiceFiles) execFileSync(process.env.FFMPEG_BIN || 'ffmpeg', ['-v','error','-xerror','-i',path.join(ROOT,f),'-f','null','-'], {stdio: ['ignore','pipe','pipe']});
    pass('Voice mapping, both voice sets, and all existing MP3 decode', {voiceCheck, decoded: voiceFiles.length});
  }
  let server, browser;
  try {
    // A fresh loopback-only server serves this checkout, never a stale external server.
    server = spawn('python3', ['-B','-u','-m','http.server','0','--bind','127.0.0.1'], {cwd: ROOT, stdio: ['ignore','pipe','pipe']});
    const port = await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(Error('HTTP startup timeout')), 10000);
      server.stdout.on('data', data => {const m = String(data).match(/port (\d+)/); if (m) {clearTimeout(timer); resolve(Number(m[1]));}});
      server.once('error', reject); server.once('exit', code => {clearTimeout(timer); reject(Error('HTTP server exited '+code));});
    });
    const baseURL = `http://127.0.0.1:${port}`;
    function originalFavicon(url,status){
      if(status!==404||originalFiles['favicon.ico']||!url)return false;
      const u=new URL(url,baseURL);
      if(u.origin!==baseURL||u.pathname!=='/favicon.ico')return false;
      if(!knownOriginalIssues.length)knownOriginalIssues.push({path:'/favicon.ico',status:404,reason:'The pinned original has no favicon; automatic browser request, not a new product failure'});
      return true;
    }
    let pendingLog='';
    server.stderr.on('data', data => {
      const lines=(pendingLog+String(data)).split('\n');pendingLog=lines.pop();
      for(const line of lines){
        const m=line.match(/"(?:GET|HEAD) ([^ ]+) HTTP\/[^"]+" (\d+)/);
        if(!m||Number(m[2])<400)continue;
        if(!originalFavicon(m[1],Number(m[2])))errors.push({type:'serverHTTP',path:m[1],status:Number(m[2])});
      }
    });
    browser = await pw.chromium.launch({executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium', headless: true,
      args: ['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
    const environment = {browser: browser.version(), playwright: pw.packageVersion,
      platform: `${os.platform()} ${os.arch()}`, timezone: 'UTC', locale: 'zh-CN', colorScheme: 'light', dpr: 1,
      seed: 20261016, fixedDate: '2026-10-16T12:00:01.000Z', stepMs:50,
      viewportPolicy:'Mobile below 800px; desktop at 1280px; native touch input enabled',
      animation: 'Original rAF via Playwright clock; performance.now starts at 0; CSS screenshot animations disabled',
      renderer: 'ANGLE SwiftShader', fonts: execFileSync('fc-match',['sans-serif'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()};
    if (existing) assert.deepEqual(environment, existing.environment, 'Browser/environment changed: reproduce pinned environment before comparing');
    async function open(viewport = {width:390,height:844}, {controlled=true, muted=true}={}) {
      const context = await browser.newContext({viewport, deviceScaleFactor:1, hasTouch:true, isMobile:viewport.width<800, locale:'zh-CN', timezoneId:'UTC', colorScheme:'light'});
      const page = await context.newPage(); page.setDefaultTimeout(90000);
      page.on('pageerror', e => errors.push({url:page.url(), type:'pageerror', message:String(e)}));
      page.on('console', m => {
        if(m.type()==='error'){
          const location=m.location();
          if(!(/^Failed to load resource:.*\b404\b/.test(m.text())&&originalFavicon(location.url,404)))
            errors.push({url:page.url(),type:'console',message:m.text(),location});
        }else if(m.type()==='warning')warnings.push(m.text());
      });
      page.on('response', r => {if(r.status()>=400&&!originalFavicon(r.url(),r.status()))errors.push({url:r.url(),type:'http',status:r.status()});});
      page.on('requestfailed', r => {if(r.failure()?.errorText !== 'net::ERR_ABORTED') errors.push({url:r.url(),type:'request',message:r.failure()?.errorText});});
      if (controlled) {await page.clock.install({time:new Date('2026-10-16T12:00:00Z')}); await page.clock.pauseAt(new Date('2026-10-16T12:00:01Z'));}
      await page.addInitScript(instrumentation, {muted, controlled});
      return {page, context};
    }
    async function load(page, scene='car') {
      const response = await page.goto(`${baseURL}/pages/${scene}.html`, {waitUntil:'load'}); assert.equal(response.status(),200);
      await page.waitForFunction(() => !!window.__dbg); await page.evaluate(() => document.fonts.ready);
      await step(page,200);
      assert.equal(await page.locator('#nogl').isVisible(), false);
      assert.ok(await page.evaluate(() => {const c=document.querySelector('#c'),g=c.getContext('webgl2')||c.getContext('webgl');return g&&!g.isContextLost()&&g.getError()===g.NO_ERROR&&Object.keys(__dbg.PARTS).length>0;}));
    }
    // Fixed 50ms steps execute the original rAF/update and respect its dt cap.
    // Avoid depending on the host GPU's wall-clock speed or rendering 60 frames/s.
    async function step(page, ms) {for(let left=ms;left>0;left-=50)await page.clock.fastForward(Math.min(left,50));}
    async function tapPart(page, id, end) {
      const before = await page.evaluate(() => __qaEvidence.pointers.length);
      const point = await page.evaluate(pickPoint,end?{id,end}:id);
      assert.ok(point, `No unobstructed canvas ray hit for ${id}`);
      await page.touchscreen.tap(point.x,point.y);
      const evidence = await page.evaluate(n => __qaEvidence.pointers.slice(n),before);
      assert.ok(evidence.length && evidence.every(e=>e.trusted && e.type==='touch'));
      const selected=await page.evaluate(() => __dbg.S.sel);
      inputs.push({scene:'car',id,selected,point,events:evidence});
      assert.equal(selected,id,`Native tap did not select ${id}: ${JSON.stringify(inputs.at(-1))}`);
    }
    async function tap(page, selector) {
      const before=await page.evaluate(()=>__qaEvidence.pointers.length); await page.locator(selector).tap();
      const evidence=await page.evaluate(n=>__qaEvidence.pointers.slice(n),before);
      assert.ok(evidence.length&&evidence.every(e=>e.trusted)); inputs.push({selector,events:evidence});
    }
    async function capture(page, file, kind='car') {
      const rawSnapshot = kind==='car' ? await page.evaluate(sceneSnapshot) : await page.evaluate(() => ({logicalMs:performance.now(),
        viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}, cards:[...document.querySelectorAll('.card')].map(c=>({id:c.dataset.scene,href:c.getAttribute('href'),rect:c.getBoundingClientRect().toJSON()}))}));
      // The stored artifact is JSON: compare the same representation on both
      // sides (JSON represents -0 as 0). Keep exact comparison of all fields.
      const snapshot=JSON.parse(JSON.stringify(rawSnapshot));
      const bytes=await page.screenshot({type:'png',animations:'disabled'}); fs.writeFileSync(path.join(OUT,file),bytes);
      const result={file,sha256:sha256(bytes),bytes:bytes.length,snapshot};
      if(PHASE2)result.masks=await page.evaluate(phase2.masks);
      captures.push(result);
      if(existing){const baseline=existing.captures.find(c=>c.file===file);assert.ok(baseline,file);
        assert.deepEqual(PHASE2?phase2.normalize(snapshot,baseline.snapshot):snapshot,baseline.snapshot,`Structural/camera/state/layout mismatch: ${file}`);}
      console.log('CAPTURE:',file);
    }
    if(UI_ONLY){await phase2.ui({open,load,step,tapPart,tap,pass,OUT,ROOT});assert.deepEqual(errors,[]);candidateScope();
      fs.writeFileSync(path.join(OUT,'ui-partial-report.json'),JSON.stringify({status:'UI_PARTIAL_PASS',checks,inputs,errors,environment,boundaries:['Excludes full original suite, original narration playback, MP3 decode and nineteen scene regression']},null,2)+'\n');
      console.log('UI PARTIAL PASS:',OUT);return;}
    // Homepage uses the original card renderer; verify actual canvas pixels and link.
    {
      const {page,context}=await open(); await page.goto(baseURL+'/',{waitUntil:'load'}); await page.evaluate(()=>document.fonts.ready);await step(page,400);
      assert.equal(await page.locator('.card').count(),20);
      const thumb=await page.locator('[data-scene="car"] canvas').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let painted=0;for(let i=3;i<a.length;i+=4)if(a[i])painted++;return {width:c.width,height:c.height,painted};});
      assert.ok(thumb.painted>100 && thumb.width>0);await capture(page,'home-390x844.png','home');
      await page.locator('[data-scene="car"]').tap();await page.waitForFunction(()=>!!window.__dbg);assert.ok(page.url().endsWith('/pages/car.html'));
      pass('J: Homepage has 20 cards, rendered car thumbnail and working car link',thumb); await context.close();
    }
    if(VISUAL){
      // Independent fresh-context reproduction of the exact eight capture recipes.
      // This is explicitly partial QA: the full command still covers A–L.
      const recipes=[
        ['car-default-390x844.png',390,844,null,null,0],
        ['car-default-360x800.png',360,800,null,null,0],
        ['car-default-1280x900.png',1280,900,null,null,0],
        ['car-night-390x844.png',390,844,'part','lights',2400],
        ['car-door-390x844.png',390,844,'part','door',700],
        ['car-xray-390x844.png',390,844,'button','#xr',1500],
        ['car-exploded-390x844.png',390,844,'button','#ex',2200]
      ];
      for(const [file,width,height,type,target,ms]of recipes){
        const {page,context}=await open({width,height});await load(page);
        if(type==='part')await tapPart(page,target);else if(type==='button')await tap(page,target);
        if(ms)await step(page,ms);await capture(page,file);await context.close();
      }
      assert.equal(captures.length,existing.captures.length);assert.deepEqual(errors,[]);protectedFiles();
      const report={status:'VISUAL_PASS',mode:'visual-only',baselineCommit:BASE,qaScriptSHA256:scriptSHA256,environment,
        scope:'Eight screenshot recipes, baseline hashes, layout/camera/state/part comparison and browser errors; excludes full functional, audio and 19-scene suites',
        captures:captures.map(c=>({file:c.file,sha256:c.sha256,baselineSHA256:existing.captures.find(b=>b.file===c.file).sha256,
          pngByteIdentical:c.sha256===existing.captures.find(b=>b.file===c.file).sha256,structuralMatch:true})),
        inputs,errors,knownOriginalIssues,warnings:[...new Set(warnings)]};
      fs.writeFileSync(path.join(OUT,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
      console.log('VISUAL PASS (partial suite). Evidence:',OUT);return;
    }
    for(const viewport of [{width:390,height:844},{width:360,height:800}]) {
      let {page,context}=await open(viewport);await load(page);
      // A fresh context gives each scenario its own original clock epoch. Do not
      // replay a growing clock-control history across repeated navigations.
      const fresh=async()=>{await context.close();({page,context}=await open(viewport));await load(page);};
      const initial=await page.evaluate(sceneSnapshot);
      assert.equal(initial.camera.theta,.95);assert.equal(initial.camera.phi,1.12);assert.equal(initial.camera.fov,48);
      assert.deepEqual(initial.buttons.map(b=>b.id),['go','xr','ex']);assert.deepEqual(initial.buttons.map(b=>b.text),['开起来','看里面','拆开看']);
      const owned=await page.evaluate(()=>{const seen=new Set();return Object.entries(__dbg.PARTS).every(([id,p])=>p.meshes.every(m=>{if(seen.has(m)||m.userData.part!==id)return false;seen.add(m);return true;}));});assert.equal(owned,true);
      await capture(page,`car-default-${viewport.width}x${viewport.height}.png`);
      // Verify actual wheel/drag event path, then reset using the original DOM button.
      const cdp=await context.newCDPSession(page);const x=viewport.width/2,y=300;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+8*i,y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await step(page,300);
      assert.ok((await page.evaluate(()=>__dbg.cam.theta))<.9);
      await fresh();await tapPart(page,'lights');assert.equal(await page.evaluate(()=>__dbg.S.nightT),1);
      assert.match(await page.locator('#cd').textContent(),/天黑/);await step(page,2400);
      assert.ok(await page.evaluate(()=>__dbg.S.night>.95));if(viewport.width===390)await capture(page,'car-night-390x844.png');
      await tapPart(page,'lights');assert.equal(await page.evaluate(()=>__dbg.S.nightT),0);assert.match(await page.locator('#cd').textContent(),/天亮/);
      await fresh();await tapPart(page,'door');await step(page,700);
      let doors=await page.evaluate(()=>__dbg.PARTS.door.groups.map(g=>({open:g.userData.open,angle:g.rotation.y})));
      assert.equal(doors.filter(g=>g.open===1).length,1);assert.ok(doors.some(g=>Math.abs(g.angle)>.8));
      if(viewport.width===390)await capture(page,'car-door-390x844.png');
      // Door hit may move after opening; tap its visible mesh again and check closure.
      await tapPart(page,'door');await step(page,700);doors=await page.evaluate(()=>__dbg.PARTS.door.groups.map(g=>g.userData.open));
      assert.equal(doors.filter(Boolean).length,0);
      await fresh();await tapPart(page,'wiper');const resting=await page.evaluate(rainState);
      await step(page,2400);const early=await page.evaluate(rainState);
      assert.equal(early.count,CANDIDATE?360:520);assert.equal(early.visible,true);assert.ok(early.gloom>.95);assert.deepEqual(early.wipers,resting.wipers,JSON.stringify({resting,early}));
      await step(page,1100);const wiping=await page.evaluate(rainState);assert.ok(wiping.wipers.some(v=>Math.abs(v-1)>.1));
      // Original stop keeps wiping for 1.5s, then eases to rest. Allow that real
      // legacy transition rather than expecting an instantaneous parked blade.
      await tapPart(page,'wiper');await step(page,3500);const ended=await page.evaluate(rainState);assert.ok(ended.opacity<.01);assert.ok(ended.wipers.every(v=>Math.abs(v-1)<.01),JSON.stringify(ended));
      await fresh();await tapPart(page,'wiper');await page.clock.fastForward(16000);await step(page,3000);
      assert.ok((await page.evaluate(rainState)).opacity<.01);
      await fresh();await tapPart(page,'door');await step(page,300);await tap(page,'#go');assert.equal(await page.evaluate(()=>__dbg.S.drive),true);await step(page,3000);
      assert.ok(await page.evaluate(()=>__dbg.PARTS.door.groups.every(g=>Math.abs(g.rotation.y)<.01)));
      assert.equal(await page.locator('#gotxt').textContent(),'停下');
      const moving=await page.evaluate(()=>__dbg.PARTS.wheels.meshes.map(m=>m.matrixWorld.toArray()));await step(page,200);
      assert.notDeepEqual(await page.evaluate(()=>__dbg.PARTS.wheels.meshes.map(m=>m.matrixWorld.toArray())),moving);
      await tap(page,'#go');assert.equal(await page.evaluate(()=>__dbg.S.drive),false);assert.equal(await page.locator('#gotxt').textContent(),'开起来');
      await fresh();await tapPart(page,'mirror');assert.equal(await page.locator('#cn').textContent(),'后视镜');assert.match(await page.locator('#cd').textContent(),/小镜子/);
      await fresh();await tap(page,'#xr');await step(page,1500);assert.equal(await page.evaluate(()=>__dbg.S.xray),true);
      assert.ok(await page.evaluate(()=>__dbg.S.xr>.99));assert.equal(await page.locator('#tray').isVisible(),true);
      if(viewport.width===390)await capture(page,'car-xray-390x844.png');
      await tap(page,'.tile:has-text("发动机")');assert.equal(await page.evaluate(()=>__dbg.S.sel),'engine');
      assert.equal(await page.evaluate(()=>__dbg.cam.focus),'engine');assert.equal(await page.locator('#cn').textContent(),'发动机');
      await tap(page,'#xr');await step(page,1500);assert.equal(await page.evaluate(()=>__dbg.S.xray),false);
      await fresh();
      await tap(page,'#ex');await step(page,2200);assert.equal(await page.evaluate(()=>__dbg.S.explode),true);
      if(viewport.width===390)await capture(page,'car-exploded-390x844.png');
      const separated=await page.evaluate(()=>Object.values(__dbg.PARTS).flatMap(p=>p.groups).filter(g=>g.userData.home&&g.position.distanceTo(g.userData.home)>.1).length);assert.ok(separated>5);
      await tap(page,'#ex');await step(page,2300);
      assert.equal(await page.evaluate(()=>__dbg.S.explode),false);assert.equal(await page.locator('#extxt').textContent(),'拆开看');
      assert.ok(await page.evaluate(()=>Object.values(__dbg.PARTS).flatMap(p=>p.groups).every(g=>!g.userData.home||g.position.distanceTo(g.userData.home)<.02)));
      assert.equal(await page.evaluate(()=>__qaEvidence.contextLost),0);
      pass(`A–H,L: native touch, default camera, lights, doors, rain/wiper, start/stop, narration text, xray and reassembly ${viewport.width}×${viewport.height}`,{parts:Object.keys(initial.parts).length,rain:{early,wiping,ended},door:doors});
      await context.close();
    }
    {const {page,context}=await open({width:1280,height:900});await load(page);await capture(page,'car-default-1280x900.png');await context.close();}
    // Real media events use a real clock. No autoplay bypass, mocked play() or
    // speech synthesis callback. A native lamp tap must play and finish its MP3.
    for(const voice of ['yunxia','xiaoyi']) {
      const {page,context}=await open({width:390,height:844},{controlled:false,muted:false});
      await page.addInitScript(v=>localStorage.setItem('voice',v),voice);
      await page.goto(baseURL+'/pages/car.html',{waitUntil:'load'});await page.waitForFunction(()=>!!window.__dbg);
      await tapPart(page,'lights');
      await page.waitForFunction(()=>__qaEvidence.media.some(e=>e.type==='playing'));
      await page.waitForFunction(()=>__qaEvidence.media.some(e=>e.type==='ended'),null,{timeout:45000});
      const evidence=await page.evaluate(()=>__qaEvidence.media);assert.ok(evidence.every(e=>e.type!=='error'));
      const expectedID=await page.evaluate(()=>VOICE_LINES[document.querySelector('#cn').textContent+'。'+document.querySelector('#cd').textContent]);
      assert.ok(expectedID,'Selected explanation must have a mapped MP3');
      assert.ok(evidence.some(e=>e.type==='ended'&&e.trusted&&e.time>0&&e.duration>0&&e.src.endsWith(`/voice/${voice}/${expectedID}.mp3`)));
      audio.push({voice,events:evidence});await context.close();
    }
    pass('G,I: Native lamp clicks play and finish original MP3 in both voices',audio);
    if(CANDIDATE)await require('./qa_car_simple_plus_phase1.cjs')({open,load,step,tapPart,tap,pass,OUT,ROOT,captures,existing,phase2:PHASE2,visualCompare:PHASE2?phase2.compare:null});
    if(PHASE2)await phase2.ui({open,load,step,tapPart,tap,pass,OUT,ROOT});
    if(PHASE3)await phase3.playback({open,load,tapPart,tap,pass,OUT,ROOT,pickPoint});
    const otherScenes=['washer','elevator','excavator','jet','dozer','crane','mixer','roller','loader','dump','firetruck','garbage','towercrane','pumptruck','grader','piler','forklift','sweeper','towtruck'];
    for(const scene of otherScenes) {
      const {page,context}=await open({width:360,height:800});await load(page,scene);
      const n=await page.evaluate(()=>Object.keys(__dbg.PARTS).length);assert.ok(n>0);
      assert.equal(await page.evaluate(()=>__qaEvidence.contextLost),0);await context.close();
      console.log('SMOKE:',scene,n,'parts');
    }
    pass('K: All other 19 scenes load and render without context loss',otherScenes);
    assert.deepEqual(errors,[],JSON.stringify(errors));pass('No new browser JS, console, HTTP or WebGL context errors',{errors:0,knownOriginalIssues,warnings:[...new Set(warnings)]});
    protectedFiles();if(CANDIDATE)candidateScope();pass(CANDIDATE?'Protected original files and frozen artifacts unchanged after QA':'Original files remain byte-identical after QA');
    const report={status:'PASS',mode:PHASE3?'candidate-phase3':PHASE2?'candidate-phase2':CANDIDATE?'candidate-phase1':'full',baselineCommit:BASE,qaScriptSHA256:scriptSHA256,environment,checks,inputs,audio,errors,knownOriginalIssues,warnings:[...new Set(warnings)],
      boundaries:['No HarmonyOS physical-device test','Software-rendered Chromium, not mobile GPU performance proof','Native MP3 playback/decoding observed; no human speaker/ear listening test','Other 19 scenes: loading smoke only'],
      screenshotComparison:'Structure, layout, camera, scene state and mesh ownership must match; PNG hashes identify artifacts, not a pixel-only correctness decision'};
    fs.writeFileSync(path.join(OUT,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
    if(RECORD){
      fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({baselineCommit:BASE,environment,protectedFiles:originalFiles,captures},null,2)+'\n');
      fs.cpSync(OUT,BASEDIR,{recursive:true,errorOnExist:true,force:false});
    }
    else assert.equal(captures.length,existing.captures.length);
    console.log('QA PASS. Evidence:',RECORD?BASEDIR:OUT);
  } finally {
    if(browser)await browser.close();if(server)server.kill('SIGTERM');
  }
}
run().catch(e=>{console.error('QA FAILED:',e.stack||e);process.exitCode=1;});
