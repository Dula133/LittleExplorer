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
lighting.effectiveLampState=effectiveLampState;return lighting;
};
})(window.LECar=window.LECar||{});
