/* Fast, renderer-independent compatibility checks. No output files are created.
   node tools/qa_car_state.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
let time=1000;
const sandbox={performance:{now:()=>time},console,setTimeout,clearTimeout};sandbox.window=sandbox;
vm.createContext(sandbox);
const manifest=path.join(__dirname,'scene_deps.json');
const deps=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest,'utf8')).car||[]:[];
for(const file of [...deps,'scenes/car.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
const car=sandbox.SCENES.car,plain=value=>JSON.parse(JSON.stringify(value));
const expected=['engine','tank','battery','shaft','wheels','exhaust','door','doorHandleleft','doorHandleright','windowleft','windowright','lockleft','lockright','speakerleft','speakerright','steer','horn','instruments','turnStalk','turnControlLeft','turnControlRight','lampKnob','hazard','rainControl','wiperControl','fogControl','start','gearControl','infotainment','screenMap','screenMusic','screenClimate','musicPlay','volumeControl','climateControl','temperatureDown','temperatureUp','fanControl','defogControl','mistControl','dayNightControl','cupHolder','armrest','brakePedal','accelerator','wiper','mirror','belt','seat','body','lights','positionLights','fogLights','turnLeft','turnRight','tail'];
assert.deepEqual(plain(car.order),expected);
assert.equal(new Set(car.order).size,56);
for(const zone of Object.values(car.cockpitControls))for(const id of zone.parts)assert.ok(expected.includes(id));
assert.equal(car.controls.getState().gearMode,'P');assert.equal(car.lighting.getState().lampMode,'OFF');
for(const [mode,position,headlight]of [['POSITION',true,false],['HEADLIGHT',true,true],['OFF',false,false]]){
 const s=car.lighting.setLampMode(mode);assert.deepEqual(plain(s.display),{position,headlight,demo:false});
}
for(const mode of ['LEFT','RIGHT','HAZARD','OFF'])assert.equal(car.lighting.setTurnMode(mode).turnMode,mode);
car.lighting.triggerBrake(1000);time=1500;car.lighting.triggerBrake(100);time=1999;assert.ok(car.lighting.getState().brakeActive);time=2000;assert.ok(!car.lighting.getState().brakeActive);
for(const [level,count]of [['NONE',0],['LIGHT',80],['MEDIUM',190],['HEAVY',360]]){
 car.weather.setWiperMode('FAST');const s=car.weather.setRainLevel(level);assert.equal(s.dropCount,count);assert.equal(s.wiperMode,'FAST');
}
car.controls.setTemperature(26);assert.throws(()=>car.controls.setTemperature(28),/temperature/);assert.equal(car.controls.getState().temperature,26);
car.controls.setFanLevel(3);assert.equal(car.controls.getState().climateOn,true);car.controls.setClimate(false);assert.equal(car.controls.getState().fanLevel,0);
assert.throws(()=>car.lighting.setTurnMode('BOTH'),/turn mode/);assert.equal(car.lighting.getState().turnMode,'OFF');
assert.throws(()=>car.weather.setRainLevel('STORM'),/rain level/);
console.log('PASS: 56 part IDs, zone references, initial modes, light semantics, brake deadline, independent rain/wipers, bounded controls');
// Factories must isolate state and bind vehicle ports once; enabled once migration supplies them.
if(sandbox.LECar){
 const api=()=>({S:{drive:false,nightT:0},now:()=>time,sfx:{isMuted:()=>true},caption(){}});
 const a=sandbox.LECar.createRuntime(api()),b=sandbox.LECar.createRuntime(api());
 const doors=[{userData:{driverDoor:true,open:0}},{userData:{driverDoor:false,open:0}}],windows=[{userData:{windowSide:'left',windowLevel:0}}];
 a.controls.bindVehicle({doorPivots:doors,frontWindows:windows,driverDoor:doors[0]});
 assert.throws(()=>a.controls.bindVehicle({doorPivots:doors,frontWindows:windows}),/already bound/);
 a.lighting.setLampMode('HEADLIGHT');a.weather.setRainLevel('HEAVY');a.controls.setWindow('left',1);
 assert.equal(b.lighting.getState().lampMode,'OFF');assert.equal(b.weather.getState().rainLevel,'NONE');
 assert.equal(a.controls.getState().windows.left,1);
 a.api.S.drive=true;a.controls.setGearMode('D');assert.equal(a.controls.getState().moving,true);assert.equal(a.controls.toggleDoor(doors[0]),false);
 a.controls.setGearMode('P');a.controls.setLocked(true);assert.equal(a.controls.toggleDoor(doors[0]),false);
 a.controls.setLocked(false);assert.equal(a.controls.toggleDoor(doors[0]),true);
 a.controls.setGearMode('D');assert.equal(doors[0].userData.open,0);
 console.log('PASS: isolated runtimes, single port binding, window source, gear/door/lock invariants');
}
// Audio policy uses fake primitives so finite alerts and preview silence are deterministic.
if(sandbox.LECar?.createAudio){
 let beeps=0,horns=0,captions=0,muted=false;const hornCalls=[];
 const sfx={wantLoop:null,isMuted:()=>muted,tone(f,d,type,g){if(f===1120)beeps++;else{hornCalls.push({f,d,type,g});if(f===420)horns++;}},loop(name){this.wantLoop=name;},stopLoop(){this.wantLoop=null;}};
 const api={S:{drive:false,nightT:0},now:()=>time,sfx,caption(){captions++;}};
 const r=sandbox.LECar.createRuntime(api),door={userData:{driverDoor:true,open:1}};
 r.lighting.setLampMode('POSITION');r.audio.sync(time,door);
 for(let i=0;i<10;i++){time+=250;r.audio.sync(time,door);}
 assert.equal(beeps,3);assert.equal(captions,1);
 door.userData.open=0;r.audio.sync(time,door);door.userData.open=1;r.audio.sync(time,door);
 r.lighting.setLampMode('OFF');time+=250;r.audio.sync(time,door);assert.equal(beeps,3);
 r.audio.pressHorn();r.audio.pressHorn();assert.equal(horns,1);time+=500;r.audio.pressHorn();assert.equal(horns,2);assert.equal(hornCalls.length,4);assert.ok(hornCalls.every(x=>x.type==='triangle'&&x.d===.22&&x.g>0&&x.g<=.055));
 r.controls.setVolumeLevel(0);time+=500;r.audio.pressHorn();assert.equal(horns,2);r.controls.setVolumeLevel(3);muted=true;time+=500;r.audio.pressHorn();assert.equal(horns,2);
 r.weather.setRainLevel('HEAVY');r.audio.sync(time,door);assert.equal(sfx.wantLoop,'water');
 api.S.drive=true;r.audio.sync(time,door);assert.equal(sfx.wantLoop,null);
 sfx.wantLoop='engine';r.audio.sync(time,door);assert.equal(sfx.wantLoop,'engine');
 const preview=sandbox.LECar.createRuntime(api,{preview:true});preview.lighting.setLampMode('HEADLIGHT');preview.controls.setMusic(true);
 preview.audio.sync(time,door);preview.audio.pressHorn();preview.audio.startReminder(door);
 assert.equal(horns,2);assert.equal(captions,2);assert.equal(preview.audio.getMusicState().active,false);
 console.log('PASS: finite door alert, immediate lamp-off cancellation, horn debounce, rain/engine priority, silent previews');
}
