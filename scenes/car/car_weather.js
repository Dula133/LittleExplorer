/* 汽车架构模块：由 car.js 组装，文件加载时不创建模型或播放声音。 */
(function(M){
const RAIN_PROFILES=Object.freeze({
  NONE:Object.freeze({count:0,speedMin:0,speedMax:0,opacity:0,gloom:0}),
  LIGHT:Object.freeze({count:80,speedMin:7,speedMax:9,opacity:.42,gloom:.22}),
  MEDIUM:Object.freeze({count:190,speedMin:8.5,speedMax:11.5,opacity:.62,gloom:.55}),
  HEAVY:Object.freeze({count:360,speedMin:10.5,speedMax:14.5,opacity:.82,gloom:1})
});
M.RAIN_PROFILES=RAIN_PROFILES;
const {RAIN_LEVELS,WIPER_MODES}=M.modes,setMode=M.setMode;
M.createWeather=function(C,now,api){
let view=null;
const weather={
  levels:RAIN_LEVELS,wiperModes:WIPER_MODES,
  setRainLevel(level){C.rainLevel=setMode(level,RAIN_LEVELS,'rain level');return this.getState();},
  setWiperMode(mode){C.wiperMode=setMode(mode,WIPER_MODES,'wiper mode');return this.getState();},
  demonstrateMist(){C.mistTarget=1;return this.getState();},
  getState(){const p=RAIN_PROFILES[C.rainLevel];return {rainLevel:C.rainLevel,wiperMode:C.wiperMode,dropCount:p.count,speedMin:p.speedMin,speedMax:p.speedMax,mist:C.mist};}
};
weather.createRain=function(ctx){const {THREE}=ctx;
    const RAIN_N=RAIN_PROFILES.HEAVY.count,rainX=new Float32Array(RAIN_N),rainY=new Float32Array(RAIN_N),rainZ=new Float32Array(RAIN_N),rainV=new Float32Array(RAIN_N),_rm=new THREE.Matrix4();
    for(let i=0;i<RAIN_N;i++){rainX[i]=(Math.random()-.5)*12;rainZ[i]=(Math.random()-.5)*10;rainY[i]=Math.random()*7;rainV[i]=Math.random();}
    const rain=new THREE.InstancedMesh(new THREE.BoxGeometry(.018,.6,.018),new THREE.MeshBasicMaterial({color:0xF4FAFF,transparent:true,opacity:0,depthWrite:false}),RAIN_N);
    rain.visible=false;rain.frustumCulled=false;rain.castShadow=false;ctx.scene.add(rain);

 return {rain,rainX,rainY,rainZ,rainV,_rm};
};
weather.bindView=function(refs){if(view)throw new Error('weather view already bound');view=refs;};
weather.update=function(dt,t){
 const S=api.S,{rainView,sweeps,mistLayer,WIPE_REST,WIPE_SWEEP}=view;
 const {rain,rainX,rainY,rainZ,rainV,_rm}=rainView;
      // 雨 + 雨刮
      const rainProfile=RAIN_PROFILES[C.rainLevel],raining=C.rainLevel!==RAIN_LEVELS.NONE,wiping=C.wiperMode!=='OFF';
      C.rain+=((raining?1:0)-C.rain)*Math.min(1,dt*2);C.wipe+=((wiping?1:0)-C.wipe)*Math.min(1,dt*3);
      rain.count=rainProfile.count;rain.visible=rainProfile.count>0&&C.rain>.01;rain.material.opacity=rainProfile.opacity*C.rain;S.gloom=rainProfile.gloom*C.rain;
      if(rain.visible){for(let i=0;i<rainProfile.count;i++){const speed=rainProfile.speedMin+(rainProfile.speedMax-rainProfile.speedMin)*rainV[i];let y=rainY[i]-speed*dt;if(y<0){y+=7;rainX[i]=(Math.random()-.5)*12;rainZ[i]=(Math.random()-.5)*10;}rainY[i]=y;_rm.makeTranslation(rainX[i],y,rainZ[i]);rain.setMatrixAt(i,_rm);}rain.instanceMatrix.needsUpdate=true;}
      if(C.defog){C.mistTarget=Math.max(0,C.mistTarget-dt*.24);}C.mist+=(C.mistTarget-C.mist)*Math.min(1,dt*2);mistLayer.material.opacity=C.mist*.65;mistLayer.visible=C.mist>.01;
      const wipeRate=C.wiperMode===WIPER_MODES.FAST?7.4:(C.wiperMode===WIPER_MODES.SLOW?4.2:0);if(C.wipe>.01&&wipeRate)C.wipePh+=dt*wipeRate*C.wipe;const wa=(.5-.5*Math.cos(C.wipePh))*Math.min(1,C.wipe*1.2);for(const sw of sweeps)sw.rotation.z=WIPE_REST-WIPE_SWEEP*wa;
};
return weather;
};
})(window.LECar=window.LECar||{});
