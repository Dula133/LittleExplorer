#!/usr/bin/env node
'use strict';
// Reuse every existing Phase 3 behavior/voice/render assertion unchanged.
// Only replace its old branch/scope gate and mask the authorized new navigation.
const assert=require('node:assert/strict');
const phase3=require('./qa_car_simple_plus_phase3.cjs');
phase3.scope=require('./qa_cockpit_desktop_v3.cjs').scope;
const phase2=require('./qa_car_simple_plus_phase2.cjs');
// Playwright serializes this function into the page: embed the original pure
// observation function verbatim, then append exactly one measured link region.
const original=phase2.masks.toString();
phase2.masks=new Function(`const regions=(${original})();
 const el=document.querySelector('#cockpit-entry');
 if(el){const r=el.getBoundingClientRect();
  if(r.width!==74||r.height!==62)throw Error('Unexpected cockpit entry dimensions');
  regions.push({kind:'cockpit-navigation',id:'cockpit-entry',rect:[Math.max(0,Math.floor(r.left-28)),Math.max(0,Math.floor(r.top-12)),Math.min(innerWidth,Math.ceil(r.right+28)),Math.min(innerHeight,Math.ceil(r.bottom+32))]});}
 return regions;`);
assert.ok(!process.argv.includes('--record-baseline'),'Never replace frozen evidence');
process.argv.push('--candidate-phase3');
if(process.argv.includes('--resume-media-scenes'))resume();else require('./qa_car_simple_plus.cjs');
function resume(){
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
 const root=path.resolve(__dirname,'..'),out=process.env.LE_QA_OUT;
 assert.ok(out,'An explicit output directory is required for a partial resume');fs.mkdirSync(out,{recursive:true});
 const filename=path.join(__dirname,'qa_car_simple_plus.cjs');let source=fs.readFileSync(filename,'utf8');
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 const originalRunnerSHA256=sha(source),originalUI=phase2.ui.toString();
 const a=originalUI.indexOf('  for(const viewport of ['),b=originalUI.indexOf('  // Real original MP3 locks');assert.ok(a>0&&b>a);
 const lockFile=path.join(out,'ui-touch-evidence.json');let reuseLocks=false;
 if(fs.existsSync(lockFile)){const old=JSON.parse(fs.readFileSync(lockFile));assert.deepEqual(old.audioLock.map(x=>x.part),['lights','wiper']);for(const e of old.audioLock){assert.ok(e.locked.length&&e.locked.every(Boolean)&&e.ended&&e.usableAfterNarration);assert.ok(e.media.some(m=>m.type==='playing'&&m.trusted));assert.ok(e.media.some(m=>m.type==='ended'&&m.trusted&&m.time>0));}reuseLocks=true;}
 const playbackOriginal=phase3.playback.toString(),playbackResume=playbackOriginal.replace('new Date(time+100)','new Date(time+1000)').replace("console.log('PLAYED:',voice,key);","console.log('PLAYED:',voice,key);fs.writeFileSync(path.join(OUT,'phase3-in-progress.json'),JSON.stringify({status:'IN_PROGRESS',evidence},null,2)+String.fromCharCode(10));");
 phase3.playback=new Function('fs','path','assert','mapping','contract','return ('+playbackResume+');')(fs,path,assert,root=>JSON.parse(fs.readFileSync(path.join(root,'voice/lines.json'))),root=>require(path.join(root,'tools/qa_car_simple_plus.phase2.json')).voiceGaps);
 const reuseAudio=process.argv.includes('--reuse-unchanged-phase3-audio');
 if(reuseAudio){phase3.playback=async function({ROOT,OUT,pass}){
  require('./qa_cockpit_desktop_v3.cjs').scope();
  const priorPath=path.join(ROOT,'docs/qa/simple-plus-phase3/phase3-playback.json'),prior=JSON.parse(fs.readFileSync(priorPath));
  const priorQAPath=path.join(ROOT,'docs/qa/simple-plus-phase3/qa-report.json'),priorQA=JSON.parse(fs.readFileSync(priorQAPath));
  const lines=JSON.parse(fs.readFileSync(path.join(ROOT,'voice/lines.json'))),expected=require('./qa_car_simple_plus.phase2.json').voiceGaps;
  assert.equal(prior.status,'PASS');assert.equal(priorQA.status,'PASS');assert.deepEqual(priorQA.errors,[]);
  const coverage=[];for(const voice of ['yunxia','xiaoyi']){const seen=new Set(),entries=prior.evidence.filter(e=>e.voice===voice);
   for(const e of entries){const suffix='/voice/'+voice+'/'+lines[e.key]+'.mp3';assert.ok(e.events.some(m=>m.type==='playing'&&m.trusted&&m.src.endsWith(suffix)));assert.ok(e.events.some(m=>m.type==='ended'&&m.trusted&&m.time>0&&m.src.endsWith(suffix)));assert.deepEqual(e.fallback,[]);seen.add(e.key);}
   for(const key of expected)assert.ok(seen.has(key));coverage.push({voice,keys:expected.length,nativeSamples:entries.length});}
  const integrationPath=path.join(ROOT,'docs/qa/cockpit-desktop-v3/cockpit-report.json'),integration=JSON.parse(fs.readFileSync(integrationPath));
  assert.equal(integration.status,'PASS');assert.equal(integration.testedSHA256['pages/car.html'],sha(fs.readFileSync(path.join(ROOT,'pages/car.html'))));
  for(const label of ['roundtrip-1280','roundtrip-390']){const e=integration.media.find(e=>e.label===label);assert.ok(e.events.some(m=>m.type==='ended'&&m.trusted&&m.time>0&&m.src.includes('/voice/xiaoyi/')));assert.deepEqual(integration.speech.find(e=>e.label===label).utterances,[]);}
  const summary={status:'REUSED_IMMUTABLE_BASELINE_PASS',base:'cfbe268081a094050152054d26f70297b58da385',coverage,priorPlaybackSHA256:sha(fs.readFileSync(priorPath)),priorFullQASHA256:sha(fs.readFileSync(priorQAPath)),freshIntegrationSHA256:sha(fs.readFileSync(integrationPath)),reason:'All original runtime code, mappings and 638 MP3s match the pinned base. The car HTML only adds the verified navigation link. Fresh round-trip and original native audio-lock checks passed. No claim that all 40 clips were replayed in this resume.'};
  fs.writeFileSync(path.join(OUT,'reused-phase3-audio.json'),JSON.stringify(summary,null,2)+String.fromCharCode(10));pass('Reused unchanged Phase 3 native two-voice / 20-key playback evidence',summary);
 };}
 const remainingUI=(originalUI.slice(0,a)+originalUI.slice(b)).replace("    await page.waitForFunction(()=>__qaEvidence.media.some(e=>e.type==='ended')","    await page.clock.resume();\n    await page.waitForFunction(()=>__qaEvidence.media.some(e=>e.type==='ended')");
 phase2.ui=new Function('fs','path','assert','return ('+remainingUI+');')(fs,path,assert);
 const start=source.indexOf('    // Homepage uses the original card renderer;'),end=source.indexOf('    if(PHASE3)await phase3.playback');assert.ok(start>0&&end>start);
 source=source.slice(0,start)+`    // Resume only cases not completed by the prior run.
    // Freeze input preparation so the moving real camera cannot race a ray hit;
    // resume the browser clock before waiting for actual playing/ended events.
    async function stableTapPart(page,...args){
      const now=await page.evaluate(()=>Date.now());await page.clock.pauseAt(new Date(now+1000));
      try{await tapPart(page,...args);}finally{await page.clock.resume();}
    }
    async function preparePausedTapPart(page,...args){const now=await page.evaluate(()=>Date.now());await page.clock.pauseAt(new Date(now+1000));await tapPart(page,...args);await page.clock.fastForward(50);}
    if(PHASE2){if(${reuseLocks})pass('Reused completed native MP3 lock evidence',${JSON.stringify({file:'ui-touch-evidence.json',sha256:reuseLocks?sha(fs.readFileSync(lockFile)):null})});else await phase2.ui({open,load,step,tapPart:preparePausedTapPart,tap,pass,OUT,ROOT});}
`+source.slice(end);
 source=source.replace('if(!VISUAL&&!UI_ONLY){','if(false){');
 source=source.replace('phase3.playback({open,load,tapPart,tap,pass,OUT,ROOT,pickPoint})','phase3.playback({open,load,tapPart:stableTapPart,tap,pass,OUT,ROOT,pickPoint})');
 source=source.replace("mode:PHASE3?'candidate-phase3'", "mode:PHASE3?'candidate-phase3-resume-media-scenes'");
 source=source.replace('else assert.equal(captures.length,existing.captures.length);', '// No captures are re-created in this explicit partial resume.');
 fs.writeFileSync(path.join(out,'resume-provenance.json'),JSON.stringify({originalRunnerSHA256,originalPlaybackSHA256:sha(playbackOriginal),adaptedPlaybackSHA256:sha(phase3.playback.toString()),reuseUnchangedPhase3Audio:reuseAudio,reusedCompleteLockEvidence:reuseLocks,compiledRunnerSHA256:sha(source),originalUI_SHA256:sha(originalUI),remainingUI_SHA256:sha(remainingUI),wrapperSHA256:sha(fs.readFileSync(__filename)),scope:'Remaining Phase 2 native MP3 lock tests, Phase 3 two-voice/20-key native playback, all 19 scene smoke checks, browser errors and base protection. Prior completed assertions are not rerun.',timing:'Only ray-hit preparation and the disabled-control assertion pause rendering/JS time; native media continues in real time. Clock resumes before awaiting real ended.'},null,2)+'\n');
 fs.writeFileSync(path.join(out,'compiled-runner.cjs.txt'),source);
 const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);
}
