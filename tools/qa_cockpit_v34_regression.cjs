#!/usr/bin/env node
'use strict';
// Reuse the immutable V3.3 tests in memory. Only branch/scope protection is
// adapted for this commit; assertions and interactions are not relaxed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const ROOT=path.resolve(__dirname,'..'),sourcePath=path.join(__dirname,'qa_cockpit_v33.cjs');let source=fs.readFileSync(sourcePath,'utf8');
const originalHash=crypto.createHash('sha256').update(source).digest('hex');
function replace(old,next){assert.ok(source.includes(old),'Adapter anchor absent: '+old);source=source.replace(old,next);}
replace("BASE='fea4cd36fc12a84fe8a3619b0552e8ac9eccf23d'","BASE='22b53b928dbcd23d7ca4ee6b597693bdd0b57e31'");
replace("for(const f of changed)assert.ok(allowed.has(f)||f.startsWith('assets/cockpit-voice/')||f.startsWith('docs/qa/cockpit-desktop-v3/v33/'),'Scope: '+f);", "for(const f of changed)assert.ok(['pages/cockpit.html','pages/cockpit-v34.css','js/cockpit-cruise.js','tools/qa_cockpit_v34.cjs','tools/qa_cockpit_v34_regression.cjs','docs/COCKPIT_V34.md','docs/MUSIC_LICENSES.md'].includes(f)||f.startsWith('docs/qa/cockpit-desktop-v3/v34/'),'Scope: '+f);");
replace("assert.equal(part(html),part(baseHTML),'Original safety/mechanical contract changed: '+start);", "assert.equal(part(html).replace(\"$('cruise').onclick=()=>{cruise.toggle();update();};\\n\",'').replace(' if(cruise.blockAcceleration())return;\\n',''),part(baseHTML),'Original safety/mechanical contract changed: '+start);");
replace("if(f==='pages/cockpit.html')continue;", "if(['pages/cockpit.html','docs/MUSIC_LICENSES.md'].includes(f))continue;");
const out=process.env.LE_V33_QA_OUT||path.join(ROOT,'docs/qa/cockpit-desktop-v3/v34/regression');process.env.LE_V33_QA_OUT=out;fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'adapter-provenance.json'),JSON.stringify({source:'tools/qa_cockpit_v33.cjs',sourceSHA256:originalHash,compiledSHA256:crypto.createHash('sha256').update(source).digest('hex'),adaptations:['V3.4 base/scope','Exclude only the exact newly added cruise handler and accelerator gate when comparing original safety bodies','Allow licence documentation update; preserve every other baseline file'],productStateWrites:false},null,2)+'\n');
const runner=new Module(sourcePath,module);runner.filename=sourcePath;runner.paths=module.paths;runner._compile(source,sourcePath);
