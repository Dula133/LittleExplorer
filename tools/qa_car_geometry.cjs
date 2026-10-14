/* Compare migration geometry against the pre-refactor commit without rendering.
   NODE_PATH=<playwright-core parent> node tools/qa_car_geometry.cjs
   --driving permits only seven declared driving parts and verifies all other geometry.
   LE_QA_BASELINE may override the pinned baseline. No output files or server needed. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const driving=process.argv.includes('--driving');
const root=path.resolve(__dirname,'..'),baseline=process.env.LE_QA_BASELINE||(driving?'edabab57fdc4aeeb149889adf412c7907a1699a5':'d132f97128ef0a40dc97897c4730c3c56eaae3a4');
(async()=>{
 const read=f=>execFileSync('git',['show',baseline+':'+f],{cwd:root,encoding:'utf8'});
 const oldDeps=driving?JSON.parse(read('tools/scene_deps.json')).car:[];
 const legacy=[...oldDeps,'scenes/car.js'].map(read).join('\n');
 const browser=await chromium.launch({executablePath:process.env.LE_QA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  const deps=JSON.parse(fs.readFileSync(path.join(root,'tools/scene_deps.json'),'utf8')).car;
  for(const file of ['lib/three.min.js','js/lib3d.js',...deps,'scenes/car.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
  const result=await page.evaluate(legacy=>{
   const current=SCENES.car,modules={...LECar};
   Function(legacy)();const old=SCENES.car;
   function snapshot(car){
    const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
    const ctx=L3.makeCtx(scene,root),api={S:{drive:false,nightT:0,night:0,xr:0},now:()=>1000,ee:0,sfx:{},caption(){}};
    const random=Math.random;Math.random=()=>.5;
    let obj;try{obj=car.build(ctx,api,{preview:true});}finally{Math.random=random;}
    root.updateMatrixWorld(true);
    const material=m=>({type:m.type,color:m.color?.toArray(),emissive:m.emissive?.toArray(),intensity:m.emissiveIntensity,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,roughness:m.roughness,metalness:m.metalness});
    const mesh=m=>({geometry:m.geometry.type,parameters:m.geometry.parameters,positions:Array.from(m.geometry.attributes.position.array),world:m.matrixWorld.toArray(),material:material(m.material),part:m.userData.part});
    return {parts:Object.fromEntries(Object.entries(ctx.PARTS).map(([id,p])=>[id,{name:p.name,mesh:p.meshes.map(mesh)}])),placed:ctx.placed.map(o=>({id:Object.entries(ctx.PARTS).find(([id,p])=>p.groups.includes(o))?.[0]||null,home:o.userData.home.toArray(),explode:o.userData.explode.toArray()})),hits:ctx.hitTargets.length,shell:ctx.shellMeshes.length,cockpitView:(()=>{const v=obj.cockpitView();return {position:v.position.toArray(),target:v.target.toArray(),fov:v.fov};})()};
   }
   const a=snapshot(old);Object.assign(LECar,modules);SCENES.car=current;const b=snapshot(current);
   return {same:JSON.stringify(a)===JSON.stringify(b),before:a,after:b};
  },legacy);
  if(driving){
   const allowed=new Set(['steer','horn','instruments','turnStalk','turnControlLeft','turnControlRight','wiperControl']);
   for(const [id,p]of Object.entries(result.before.parts))if(!allowed.has(id))assert.deepEqual(result.after.parts[id],p,'unexpected geometry change: '+id);
   for(const id of allowed)assert.notDeepEqual(result.after.parts[id],result.before.parts[id],id+' should improve');
   assert.deepEqual(result.after.placed.filter(p=>p.id!=='steer'),result.before.placed.filter(p=>p.id!=='steer'));
   assert.equal(result.after.shell,result.before.shell);
   const expected={position:[-1.62,1.60,-.34],target:[.60,1.12,-.24],fov:76};assert.equal(result.after.cockpitView.fov,expected.fov);for(const k of ['position','target'])expected[k].forEach((v,i)=>assert.ok(Math.abs(result.after.cockpitView[k][i]-v)<1e-12));
   console.log('PASS: driving geometry changes limited to seven declared parts; all other geometry/materials/placement/shell unchanged');
   return;
  }
  assert.deepEqual(result.after,result.before,'geometry, material, picking, placement or cockpit camera changed');
  console.log('PASS: baseline geometry/materials/world transforms/part names/placements/hit targets/shell/cockpit cameras unchanged ('+Object.keys(result.after.parts).length+' parts)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
