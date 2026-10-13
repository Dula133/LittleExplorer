/* Compare migration geometry against the pre-refactor commit without rendering.
   NODE_PATH=<playwright-core parent> node tools/qa_car_geometry.cjs
   LE_QA_BASELINE may override the pinned baseline. No output files or server needed. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),baseline=process.env.LE_QA_BASELINE||'d132f97128ef0a40dc97897c4730c3c56eaae3a4';
(async()=>{
 const legacy=execFileSync('git',['show',baseline+':scenes/car.js'],{cwd:root,encoding:'utf8'});
 const browser=await chromium.launch({executablePath:process.env.LE_QA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  const deps=JSON.parse(fs.readFileSync(path.join(root,'tools/scene_deps.json'),'utf8')).car;
  for(const file of ['lib/three.min.js','js/lib3d.js',...deps,'scenes/car.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
  const result=await page.evaluate(legacy=>{
   const current=SCENES.car;
   Function(legacy)();const old=SCENES.car;SCENES.car=current;
   function snapshot(car){
    const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
    const ctx=L3.makeCtx(scene,root),api={S:{drive:false,nightT:0,night:0,xr:0},now:()=>1000,ee:0,sfx:{},caption(){}};
    const random=Math.random;Math.random=()=>.5;
    let obj;try{obj=car.build(ctx,api,{preview:true});}finally{Math.random=random;}
    root.updateMatrixWorld(true);
    const material=m=>({type:m.type,color:m.color?.toArray(),emissive:m.emissive?.toArray(),intensity:m.emissiveIntensity,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,roughness:m.roughness,metalness:m.metalness});
    const mesh=m=>({geometry:m.geometry.type,parameters:m.geometry.parameters,positions:Array.from(m.geometry.attributes.position.array),world:m.matrixWorld.toArray(),material:material(m.material),part:m.userData.part});
    return {parts:Object.fromEntries(Object.entries(ctx.PARTS).map(([id,p])=>[id,{name:p.name,mesh:p.meshes.map(mesh)}])),placed:ctx.placed.map(o=>({home:o.userData.home.toArray(),explode:o.userData.explode.toArray()})),hits:ctx.hitTargets.length,shell:ctx.shellMeshes.length,cockpitView:obj.cockpitView};
   }
   const a=snapshot(old),b=snapshot(current);
   return {same:JSON.stringify(a)===JSON.stringify(b),before:a,after:b};
  },legacy);
  assert.deepEqual(result.after,result.before,'geometry, material, picking, placement or cockpit camera changed');
  console.log('PASS: baseline geometry/materials/world transforms/part names/placements/hit targets/shell/cockpit cameras unchanged ('+Object.keys(result.after.parts).length+' parts)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
