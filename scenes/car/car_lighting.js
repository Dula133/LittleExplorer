/* 汽车架构模块：由 car.js 组装，文件加载时不创建模型或播放声音。 */
(function(M){
const {LAMP_MODES,TURN_MODES}=M.modes,setMode=M.setMode;
M.createLighting=function(C,now){
const effectiveLampState=(t=now())=>{
  const demo=t<C.lightsUntil;
  const headlight=C.lampMode===LAMP_MODES.HEADLIGHT||demo;
  return {position:C.lampMode!==LAMP_MODES.OFF||headlight,headlight,demo};
};
const lighting={
  modes:{lamp:LAMP_MODES,turn:TURN_MODES},
  setLampMode(mode){C.lampMode=setMode(mode,LAMP_MODES,'lamp mode');C.lightsUntil=0;if(C.lampMode===LAMP_MODES.OFF){C.lightReminderBeeps=0;C.lightReminderCondition=false;}return this.getState();},
  setTurnMode(mode){const next=setMode(mode,TURN_MODES,'turn mode');if(next!==C.turnMode){C.turnMode=next;C.turnEpoch=now();}return this.getState();},
  triggerBrake(duration=3000){const ms=Number(duration);if(!Number.isFinite(ms)||ms<0)throw new RangeError(`brake duration: ${duration}`);C.brakeUntil=Math.max(C.brakeUntil,now()+ms);return this.getState();},
  setFogLight(on){C.fogLight=!!on;return this.getState();},
  getState(){const display=effectiveLampState();return {lampMode:C.lampMode,turnMode:C.turnMode,fogLight:C.fogLight,brakeActive:now()<C.brakeUntil,reminderActive:C.lightReminderCondition,display};}
};
lighting.update=function(dt,t,night,{lamps,beams,positionLamps,fogLamps,fogBeams,fogSpots,turnLamps,spots,tailLights}){
 const lampDisplay=effectiveLampState(t);
 C.lights+=((lampDisplay.headlight?1:0)-C.lights)*Math.min(1,dt*6);C.position+=((lampDisplay.position?1:0)-C.position)*Math.min(1,dt*8);
      for(const l of lamps)l.userData.dynInt=(1.6+1.6*night)*C.lights;for(const b of beams)b.material.opacity=(.32+.3*night)*C.lights;
      for(const l of positionLamps)l.userData.dynInt=1.35*C.position;
      C.fog+=((C.fogLight?1:0)-C.fog)*Math.min(1,dt*8);for(const l of fogLamps)l.userData.dynInt=1.8*C.fog;for(const b of fogBeams)b.material.opacity=.2*C.fog;for(const sp of fogSpots)sp.intensity=1.35*C.fog;
      const blinkOn=C.turnMode!==TURN_MODES.OFF&&((t-C.turnEpoch)%900)<450;
      for(const side of [TURN_MODES.LEFT,TURN_MODES.RIGHT]){const sideOn=blinkOn&&(C.turnMode===side||C.turnMode===TURN_MODES.HAZARD);for(const l of turnLamps[side])l.userData.dynInt=sideOn?2.6:0;}
      for(const sp of spots)sp.intensity=C.lights*night*2.6;C.brake+=(((t<C.brakeUntil)?1:0)-C.brake)*Math.min(1,dt*8);for(const tl of tailLights)tl.userData.dynInt=.5+1.0*night+2.4*C.brake;
 return {lampDisplay,blinkOn};
};
lighting.effectiveLampState=effectiveLampState;return lighting;
};
})(window.LECar=window.LECar||{});
